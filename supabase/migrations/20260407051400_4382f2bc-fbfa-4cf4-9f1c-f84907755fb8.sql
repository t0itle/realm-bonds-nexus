
-- ============ DATA WIPE ============
DELETE FROM active_marches;
DELETE FROM active_reinforcements;
DELETE FROM active_spy_missions;
DELETE FROM alliance_contracts;
DELETE FROM alliance_messages;
DELETE FROM alliance_resource_transfers;
DELETE FROM alliance_members;
DELETE FROM alliances;
DELETE FROM battle_reports;
DELETE FROM build_queue;
DELETE FROM buildings;
DELETE FROM caravans;
DELETE FROM guild_votes;
DELETE FROM guild_proposals;
DELETE FROM intel_reports;
DELETE FROM npc_mercenary_contracts;
DELETE FROM npc_player_relations;
DELETE FROM npc_town_relations;
DELETE FROM npc_town_state;
DELETE FROM wall_segments;
DELETE FROM outposts;
DELETE FROM player_messages;
DELETE FROM player_skins;
DELETE FROM push_subscriptions;
DELETE FROM research_progress;
DELETE FROM roads;
DELETE FROM spy_training_queue;
DELETE FROM trade_routes;
DELETE FROM training_queue;
DELETE FROM vassalages;
DELETE FROM world_boss_defeats;
DELETE FROM world_events;
DELETE FROM villages;

-- ============ NEW TABLES ============

-- World burgs (NPC towns from Azgaar map)
CREATE TABLE public.world_burgs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  burg_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  state_id INTEGER NOT NULL DEFAULT 0,
  state_name TEXT NOT NULL DEFAULT '',
  culture_name TEXT NOT NULL DEFAULT '',
  population INTEGER NOT NULL DEFAULT 0,
  burg_type TEXT NOT NULL DEFAULT 'Generic',
  burg_group TEXT NOT NULL DEFAULT 'village',
  has_citadel BOOLEAN NOT NULL DEFAULT false,
  has_walls BOOLEAN NOT NULL DEFAULT false,
  has_temple BOOLEAN NOT NULL DEFAULT false,
  has_port BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#888',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.world_burgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view world burgs"
ON public.world_burgs FOR SELECT
TO authenticated
USING (true);

-- World states (NPC kingdoms)
CREATE TABLE public.world_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#888',
  capital_burg_id INTEGER NOT NULL DEFAULT 0,
  culture_name TEXT NOT NULL DEFAULT '',
  state_type TEXT NOT NULL DEFAULT 'Generic',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.world_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view world states"
ON public.world_states FOR SELECT
TO authenticated
USING (true);

-- ============ SCHEMA CHANGES ============

-- Add settlement tier/sub-level system to villages
ALTER TABLE public.villages
  ADD COLUMN IF NOT EXISTS settlement_tier INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS settlement_sub_level INTEGER NOT NULL DEFAULT 1;

-- Update village defaults for new players (camp start)
ALTER TABLE public.villages
  ALTER COLUMN gold SET DEFAULT 100,
  ALTER COLUMN wood SET DEFAULT 50,
  ALTER COLUMN stone SET DEFAULT 25,
  ALTER COLUMN food SET DEFAULT 75,
  ALTER COLUMN settlement_type SET DEFAULT 'camp',
  ALTER COLUMN population SET DEFAULT 5,
  ALTER COLUMN max_population SET DEFAULT 10,
  ALTER COLUMN storage_capacity SET DEFAULT 500;

-- Update the handle_new_village function for camp start
CREATE OR REPLACE FUNCTION public.handle_new_village()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  village_id UUID;
  spawn_x DOUBLE PRECISION;
  spawn_y DOUBLE PRECISION;
BEGIN
  -- Spawn players at random valid positions on the map (map is 384x697)
  -- Avoid edges, place in the playable area
  spawn_x := 40 + random() * 300;
  spawn_y := 50 + random() * 590;

  INSERT INTO public.villages (
    user_id, name, map_x, map_y,
    settlement_type, settlement_tier, settlement_sub_level,
    gold, wood, stone, food, population, max_population, storage_capacity
  )
  VALUES (
    NEW.id, 'Camp of ' || COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'),
    spawn_x, spawn_y,
    'camp', 1, 1,
    100, 50, 25, 75, 5, 10, 500
  )
  RETURNING id INTO village_id;

  -- Start with just a campfire (townhall equivalent at camp tier)
  INSERT INTO public.buildings (village_id, user_id, type, level, position) VALUES
    (village_id, NEW.id, 'campfire', 1, 4);

  RETURN NEW;
END;
$$;
