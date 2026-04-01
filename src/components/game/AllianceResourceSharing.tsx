import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGameState';

interface AllianceMember {
  user_id: string;
  role: string;
  displayName: string;
}

interface Transfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  message: string | null;
  created_at: string;
  senderName?: string;
  receiverName?: string;
}

const RESOURCE_ICONS: Record<string, string> = { gold: '💰', wood: '🪵', stone: '🪨', food: '🌾' };

export default function AllianceResourceSharing({ allianceId }: { allianceId: string }) {
  const { user } = useAuth();
  const { resources, villageId } = useGame();
  const [members, setMembers] = useState<AllianceMember[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [amounts, setAmounts] = useState({ gold: 0, wood: 0, stone: 0, food: 0 });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!allianceId || !user) return;
    loadMembers();
    loadTransfers();
  }, [allianceId, user]);

  const loadMembers = async () => {
    const { data: mems } = await supabase
      .from('alliance_members')
      .select('user_id, role')
      .eq('alliance_id', allianceId);
    if (!mems) return;

    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name');
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));

    setMembers(
      mems
        .filter(m => m.user_id !== user!.id)
        .map(m => ({ ...m, displayName: profileMap.get(m.user_id) || 'Unknown' }))
    );
  };

  const loadTransfers = async () => {
    const { data } = await supabase
      .from('alliance_resource_transfers')
      .select('*')
      .eq('alliance_id', allianceId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!data) return;

    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name');
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));

    setTransfers(data.map(t => ({
      ...t,
      senderName: profileMap.get(t.sender_id) || 'Unknown',
      receiverName: profileMap.get(t.receiver_id) || 'Unknown',
    })));
  };

  const totalSending = amounts.gold + amounts.wood + amounts.stone + amounts.food;

  const canSend = selectedMember
    && totalSending > 0
    && amounts.gold <= resources.gold
    && amounts.wood <= resources.wood
    && amounts.stone <= resources.stone
    && amounts.food <= resources.food;

  const sendResources = async () => {
    if (!user || !villageId || !canSend) return;
    setSending(true);
    setError('');
    setSuccess('');

    // Deduct from sender's village
    const { error: updateErr } = await supabase
      .from('villages')
      .update({
        gold: resources.gold - amounts.gold,
        wood: resources.wood - amounts.wood,
        stone: resources.stone - amounts.stone,
        food: resources.food - amounts.food,
      })
      .eq('id', villageId);

    if (updateErr) {
      setError('Failed to deduct resources');
      setSending(false);
      return;
    }

    // Add to receiver's village
    const { data: receiverVillage } = await supabase
      .from('villages')
      .select('id, gold, wood, stone, food')
      .eq('user_id', selectedMember)
      .single();

    if (receiverVillage) {
      await supabase.from('villages').update({
        gold: Number(receiverVillage.gold) + amounts.gold,
        wood: Number(receiverVillage.wood) + amounts.wood,
        stone: Number(receiverVillage.stone) + amounts.stone,
        food: Number(receiverVillage.food) + amounts.food,
      }).eq('id', receiverVillage.id);
    }

    // Log transfer
    await supabase.from('alliance_resource_transfers').insert({
      alliance_id: allianceId,
      sender_id: user.id,
      receiver_id: selectedMember,
      gold: amounts.gold,
      wood: amounts.wood,
      stone: amounts.stone,
      food: amounts.food,
    });

    setAmounts({ gold: 0, wood: 0, stone: 0, food: 0 });
    setSuccess('Resources sent!');
    setSending(false);
    loadTransfers();
  };

  return (
    <div className="space-y-3">
      <h3 className="font-display text-sm text-foreground">📦 Share Resources</h3>

      {/* Send form */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <select
          value={selectedMember}
          onChange={e => setSelectedMember(e.target.value)}
          className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground"
        >
          <option value="">Select member...</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>{m.displayName} ({m.role})</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3">
          {(['gold', 'wood', 'stone', 'food'] as const).map(res => (
            <div key={res} className="flex items-center gap-2">
              <span className="text-sm">{RESOURCE_ICONS[res]}</span>
              <input
                type="number"
                min={0}
                max={resources[res]}
                value={amounts[res] || ''}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') { setAmounts(prev => ({ ...prev, [res]: 0 })); return; }
                  const val = Math.max(0, Math.min(Math.floor(resources[res]), parseInt(raw) || 0));
                  setAmounts(prev => ({ ...prev, [res]: val }));
                }}
                placeholder="0"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-primary">{success}</p>}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={sendResources}
          disabled={!canSend || sending}
          className="w-full wood-btn-primary font-display text-sm py-3 rounded-lg glow-gold disabled:opacity-40"
        >
          {sending ? 'Sending...' : `Send Resources`}
        </motion.button>
      </div>

      {/* Transfer history */}
      {transfers.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="font-display text-sm text-muted-foreground">Recent Transfers</h4>
          {transfers.slice(0, 5).map(t => {
            const parts = [];
            if (t.gold > 0) parts.push(`💰${t.gold}`);
            if (t.wood > 0) parts.push(`🪵${t.wood}`);
            if (t.stone > 0) parts.push(`🪨${t.stone}`);
            if (t.food > 0) parts.push(`🌾${t.food}`);
            const isSender = t.sender_id === user?.id;
            return (
              <div key={t.id} className="game-panel rounded-lg p-2 text-sm text-muted-foreground flex items-center justify-between">
                <span>
                  {isSender ? `You → ${t.receiverName}` : `${t.senderName} → You`}
                </span>
                <span className="text-foreground font-bold">{parts.join(' ')}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
