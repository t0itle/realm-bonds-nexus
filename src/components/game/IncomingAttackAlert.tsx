import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame, TROOP_INFO, TroopType } from '@/hooks/useGameState';
import { toast } from 'sonner';

interface IncomingMarch {
  id: string;
  user_id: string;
  player_name: string;
  target_user_id: string;
  target_name: string;
  target_x: number;
  target_y: number;
  arrives_at: string;
  started_at: string;
  sent_army: Record<string, number>;
  march_type: string;
}

interface IncomingAttackAlertProps {
  onAllyAttacked?: (march: IncomingMarch, allyName: string) => void;
}

export default function IncomingAttackAlert({ onAllyAttacked }: IncomingAttackAlertProps) {
  const { user } = useAuth();
  const [incomingAttacks, setIncomingAttacks] = useState<IncomingMarch[]>([]);
  const [allianceMembers, setAllianceMembers] = useState<string[]>([]);
  const [allianceMemberNames, setAllianceMemberNames] = useState<Record<string, string>>({});
  const notifiedIds = useRef<Set<string>>(new Set());

  // Fetch alliance membership
  useEffect(() => {
    if (!user) return;
    const fetchAlliance = async () => {
      const { data: myMembership } = await supabase
        .from('alliance_members')
        .select('alliance_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!myMembership) return;

      const { data: members } = await supabase
        .from('alliance_members')
        .select('user_id')
        .eq('alliance_id', myMembership.alliance_id);

      if (members) {
        const ids = members.map(m => m.user_id).filter(id => id !== user.id);
        setAllianceMembers(ids);

        // Fetch display names
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', ids);
          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach(p => { names[p.user_id] = p.display_name; });
            setAllianceMemberNames(names);
          }
        }
      }
    };
    fetchAlliance();
  }, [user]);

  // Subscribe to incoming attacks via realtime
  useEffect(() => {
    if (!user) return;

    const fetchIncoming = async () => {
      const targetIds = [user.id, ...allianceMembers];
      const { data } = await supabase
        .from('active_marches')
        .select('*')
        .in('target_user_id', targetIds)
        .eq('march_type', 'attack')
        .gt('arrives_at', new Date().toISOString())
        .order('arrives_at', { ascending: true });

      if (data) {
        const marches = data as unknown as IncomingMarch[];
        setIncomingAttacks(marches);

        // Show toast notifications for new attacks
        marches.forEach(m => {
          if (notifiedIds.current.has(m.id)) return;
          notifiedIds.current.add(m.id);

          const eta = Math.max(0, Math.floor((new Date(m.arrives_at).getTime() - Date.now()) / 1000));
          const mins = Math.floor(eta / 60);
          const secs = eta % 60;
          const etaStr = `${mins}:${secs.toString().padStart(2, '0')}`;

          if (m.target_user_id === user.id) {
            toast.error(`⚠️ ${m.player_name} is marching on your village! ETA: ${etaStr}`, {
              duration: 15000,
              action: {
                label: '🗺️ Map',
                onClick: () => window.dispatchEvent(new CustomEvent('switch-tab', { detail: 'map' })),
              },
            });
          } else {
            const allyName = allianceMemberNames[m.target_user_id] || m.target_name;
            toast.warning(`🛡️ Your ally ${allyName} is under attack by ${m.player_name}! ETA: ${etaStr}`, {
              duration: 15000,
              action: {
                label: '🗡️ Reinforce',
                onClick: () => onAllyAttacked?.(m, allyName),
              },
            });
          }
        });
      }
    };

    fetchIncoming();

    const channel = supabase.channel('incoming-attacks-alert')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'active_marches',
      }, (payload) => {
        const march = payload.new as any;
        if (march.march_type === 'attack' && (march.target_user_id === user.id || allianceMembers.includes(march.target_user_id))) {
          fetchIncoming();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, allianceMembers, allianceMemberNames, onAllyAttacked]);

  // Timer re-render
  const [, tick] = useState(0);
  useEffect(() => {
    if (incomingAttacks.length === 0) return;
    const interval = setInterval(() => tick(v => v + 1), 1000);
    return () => clearInterval(interval);
  }, [incomingAttacks.length]);

  const myAttacks = incomingAttacks.filter(m => m.target_user_id === user?.id);

  if (myAttacks.length === 0) return null;

  return (
    <div className="px-3 py-1">
      {myAttacks.map(attack => {
        const remaining = Math.max(0, new Date(attack.arrives_at).getTime() - Date.now());
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        const totalSent = attack.sent_army ? Object.values(attack.sent_army).reduce((s, v) => s + (Number(v) || 0), 0) : 0;

        return (
          <motion.div
            key={attack.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="game-panel border border-destructive/50 rounded-xl px-3 py-2 mb-1 bg-destructive/5"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg animate-pulse">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-display text-destructive">
                  Incoming attack from <span className="font-bold">{attack.player_name}</span>!
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-muted-foreground">
                    {totalSent > 0 ? `~${totalSent} troops` : 'Unknown force'}
                  </span>
                  <span className="text-[11px] font-bold text-destructive">
                    ETA: {mins}:{secs.toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
