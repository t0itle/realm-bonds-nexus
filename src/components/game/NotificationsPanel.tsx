import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/hooks/useGameState';
import { TROOP_INFO } from '@/lib/gameConstants';
import type { TroopType } from '@/lib/gameTypes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface BattleAlert {
  id: string;
  attacker_id: string;
  attacker_name: string;
  defender_id: string;
  defender_name: string;
  result: string;
  created_at: string;
  vassalized: boolean | null;
  resources_raided: any;
  building_damaged: string | null;
  building_damage_levels: number | null;
  attacker_troops_sent: any;
  attacker_troops_lost: any;
  defender_troops_lost: any;
}

type NotifItem = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  type: 'attack_on_me' | 'vassal_attacked' | 'vassalized' | 'rebellion' | 'general';
  battle?: BattleAlert;
};

function timeAgoStr(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TroopList({ troops, label, color }: { troops: any; label: string; color: string }) {
  if (!troops) return null;
  const entries = Object.entries(troops).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return null;
  return (
    <div>
      <p className={`text-[8px] font-display ${color} mb-0.5`}>{label}</p>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {entries.map(([type, count]) => (
          <span key={type} className="text-[9px] text-foreground">
            {TROOP_INFO[type as TroopType]?.emoji || '🗡️'} {TROOP_INFO[type as TroopType]?.name || type}: <span className="font-bold">{Number(count)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ResourceList({ resources, label, color }: { resources: any; label: string; color: string }) {
  if (!resources) return null;
  const icons: Record<string, string> = { gold: '💰', wood: '🪵', stone: '🪨', food: '🌾', steel: '⚙️' };
  const entries = Object.entries(resources).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className={`text-[8px] font-display ${color}`}>{label}</span>
      {entries.map(([type, count]) => (
        <span key={type} className="text-[9px] text-foreground">
          {icons[type] || ''}{Number(count)}
        </span>
      ))}
    </div>
  );
}

function BattleDetail({ battle, isDefender }: { battle: BattleAlert; isDefender: boolean }) {
  const attackerWon = battle.result === 'victory';
  const sumValues = (obj: any) => obj ? Object.values(obj).reduce((s: number, v: any) => s + (Number(v) || 0), 0) as number : 0;
  const totalSent = sumValues(battle.attacker_troops_sent);
  const totalAtkLost = sumValues(battle.attacker_troops_lost);
  const totalDefLost = sumValues(battle.defender_troops_lost);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
        {/* Battle outcome banner */}
        <div className={`rounded-lg px-2 py-1 text-center text-[10px] font-display ${
          (isDefender ? !attackerWon : attackerWon)
            ? 'bg-primary/15 text-primary'
            : 'bg-destructive/15 text-destructive'
        }`}>
          {attackerWon ? `⚔️ ${battle.attacker_name} won the battle` : `🛡️ ${battle.defender_name} held the line`}
        </div>

        {/* Attacker section */}
        <div className="game-panel rounded-lg p-2 space-y-1">
          <p className="text-[9px] font-display text-foreground">⚔️ Attacker — {battle.attacker_name}</p>
          <TroopList troops={battle.attacker_troops_sent} label="Troops Sent" color="text-muted-foreground" />
          <TroopList troops={battle.attacker_troops_lost} label="Casualties" color="text-destructive" />
          {totalSent > 0 && (
            <p className="text-[8px] text-muted-foreground">
              Survived: {totalSent - totalAtkLost}/{totalSent} ({totalSent > 0 ? Math.round(((totalSent - totalAtkLost) / totalSent) * 100) : 0}%)
            </p>
          )}
        </div>

        {/* Defender section */}
        <div className="game-panel rounded-lg p-2 space-y-1">
          <p className="text-[9px] font-display text-foreground">🛡️ Defender — {battle.defender_name}</p>
          <TroopList troops={battle.defender_troops_lost} label="Casualties" color="text-destructive" />
          {totalDefLost > 0 && (
            <p className="text-[8px] text-muted-foreground">Lost {totalDefLost} troops in defense</p>
          )}
          {totalDefLost === 0 && (
            <p className="text-[8px] text-muted-foreground">No casualties</p>
          )}
        </div>

        {/* Spoils / Damage */}
        <div className="space-y-1">
          <ResourceList
            resources={battle.resources_raided}
            label={isDefender ? '📦 Lost:' : '📦 Plundered:'}
            color={isDefender ? 'text-destructive' : 'text-primary'}
          />
          {battle.building_damaged && (
            <p className="text-[9px] text-amber-400">
              🏚️ {battle.building_damaged} damaged{battle.building_damage_levels ? ` (−${battle.building_damage_levels} lvl)` : ''}
            </p>
          )}
          {battle.vassalized && (
            <p className="text-[9px] font-bold text-primary">
              ⛓️ {isDefender ? 'You were vassalized!' : 'Enemy vassalized!'}
            </p>
          )}
        </div>

        <p className="text-[7px] text-muted-foreground text-right">
          {new Date(battle.created_at).toLocaleString()}
        </p>
      </div>
    </motion.div>
  );
}

export default function NotificationsPanel({ embedded = false }: { embedded?: boolean }) {
  const { vassalages, battleLogs, resources, population, buildings } = useGame();
  const { user } = useAuth();
  const [dbAlerts, setDbAlerts] = useState<BattleAlert[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wallTipShown = useRef(false);

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      const myVassalIds = vassalages
        .filter(v => v.lord_id === user.id && v.status === 'active')
        .map(v => v.vassal_id);

      const allDefenderIds = [user.id, ...myVassalIds];

      const { data } = await supabase
        .from('battle_reports')
        .select('*')
        .in('defender_id', allDefenderIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setDbAlerts(data as BattleAlert[]);
        if (!wallTipShown.current && data.some(a => a.defender_id === user.id)) {
          const hasWall = buildings.some(b => b.type === 'wall');
          const dismissed = localStorage.getItem('wall_tip_dismissed');
          if (!hasWall && !dismissed) {
            wallTipShown.current = true;
            toast('🧱 Build Walls!', {
              description: 'Your village was attacked! Build Walls to boost defense.',
              duration: 12000,
              action: { label: 'Got it', onClick: () => localStorage.setItem('wall_tip_dismissed', '1') },
            });
          }
        }
      }
    };

    fetchAlerts();

    const channel = supabase.channel('notif-battles')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_reports',
      }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, vassalages, buildings]);

  // Also fetch reports where I'm the attacker
  const [sentAlerts, setSentAlerts] = useState<BattleAlert[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from('battle_reports')
      .select('*')
      .eq('attacker_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setSentAlerts(data as BattleAlert[]);
      });
  }, [user, dbAlerts]); // refetch when dbAlerts change (realtime)

  const notifications: NotifItem[] = [];

  // Sent attacks
  for (const alert of sentAlerts) {
    const raided = alert.resources_raided || {};
    const raidStr = [
      raided.gold ? `${raided.gold}💰` : '',
      raided.wood ? `${raided.wood}🪵` : '',
      raided.stone ? `${raided.stone}🪨` : '',
      raided.food ? `${raided.food}🌾` : '',
    ].filter(Boolean).join(' ');

    notifications.push({
      id: `sent-${alert.id}`,
      icon: alert.result === 'victory' ? '⚔️' : '💀',
      title: alert.result === 'victory'
        ? `You raided ${alert.defender_name}!`
        : `Your attack on ${alert.defender_name} failed`,
      detail: alert.result === 'victory' && raidStr ? `Plundered: ${raidStr}` : 'Your forces were repelled',
      time: timeAgoStr(alert.created_at),
      type: 'general',
      battle: alert,
    });
  }

  // Received attacks
  for (const alert of dbAlerts) {
    const raided = alert.resources_raided || {};
    const raidStr = [
      raided.gold ? `${raided.gold}💰` : '',
      raided.wood ? `${raided.wood}🪵` : '',
      raided.stone ? `${raided.stone}🪨` : '',
      raided.food ? `${raided.food}🌾` : '',
    ].filter(Boolean).join(' ');

    if (alert.defender_id === user?.id) {
      notifications.push({
        id: alert.id,
        icon: alert.result === 'victory' ? '⚔️' : '🛡️',
        title: alert.result === 'victory'
          ? `${alert.attacker_name} raided your village!`
          : `You repelled ${alert.attacker_name}'s attack!`,
        detail: [
          alert.result === 'victory' && raidStr ? `Lost: ${raidStr}` : '',
          alert.building_damaged ? `${alert.building_damaged} damaged` : '',
          alert.vassalized ? '⛓️ You were vassalized!' : '',
        ].filter(Boolean).join(' · ') || (alert.result === 'victory' ? 'Your defenses fell' : 'Your walls held strong'),
        time: timeAgoStr(alert.created_at),
        type: alert.vassalized ? 'vassalized' : 'attack_on_me',
        battle: alert,
      });
    } else {
      notifications.push({
        id: alert.id,
        icon: '👑',
        title: `${alert.attacker_name} attacked your vassal ${alert.defender_name}`,
        detail: [
          alert.result === 'victory' ? 'Attacker won' : 'Vassal defended',
          raidStr ? `Raided: ${raidStr}` : '',
          alert.vassalized ? '⛓️ Vassal stolen!' : '',
        ].filter(Boolean).join(' · '),
        time: timeAgoStr(alert.created_at),
        type: 'vassal_attacked',
        battle: alert,
      });
    }
  }

  // Resource warnings
  if (resources.food <= 0) {
    notifications.push({ id: 'warn-food', icon: '⚠️', title: 'Famine! Your food reserves are empty', detail: 'Troops and citizens will desert if food stays at 0', time: 'Now', type: 'general' });
  }
  if (population.happiness < 25) {
    notifications.push({ id: 'warn-happy', icon: '😡', title: 'Unrest! Happiness critically low', detail: `Happiness at ${population.happiness}% — citizens may revolt`, time: 'Now', type: 'general' });
  }

  // Rebellion reminders
  const myLords = vassalages.filter(v => v.vassal_id === user?.id && v.status === 'active');
  for (const v of myLords) {
    if (new Date(v.rebellion_available_at) <= new Date()) {
      notifications.push({ id: `rebel-ready-${v.id}`, icon: '🔓', title: 'Rebellion available!', detail: 'You can now attempt to rebel against your lord', time: 'Now', type: 'rebellion' });
    }
  }

  // Sort by time (battles first by created_at, warnings at end)
  notifications.sort((a, b) => {
    if (!a.battle && !b.battle) return 0;
    if (!a.battle) return 1;
    if (!b.battle) return -1;
    return new Date(b.battle.created_at).getTime() - new Date(a.battle.created_at).getTime();
  });

  const typeColors: Record<NotifItem['type'], string> = {
    attack_on_me: 'border-destructive/30',
    vassal_attacked: 'border-amber-500/30',
    vassalized: 'border-destructive/50',
    rebellion: 'border-primary/30',
    general: 'border-border',
  };

  if (embedded) {
    if (notifications.length === 0) return null;
    return (
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <h3 className="font-display text-xs text-foreground flex items-center gap-1">🔔 Alerts</h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {notifications.slice(0, 10).map(n => (
            <div key={n.id} className={`rounded-lg p-2 space-y-0.5 border ${typeColors[n.type]} bg-card/50`}>
              <div className="flex items-start gap-1.5">
                <span className="text-sm">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] font-display text-foreground leading-tight">{n.title}</p>
                    <span className="text-[7px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground">{n.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto pb-20">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">📜 War Chronicle</h2>

      {notifications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
          <span className="text-4xl">🔕</span>
          <p className="text-sm text-muted-foreground">All quiet in the realm</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const isExpanded = expandedId === n.id;
            const isDefender = n.battle ? n.battle.defender_id === user?.id : false;
            return (
              <div
                key={n.id}
                className={`game-panel rounded-xl p-3 border transition-colors ${typeColors[n.type]} ${n.battle ? 'cursor-pointer hover:bg-accent/5' : ''}`}
                onClick={() => n.battle && setExpandedId(isExpanded ? null : n.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-display text-foreground leading-tight">{n.title}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                        {n.battle && (
                          <span className="text-[9px] text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{n.detail}</p>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && n.battle && (
                    <BattleDetail battle={n.battle} isDefender={isDefender} />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
