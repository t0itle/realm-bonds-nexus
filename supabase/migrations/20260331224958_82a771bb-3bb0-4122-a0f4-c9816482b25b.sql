
CREATE OR REPLACE FUNCTION public.raze_outpost(p_outpost_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM outposts WHERE id = p_outpost_id;
$$;
