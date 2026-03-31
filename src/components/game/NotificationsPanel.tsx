import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

type NotifItem = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  time: string;
  type: 'attack_on_me' | 'vassal_attacked' | 'vassalized' | 'rebellion' | 'general';
};

function timeAgoStr(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPanel({ embedded = false }: { embedded?: boolean }) {
  const { vassalages, battleLogs, resources, population, buildings } = useGame();
  const { user } = useAuth();
  const [dbAlerts, setDbAlerts] = useState<BattleAlert[]>([]);
  const wallTipShown = useRef(false);

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      // Fetch attacks on me + attacks on my vassals
      const myVassalIds = vassalages
        .filter(v => v.lord_id === user.id && v.status === 'active')
        .map(v => v.vassal_id);

      const allDefenderIds = [user.id, ...myVassalIds];

      const { data } = await supabase
        .from('battle_reports')
        .select('id, attacker_id, attacker_name, defender_id, defender_name, result, created_at, vassalized, resources_raided, building_damaged')
        .in('defender_id', allDefenderIds)
        .order('created_at', { ascending: false })
        .limit(30);

      if (data) setDbAlerts(data as BattleAlert[]);
    };

    fetchAlerts();

    // Subscribe to realtime updates
    const channel = supabase.channel('notif-battles')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'battle_reports',
      }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, vassalages]);

  // Build unified notification list
  const notifications: NotifItem[] = [];

  // Battle alerts from DB
  for (const alert of dbAlerts) {
    const raided = alert.resources_raided || {};
    const raidStr = [
      raided.gold ? `${raided.gold}💰` : '',
      raided.wood ? `${raided.wood}🪵` : '',
      raided.stone ? `${raided.stone}🪨` : '',
      raided.food ? `${raided.food}🌾` : '',
    ].filter(Boolean).join(' ');

    if (alert.defender_id === user?.id) {
      // I was attacked
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
      });
    } else {
      // My vassal was attacked
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
      });
    }
  }

  // Resource warnings
  if (resources.food <= 0) {
    notifications.push({
      id: 'warn-food',
      icon: '⚠️',
      title: 'Famine! Your food reserves are empty',
      detail: 'Troops and citizens will desert if food stays at 0',
      time: 'Now',
      type: 'general',
    });
  }

  if (population.happiness < 25) {
    notifications.push({
      id: 'warn-happy',
      icon: '😡',
      title: 'Unrest! Happiness critically low',
      detail: `Happiness at ${population.happiness}% — citizens may revolt`,
      time: 'Now',
      type: 'general',
    });
  }

  // Vassal status reminders
  const myLords = vassalages.filter(v => v.vassal_id === user?.id && v.status === 'active');
  for (const v of myLords) {
    const canRebel = new Date(v.rebellion_available_at) <= new Date();
    if (canRebel) {
      notifications.push({
        id: `rebel-ready-${v.id}`,
        icon: '🔓',
        title: 'Rebellion available!',
        detail: 'You can now attempt to rebel against your lord',
        time: 'Now',
        type: 'rebellion',
      });
    }
  }

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
      <h2 className="font-display text-lg text-foreground text-shadow-gold">🔔 Notifications</h2>

      {notifications.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12">
          <span className="text-4xl">🔕</span>
          <p className="text-sm text-muted-foreground">All quiet in the realm</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`game-panel rounded-xl p-3 space-y-1 border ${typeColors[n.type]}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-display text-foreground leading-tight">{n.title}</p>
                    <span className="text-[8px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{n.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
