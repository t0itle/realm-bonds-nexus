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
  angle DOUBLE PRECISION;
  radius DOUBLE PRECISION;
BEGIN
  -- Tight cluster around the green central landmass (~165, 317)
  -- Random point within a small ~15-unit radius circle
  angle := random() * 2 * pi();
  radius := sqrt(random()) * 15;
  spawn_x := 165 + cos(angle) * radius;
  spawn_y := 317 + sin(angle) * radius;

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

-- Move all existing players' villages into the central cluster
UPDATE public.villages
SET map_x = 165 + cos(random() * 2 * pi()) * (sqrt(random()) * 15),
    map_y = 317 + sin(random() * 2 * pi()) * (sqrt(random()) * 15);