
-- Add village_id to training_queue
ALTER TABLE public.training_queue ADD COLUMN village_id uuid REFERENCES public.villages(id) ON DELETE CASCADE;

-- Backfill existing rows with the user's first village
UPDATE public.training_queue tq
SET village_id = (
  SELECT v.id FROM public.villages v WHERE v.user_id = tq.user_id ORDER BY v.created_at ASC LIMIT 1
)
WHERE village_id IS NULL;

-- Add village_id to build_queue
ALTER TABLE public.build_queue ADD COLUMN village_id uuid REFERENCES public.villages(id) ON DELETE CASCADE;

-- Backfill existing build_queue rows
UPDATE public.build_queue bq
SET village_id = (
  SELECT v.id FROM public.villages v WHERE v.user_id = bq.user_id ORDER BY v.created_at ASC LIMIT 1
)
WHERE village_id IS NULL;
