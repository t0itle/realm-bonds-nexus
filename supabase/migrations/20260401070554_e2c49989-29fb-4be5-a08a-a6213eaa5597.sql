
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
  avg_x DOUBLE PRECISION;
  avg_y DOUBLE PRECISION;
  player_count INT;
  angle DOUBLE PRECISION;
  radius DOUBLE PRECISION;
BEGIN
  -- Find where existing players are clustered
  SELECT COUNT(*), COALESCE(AVG(map_x), 0), COALESCE(AVG(map_y), 0)
  INTO player_count, avg_x, avg_y
  FROM public.villages;

  IF player_count = 0 THEN
    -- First player: spawn at origin
    spawn_x := 0;
    spawn_y := 0;
  ELSE
    -- Spawn in a ring around the cluster center
    -- Distance: 15000-30000 units from center (close enough to discover, far enough to develop)
    angle := random() * 2 * pi();
    radius := 15000 + random() * 15000 + (player_count * 3000);
    spawn_x := avg_x + cos(angle) * radius;
    spawn_y := avg_y + sin(angle) * radius;
  END IF;

  INSERT INTO public.villages (user_id, name, map_x, map_y)
  VALUES (NEW.id, 'Village of ' || COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'), spawn_x, spawn_y)
  RETURNING id INTO village_id;
  
  INSERT INTO public.buildings (village_id, user_id, type, level, position) VALUES
    (village_id, NEW.id, 'townhall', 1, 4),
    (village_id, NEW.id, 'farm', 1, 7),
    (village_id, NEW.id, 'lumbermill', 1, 3);
  
  RETURN NEW;
END;
$function$;
