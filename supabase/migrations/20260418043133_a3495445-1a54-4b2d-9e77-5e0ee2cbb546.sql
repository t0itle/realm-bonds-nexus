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
  spawn_idx INTEGER;
BEGIN
  spawn_idx := 1 + floor(random() * 31)::int;
  WITH points(x, y, n) AS (
    SELECT * FROM (VALUES
      (170.1::float8,307.4::float8,1),(171.4,309.4,2),(170.7,311.5,3),(165.5,313.4,4),(167.8,313.5,5),
      (170.1,313.6,6),(172.1,311.1,7),(174.2,313.4,8),(165.2,314.3,9),(165.1,316.0,10),
      (169.2,316.3,11),(172.4,314.3,12),(174.3,314.6,13),(165.0,317.7,14),(164.8,320.0,15),
      (168.8,317.3,16),(173.2,317.9,17),(174.8,318.7,18),(162.9,322.6,19),(164.6,322.2,20),
      (168.5,320.1,21),(172.2,322.1,22),(173.7,320.7,23),(162.8,323.8,24),(162.3,325.3,25),
      (166.1,323.7,26),(168.4,323.6,27),(173.2,325.2,28),(159.7,327.4,29),(161.7,326.9,30),
      (165.1,326.4,31)
    ) AS t(x, y, n)
  )
  SELECT x + (random()-0.5)*0.4, y + (random()-0.5)*0.4 INTO spawn_x, spawn_y
  FROM points WHERE n = spawn_idx;

  INSERT INTO public.villages (
    user_id, name, map_x, map_y,
    settlement_type, settlement_tier, settlement_sub_level,
    gold, wood, stone, food, population, max_population, storage_capacity
  )
  VALUES (
    NEW.id, 'Camp of ' || COALESCE(NEW.raw_user_meta_data->>'display_name', 'Wanderer'),
    spawn_x, spawn_y, 'camp', 1, 1,
    100, 50, 25, 75, 5, 10, 500
  )
  RETURNING id INTO village_id;

  INSERT INTO public.buildings (village_id, user_id, type, level, position) VALUES
    (village_id, NEW.id, 'campfire', 1, 4);
  RETURN NEW;
END;
$function$;

-- Relocate every existing village onto a valid land tile from the same pool
WITH pts(x, y, n) AS (
  VALUES
    (170.1::float8,307.4::float8,1),(171.4,309.4,2),(170.7,311.5,3),(165.5,313.4,4),(167.8,313.5,5),
    (170.1,313.6,6),(172.1,311.1,7),(174.2,313.4,8),(165.2,314.3,9),(165.1,316.0,10),
    (169.2,316.3,11),(172.4,314.3,12),(174.3,314.6,13),(165.0,317.7,14),(164.8,320.0,15),
    (168.8,317.3,16),(173.2,317.9,17),(174.8,318.7,18),(162.9,322.6,19),(164.6,322.2,20),
    (168.5,320.1,21),(172.2,322.1,22),(173.7,320.7,23),(162.8,323.8,24),(162.3,325.3,25),
    (166.1,323.7,26),(168.4,323.6,27),(173.2,325.2,28),(159.7,327.4,29),(161.7,326.9,30),
    (165.1,326.4,31)
), v AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS n FROM public.villages
)
UPDATE public.villages vv
SET map_x = pts.x + (random()-0.5)*0.4,
    map_y = pts.y + (random()-0.5)*0.4
FROM v, pts
WHERE vv.id = v.id AND pts.n = ((v.n - 1) % 31) + 1;