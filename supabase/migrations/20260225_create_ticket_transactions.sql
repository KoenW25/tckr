CREATE TABLE IF NOT EXISTS public.ticket_transactions (
  id bigserial PRIMARY KEY,
  payment_id text NOT NULL UNIQUE,
  event_id text NOT NULL,
  ticket_id text NOT NULL,
  sold_price numeric(10,2) NOT NULL,
  sold_at timestamptz NOT NULL DEFAULT now(),
  buyer_id uuid NULL,
  seller_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_transactions_event_id_idx
  ON public.ticket_transactions (event_id);

CREATE INDEX IF NOT EXISTS ticket_transactions_sold_at_idx
  ON public.ticket_transactions (sold_at);
