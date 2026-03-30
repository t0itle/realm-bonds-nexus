
-- Guild proposals table
CREATE TABLE public.guild_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alliance_id uuid NOT NULL REFERENCES public.alliances(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL,
  type text NOT NULL, -- 'tax_rate', 'transfer', 'war'
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  votes_for integer NOT NULL DEFAULT 0,
  votes_against integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Individual votes
CREATE TABLE public.guild_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.guild_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote text NOT NULL, -- 'for' or 'against'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

-- RLS for guild_proposals
ALTER TABLE public.guild_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alliance members can view proposals"
ON public.guild_proposals FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM alliance_members am
  WHERE am.alliance_id = guild_proposals.alliance_id AND am.user_id = auth.uid()
));

CREATE POLICY "Alliance members can create proposals"
ON public.guild_proposals FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = proposed_by AND
  EXISTS (
    SELECT 1 FROM alliance_members am
    WHERE am.alliance_id = guild_proposals.alliance_id AND am.user_id = auth.uid()
  )
);

CREATE POLICY "Alliance members can update proposals"
ON public.guild_proposals FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM alliance_members am
  WHERE am.alliance_id = guild_proposals.alliance_id AND am.user_id = auth.uid()
));

-- RLS for guild_votes
ALTER TABLE public.guild_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view votes on proposals they can see"
ON public.guild_votes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM guild_proposals gp
  JOIN alliance_members am ON am.alliance_id = gp.alliance_id
  WHERE gp.id = guild_votes.proposal_id AND am.user_id = auth.uid()
));

CREATE POLICY "Users can cast votes"
ON public.guild_votes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM guild_proposals gp
    JOIN alliance_members am ON am.alliance_id = gp.alliance_id
    WHERE gp.id = guild_votes.proposal_id AND am.user_id = auth.uid()
  )
);
