import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useGameTicker } from '@/hooks/useGameTicker';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceBar from './ResourceBar';
import ThemeToggle from '@/components/ThemeToggle';
import { useGame } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PatchNotesModal from './PatchNotesModal';
import IncomingAttackAlert from './IncomingAttackAlert';
import AllyDefenseModal from './AllyDefenseModal';
import GratitudeModal from './GratitudeModal';

function lazyRetry<T extends { default: React.ComponentType<any> }>(
  fn: () => Promise<T>
): React.LazyExoticComponent<T['default']> {
  return lazy(() => {
    const attempt = (retries: number): Promise<T> =>
      fn().catch((err) => {
        if (retries > 0) {
          return new Promise<T>((resolve) =>
            setTimeout(() => resolve(attempt(retries - 1)), 1000)
          );
        }
        // After all retries fail, reload the page once
        const hasReloaded = sessionStorage.getItem('lazy_reload');
        if (!hasReloaded) {
          sessionStorage.setItem('lazy_reload', '1');
          window.location.reload();
        }
        throw err;
      });
    sessionStorage.removeItem('lazy_reload');
    return attempt(3);
  });
}

const VillageGrid = lazyRetry(() => import('./VillageGrid'));
const WorldMap = lazyRetry(() => import('./WorldMap'));
const SocialPanel = lazyRetry(() => import('./SocialPanel'));
const ProfilePanel = lazyRetry(() => import('./ProfilePanel'));



function TabFallback() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-2xl animate-float">⏳</div>
    </div>
  );
}

type Tab = 'village' | 'map' | 'social' | 'profile';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'village', icon: '🏘️', label: 'Govern' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'social', icon: '💬', label: 'Social' },
  { id: 'profile', icon: '👤', label: 'Me' },
];

export default function GameLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [hasOpenedMap, setHasOpenedMap] = useState(true);
  const [dmTarget, setDmTarget] = useState<{ userId: string; name: string } | null>(null);
  const isMobile = useIsMobile();
  const { villageName, playerLevel, loading, displayName, army, trainingQueue, vassalages } = useGame();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeMarches, setActiveMarches] = useState<{ id: string; target_name: string; march_type: string; arrives_at: string; started_at: string }[]>([]);
  const [vassalPopup, setVassalPopup] = useState(false);
  // Ally defense modal state
  const [allyDefenseData, setAllyDefenseData] = useState<{
    attackerName: string; allyName: string; allyVillageId?: string;
    targetX: number; targetY: number; attackEta: string;
  } | null>(null);
  // Gratitude modal state
  const [gratitudeData, setGratitudeData] = useState<{ allyUserId: string; allyName: string } | null>(null);
  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);

  // Check if player is vassalized
  const myVassalage = vassalages.find(v => v.vassal_id === user?.id && v.status === 'active');
  const myVassalCount = vassalages.filter(v => v.lord_id === user?.id && v.status === 'active').length;
  const [lordName, setLordName] = useState<string | null>(null);
  useEffect(() => {
    if (!myVassalage) { setLordName(null); return; }
    supabase.from('profiles').select('display_name').eq('user_id', myVassalage.lord_id).single()
      .then(({ data }) => setLordName(data?.display_name || 'Unknown Lord'));
  }, [myVassalage?.lord_id]);
  const tick = useGameTicker();

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

  // Active marches tracker
  useEffect(() => {
    if (!user) return;
    const fetchMarches = async () => {
      const { data } = await supabase.from('active_marches')
        .select('id, target_name, march_type, arrives_at, started_at')
        .eq('user_id', user.id)
        .gt('arrives_at', new Date().toISOString())
        .order('arrives_at', { ascending: true });
      setActiveMarches(data || []);
    };
    fetchMarches();
    const interval = setInterval(fetchMarches, 10000);
    const channel = supabase.channel('march-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_marches' }, () => fetchMarches())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [user]);

  // Reset unread when viewing messages
  useEffect(() => {
    if (activeTab === 'social' && user) {
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
      setActiveTab('social');
    };
    window.addEventListener('open-dm', handler);
    return () => window.removeEventListener('open-dm', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      setActiveTab((e as CustomEvent).detail as Tab);
    };
    window.addEventListener('switch-tab', handler);
    return () => window.removeEventListener('switch-tab', handler);
  }, []);

  useEffect(() => {
    if (activeTab === 'map' && !hasOpenedMap) {
      setHasOpenedMap(true);
    }
  }, [activeTab, hasOpenedMap]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3">
        <div className="text-4xl animate-float">🏰</div>
        <p className="font-display text-sm text-muted-foreground">Entering the realm...</p>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-background overflow-hidden ${isMobile ? 'flex flex-col' : 'flex flex-row'}`}>
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside className="w-64 shrink-0 h-full flex flex-col border-r border-border bg-sidebar overflow-y-auto">
          {/* Header */}
          <div className="px-4 pt-5 pb-3 space-y-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <h1 className="truncate font-display text-base font-bold text-foreground text-shadow-gold">{villageName || displayName}</h1>
              <ThemeToggle />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-primary font-semibold">Level {playerLevel}</span>
              {myVassalage ? (
                <button onClick={() => setVassalPopup(true)} className="text-[10px] font-bold text-destructive bg-destructive/15 px-2 py-0.5 rounded-full animate-pulse">⛓️ Vassalized</button>
              ) : myVassalCount > 0 ? (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">👑 {myVassalCount} Vassal{myVassalCount > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">🛡️ Sovereign</span>
              )}
            </div>
            {totalTroops > 0 && (
              <span className="text-xs text-foreground bg-secondary px-2.5 py-1 rounded-full inline-block">⚔️ {totalTroops} troops</span>
            )}
            {trainingQueue.length > 0 && (
              <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full inline-block animate-pulse">🔨 Training</span>
            )}
          </div>

          {/* Resources in sidebar */}
          <div className="px-2 py-2">
            <ResourceBar />
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 px-2 py-2 space-y-1">
            {TABS.map(tab => (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'bg-primary/15 text-primary font-display'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'social' && unreadCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-1 bottom-1 w-1 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          {/* Marches in sidebar */}
          {activeMarches.length > 0 && (
            <div className="px-3 py-2 border-t border-border/50 space-y-1 max-h-40 overflow-y-auto">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Active Marches</span>
              {activeMarches.map(march => {
                const now = Date.now();
                const arrival = new Date(march.arrives_at).getTime();
                const start = new Date(march.started_at).getTime();
                const remaining = Math.max(0, arrival - now);
                const total = arrival - start;
                const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 1;
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                const emoji = march.march_type === 'attack' ? '⚔️' : march.march_type === 'scout' ? '🔍' : '🚶';
                return (
                  <button key={march.id} onClick={() => setActiveTab('map')}
                    className="w-full flex items-center gap-2 game-panel border border-primary/30 rounded-lg px-2.5 py-1.5 hover:border-primary/60 transition-colors">
                    <span className="text-sm animate-pulse">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-display text-foreground truncate">{march.target_name || 'target'}</span>
                        <span className="text-[10px] font-bold text-primary ml-2 shrink-0">
                          {remaining > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : 'Arriving...'}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      )}

      {/* ── Main content area ── */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isMobile ? '' : 'h-full'}`}>
        {/* Mobile header */}
        {isMobile && (
          <>
            <div className="px-4 pt-3 pb-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-display text-sm font-bold text-foreground text-shadow-gold">{villageName || displayName}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-primary font-semibold">Level {playerLevel}</span>
                    {myVassalage ? (
                      <button onClick={() => setVassalPopup(true)} className="text-[9px] font-bold text-destructive bg-destructive/15 px-2 py-0.5 rounded-full animate-pulse">⛓️ Vassalized</button>
                    ) : myVassalCount > 0 ? (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">👑 {myVassalCount} Vassal{myVassalCount > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-[9px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">🛡️ Sovereign</span>
                    )}
                    {totalTroops > 0 && (
                      <span className="text-[10px] text-foreground bg-secondary px-2 py-0.5 rounded-full">⚔️ {totalTroops} troops</span>
                    )}
                    {trainingQueue.length > 0 && (
                      <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">🔨 Training</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <ThemeToggle />
                </div>
              </div>
            </div>

            <ResourceBar />
          </>
        )}

        {/* Incoming attack warnings */}
        <IncomingAttackAlert
          onAllyAttacked={(march, allyName) => {
            supabase.from('villages').select('id').eq('user_id', march.target_user_id).single()
              .then(({ data }) => {
                setAllyDefenseData({
                  attackerName: march.player_name,
                  allyName,
                  allyVillageId: data?.id,
                  targetX: march.target_x as any,
                  targetY: march.target_y as any,
                  attackEta: march.arrives_at,
                });
              });
          }}
        />

        {/* Active marches banner — mobile only */}
        {isMobile && activeMarches.length > 0 && (
          <div className="px-3 py-1.5 max-h-24 overflow-y-auto scrollbar-thin">
            {activeMarches.map(march => {
              const now = Date.now();
              const arrival = new Date(march.arrives_at).getTime();
              const start = new Date(march.started_at).getTime();
              const remaining = Math.max(0, arrival - now);
              const total = arrival - start;
              const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 1;
              const mins = Math.floor(remaining / 60000);
              const secs = Math.floor((remaining % 60000) / 1000);
              const emoji = march.march_type === 'attack' ? '⚔️' : march.march_type === 'scout' ? '🔍' : '🚶';
              return (
                <button key={march.id} onClick={() => setActiveTab('map')}
                  className="w-full flex items-center gap-2 game-panel border border-primary/30 rounded-lg px-3 py-1.5 mb-1 hover:border-primary/60 transition-colors">
                  <span className="text-sm animate-pulse">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-display text-foreground truncate">
                        {march.march_type === 'attack' ? 'Attacking' : march.march_type === 'scout' ? 'Scouting' : 'Marching to'} {march.target_name || 'target'}
                      </span>
                      <span className="text-[10px] font-bold text-primary ml-2 shrink-0">
                        {remaining > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : 'Arriving...'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content */}
        <div className={`flex-1 overflow-hidden relative ${isMobile ? 'pb-16' : ''}`}>
          {(hasOpenedMap || activeTab === 'map') && (
            <div className={activeTab === 'map' ? 'absolute inset-0 flex flex-col overflow-y-auto' : 'hidden'}>
              <Suspense fallback={<TabFallback />}>
                <WorldMap />
              </Suspense>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab !== 'map' && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className={`absolute inset-0 flex flex-col overflow-y-auto ${!isMobile ? 'p-6' : ''}`}
              >
                <Suspense fallback={<TabFallback />}>
                  {activeTab === 'village' && <VillageGrid />}
                  {activeTab === 'social' && <SocialPanel initialDm={dmTarget} onDmHandled={() => setDmTarget(null)} />}
                  {activeTab === 'profile' && <ProfilePanel />}
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 safe-bottom">
          <div className="relative flex items-center rounded-full border border-border backdrop-blur-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--card) / 0.95) 0%, hsl(var(--card) / 0.85) 100%)',
              boxShadow: '0 8px 32px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
            }}
          >
            <motion.div
              className="absolute top-1 bottom-1 rounded-full pointer-events-none"
              style={{
                width: `calc(${100 / TABS.length}% - 8px)`,
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.08) 100%)',
                border: '1px solid hsl(var(--primary) / 0.3)',
                boxShadow: '0 0 20px hsl(var(--primary) / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.1)',
                backdropFilter: 'blur(8px)',
              }}
              animate={{
                left: `calc(${TABS.findIndex(t => t.id === activeTab) * (100 / TABS.length)}% + 4px)`,
              }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            />
            {TABS.map(tab => (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative z-10 ${
                  activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <motion.span
                  className="text-base relative"
                  animate={{ scale: activeTab === tab.id ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {tab.icon}
                  {tab.id === 'social' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </motion.span>
                <span className={`text-[9px] font-semibold ${activeTab === tab.id ? 'font-display' : ''}`}>
                  {tab.label}
                </span>
              </motion.button>
            ))}
          </div>
        </nav>
      )}

      <PatchNotesModal />

      <AllyDefenseModal
        open={!!allyDefenseData}
        onClose={() => setAllyDefenseData(null)}
        attackerName={allyDefenseData?.attackerName || ''}
        allyName={allyDefenseData?.allyName || ''}
        allyVillageId={allyDefenseData?.allyVillageId}
        targetX={allyDefenseData?.targetX || 0}
        targetY={allyDefenseData?.targetY || 0}
        attackEta={allyDefenseData?.attackEta || new Date().toISOString()}
      />

      <GratitudeModal
        open={!!gratitudeData}
        onClose={() => setGratitudeData(null)}
        allyUserId={gratitudeData?.allyUserId || ''}
        allyName={gratitudeData?.allyName || ''}
      />

      <AnimatePresence>
        {vassalPopup && myVassalage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
            onClick={() => setVassalPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="game-panel border border-destructive/40 rounded-2xl p-5 max-w-sm w-full space-y-3"
            >
              <div className="text-center space-y-1">
                <span className="text-3xl">⛓️</span>
                <h3 className="font-display text-lg text-destructive">You Are Vassalized</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lord</span>
                  <span className="text-foreground font-display">{lordName || '...'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tribute Rate</span>
                  <span className="text-destructive font-bold">{myVassalage.tribute_rate}% of production</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ransom Cost</span>
                  <span className="text-foreground">{myVassalage.ransom_gold} 💰</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rebellion Available</span>
                  <span className="text-foreground text-xs">
                    {new Date(myVassalage.rebellion_available_at) <= new Date() ? '✅ Now' : new Date(myVassalage.rebellion_available_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                A portion of your resources goes to your lord. Pay the ransom or attempt a rebellion from the Military → Troops tab to break free.
              </p>
              <button onClick={() => setVassalPopup(false)}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display text-sm">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
