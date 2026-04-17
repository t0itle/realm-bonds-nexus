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
  spawn_idx := 1 + floor(random() * 150)::int;
  WITH points(x, y) AS (
    SELECT (p).f1, (p).f2
    FROM unnest(ARRAY[ROW(109.1::float8,295.6::float8),ROW(108.2::float8,254.8::float8),ROW(163.2::float8,357::float8),ROW(132.1::float8,399.9::float8),ROW(116.4::float8,309.1::float8),ROW(109.2::float8,397.9::float8),ROW(156.9::float8,371.1::float8),ROW(174.2::float8,369.0::float8),ROW(220.1::float8,357.2::float8),ROW(116.1::float8,305.2::float8),ROW(119.4::float8,240.3::float8),ROW(147.0::float8,246::float8),ROW(204.9::float8,336.5::float8),ROW(101.1::float8,315.1::float8),ROW(197.8::float8,292.4::float8),ROW(118.9::float8,392.3::float8),ROW(156.2::float8,344.0::float8),ROW(139.1::float8,240.0::float8),ROW(109.4::float8,325.2::float8),ROW(174.8::float8,318.7::float8),ROW(224.8::float8,350.9::float8),ROW(100.9::float8,278.3::float8),ROW(124.4::float8,399.6::float8),ROW(118.1::float8,251.7::float8),ROW(208.9::float8,340.6::float8),ROW(201.6::float8,287.1::float8),ROW(103.0::float8,394.0::float8),ROW(199.7::float8,293.3::float8),ROW(129.6::float8,241.9::float8),ROW(221.4::float8,285.1::float8),ROW(169.5::float8,335.7::float8),ROW(179.1::float8,317.2::float8),ROW(186.9::float8,332.5::float8),ROW(129.4::float8,245.5::float8),ROW(121.7::float8,399.6::float8),ROW(106.3::float8,288.5::float8),ROW(101.4::float8,325.8::float8),ROW(151.1::float8,242.5::float8),ROW(162.3::float8,354.9::float8),ROW(175.2::float8,295.4::float8),ROW(162.4::float8,359.1::float8),ROW(118.4::float8,385.3::float8),ROW(106.9::float8,301.2::float8),ROW(218.6::float8,325.0::float8),ROW(166.4::float8,358.1::float8),ROW(213.7::float8,321.2::float8),ROW(200.1::float8,288.7::float8),ROW(178.7::float8,327.1::float8),ROW(165.8::float8,330.2::float8),ROW(164.9::float8,333.9::float8),ROW(171.9::float8,294.4::float8),ROW(113.1::float8,400.0::float8),ROW(181.1::float8,333::float8),ROW(110.4::float8,389.6::float8),ROW(143.2::float8,242.4::float8),ROW(185.4::float8,330.8::float8),ROW(204.0::float8,322.0::float8),ROW(173.1::float8,336.2::float8),ROW(176.2::float8,294.7::float8),ROW(101.1::float8,288.8::float8),ROW(110.1::float8,394.9::float8),ROW(185.1::float8,342.1::float8),ROW(152.7::float8,350.7::float8),ROW(186.5::float8,342.8::float8),ROW(102.1::float8,314.9::float8),ROW(210.9::float8,348.5::float8),ROW(107.1::float8,324.0::float8),ROW(172.1::float8,311.1::float8),ROW(125.3::float8,306.0::float8),ROW(109.3::float8,394.3::float8),ROW(125.1::float8,279.2::float8),ROW(228.1::float8,285.8::float8),ROW(228.3::float8,291.2::float8),ROW(117.9::float8,297.6::float8),ROW(169.8::float8,349.6::float8),ROW(216.5::float8,359.8::float8),ROW(212.9::float8,356.9::float8),ROW(174.5::float8,303.4::float8),ROW(166.1::float8,346.6::float8),ROW(185.6::float8,263.6::float8),ROW(119.5::float8,257.3::float8),ROW(157.5::float8,338.0::float8),ROW(118.7::float8,289.6::float8),ROW(176.2::float8,296.9::float8),ROW(119.2::float8,248.5::float8),ROW(118.4::float8,391.3::float8),ROW(169.4::float8,352.4::float8),ROW(207.7::float8,329.7::float8),ROW(125.2::float8,391.0::float8),ROW(220.1::float8,335.2::float8),ROW(178.4::float8,355.3::float8),ROW(110.9::float8,317.3::float8),ROW(101.1::float8,293.3::float8),ROW(214.6::float8,327.5::float8),ROW(160.9::float8,334.9::float8),ROW(172.4::float8,314.3::float8),ROW(228.8::float8,294.1::float8),ROW(109.4::float8,241.1::float8),ROW(113.8::float8,285.2::float8),ROW(180.9::float8,242.9::float8),ROW(171.9::float8,346.2::float8),ROW(105.3::float8,321.4::float8),ROW(166.7::float8,341.8::float8),ROW(112.6::float8,286.0::float8),ROW(178.2::float8,298.0::float8),ROW(186.7::float8,341.1::float8),ROW(102.5::float8,293.9::float8),ROW(106.6::float8,246.7::float8),ROW(211.2::float8,346.9::float8),ROW(126.0::float8,303.1::float8),ROW(100.7::float8,312.1::float8),ROW(183.6::float8,350.6::float8),ROW(129.4::float8,395.8::float8),ROW(129.5::float8,293.9::float8),ROW(124.0::float8,244.6::float8),ROW(149.8::float8,348.5::float8),ROW(184.8::float8,348.7::float8),ROW(182::float8,348.9::float8),ROW(181.2::float8,241.7::float8),ROW(164.7::float8,348.8::float8),ROW(166.4::float8,361.5::float8),ROW(147.6::float8,242.6::float8),ROW(215.1::float8,348.9::float8),ROW(161.7::float8,326.9::float8),ROW(121.9::float8,242.1::float8),ROW(162.4::float8,328.8::float8),ROW(216.1::float8,356.6::float8),ROW(118.9::float8,284.9::float8),ROW(132.8::float8,397.3::float8),ROW(118.0::float8,299.2::float8),ROW(180.4::float8,307.7::float8),ROW(166.1::float8,323.7::float8),ROW(167.6::float8,296.2::float8),ROW(196.1::float8,287.4::float8),ROW(148.8::float8,240.6::float8),ROW(167.1::float8,293.6::float8),ROW(196::float8,289.4::float8),ROW(130.8::float8,399.7::float8),ROW(171.7::float8,353.6::float8),ROW(107.9::float8,292.0::float8),ROW(154.9::float8,248.5::float8),ROW(174.8::float8,308.2::float8),ROW(182.1::float8,342.2::float8),ROW(120.3::float8,287.6::float8),ROW(112.2::float8,303.1::float8),ROW(174.7::float8,349.2::float8),ROW(192.7::float8,240.8::float8),ROW(164.6::float8,336.7::float8),ROW(128.3::float8,392.1::float8),ROW(199.4::float8,286.5::float8)]) WITH ORDINALITY AS t(p, n)
    WHERE n = spawn_idx
  )
  SELECT x, y INTO spawn_x, spawn_y FROM points;

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