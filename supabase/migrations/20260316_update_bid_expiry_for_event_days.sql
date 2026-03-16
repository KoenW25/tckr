-- Use event day date (event_days.day_date) when validating expired-event bids
CREATE OR REPLACE FUNCTION public.prevent_bids_on_expired_events()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_event_id bigint;
  resolved_event_day_id bigint;
  resolved_event_date date;
BEGIN
  -- Only enforce this for bids that are open/pending.
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  resolved_event_day_id := NEW.event_day_id;
  resolved_event_id := NEW.event_id;

  -- Resolve from ticket first when needed.
  IF NEW.ticket_id IS NOT NULL AND (resolved_event_day_id IS NULL OR resolved_event_id IS NULL) THEN
    SELECT t.event_day_id, t.event_id
      INTO resolved_event_day_id, resolved_event_id
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id;
  END IF;

  -- Resolve event_day from event when needed.
  IF resolved_event_day_id IS NULL AND resolved_event_id IS NOT NULL THEN
    SELECT d.id
      INTO resolved_event_day_id
    FROM public.event_days d
    WHERE d.event_id = resolved_event_id
    ORDER BY d.day_date ASC
    LIMIT 1;
  END IF;

  -- Prefer day_date from event_days.
  IF resolved_event_day_id IS NOT NULL THEN
    SELECT d.day_date
      INTO resolved_event_date
    FROM public.event_days d
    WHERE d.id = resolved_event_day_id;
  END IF;

  -- Fallback for legacy rows/events without event_days.
  IF resolved_event_date IS NULL AND resolved_event_id IS NOT NULL THEN
    SELECT e.date::date
      INTO resolved_event_date
    FROM public.events e
    WHERE e.id = resolved_event_id;
  END IF;

  IF resolved_event_date IS NOT NULL AND resolved_event_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Bieden op verlopen events is niet toegestaan.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
