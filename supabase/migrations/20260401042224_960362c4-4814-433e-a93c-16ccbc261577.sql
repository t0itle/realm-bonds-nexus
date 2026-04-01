
CREATE TABLE public.player_skins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  skin_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, skin_id)
);

ALTER TABLE public.player_skins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skins" ON public.player_skins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can purchase skins" ON public.player_skins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skins" ON public.player_skins FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skins" ON public.player_skins FOR DELETE TO authenticated USING (auth.uid() = user_id);
