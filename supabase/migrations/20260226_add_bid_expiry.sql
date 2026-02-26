-- Add expiry support for accepted/pending bids
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Ensure bid status supports expired
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bids_status_allowed_chk'
  ) THEN
    ALTER TABLE public.bids
      DROP CONSTRAINT bids_status_allowed_chk;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bids_status_allowed_chk'
  ) THEN
    ALTER TABLE public.bids
      ADD CONSTRAINT bids_status_allowed_chk
      CHECK (status IN ('pending', 'accepted', 'cancelled', 'rejected', 'expired'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS bids_status_expires_at_idx
  ON public.bids (status, expires_at);

-- Auto-normalize pending bids to expired when their expires_at is already in the past
CREATE OR REPLACE FUNCTION public.apply_bid_expiry_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending'
     AND NEW.expires_at IS NOT NULL
     AND NEW.expires_at <= now() THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_apply_expiry_status_trg ON public.bids;
CREATE TRIGGER bids_apply_expiry_status_trg
BEFORE INSERT OR UPDATE ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.apply_bid_expiry_status();
