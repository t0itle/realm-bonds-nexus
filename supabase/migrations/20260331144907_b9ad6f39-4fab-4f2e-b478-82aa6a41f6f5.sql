
-- Add persistent state columns to villages
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS spies integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS poisons integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_militia integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_archer integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_knight integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_cavalry integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_siege integer NOT NULL DEFAULT 0;
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS injured_scout integer NOT NULL DEFAULT 0;

-- Build queue table (persists building/upgrade timers)
CREATE TABLE public.build_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  building_id uuid NOT NULL,
  building_type text NOT NULL,
  target_level integer NOT NULL,
  finish_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.build_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own build queue" ON public.build_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Training queue table (persists troop training timers)
CREATE TABLE public.training_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  troop_type text NOT NULL,
  count integer NOT NULL,
  finish_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own training queue" ON public.training_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Spy training queue table
CREATE TABLE public.spy_training_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  count integer NOT NULL,
  finish_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spy_training_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own spy training queue" ON public.spy_training_queue FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Active spy missions table
CREATE TABLE public.active_spy_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mission text NOT NULL,
  target_name text NOT NULL,
  target_id text NOT NULL,
  spies_count integer NOT NULL DEFAULT 1,
  depart_time timestamptz NOT NULL,
  arrival_time timestamptz NOT NULL,
  target_x double precision NOT NULL DEFAULT 0,
  target_y double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.active_spy_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own spy missions" ON public.active_spy_missions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Intel reports table
CREATE TABLE public.intel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_name text NOT NULL,
  mission text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  spies_lost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own intel reports" ON public.intel_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
