
CREATE TABLE public.wall_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  outpost_a_id UUID NOT NULL REFERENCES public.outposts(id) ON DELETE CASCADE,
  outpost_b_id UUID NOT NULL REFERENCES public.outposts(id) ON DELETE CASCADE,
  wall_level INTEGER NOT NULL DEFAULT 1,
  health INTEGER NOT NULL DEFAULT 100,
  max_health INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(outpost_a_id, outpost_b_id)
);

ALTER TABLE public.wall_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view wall segments"
  ON public.wall_segments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create own wall segments"
  ON public.wall_segments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wall segments"
  ON public.wall_segments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wall segments"
  ON public.wall_segments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
