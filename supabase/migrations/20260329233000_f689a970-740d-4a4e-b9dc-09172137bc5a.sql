
-- Battle reports table
CREATE TABLE public.battle_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID NOT NULL,
  defender_id UUID NOT NULL,
  attacker_name TEXT NOT NULL DEFAULT 'Unknown',
  defender_name TEXT NOT NULL DEFAULT 'Unknown',
  result TEXT NOT NULL DEFAULT 'victory',
  attacker_troops_sent JSONB NOT NULL DEFAULT '{}',
  attacker_troops_lost JSONB NOT NULL DEFAULT '{}',
  defender_troops_lost JSONB NOT NULL DEFAULT '{}',
  resources_raided JSONB NOT NULL DEFAULT '{}',
  building_damaged TEXT,
  building_damage_levels INTEGER DEFAULT 0,
  vassalized BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vassalages table
CREATE TABLE public.vassalages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lord_id UUID NOT NULL,
  vassal_id UUID NOT NULL,
  tribute_rate INTEGER NOT NULL DEFAULT 10,
  rebellion_available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  ransom_gold INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE(lord_id, vassal_id)
);

-- RLS for battle_reports
ALTER TABLE public.battle_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own battle reports" ON public.battle_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

CREATE POLICY "Authenticated users can insert battle reports" ON public.battle_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = attacker_id);

-- RLS for vassalages
ALTER TABLE public.vassalages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vassalages" ON public.vassalages
  FOR SELECT TO authenticated
  USING (auth.uid() = lord_id OR auth.uid() = vassal_id);

CREATE POLICY "Users can create vassalages on victory" ON public.vassalages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = lord_id);

CREATE POLICY "Lords and vassals can update vassalages" ON public.vassalages
  FOR UPDATE TO authenticated
  USING (auth.uid() = lord_id OR auth.uid() = vassal_id);

-- Enable realtime for battle reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vassalages;
