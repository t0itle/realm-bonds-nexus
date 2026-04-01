
CREATE TABLE public.world_boss_defeats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  boss_week_seed INTEGER NOT NULL,
  boss_type TEXT NOT NULL,
  defeated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, boss_week_seed)
);

ALTER TABLE public.world_boss_defeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own boss defeats"
  ON public.world_boss_defeats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record own boss defeats"
  ON public.world_boss_defeats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
