CREATE TABLE IF NOT EXISTS public.event_alert_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notified_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_alert_subscriptions_event_email_uidx
  ON public.event_alert_subscriptions (event_id, email);

CREATE INDEX IF NOT EXISTS event_alert_subscriptions_event_active_idx
  ON public.event_alert_subscriptions (event_id, is_active, notified_at);
