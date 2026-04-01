import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGameState';
import ResourceIcon from './ResourceIcon';
import { toast } from 'sonner';

interface Contract {
  id: string;
  alliance_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  reward_gold: number;
  reward_wood: number;
  reward_stone: number;
  reward_food: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface GuildContractsProps {
  allianceId: string;
  isLeader: boolean;
}

export default function GuildContracts({ allianceId, isLeader }: GuildContractsProps) {
  const { user } = useAuth();
  const { allVillages } = useGame();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardGold, setRewardGold] = useState(50);

  const profileMap = new Map(allVillages.map(v => [v.village.user_id, v.profile.display_name]));

  useEffect(() => { loadContracts(); }, [allianceId]);

  const loadContracts = async () => {
    const { data } = await supabase
      .from('alliance_contracts')
      .select('*')
      .eq('alliance_id', allianceId)
      .order('created_at', { ascending: false });
    if (data) setContracts(data);
  };

  const createContract = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from('alliance_contracts').insert({
      alliance_id: allianceId,
      created_by: user.id,
      title: title.trim(),
      description: description.trim() || null,
      reward_gold: rewardGold,
    });
    if (error) { toast.error('Failed to create contract'); return; }
    toast.success('Contract posted!');
    setCreating(false);
    setTitle('');
    setDescription('');
    setRewardGold(50);
    loadContracts();
  };

  const acceptContract = async (contract: Contract) => {
    if (!user || contract.assigned_to) return;
    const { error } = await supabase.from('alliance_contracts')
      .update({ assigned_to: user.id, status: 'in_progress' })
      .eq('id', contract.id);
    if (error) { toast.error('Failed to accept'); return; }
    toast.success(`Accepted: ${contract.title}`);
    loadContracts();
  };

  const completeContract = async (contract: Contract) => {
    if (!user) return;
    // Only assignee or leader can mark complete
    if (contract.assigned_to !== user.id && !isLeader) return;

    // Pay from alliance treasury
    const { data: alliance } = await supabase.from('alliances')
      .select('treasury_gold, treasury_wood, treasury_stone, treasury_food')
      .eq('id', allianceId).single();

    if (alliance && (alliance.treasury_gold as number) >= contract.reward_gold) {
      await supabase.from('alliances').update({
        treasury_gold: (alliance.treasury_gold as number) - contract.reward_gold,
        treasury_wood: (alliance.treasury_wood as number) - contract.reward_wood,
        treasury_stone: (alliance.treasury_stone as number) - contract.reward_stone,
        treasury_food: (alliance.treasury_food as number) - contract.reward_food,
      }).eq('id', allianceId);

      // Pay the worker
      const workerId = contract.assigned_to;
      if (workerId) {
        const { data: village } = await supabase.from('villages')
          .select('*').eq('user_id', workerId).single();
        if (village) {
          await supabase.from('villages').update({
            gold: Number(village.gold) + contract.reward_gold,
            wood: Number(village.wood) + contract.reward_wood,
            stone: Number(village.stone) + contract.reward_stone,
            food: Number(village.food) + contract.reward_food,
          }).eq('id', village.id);
        }
      }
    }

    await supabase.from('alliance_contracts')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', contract.id);

    toast.success(`Contract completed! Reward paid.`);
    loadContracts();
  };

  const openContracts = contracts.filter(c => c.status === 'open');
  const activeContracts = contracts.filter(c => c.status === 'in_progress');
  const completedContracts = contracts.filter(c => c.status === 'completed').slice(0, 5);

  return (
    <div className="game-panel border-glow rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-foreground">📜 Guild Contracts</h3>
        {isLeader && !creating && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCreating(true)}
            className="text-sm wood-btn-primary px-3 py-2 rounded-lg font-display">+ New</motion.button>
        )}
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden">
            <input type="text" placeholder="Contract title..." value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground" />
            <input type="text" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground" />
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-0.5"><ResourceIcon type="gold" size={10} /> Reward:</span>
              <input type="number" min={0} value={rewardGold} onChange={e => setRewardGold(Number(e.target.value))}
                className="w-20 bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground" />
              <span className="text-sm text-muted-foreground">gold</span>
            </div>
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={createContract}
                className="flex-1 wood-btn-primary text-sm py-2.5 rounded-lg font-display">Post Contract</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setCreating(false)}
                className="flex-1 bg-muted text-muted-foreground text-sm py-2.5 rounded-lg">Cancel</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open Contracts */}
      {openContracts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-primary font-display">Open ({openContracts.length})</p>
          {openContracts.map(c => (
            <div key={c.id} className="bg-secondary/50 rounded-lg p-2 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-semibold truncate">{c.title}</p>
                {c.description && <p className="text-sm text-muted-foreground truncate">{c.description}</p>}
                <p className="text-sm text-primary flex items-center gap-0.5"><ResourceIcon type="gold" size={9} /> {c.reward_gold} gold</p>
              </div>
              {c.created_by !== user?.id && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => acceptContract(c)}
                  className="text-sm bg-primary/20 text-primary px-3 py-2 rounded ml-2">Accept</motion.button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active Contracts */}
      {activeContracts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-foreground font-display">In Progress ({activeContracts.length})</p>
          {activeContracts.map(c => (
            <div key={c.id} className="bg-secondary/50 rounded-lg p-2 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-semibold truncate">{c.title}</p>
                <p className="text-sm text-muted-foreground">
                  Assigned to: {profileMap.get(c.assigned_to || '') || 'Unknown'}
                </p>
                <p className="text-sm text-primary flex items-center gap-0.5"><ResourceIcon type="gold" size={9} /> {c.reward_gold} gold</p>
              </div>
              {(c.assigned_to === user?.id || isLeader) && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => completeContract(c)}
                  className="text-sm bg-food/20 text-food px-3 py-2 rounded ml-2">✓ Done</motion.button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completedContracts.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-display">Completed</p>
          {completedContracts.map(c => (
            <div key={c.id} className="bg-muted/30 rounded-lg p-2 opacity-60">
              <p className="text-sm text-foreground line-through">{c.title}</p>
            </div>
          ))}
        </div>
      )}

      {contracts.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          {isLeader ? 'Post contracts for guild members to earn pay' : 'No contracts available'}
        </p>
      )}
    </div>
  );
}
