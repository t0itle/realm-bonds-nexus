
-- Add target_user_id and sent_army to active_marches
ALTER TABLE public.active_marches ADD COLUMN target_user_id uuid;
ALTER TABLE public.active_marches ADD COLUMN sent_army jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Create active_reinforcements table
CREATE TABLE public.active_reinforcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  host_village_id uuid NOT NULL REFERENCES public.villages(id) ON DELETE CASCADE,
  troops jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.active_reinforcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage own reinforcements"
ON public.active_reinforcements
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Host can view reinforcements at their village"
ON public.active_reinforcements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.villages v
    WHERE v.id = host_village_id AND v.user_id = auth.uid()
  )
);
