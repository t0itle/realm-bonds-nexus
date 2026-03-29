import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceBar from './ResourceBar';
import ThemeToggle from '@/components/ThemeToggle';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

function lazyRetry<T extends { default: React.ComponentType<any> }>(
  fn: () => Promise<T>
): React.LazyExoticComponent<T['default']> {
  return lazy(() =>
    fn().catch(() => {
      // Retry once after a brief delay (handles stale HMR cache)
      return new Promise<T>((resolve) => {
        setTimeout(() => resolve(fn()), 1500);
      });
    })
  );
}

const VillageGrid = lazyRetry(() => import('./VillageGrid'));
const WorldMap = lazyRetry(() => import('./WorldMap'));
const AlliancePanel = lazyRetry(() => import('./AlliancePanel'));
const MilitaryPanel = lazyRetry(() => import('./MilitaryPanel'));
const ProfilePanel = lazyRetry(() => import('./ProfilePanel'));
const MessagesPanel = lazyRetry(() => import('./MessagesPanel'));
const StatSheet = lazyRetry(() => import('./StatSheet'));

function TabFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-2xl animate-float">⏳</div>
    </div>
  );
}

type Tab = 'village' | 'map' | 'military' | 'alliance' | 'messages' | 'profile' | 'stats';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'village', icon: '🏘️', label: 'Village' },
  { id: 'military', icon: '⚔️', label: 'Army' },
  { id: 'stats', icon: '📊', label: 'Stats' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'messages', icon: '💬', label: 'Mail' },
  { id: 'alliance', icon: '🤝', label: 'Guild' },
  { id: 'profile', icon: '👤', label: 'Me' },
];

export default function GameLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('village');
  const [dmTarget, setDmTarget] = useState<{ userId: string; name: string } | null>(null);
  const { villageName, playerLevel, loading, displayName, army, trainingQueue } = useGame();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);

  // Fetch unread message count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from('player_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id).eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const channel = supabase.channel('unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_messages' }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Reset unread when viewing messages
  useEffect(() => {
    if (activeTab === 'messages' && user) {
      const timer = setTimeout(async () => {
        const { count } = await supabase.from('player_messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id).eq('read', false);
        setUnreadCount(count || 0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDmTarget({ userId: detail.userId, name: detail.name });
      setActiveTab('messages');
    };
    window.addEventListener('open-dm', handler);
    return () => window.removeEventListener('open-dm', handler);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <div className="text-4xl animate-float">🏰</div>
        <p className="font-display text-sm text-muted-foreground">Entering the realm...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h1 className="font-display text-sm font-bold text-foreground text-shadow-gold">{villageName || displayName}</h1>
          <span className="text-[10px] text-primary font-semibold">Level {playerLevel}</span>
        </div>
        <div className="flex items-center gap-2">
          {totalTroops > 0 && (
            <span className="text-[10px] text-foreground bg-secondary px-2 py-0.5 rounded-full">⚔️ {totalTroops} troops</span>
          )}
          {trainingQueue.length > 0 && (
            <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">🔨 Training</span>
          )}
          <ThemeToggle />
        </div>
      </div>

      <ResourceBar />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col overflow-y-auto"
          >
            <Suspense fallback={<TabFallback />}>
              {activeTab === 'village' && <VillageGrid />}
              {activeTab === 'military' && <MilitaryPanel />}
              {activeTab === 'stats' && <StatSheet />}
              {activeTab === 'map' && <WorldMap />}
              {activeTab === 'messages' && <MessagesPanel initialDm={dmTarget} onDmHandled={() => setDmTarget(null)} />}
              {activeTab === 'alliance' && <AlliancePanel />}
              {activeTab === 'profile' && <ProfilePanel />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="game-panel border-t border-glow safe-bottom">
        <div className="flex items-center justify-around py-1.5">
          {TABS.map(tab => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0 px-2 py-0.5 rounded-lg transition-colors relative ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-base relative">
                {tab.icon}
                {tab.id === 'messages' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className={`text-[9px] font-semibold ${activeTab === tab.id ? 'font-display' : ''}`}>
                {tab.label}
              </span>
            </motion.button>
          ))}
        </div>
      </nav>
    </div>
  );
}
