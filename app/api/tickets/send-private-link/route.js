import { createClient } from '@supabase/supabase-js';
import { calculateBuyerTotal } from '@/lib/fees';
import { sendPrivateSaleEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resolveUserFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

function getBaseUrl(request) {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    request.headers.get('origin') ||
    request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
    'http://localhost:3000'
  );
}

export async function POST(request) {
  try {
    const actor = await resolveUserFromRequest(request);
    if (!actor?.id) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const { ticketId } = await request.json();
    if (!ticketId) {
      return Response.json({ error: 'ticketId is verplicht.' }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('id, user_id, status, ask_price, event_name, is_private, private_buyer_email')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return Response.json({ error: 'Ticket niet gevonden.' }, { status: 404 });
    }

    if (ticket.user_id !== actor.id) {
      return Response.json({ error: 'Je bent geen eigenaar van dit ticket.' }, { status: 403 });
    }

    if (ticket.status !== 'available') {
      return Response.json({ error: 'Ticket is niet beschikbaar voor prive verkoop.' }, { status: 409 });
    }

    if (!ticket.is_private || !ticket.private_buyer_email) {
      return Response.json(
        { error: 'Dit ticket is niet ingesteld als prive verkoop met e-mailadres.' },
        { status: 400 }
      );
    }

    const askPrice = Number(ticket.ask_price);
    if (!Number.isFinite(askPrice) || askPrice <= 0) {
      return Response.json({ error: 'Ongeldige ticketprijs.' }, { status: 400 });
    }

    const mollieApiKey = process.env.MOLLIE_API_KEY;
    if (!mollieApiKey) {
      return Response.json({ error: 'Betalingsconfiguratie ontbreekt.' }, { status: 500 });
    }

    const baseUrl = getBaseUrl(request);
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    const totalAmount = calculateBuyerTotal(askPrice);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const molliePayload = {
      amount: {
        currency: 'EUR',
        value: totalAmount.toFixed(2),
      },
      description: `Tckr – Prive verkoop #${ticket.id}`,
      redirectUrl: `${baseUrl}/betaling/succes`,
      expiresAt,
      metadata: {
        ticketId: String(ticket.id),
        privateSale: 'true',
        privateBuyerEmail: String(ticket.private_buyer_email),
      },
    };

    if (!isLocalhost) {
      molliePayload.webhookUrl = `${baseUrl}/api/payments/webhook`;
    }

    const mollieRes = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(molliePayload),
    });

    const mollieData = await mollieRes.json();
    const checkoutUrl = mollieData?._links?.checkout?.href || null;

    if (!mollieRes.ok || !checkoutUrl) {
      console.error('[Private Link] Mollie create payment failed:', mollieData);
      return Response.json(
        { error: mollieData?.detail || 'Betaallink aanmaken mislukt.' },
        { status: 502 }
      );
    }

    await sendPrivateSaleEmail(
      ticket.private_buyer_email,
      ticket.event_name || 'Onbekend evenement',
      totalAmount,
      checkoutUrl
    );

    return Response.json({
      success: true,
      checkoutUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('[Private Link] Unexpected error:', error);
    return Response.json(
      { error: 'Er ging iets mis bij het versturen van de prive betaallink.' },
      { status: 500 }
    );
  }
}
