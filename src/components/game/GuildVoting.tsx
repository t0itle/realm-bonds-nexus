import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import ResourceIcon from './ResourceIcon';

interface GuildVotingProps {
  allianceId: string;
  isLeader: boolean;
}

interface Proposal {
  id: string;
  alliance_id: string;
  proposed_by: string;
  type: string;
  title: string;
  description: string | null;
  payload: any;
  status: string;
  votes_for: number;
  votes_against: number;
  expires_at: string;
  created_at: string;
  proposer_name?: string;
  my_vote?: string | null;
  member_count?: number;
}

type ProposalType = 'tax_rate' | 'transfer' | 'war';

export default function GuildVoting({ allianceId, isLeader }: GuildVotingProps) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [creating, setCreating] = useState(false);
  const [proposalType, setProposalType] = useState<ProposalType>('tax_rate');
  const [loading, setLoading] = useState(false);

  const [newTaxRate, setNewTaxRate] = useState(10);
  const [transferResource, setTransferResource] = useState('gold');
  const [transferAmount, setTransferAmount] = useState(100);
  const [transferTarget, setTransferTarget] = useState('');
  const [warTarget, setWarTarget] = useState('');
  const [warReason, setWarReason] = useState('');

  const [members, setMembers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [otherAlliances, setOtherAlliances] = useState<{ id: string; name: string; tag: string }[]>([]);

  useEffect(() => {
    loadProposals();
    loadMembers();
    loadOtherAlliances();
    const interval = setInterval(loadProposals, 10000);
    return () => clearInterval(interval);
  }, [allianceId]);

  const loadMembers = async () => {
    const { data: memberData } = await supabase
      .from('alliance_members')
      .select('user_id')
      .eq('alliance_id', allianceId);
    if (!memberData) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', memberData.map(m => m.user_id));
    if (profiles) setMembers(profiles);
  };

  const loadOtherAlliances = async () => {
    const { data } = await supabase
      .from('alliances')
      .select('id, name, tag')
      .neq('id', allianceId);
    if (data) setOtherAlliances(data);
  };

  const loadProposals = async () => {
    if (!user) return;

    const { data: props } = await supabase
      .from('guild_proposals')
      .select('*')
      .eq('alliance_id', allianceId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!props) return;

    const { count } = await supabase
      .from('alliance_members')
      .select('*', { count: 'exact', head: true })
      .eq('alliance_id', allianceId);

    const { data: myVotes } = await supabase
      .from('guild_votes')
      .select('proposal_id, vote')
      .eq('user_id', user.id)
      .in('proposal_id', props.map(p => p.id));

    const voteMap = new Map(myVotes?.map(v => [v.proposal_id, v.vote]) || []);

    const proposerIds = [...new Set(props.map(p => p.proposed_by))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', proposerIds);
    const nameMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    const now = new Date();
    const enriched = props.map(p => ({
      ...p,
      my_vote: voteMap.get(p.id) || null,
      proposer_name: nameMap.get(p.proposed_by) || 'Unknown',
      member_count: count || 1,
    }));

    for (const p of enriched) {
      if (p.status === 'open' && new Date(p.expires_at) < now) {
        const passed = p.votes_for > p.votes_against && p.votes_for > 0;
        await supabase
          .from('guild_proposals')
          .update({ status: passed ? 'passed' : 'failed' })
          .eq('id', p.id);
        p.status = passed ? 'passed' : 'failed';

        if (passed) {
          await executeProposal(p);
        }
      }
    }

    setProposals(enriched);
  };

  const executeProposal = async (proposal: Proposal) => {
    const payload = proposal.payload as any;
    if (proposal.type === 'tax_rate') {
      await supabase
        .from('alliances')
        .update({ tax_rate: payload.rate })
        .eq('id', allianceId);
      toast.success(`Tax rate changed to ${payload.rate}% by vote`);
    }
  };

  const createProposal = async () => {
    if (!user) return;
    setLoading(true);

    let title = '';
    let description = '';
    let payload: any = {};

    if (proposalType === 'tax_rate') {
      title = `Change tax rate to ${newTaxRate}%`;
      description = `Proposal to set the guild tax rate to ${newTaxRate}%`;
      payload = { rate: newTaxRate };
    } else if (proposalType === 'transfer') {
      const targetName = members.find(m => m.user_id === transferTarget)?.display_name || 'Unknown';
      title = `Transfer ${transferAmount} ${transferResource} to ${targetName}`;
      description = `Withdraw ${transferAmount} ${transferResource} from treasury to ${targetName}`;
      payload = { resource: transferResource, amount: transferAmount, target_id: transferTarget, target_name: targetName };
    } else if (proposalType === 'war') {
      const targetAlliance = otherAlliances.find(a => a.id === warTarget);
      title = `Declare war on [${targetAlliance?.tag}] ${targetAlliance?.name}`;
      description = warReason || `War declaration against ${targetAlliance?.name}`;
      payload = { target_alliance_id: warTarget, target_name: targetAlliance?.name };
    }

    const { error } = await supabase.from('guild_proposals').insert({
      alliance_id: allianceId,
      proposed_by: user.id,
      type: proposalType,
      title,
      description,
      payload,
    });

    if (error) {
      toast.error('Failed to create proposal');
    } else {
      toast.success('Proposal created! Members have 24h to vote.');
      setCreating(false);

      // Send push notifications to all other guild members
      const otherMembers = members.filter(m => m.user_id !== user.id);
      const proposerName = members.find(m => m.user_id === user.id)?.display_name || 'A member';
      for (const member of otherMembers) {
        supabase.functions.invoke('send-push', {
          body: {
            user_id: member.user_id,
            title: '🗳️ New Guild Proposal',
            body: `${proposerName}: ${title}`,
            tag: 'guild-proposal',
          },
        }).catch(console.error);
      }
    }
    setLoading(false);
    loadProposals();
  };

  const castVote = async (proposalId: string, vote: 'for' | 'against') => {
    if (!user) return;

    const { error } = await supabase.from('guild_votes').insert({
      proposal_id: proposalId,
      user_id: user.id,
      vote,
    });
    if (error) {
      if (error.code === '23505') toast.error('You already voted');
      else toast.error('Vote failed');
      return;
    }

    const field = vote === 'for' ? 'votes_for' : 'votes_against';
    const proposal = proposals.find(p => p.id === proposalId);
    if (proposal) {
      await supabase
        .from('guild_proposals')
        .update({ [field]: (proposal[field as keyof Proposal] as number) + 1 })
        .eq('id', proposalId);

      const newCount = (proposal[field as keyof Proposal] as number) + 1;
      const memberCount = proposal.member_count || 1;
      if (newCount > memberCount / 2) {
        const passed = vote === 'for';
        await supabase
          .from('guild_proposals')
          .update({ status: passed ? 'passed' : 'failed' })
          .eq('id', proposalId);
        if (passed) {
          await executeProposal(proposal);
        }
        toast.success(passed ? 'Proposal passed by majority!' : 'Proposal rejected by majority!');
      }
    }

    toast.success(`Vote cast: ${vote}`);
    loadProposals();
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'tax_rate': return '💰';
      case 'transfer': return '📦';
      case 'war': return '⚔️';
      default: return '📜';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-primary';
      case 'passed': return 'text-green-400';
      case 'failed': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const timeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m left`;
  };

  return (
    <div className="game-panel border-glow rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-foreground">🗳️ Guild Voting</h3>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setCreating(!creating)}
          className="bg-primary/20 text-primary text-sm px-3 py-2 rounded font-display"
        >
          {creating ? 'Cancel' : '+ Propose'}
        </motion.button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-2"
          >
            <div className="flex gap-2">
              {(['tax_rate', 'transfer', 'war'] as ProposalType[]).map(t => (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setProposalType(t)}
                  className={`flex-1 text-sm py-2.5 rounded font-display ${
                    proposalType === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {typeIcon(t)} {t === 'tax_rate' ? 'Tax' : t === 'transfer' ? 'Transfer' : 'War'}
                </motion.button>
              ))}
            </div>

            {proposalType === 'tax_rate' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">New rate:</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={newTaxRate}
                  onChange={e => setNewTaxRate(Number(e.target.value))}
                  className="w-14 bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground text-center"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}

            {proposalType === 'transfer' && (
              <div className="space-y-2">
                <div className="flex gap-3">
                  <select
                    value={transferResource}
                    onChange={e => setTransferResource(e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
                  >
                    <option value="gold">Gold</option>
                    <option value="wood">Wood</option>
                    <option value="stone">Stone</option>
                    <option value="food">Food</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={transferAmount}
                    onChange={e => setTransferAmount(Number(e.target.value))}
                    className="w-20 bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground text-center"
                  />
                </div>
                <select
                  value={transferTarget}
                  onChange={e => setTransferTarget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select recipient...</option>
                  {members.filter(m => m.user_id !== user?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                  ))}
                </select>
              </div>
            )}

            {proposalType === 'war' && (
              <div className="space-y-2">
                <select
                  value={warTarget}
                  onChange={e => setWarTarget(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select target alliance...</option>
                  {otherAlliances.map(a => (
                    <option key={a.id} value={a.id}>[{a.tag}] {a.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={warReason}
                  onChange={e => setWarReason(e.target.value)}
                  maxLength={100}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground"
                />
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={createProposal}
              disabled={loading || (proposalType === 'transfer' && !transferTarget) || (proposalType === 'war' && !warTarget)}
              className="w-full bg-primary text-primary-foreground font-display text-sm py-3 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Submit Proposal'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {proposals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">No proposals yet</p>
        )}
        {proposals.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-secondary/50 rounded-lg p-2 space-y-1.5"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-display truncate">
                  {typeIcon(p.type)} {p.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  by {p.proposer_name} • {p.status === 'open' ? timeLeft(p.expires_at) : ''}
                </p>
              </div>
              <span className={`text-sm font-display uppercase ${statusColor(p.status)}`}>
                {p.status}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-sm text-green-400">👍 {p.votes_for}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                {(p.votes_for + p.votes_against) > 0 && (
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${(p.votes_for / (p.votes_for + p.votes_against)) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-sm text-destructive">👎 {p.votes_against}</span>
            </div>

            {p.status === 'open' && !p.my_vote && (
              <div className="flex gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => castVote(p.id, 'for')}
                  className="flex-1 bg-green-500/20 text-green-400 text-sm py-2 rounded font-display"
                >
                  Vote For
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => castVote(p.id, 'against')}
                  className="flex-1 bg-destructive/20 text-destructive text-sm py-2 rounded font-display"
                >
                  Vote Against
                </motion.button>
              </div>
            )}
            {p.my_vote && p.status === 'open' && (
              <p className="text-sm text-muted-foreground text-center">
                You voted: <span className={p.my_vote === 'for' ? 'text-green-400' : 'text-destructive'}>{p.my_vote}</span>
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
