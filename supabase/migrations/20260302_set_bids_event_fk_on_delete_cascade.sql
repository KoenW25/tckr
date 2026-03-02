-- Ensure deleting an event also removes related bids
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bids_event_id_fkey'
      AND conrelid = 'public.bids'::regclass
  ) THEN
    ALTER TABLE public.bids
      DROP CONSTRAINT bids_event_id_fkey;
  END IF;
END
$$;

ALTER TABLE public.bids
  ADD CONSTRAINT bids_event_id_fkey
  FOREIGN KEY (event_id)
  REFERENCES public.events(id)
  ON DELETE CASCADE;
