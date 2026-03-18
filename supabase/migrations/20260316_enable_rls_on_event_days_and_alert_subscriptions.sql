-- Ensure RLS is enabled on public tables exposed through PostgREST.
-- This migration is idempotent and safe to run multiple times.

-- event_days
ALTER TABLE IF EXISTS public.event_days ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_days'
      AND policyname = 'Public read event_days'
  ) THEN
    CREATE POLICY "Public read event_days"
      ON public.event_days
      FOR SELECT
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_days'
      AND policyname = 'Authenticated insert event_days'
  ) THEN
    CREATE POLICY "Authenticated insert event_days"
      ON public.event_days
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

-- event_alert_subscriptions
ALTER TABLE IF EXISTS public.event_alert_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_alert_subscriptions'
      AND policyname = 'Users read own event alert subscriptions'
  ) THEN
    CREATE POLICY "Users read own event alert subscriptions"
      ON public.event_alert_subscriptions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_alert_subscriptions'
      AND policyname = 'Users insert own event alert subscriptions'
  ) THEN
    CREATE POLICY "Users insert own event alert subscriptions"
      ON public.event_alert_subscriptions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_alert_subscriptions'
      AND policyname = 'Users update own event alert subscriptions'
  ) THEN
    CREATE POLICY "Users update own event alert subscriptions"
      ON public.event_alert_subscriptions
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_alert_subscriptions'
      AND policyname = 'Users delete own event alert subscriptions'
  ) THEN
    CREATE POLICY "Users delete own event alert subscriptions"
      ON public.event_alert_subscriptions
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END
$$;
