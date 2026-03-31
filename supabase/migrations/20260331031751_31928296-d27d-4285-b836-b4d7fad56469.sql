
CREATE TABLE public.outposts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  name TEXT NOT NULL DEFAULT 'Outpost',
  outpost_type TEXT NOT NULL DEFAULT 'outpost',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all outposts"
  ON public.outposts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own outposts"
  ON public.outposts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own outposts"
  ON public.outposts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
