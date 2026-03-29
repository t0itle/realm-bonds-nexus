
CREATE TABLE public.alliance_resource_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  gold integer NOT NULL DEFAULT 0,
  wood integer NOT NULL DEFAULT 0,
  stone integer NOT NULL DEFAULT 0,
  food integer NOT NULL DEFAULT 0,
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alliance_resource_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members can view their alliance transfers"
  ON public.alliance_resource_transfers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alliance_members am
      WHERE am.alliance_id = alliance_resource_transfers.alliance_id
      AND am.user_id = auth.uid()
    )
  );

CREATE POLICY "Alliance members can send resources"
  ON public.alliance_resource_transfers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.alliance_members am
      WHERE am.alliance_id = alliance_resource_transfers.alliance_id
      AND am.user_id = auth.uid()
    )
  );
