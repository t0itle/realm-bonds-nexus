
-- Add storage capacity to villages
ALTER TABLE public.villages ADD COLUMN IF NOT EXISTS storage_capacity INTEGER NOT NULL DEFAULT 2000;

-- Add warehouse building type support (it's just another building type string)
-- No schema change needed, just logic

-- Caravans table for resource transfers between settlements
CREATE TABLE public.caravans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  to_village_id UUID NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  gold INTEGER NOT NULL DEFAULT 0,
  wood INTEGER NOT NULL DEFAULT 0,
  stone INTEGER NOT NULL DEFAULT 0,
  food INTEGER NOT NULL DEFAULT 0,
  steel INTEGER NOT NULL DEFAULT 0,
  departed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  arrives_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_transit',
  raided_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.caravans ENABLE ROW LEVEL SECURITY;

-- Everyone can see caravans (for raiding visibility)
CREATE POLICY "Anyone authenticated can view caravans"
  ON public.caravans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own caravans"
  ON public.caravans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own caravans"
  ON public.caravans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own caravans"
  ON public.caravans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for caravans so players can see them moving
ALTER PUBLICATION supabase_realtime ADD TABLE public.caravans;
