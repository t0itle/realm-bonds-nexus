
CREATE OR REPLACE FUNCTION public.handle_new_village()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  village_id UUID;
  spawn_x DOUBLE PRECISION;
  spawn_y DOUBLE PRECISION;
BEGIN
  spawn_x := 110 + random() * 110;
  spawn_y := 240 + random() * 160;

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

  INSERT INTO public.buildings (village_id, user_id, type, level, position) VALUES
    (village_id, NEW.id, 'campfire', 1, 4);

  RETURN NEW;
END;
$function$;
