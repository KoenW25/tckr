import { createClient } from '@supabase/supabase-js';
import { sendBuyerConfirmationEmail, sendSellerNotificationEmail } from '@/lib/email';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractStoragePathFromUrl(url) {
  if (!url) return null;
  const normalized = decodeURIComponent(String(url)).trim();

  // If only raw storage path is stored (e.g. "userId/file.pdf"), use as-is.
  if (!normalized.startsWith('http')) {
    return normalized.split('?')[0].replace(/^\/+/, '');
  }

  const markers = [
    '/storage/v1/object/public/tickets/',
    '/storage/v1/object/authenticated/tickets/',
    '/storage/v1/object/sign/tickets/',
  ];
  for (const marker of markers) {
    const index = normalized.indexOf(marker);
    if (index !== -1) return normalized.substring(index + marker.length).split('?')[0];
  }

  // Generic parsing for legacy URLs where bucket may be embedded differently.
  const genericMarkers = [
    '/storage/v1/object/public/',
    '/storage/v1/object/authenticated/',
    '/storage/v1/object/sign/',
  ];
  for (const marker of genericMarkers) {
    const idx = normalized.indexOf(marker);
    if (idx === -1) continue;
    const tail = normalized.substring(idx + marker.length).split('?')[0];
    const [bucket, ...rest] = tail.split('/');
    if (bucket === 'tickets' && rest.length > 0) {
      return rest.join('/');
    }
  }

  return null;
}

function getSignedUrlExpirySeconds(eventDate) {
  const minimum = 60 * 60 * 24; // minimaal 1 dag
  if (!eventDate) return minimum;

  const eventDateObj = new Date(eventDate);
  if (Number.isNaN(eventDateObj.getTime())) return minimum;

  // Geldig t/m minimaal 1 dag na eventdatum
  const validUntil = new Date(eventDateObj);
  validUntil.setDate(validUntil.getDate() + 1);
  validUntil.setHours(23, 59, 59, 999);

  const secondsUntil = Math.ceil((validUntil.getTime() - Date.now()) / 1000);
  return Math.max(minimum, secondsUntil);
}

async function createTicketSignedUrl(pdfUrl, eventDate) {
  const storagePath = extractStoragePathFromUrl(pdfUrl);
  if (!storagePath) return null;
  const expiresIn = getSignedUrlExpirySeconds(eventDate);

  const { data, error } = await supabaseService.storage
    .from('tickets')
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn('[Mollie Webhook] Could not create signed URL:', error, '| path:', storagePath);
    return null;
  }

  return data.signedUrl;
}

async function getUserEmailById(userId) {
  if (!userId) return null;

  const { data: authData, error: authError } = await supabaseService.auth.admin.getUserById(userId);
  if (!authError && authData?.user?.email) {
    return authData.user.email;
  }

  // Fallback for projects that keep emails in public profiles.
  const { data: profileData, error: profileError } = await supabaseService
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (!profileError && profileData?.email) {
    return profileData.email;
  }

  return null;
}

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
          const totalAmount = payment.amount?.value || ticket.ask_price || ticket.price;
          const buyerUserId = buyerId || ticket.buyer_id;
          const sellerUserId = ticket.seller_id || ticket.user_id;

          if (ticket.event_id != null) {
            const soldPrice = Number(ticket.ask_price ?? ticket.price ?? payment.amount?.value ?? 0);
            const { error: txError } = await supabaseService
              .from('ticket_transactions')
              .upsert(
                {
                  payment_id: String(paymentId),
                  event_id: String(ticket.event_id),
                  ticket_id: String(ticket.id),
                  sold_price: Number.isFinite(soldPrice) ? soldPrice : 0,
                  sold_at: payment.paidAt || new Date().toISOString(),
                  buyer_id: buyerUserId || null,
                  seller_id: sellerUserId || null,
                },
                { onConflict: 'payment_id' }
              );
            if (txError) {
              console.error('[Mollie Webhook] Transaction log upsert failed:', txError);
            }
          } else {
            console.warn('[Mollie Webhook] Skipping transaction log: ticket has no event_id');
          }

          // Send buyer confirmation email
          if (buyerUserId) {
            const buyerEmail = await getUserEmailById(buyerUserId);
            if (buyerEmail) {
              const signedPdfUrl = await createTicketSignedUrl(
                ticket.pdf_url || null,
                ticket.event_date || null
              );
              await sendBuyerConfirmationEmail(
                buyerEmail,
                eventName,
                totalAmount,
                signedPdfUrl
              );
              console.log('[Mollie Webhook] Buyer confirmation email sent to', buyerEmail);
            } else {
              console.warn('[Mollie Webhook] Could not resolve buyer email for', buyerUserId);
            }
          }

          // Send seller notification email
          if (sellerUserId) {
            const sellerEmail = await getUserEmailById(sellerUserId);
            const sellerAmount = ticket.ask_price || ticket.price || totalAmount;
            if (sellerEmail) {
              await sendSellerNotificationEmail(sellerEmail, eventName, sellerAmount);
              console.log('[Mollie Webhook] Seller notification email sent to', sellerEmail);
            } else {
              console.warn('[Mollie Webhook] Could not resolve seller email for', sellerUserId);
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
