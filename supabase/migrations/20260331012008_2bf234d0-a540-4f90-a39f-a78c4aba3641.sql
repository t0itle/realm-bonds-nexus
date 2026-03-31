ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS settlement_type text NOT NULL DEFAULT 'village';
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS map_x double precision NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS map_y double precision NOT NULL DEFAULT 0;