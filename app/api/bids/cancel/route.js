import { createClient } from '@supabase/supabase-js';

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

export async function POST(request) {
  try {
    const actor = await resolveUserFromRequest(request);
    if (!actor?.id) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const { bidId } = await request.json();
    if (!bidId) {
      return Response.json({ error: 'bidId is verplicht.' }, { status: 400 });
    }

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('bids')
      .select('id, user_id, status')
      .eq('id', bidId)
      .single();

    if (bidError || !bid) {
      return Response.json({ error: 'Bod niet gevonden.' }, { status: 404 });
    }

    if (bid.user_id !== actor.id) {
      return Response.json({ error: 'Je mag dit bod niet intrekken.' }, { status: 403 });
    }

    if (bid.status !== 'pending') {
      return Response.json({ error: 'Alleen open biedingen kunnen worden ingetrokken.' }, { status: 409 });
    }

    const { error: cancelError } = await supabaseAdmin
      .from('bids')
      .update({ status: 'cancelled' })
      .eq('id', bid.id)
      .eq('status', 'pending');

    if (cancelError) {
      return Response.json({ error: 'Bod intrekken mislukt.' }, { status: 500 });
    }

    return Response.json({ success: true, bidId: bid.id }, { status: 200 });
  } catch (error) {
    console.error('[Bids Cancel] Unexpected error:', error);
    return Response.json({ error: 'Er ging iets mis bij het intrekken van je bod.' }, { status: 500 });
  }
}
