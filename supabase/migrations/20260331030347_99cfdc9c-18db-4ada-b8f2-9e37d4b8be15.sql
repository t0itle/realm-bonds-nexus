
-- Active marches table for live troop movement visibility
CREATE TABLE public.active_marches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  player_name text NOT NULL DEFAULT 'Unknown',
  start_x double precision NOT NULL,
  start_y double precision NOT NULL,
  target_x double precision NOT NULL,
  target_y double precision NOT NULL,
  target_name text NOT NULL DEFAULT '',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  arrives_at timestamp with time zone NOT NULL,
  march_type text NOT NULL DEFAULT 'attack',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.active_marches ENABLE ROW LEVEL SECURITY;

-- Everyone can see all marches (for live map view)
CREATE POLICY "Anyone authenticated can view marches"
  ON public.active_marches FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert own marches
CREATE POLICY "Users can insert own marches"
  ON public.active_marches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own marches (on arrival)
CREATE POLICY "Users can delete own marches"
  ON public.active_marches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_marches;
