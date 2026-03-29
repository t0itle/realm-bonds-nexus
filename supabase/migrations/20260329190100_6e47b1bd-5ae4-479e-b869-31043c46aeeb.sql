
-- Player-to-player messages
CREATE TABLE public.player_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON public.player_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON public.player_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark own messages read"
  ON public.player_messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- Guild/alliance chat
CREATE TABLE public.alliance_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alliance_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members can view messages"
  ON public.alliance_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.alliance_members am
    WHERE am.alliance_id = alliance_messages.alliance_id AND am.user_id = auth.uid()
  ));

CREATE POLICY "Alliance members can send messages"
  ON public.alliance_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.alliance_members am
    WHERE am.alliance_id = alliance_messages.alliance_id AND am.user_id = auth.uid()
  ));

-- Guild tax system: add tax_rate to alliances, add treasury columns
ALTER TABLE public.alliances 
  ADD COLUMN tax_rate INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN treasury_gold BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN treasury_wood BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN treasury_stone BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN treasury_food BIGINT NOT NULL DEFAULT 0;

-- Guild contracts
CREATE TABLE public.alliance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id UUID NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  assigned_to UUID,
  title TEXT NOT NULL,
  description TEXT,
  reward_gold INTEGER NOT NULL DEFAULT 0,
  reward_wood INTEGER NOT NULL DEFAULT 0,
  reward_stone INTEGER NOT NULL DEFAULT 0,
  reward_food INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.alliance_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members can view contracts"
  ON public.alliance_contracts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.alliance_members am
    WHERE am.alliance_id = alliance_contracts.alliance_id AND am.user_id = auth.uid()
  ));

CREATE POLICY "Alliance leaders can create contracts"
  ON public.alliance_contracts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.alliance_members am
    WHERE am.alliance_id = alliance_contracts.alliance_id AND am.user_id = auth.uid() AND am.role IN ('leader', 'officer')
  ));

CREATE POLICY "Alliance members can update contracts"
  ON public.alliance_contracts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.alliance_members am
    WHERE am.alliance_id = alliance_contracts.alliance_id AND am.user_id = auth.uid()
  ));

-- Enable realtime for messaging
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alliance_messages;
