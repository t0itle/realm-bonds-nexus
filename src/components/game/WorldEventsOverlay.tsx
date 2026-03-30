import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGameState';
import { Sparkles, Skull, Sword, ShoppingCart, CloudLightning, Ghost, X, Check } from 'lucide-react';

interface WorldEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  effects: Record<string, number>;
  status: string;
  created_at: string;
  expires_at: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  crisis: <Skull className="w-4 h-4 text-destructive" />,
  opportunity: <Sparkles className="w-4 h-4 text-primary" />,
  military: <Sword className="w-4 h-4 text-orange-400" />,
  trade: <ShoppingCart className="w-4 h-4 text-emerald-400" />,
  weather: <CloudLightning className="w-4 h-4 text-blue-400" />,
  supernatural: <Ghost className="w-4 h-4 text-purple-400" />,
};

const EVENT_COLORS: Record<string, string> = {
  crisis: 'border-destructive/30 bg-destructive/5',
  opportunity: 'border-primary/30 bg-primary/5',
  military: 'border-orange-400/30 bg-orange-400/5',
  trade: 'border-emerald-400/30 bg-emerald-400/5',
  weather: 'border-blue-400/30 bg-blue-400/5',
  supernatural: 'border-purple-400/30 bg-purple-400/5',
};

function formatEffect(key: string, val: number): string {
  const sign = val > 0 ? '+' : '';
  const icons: Record<string, string> = { gold: '💰', wood: '🪵', stone: '🪨', food: '🌾', happiness: '😊', population: '👤' };
  return `${icons[key] || ''} ${sign}${val} ${key}`;
}

export default function WorldEventsOverlay() {
  const { user } = useAuth();
  const game = useGame();
  const [events, setEvents] = useState<WorldEvent[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      const { data } = await supabase
        .from('world_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);
      setEvents((data as WorldEvent[]) || []);
    };

    fetchEvents();

    // Realtime subscription
    const channel = supabase
      .channel('world-events')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'world_events',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const resolveEvent = async (event: WorldEvent, accept: boolean) => {
    if (accept) {
      // Apply effects to village
      const effects = event.effects;
      const updates: Record<string, any> = {};

      if (effects.gold) updates.gold = Math.max(0, game.resources.gold + effects.gold);
      if (effects.wood) updates.wood = Math.max(0, game.resources.wood + effects.wood);
      if (effects.stone) updates.stone = Math.max(0, game.resources.stone + effects.stone);
      if (effects.food) updates.food = Math.max(0, game.resources.food + effects.food);
      if (effects.happiness) updates.happiness = Math.max(0, Math.min(100, game.population.happiness + effects.happiness));
      if (effects.population) updates.population = Math.max(1, game.population.current + effects.population);

      if (Object.keys(updates).length > 0 && game.villageId) {
        await supabase.from('villages').update(updates).eq('id', game.villageId);
      }

      // Apply local state too
      if (effects.gold || effects.wood || effects.stone || effects.food) {
        game.addResources({
          gold: effects.gold || 0,
          wood: effects.wood || 0,
          stone: effects.stone || 0,
          food: effects.food || 0,
        });
      }
    }

    // Mark resolved
    await supabase.from('world_events').update({
      status: accept ? 'accepted' : 'dismissed',
      resolved_at: new Date().toISOString(),
    }).eq('id', event.id);

    setEvents(prev => prev.filter(e => e.id !== event.id));
  };

  if (events.length === 0) return null;

  return (
    <div className="mx-3 mb-2 space-y-2">
      <AnimatePresence>
        {events.map(event => {
          const colorClass = EVENT_COLORS[event.event_type] || EVENT_COLORS.opportunity;
          const icon = EVENT_ICONS[event.event_type] || EVENT_ICONS.opportunity;
          const nonZeroEffects = Object.entries(event.effects).filter(([, v]) => v !== 0);

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`game-panel rounded-xl border p-3 ${colorClass}`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-display font-bold text-foreground">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>

                  {nonZeroEffects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {nonZeroEffects.map(([key, val]) => (
                        <span key={key} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                          val > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {formatEffect(key, val)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1.5 mt-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => resolveEvent(event, true)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-display bg-primary text-primary-foreground"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => resolveEvent(event, false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-display bg-muted text-muted-foreground"
                    >
                      <X className="w-3 h-3" /> Dismiss
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
