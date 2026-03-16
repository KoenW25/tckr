ALTER TABLE public.ticket_transactions
  ADD COLUMN IF NOT EXISTS event_day_id BIGINT;

ALTER TABLE public.ticket_transactions
  DROP CONSTRAINT IF EXISTS ticket_transactions_event_day_id_fkey;
ALTER TABLE public.ticket_transactions
  ADD CONSTRAINT ticket_transactions_event_day_id_fkey
  FOREIGN KEY (event_day_id) REFERENCES public.event_days(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ticket_transactions_event_day_id_idx
  ON public.ticket_transactions (event_day_id);

UPDATE public.ticket_transactions tx
SET event_day_id = t.event_day_id
FROM public.tickets t
WHERE tx.event_day_id IS NULL
  AND tx.ticket_id::bigint = t.id;
