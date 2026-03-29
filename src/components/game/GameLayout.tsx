import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResourceBar from './ResourceBar';
import VillageGrid from './VillageGrid';
import WorldMap from './WorldMap';
import AlliancePanel from './AlliancePanel';
import ProfilePanel from './ProfilePanel';
import { useGame } from '@/hooks/useGameState';

type Tab = 'village' | 'map' | 'alliance' | 'profile';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'village', icon: '🏘️', label: 'Village' },
  { id: 'map', icon: '🗺️', label: 'World' },
  { id: 'alliance', icon: '⚔️', label: 'Alliance' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

export default function GameLayout() {
  const [activeTab, setActiveTab] = useState<Tab>('village');
  const { villageName, playerLevel, loading, displayName } = useGame();

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
        <div className="font-display text-xs text-muted-foreground tracking-widest uppercase">
          Realm of Shadows
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
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col overflow-y-auto"
          >
            {activeTab === 'village' && <VillageGrid />}
            {activeTab === 'map' && <WorldMap />}
            {activeTab === 'alliance' && <AlliancePanel />}
            {activeTab === 'profile' && <ProfilePanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="game-panel border-t border-glow safe-bottom">
        <div className="flex items-center justify-around py-2">
          {TABS.map(tab => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className={`text-[10px] font-semibold ${activeTab === tab.id ? 'font-display' : ''}`}>
                {tab.label}
              </span>
            </motion.button>
          ))}
        </div>
      </nav>
    </div>
  );
}
