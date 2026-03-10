import { createClient } from '@supabase/supabase-js';

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

    if (authError || !user?.id || !user?.email) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const { eventId } = await request.json();
    const numericEventId = Number(eventId);
    if (!Number.isInteger(numericEventId) || numericEventId <= 0) {
      return Response.json({ error: 'Ongeldig eventId.' }, { status: 400 });
    }

    const { data: existingEvent, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', numericEventId)
      .maybeSingle();
    if (eventError || !existingEvent) {
      return Response.json({ error: 'Event niet gevonden.' }, { status: 404 });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('event_alert_subscriptions')
      .upsert(
        {
          event_id: numericEventId,
          email: String(user.email).trim().toLowerCase(),
          user_id: user.id,
          is_active: true,
          notified_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,email' }
      );

    if (upsertError) {
      console.error('[Event Subscribe] Upsert failed:', upsertError);
      return Response.json({ error: 'Aanmelden voor meldingen mislukt.' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[Event Subscribe] Unexpected error:', error);
    return Response.json({ error: 'Er ging iets mis bij aanmelden voor meldingen.' }, { status: 500 });
  }
}
