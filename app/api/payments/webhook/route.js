import { createClient } from '@supabase/supabase-js';
import { sendBuyerConfirmationEmail, sendSellerNotificationEmail } from '@/lib/email';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.text();
    console.log('[Mollie Webhook] Raw body:', body);

    const params = new URLSearchParams(body);
    const paymentId = params.get('id');

    console.log('[Mollie Webhook] Payment ID:', paymentId);

    if (!paymentId) {
      console.error('[Mollie Webhook] No payment ID in request body');
      return new Response('OK', { status: 200 });
    }

    const mollieApiKey = process.env.MOLLIE_API_KEY;

    if (!mollieApiKey) {
      console.error('[Mollie Webhook] MOLLIE_API_KEY not set');
      return new Response('OK', { status: 200 });
    }

    console.log('[Mollie Webhook] Fetching payment from Mollie...');

    const mollieRes = await fetch(
      `https://api.mollie.com/v2/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${mollieApiKey}`,
        },
      }
    );

    if (!mollieRes.ok) {
      const errorText = await mollieRes.text();
      console.error('[Mollie Webhook] Failed to fetch payment:', mollieRes.status, errorText);
      return new Response('OK', { status: 200 });
    }

    const payment = await mollieRes.json();

    console.log('[Mollie Webhook] Payment status:', payment.status);
    console.log('[Mollie Webhook] Payment metadata:', JSON.stringify(payment.metadata));

    if (payment.status === 'paid') {
      const ticketId = payment.metadata?.ticketId;
      const buyerId = payment.metadata?.buyerId;

      if (!ticketId) {
        console.error('[Mollie Webhook] No ticketId in payment metadata');
        return new Response('OK', { status: 200 });
      }

      console.log('[Mollie Webhook] Updating ticket', ticketId, 'to sold, buyer:', buyerId);

      const updatePayload = { status: 'sold' };
      if (buyerId) {
        updatePayload.buyer_id = buyerId;
      }

      const { data, error } = await supabaseService
        .from('tickets')
        .update(updatePayload)
        .eq('id', ticketId)
        .select();

      if (error) {
        console.error('[Mollie Webhook] Supabase update error:', JSON.stringify(error));
      } else {
        console.log('[Mollie Webhook] Ticket updated successfully:', JSON.stringify(data));

        const ticket = data?.[0];
        if (ticket) {
          const eventName = ticket.event_name || 'Onbekend evenement';
          const totalAmount = payment.amount?.value || ticket.price;

          // Send buyer confirmation email
          if (buyerId) {
            const { data: buyer } = await supabaseService
              .from('profiles')
              .select('email')
              .eq('id', buyerId)
              .single();

            if (buyer?.email) {
              await sendBuyerConfirmationEmail(buyer.email, eventName, totalAmount);
              console.log('[Mollie Webhook] Buyer confirmation email sent to', buyer.email);
            }
          }

          // Send seller notification email
          if (ticket.seller_id) {
            const { data: seller } = await supabaseService
              .from('profiles')
              .select('email')
              .eq('id', ticket.seller_id)
              .single();

            const sellerAmount = ticket.price;
            if (seller?.email) {
              await sendSellerNotificationEmail(seller.email, eventName, sellerAmount);
              console.log('[Mollie Webhook] Seller notification email sent to', seller.email);
            }
          }
        }
      }
    } else {
      console.log('[Mollie Webhook] Payment not paid, status:', payment.status, '- no action taken');
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[Mollie Webhook] Unexpected error:', err);
    return new Response('OK', { status: 200 });
  }
}
