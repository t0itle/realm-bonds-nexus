CREATE TABLE public.npc_settlement_lore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  burg_id integer NOT NULL UNIQUE,
  burg_name text NOT NULL,
  state_id integer NOT NULL,
  state_name text NOT NULL,
  ruler_name text NOT NULL,
  ruler_title text NOT NULL,
  dynasty_name text NOT NULL,
  lineage jsonb NOT NULL DEFAULT '[]'::jsonb,
  kingdom_hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  settlement_history text NOT NULL,
  ruler_personality text NOT NULL,
  notable_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.npc_settlement_lore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settlement lore"
ON public.npc_settlement_lore FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Service can manage settlement lore"
ON public.npc_settlement_lore FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_npc_settlement_lore_burg_id ON public.npc_settlement_lore(burg_id);
CREATE INDEX idx_npc_settlement_lore_state_id ON public.npc_settlement_lore(state_id);

CREATE TRIGGER update_npc_settlement_lore_updated_at
BEFORE UPDATE ON public.npc_settlement_lore
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();