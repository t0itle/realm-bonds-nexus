
CREATE OR REPLACE FUNCTION public.deliver_caravan(
  p_caravan_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caravan RECORD;
BEGIN
  -- Get the caravan and verify ownership + status
  SELECT * INTO v_caravan
  FROM caravans
  WHERE id = p_caravan_id
    AND user_id = p_user_id
    AND status = 'in_transit'
    AND arrives_at <= now();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Add resources to destination village
  UPDATE villages
  SET gold = gold + v_caravan.gold,
      wood = wood + v_caravan.wood,
      stone = stone + v_caravan.stone,
      food = food + v_caravan.food,
      steel = steel + v_caravan.steel,
      updated_at = now()
  WHERE id = v_caravan.to_village_id;

  -- Mark caravan as delivered
  UPDATE caravans
  SET status = 'delivered'
  WHERE id = p_caravan_id;

  RETURN true;
END;
$$;
