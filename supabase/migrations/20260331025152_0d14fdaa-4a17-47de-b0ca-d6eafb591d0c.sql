
-- NPC player relations: persistent sentiment per player per NPC town
CREATE TABLE public.npc_player_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  npc_town_id text NOT NULL,
  sentiment integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'neutral',
  tribute_rate integer NOT NULL DEFAULT 0,
  trades_completed integer NOT NULL DEFAULT 0,
  last_interaction timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, npc_town_id)
);

ALTER TABLE public.npc_player_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own NPC relations"
  ON public.npc_player_relations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own NPC relations"
  ON public.npc_player_relations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own NPC relations"
  ON public.npc_player_relations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- NPC-to-NPC relations: global state simulated on tick
CREATE TABLE public.npc_town_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  town_a_id text NOT NULL,
  town_b_id text NOT NULL,
  relation_type text NOT NULL DEFAULT 'neutral',
  strength integer NOT NULL DEFAULT 50,
  last_event text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(town_a_id, town_b_id)
);

ALTER TABLE public.npc_town_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view NPC town relations"
  ON public.npc_town_relations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can manage NPC town relations"
  ON public.npc_town_relations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- NPC mercenary contracts: track hired troops
CREATE TABLE public.npc_mercenary_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  npc_town_id text NOT NULL,
  troops_hired jsonb NOT NULL DEFAULT '{}'::jsonb,
  gold_paid integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.npc_mercenary_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mercenary contracts"
  ON public.npc_mercenary_contracts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create mercenary contracts"
  ON public.npc_mercenary_contracts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mercenary contracts"
  ON public.npc_mercenary_contracts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- NPC town state: tracks NPC autonomous actions (claimed regions, power changes)
CREATE TABLE public.npc_town_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npc_town_id text NOT NULL UNIQUE,
  current_power integer NOT NULL DEFAULT 100,
  claimed_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  available_mercenaries jsonb NOT NULL DEFAULT '{"militia": 20, "archer": 10, "knight": 5}'::jsonb,
  last_action text,
  last_action_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.npc_town_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view NPC town state"
  ON public.npc_town_state FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can manage NPC town state"
  ON public.npc_town_state FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
