
-- Add workers column to buildings table for server-side tracking
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS workers integer NOT NULL DEFAULT 0;

-- Enable realtime for villages table so clients get server tick updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.villages;
