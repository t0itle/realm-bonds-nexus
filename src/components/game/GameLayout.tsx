import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceBar from './ResourceBar';
import VillageGrid from './VillageGrid';
import WorldMap from './WorldMap';
import AlliancePanel from './AlliancePanel';
import MilitaryPanel from './MilitaryPanel';
import ProfilePanel from './ProfilePanel';
import MessagesPanel from './MessagesPanel';
import ThemeToggle from '@/components/ThemeToggle';
import { useGame } from '@/hooks/useGameState';

type Tab = 'village' | 'map' | 'military' | 'alliance' | 'messages' | 'profile';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'village', icon: '🏘️', label: 'Village' },
  { id: 'military', icon: '⚔️', label: 'Army' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'messages', icon: '💬', label: 'Mail' },
  { id: 'alliance', icon: '🤝', label: 'Guild' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

export default function GameLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('village');
  const [dmTarget, setDmTarget] = useState<{ userId: string; name: string } | null>(null);
  const { villageName, playerLevel, loading, displayName, army, trainingQueue } = useGame();
  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);

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
            {activeTab === 'village' && <VillageGrid />}
            {activeTab === 'military' && <MilitaryPanel />}
            {activeTab === 'map' && <WorldMap />}
            {activeTab === 'messages' && <MessagesPanel />}
            {activeTab === 'alliance' && <AlliancePanel />}
            {activeTab === 'profile' && <ProfilePanel />}
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
              <span className="text-base">{tab.icon}</span>
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
