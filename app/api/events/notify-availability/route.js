import { createClient } from '@supabase/supabase-js';
import { sendEventAvailabilityAlertEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.id) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const body = await request.json();
    const ticketIds = Array.isArray(body?.ticketIds) ? body.ticketIds.map(Number).filter(Number.isInteger) : [];
    if (ticketIds.length === 0) {
      return Response.json({ error: 'Geen ticketIds ontvangen.' }, { status: 400 });
    }

    const { data: ownedTickets, error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .select('id, event_id, event_name, status, ask_price, user_id, is_private')
      .in('id', ticketIds)
      .eq('user_id', user.id)
      .eq('status', 'available')
      .not('ask_price', 'is', null);

    if (ticketsError) {
      console.error('[Event Notify] Tickets fetch failed:', ticketsError);
      return Response.json({ error: 'Tickets ophalen mislukt.' }, { status: 500 });
    }

    const publicTickets = (ownedTickets ?? []).filter((ticket) => !ticket.is_private);
    const eventIds = [...new Set(publicTickets.map((ticket) => Number(ticket.event_id)).filter(Number.isInteger))];
    if (eventIds.length === 0) {
      return Response.json({ success: true, sent: 0 });
    }

    const { data: allAvailableByEvent, error: allAvailableError } = await supabaseAdmin
      .from('tickets')
      .select('event_id, ask_price, status, is_private')
      .in('event_id', eventIds)
      .eq('status', 'available')
      .not('ask_price', 'is', null);
    if (allAvailableError) {
      console.error('[Event Notify] Aggregate fetch failed:', allAvailableError);
      return Response.json({ error: 'Aanbod ophalen mislukt.' }, { status: 500 });
    }

    const lowestAskByEventId = {};
    for (const ticket of allAvailableByEvent ?? []) {
      if (ticket?.is_private) continue;
      const eventId = Number(ticket.event_id);
      const ask = Number(ticket.ask_price);
      if (!Number.isInteger(eventId) || !Number.isFinite(ask)) continue;
      if (lowestAskByEventId[eventId] == null || ask < lowestAskByEventId[eventId]) {
        lowestAskByEventId[eventId] = ask;
      }
    }

    const ticketByEventId = {};
    for (const ticket of publicTickets) {
      const eventId = Number(ticket.event_id);
      if (!Number.isInteger(eventId) || ticketByEventId[eventId]) continue;
      ticketByEventId[eventId] = ticket;
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('event_alert_subscriptions')
      .select('id, event_id, email, is_active, notified_at')
      .in('event_id', eventIds)
      .eq('is_active', true)
      .is('notified_at', null);
    if (subscriptionsError) {
      console.error('[Event Notify] Subscriptions fetch failed:', subscriptionsError);
      return Response.json({ error: 'Meldingen ophalen mislukt.' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';
    const sentSubscriptionIds = [];

    for (const subscription of subscriptions ?? []) {
      const eventId = Number(subscription.event_id);
      const ticket = ticketByEventId[eventId];
      if (!ticket) continue;

      const lowestAsk = lowestAskByEventId[eventId] ?? Number(ticket.ask_price);
      const eventName = ticket.event_name || `Event #${eventId}`;
      const eventUrl = `${baseUrl}/markt/${eventId}`;

      await sendEventAvailabilityAlertEmail(
        subscription.email,
        eventName,
        eventUrl,
        lowestAsk
      );
      sentSubscriptionIds.push(subscription.id);
    }

    if (sentSubscriptionIds.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('event_alert_subscriptions')
        .update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in('id', sentSubscriptionIds);
      if (updateError) {
        console.error('[Event Notify] Failed to mark subscriptions as notified:', updateError);
      }
    }

    return Response.json({ success: true, sent: sentSubscriptionIds.length });
  } catch (error) {
    console.error('[Event Notify] Unexpected error:', error);
    return Response.json({ error: 'Er ging iets mis bij het versturen van meldingen.' }, { status: 500 });
  }
}
