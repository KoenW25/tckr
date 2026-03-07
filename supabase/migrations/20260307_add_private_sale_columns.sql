ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS private_buyer_email text;
