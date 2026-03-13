import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractStorageObjectFromUrl(url) {
  if (!url) return null;
  const normalized = decodeURIComponent(String(url)).trim();
  const defaultBucket = 'tickets';

  if (!normalized.startsWith('http')) {
    return {
      bucket: defaultBucket,
      path: normalized.split('?')[0].replace(/^\/+/, ''),
    };
  }

  const specificMarkers = [
    '/storage/v1/object/public/tickets/',
    '/storage/v1/object/authenticated/tickets/',
    '/storage/v1/object/sign/tickets/',
  ];
  for (const marker of specificMarkers) {
    const index = normalized.indexOf(marker);
    if (index !== -1) {
      return {
        bucket: defaultBucket,
        path: normalized.substring(index + marker.length).split('?')[0],
      };
    }
  }

  const genericMarkers = [
    '/storage/v1/object/public/',
    '/storage/v1/object/authenticated/',
    '/storage/v1/object/sign/',
  ];
  for (const marker of genericMarkers) {
    const index = normalized.indexOf(marker);
    if (index === -1) continue;
    const tail = normalized.substring(index + marker.length).split('?')[0];
    const [bucket, ...rest] = tail.split('/');
    if (!bucket || rest.length === 0) continue;
    return { bucket, path: rest.join('/') };
  }

  return null;
}

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
    } = await supabaseService.auth.getUser(token);

    if (authError || !user?.id) {
      return Response.json({ error: 'Niet geautoriseerd.' }, { status: 401 });
    }

    const { ticketId } = await request.json();
    const numericTicketId = Number(ticketId);
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      return Response.json({ error: 'Ongeldig ticketId.' }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabaseService
      .from('tickets')
      .select('id, pdf_url, buyer_id, user_id')
      .eq('id', numericTicketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return Response.json({ error: 'Ticket niet gevonden.' }, { status: 404 });
    }

    const isOwner = ticket.user_id === user.id;
    const isBuyer = ticket.buyer_id === user.id;
    if (!isOwner && !isBuyer) {
      return Response.json({ error: 'Geen toegang tot dit ticket.' }, { status: 403 });
    }

    const storageObject = extractStorageObjectFromUrl(ticket.pdf_url);
    if (!storageObject?.bucket || !storageObject?.path) {
      return Response.json({ error: 'Ticketbestand ongeldig opgeslagen.' }, { status: 400 });
    }

    const { data: fileData, error: downloadError } = await supabaseService.storage
      .from(storageObject.bucket)
      .download(storageObject.path);

    if (downloadError || !fileData) {
      console.error('[Ticket Download] Failed to download file:', downloadError);
      return Response.json({ error: 'Ticket downloaden mislukt.' }, { status: 500 });
    }

    const fileName = storageObject.path.split('/').pop() || `ticket-${numericTicketId}.pdf`;
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[Ticket Download] Unexpected error:', error);
    return Response.json({ error: 'Er ging iets mis bij het downloaden van je ticket.' }, { status: 500 });
  }
}
