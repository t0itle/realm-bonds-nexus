CREATE OR REPLACE FUNCTION public.add_to_alliance_treasury(
  p_alliance_id uuid,
  p_gold bigint,
  p_wood bigint,
  p_stone bigint,
  p_food bigint
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE alliances
  SET treasury_gold = treasury_gold + p_gold,
      treasury_wood = treasury_wood + p_wood,
      treasury_stone = treasury_stone + p_stone,
      treasury_food = treasury_food + p_food,
      updated_at = now()
  WHERE id = p_alliance_id;
$$;