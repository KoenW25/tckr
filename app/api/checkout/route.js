import { createClient } from '@supabase/supabase-js';
import { calculateBuyerTotal } from '@/lib/fees';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { ticketId, bidId } = await request.json();

    if (!ticketId) {
      return Response.json({ error: 'ticketId is verplicht.' }, { status: 400 });
    }

    // Buyer bepalen via auth header (server-side verificatie)
    let buyerId = null;
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data } = await supabaseAuth.auth.getUser(token);
      buyerId = data?.user?.id || null;
    }

    if (!buyerId && cookieHeader) {
      const sbAccessToken = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('sb-') && c.includes('-auth-token'));
      if (sbAccessToken) {
        const token = decodeURIComponent(sbAccessToken.split('=').slice(1).join('='));
        try {
          const parsed = JSON.parse(token);
          const accessToken = parsed?.[0] || parsed?.access_token;
          if (accessToken) {
            const { data } = await supabaseAdmin.auth.getUser(accessToken);
            buyerId = data?.user?.id || null;
          }
        } catch {}
      }
    }

    console.log('[Checkout] buyerId resolved:', buyerId);

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, ask_price, status, reserved_for, reserved_until')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return Response.json(
        { error: 'Ticket niet gevonden.', detail: ticketError?.message },
        { status: 404 }
      );
    }

    let paymentPrice = ticket.ask_price;

    if (ticket.status === 'reserved') {
      if (ticket.reserved_until && new Date(ticket.reserved_until) < new Date()) {
        return Response.json(
          { error: 'De reservering voor dit ticket is verlopen.' },
          { status: 409 }
        );
      }

      if (bidId) {
        const { data: bid, error: bidError } = await supabaseAdmin
          .from('bids')
          .select('id, bid_price, status')
          .eq('id', bidId)
          .eq('ticket_id', ticketId)
          .eq('status', 'accepted')
          .single();

        if (bidError || !bid) {
          return Response.json(
            { error: 'Geaccepteerd bod niet gevonden.' },
            { status: 404 }
          );
        }

        paymentPrice = bid.bid_price;
      }
    } else if (ticket.status !== 'available') {
      return Response.json(
        { error: 'Dit ticket is niet meer beschikbaar.' },
        { status: 409 }
      );
    }

    if (paymentPrice == null || paymentPrice <= 0) {
      return Response.json(
        { error: 'Dit ticket heeft geen geldige prijs.' },
        { status: 400 }
      );
    }

    const totalAmount = calculateBuyerTotal(paymentPrice);
    const mollieApiKey = process.env.MOLLIE_API_KEY;

    if (!mollieApiKey) {
      console.error('MOLLIE_API_KEY is not set');
      return Response.json(
        { error: 'Betalingsconfiguratie ontbreekt.' },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      request.headers.get('origin') ||
      request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
      'http://localhost:3000';

    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    const molliePayload = {
      amount: {
        currency: 'EUR',
        value: totalAmount.toFixed(2),
      },
      description: `Tckr – Ticket #${ticket.id}`,
      redirectUrl: `${baseUrl}/betaling/succes`,
      metadata: {
        ticketId: ticket.id,
        buyerId: buyerId,
      },
    };

    if (!isLocalhost) {
      molliePayload.webhookUrl = `${baseUrl}/api/payments/webhook`;
    }

    console.log('[Checkout] Mollie payload metadata:', JSON.stringify(molliePayload.metadata));

    const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(molliePayload),
    });

    const mollieData = await mollieRes.json();

    if (!mollieRes.ok) {
      console.error('Mollie error:', mollieData);
      return Response.json(
        {
          error:
            mollieData?.detail ||
            'Er ging iets mis bij het aanmaken van de betaling.',
        },
        { status: 502 }
      );
    }

    return Response.json({ checkoutUrl: mollieData._links.checkout.href });
  } catch (err) {
    console.error('Checkout API error:', err);
    return Response.json(
      { error: 'Er ging iets mis bij het verwerken van je bestelling.' },
      { status: 500 }
    );
  }
}
