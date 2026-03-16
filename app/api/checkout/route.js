import { createClient } from '@supabase/supabase-js';
import { calculateBuyerTotal } from '@/lib/fees';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { ticketId, ticketIds, bidId } = await request.json();
    const requestedTicketIds = Array.isArray(ticketIds)
      ? [...new Set(ticketIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
      : Number.isInteger(Number(ticketId)) && Number(ticketId) > 0
        ? [Number(ticketId)]
        : [];
    const isMultiTicketCheckout = requestedTicketIds.length > 1;

    if (requestedTicketIds.length === 0) {
      return Response.json({ error: 'ticketId of ticketIds is verplicht.' }, { status: 400 });
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

    const { data: ticketsData, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select('id, ask_price, status, reserved_for, reserved_until, user_id')
      .in('id', requestedTicketIds);

    if (ticketsError) {
      return Response.json(
        { error: 'Ticket niet gevonden.', detail: ticketsError?.message },
        { status: 404 }
      );
    }
    const ticketsById = new Map((ticketsData ?? []).map((ticket) => [Number(ticket.id), ticket]));
    const tickets = requestedTicketIds.map((id) => ticketsById.get(id)).filter(Boolean);
    if (tickets.length !== requestedTicketIds.length) {
      return Response.json({ error: 'Een of meer tickets zijn niet gevonden.' }, { status: 404 });
    }

    if (buyerId && tickets.some((ticket) => ticket.user_id === buyerId)) {
      return Response.json(
        { error: 'Je kan je eigen ticket niet kopen' },
        { status: 403 }
      );
    }

    let lineItemPrices = tickets.map((ticket) => Number(ticket.ask_price));

    if (isMultiTicketCheckout) {
      if (tickets.some((ticket) => ticket.status !== 'available')) {
        return Response.json(
          { error: 'Een of meer tickets zijn niet meer beschikbaar.' },
          { status: 409 }
        );
      }
    } else {
      const ticket = tickets[0];
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
            .eq('ticket_id', ticket.id)
            .eq('status', 'accepted')
            .single();

          if (bidError || !bid) {
            return Response.json(
              { error: 'Geaccepteerd bod niet gevonden.' },
              { status: 404 }
            );
          }

          lineItemPrices = [Number(bid.bid_price)];
        }
      } else if (ticket.status !== 'available') {
        return Response.json(
          { error: 'Dit ticket is niet meer beschikbaar.' },
          { status: 409 }
        );
      }
    }

    if (lineItemPrices.some((price) => !Number.isFinite(price) || price <= 0)) {
      return Response.json(
        { error: 'Een of meer tickets hebben geen geldige prijs.' },
        { status: 400 }
      );
    }

    const totalAmount = lineItemPrices.reduce((sum, price) => sum + calculateBuyerTotal(price), 0);
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
      description:
        tickets.length === 1
          ? `Tckr – Ticket #${tickets[0].id}`
          : `Tckr – ${tickets.length} tickets`,
      redirectUrl: `${baseUrl}/betaling/succes`,
      metadata: {
        ticketId: tickets[0].id,
        ticketIds: tickets.map((ticket) => ticket.id).join(','),
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
