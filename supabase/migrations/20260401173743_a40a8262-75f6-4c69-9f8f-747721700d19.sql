
ALTER TABLE public.npc_town_state
  ADD COLUMN stock_gold integer NOT NULL DEFAULT 1000,
  ADD COLUMN stock_wood integer NOT NULL DEFAULT 800,
  ADD COLUMN stock_stone integer NOT NULL DEFAULT 600,
  ADD COLUMN stock_food integer NOT NULL DEFAULT 900,
  ADD COLUMN stock_steel integer NOT NULL DEFAULT 50,
  ADD COLUMN last_regen_at timestamp with time zone NOT NULL DEFAULT now();

-- Update existing rows to have resources based on their power level
UPDATE public.npc_town_state SET
  stock_gold = current_power * 10,
  stock_wood = current_power * 8,
  stock_stone = current_power * 6,
  stock_food = current_power * 9,
  stock_steel = GREATEST(5, current_power / 2),
  last_regen_at = now();
