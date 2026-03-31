
-- Add level, garrison, and border wall fields to outposts
ALTER TABLE public.outposts ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.outposts ADD COLUMN IF NOT EXISTS garrison_power INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.outposts ADD COLUMN IF NOT EXISTS has_wall BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.outposts ADD COLUMN IF NOT EXISTS wall_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.outposts ADD COLUMN IF NOT EXISTS territory_radius INTEGER NOT NULL DEFAULT 15000;

-- Allow users to update their own outposts
CREATE POLICY "Users can update own outposts"
  ON public.outposts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
