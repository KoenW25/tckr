-- Enable RLS for security alerts
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_transactions ENABLE ROW LEVEL SECURITY;

-- Keep events publicly readable for market pages.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Public read events'
  ) THEN
    CREATE POLICY "Public read events"
      ON public.events
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;

-- Allow authenticated users to insert events (existing behavior).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'events'
      AND policyname = 'Authenticated insert events'
  ) THEN
    CREATE POLICY "Authenticated insert events"
      ON public.events
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;
