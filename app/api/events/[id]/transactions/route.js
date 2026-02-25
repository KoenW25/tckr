import { createClient } from '@supabase/supabase-js';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(_request, context) {
  try {
    const maybeParams = context?.params;
    const resolvedParams =
      maybeParams && typeof maybeParams.then === 'function'
        ? await maybeParams
        : maybeParams;
    const eventId = resolvedParams?.id ? String(resolvedParams.id) : '';
    if (!eventId) {
      return Response.json({ error: 'eventId is verplicht.' }, { status: 400 });
    }

    const { data, error } = await supabaseService
      .from('ticket_transactions')
      .select('sold_price, sold_at')
      .eq('event_id', eventId)
      .order('sold_at', { ascending: true });

    let transactions = [];
    if (error) {
      console.warn('[Event Transactions] Falling back to tickets table:', error.message);
    } else {
      transactions = (data ?? []).filter(
        (tx) => tx?.sold_price != null && Number.isFinite(Number(tx.sold_price))
      );
    }

    // Fallback for projects where ticket_transactions is not yet populated.
    if (transactions.length === 0) {
      const { data: soldTickets, error: soldError } = await supabaseService
        .from('tickets')
        .select('ask_price, price, sold_at, updated_at, created_at')
        .eq('event_id', eventId)
        .eq('status', 'sold')
        .order('updated_at', { ascending: true });

      if (!soldError) {
        transactions = (soldTickets ?? [])
          .map((tk) => {
            const soldPrice = Number(tk.ask_price ?? tk.price);
            if (!Number.isFinite(soldPrice)) return null;
            return {
              sold_price: soldPrice,
              sold_at: tk.sold_at || tk.updated_at || tk.created_at || new Date().toISOString(),
            };
          })
          .filter(Boolean);
      }
    }

    return Response.json(
      {
        count: transactions.length,
        points: transactions.map((tx) => ({
          soldAt: tx.sold_at,
          price: Number(tx.sold_price),
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Event Transactions] Unexpected error:', err);
    return Response.json({ error: 'Interne fout bij transacties ophalen.' }, { status: 500 });
  }
}
