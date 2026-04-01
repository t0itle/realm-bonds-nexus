import { useState, useEffect, useRef, useCallback } from 'react';
import { useGame, BUILDING_INFO, getUpgradeCost, getProduction, getSteelProduction, BuildingType, Building } from '@/hooks/useGameState';
import { motion, AnimatePresence } from 'framer-motion';
import { BUILDING_SPRITES, WORKERS_SPRITE, WORKER_FOR_BUILDING } from './sprites';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import BuildModal from './BuildModal';
import ResourceIcon, { getResourceType } from './ResourceIcon';
import { Send, Scroll } from 'lucide-react';

import { lazy, Suspense } from 'react';

const MilitaryPanel = lazy(() => import('./MilitaryPanel'));
const StatSheet = lazy(() => import('./StatSheet'));

function getGridSize(settlementType: string): number {
  if (settlementType === 'city') return 25;
  if (settlementType === 'town') return 16;
  return 9;
}

function getGridCols(gridSize: number): number {
  if (gridSize >= 25) return 5;
  if (gridSize >= 16) return 4;
  return 3;
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}
const DM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-dm`;

function OracleWidget() {
  const game = useGame();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: '⚜️ Greetings, my liege. I watch over your realm. Ask me anything.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  }, []);

  const gameState = {
    villageName: game.villageName, playerLevel: game.playerLevel,
    gold: game.resources.gold, wood: game.resources.wood, stone: game.resources.stone, food: game.resources.food, steel: game.steel,
    population: game.population.current, maxPopulation: game.population.max, happiness: game.population.happiness,
    taxRate: game.popTaxRate, rations: game.rations,
    militia: game.army.militia, archers: game.army.archer, knights: game.army.knight,
    cavalry: game.army.cavalry, siege: game.army.siege, scouts: game.army.scout,
    totalTroops: Object.values(game.army).reduce((s, v) => s + v, 0),
    buildings: game.buildings.filter(b => b.type !== 'empty').map(b => `${b.type} Lv${b.level}`).join(', '),
  };

  const send = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput('');
    setExpanded(true);
    const userMsg = { role: 'user' as const, content };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setLoading(true);
    scrollBottom();

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > newMsgs.length)
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
      scrollBottom();
    };

    try {
      const resp = await fetch(DM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: newMsgs.slice(-10), gameState, type: 'chat' }),
      });
      if (!resp.ok || !resp.body) throw new Error('Oracle unavailable');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) upsert(c); } catch {}
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `🔮 ${e.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="mx-3 mb-2">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 game-panel px-3 py-2 rounded-xl border border-primary/20">
        <span className="text-base">🔮</span>
        <span className="text-[10px] font-display text-primary flex-1 text-left">Oracle of the Realm</span>
        <span className="text-[10px] text-muted-foreground">{expanded ? '▼' : '▶'}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="game-panel border border-border/50 rounded-b-xl px-3 py-2 space-y-2">
              <div ref={scrollRef} className="max-h-32 overflow-y-auto space-y-1.5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-2 py-1 text-[10px] leading-relaxed ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
                      {msg.role === 'assistant' && <Scroll className="w-2.5 h-2.5 text-primary inline mr-0.5 mb-0.5" />}
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="text-[10px] text-muted-foreground animate-pulse">🔮 Gazing...</div>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {['Kingdom status?', 'What to build?', 'Military advice'].map(q => (
                  <button key={q} onClick={() => send(q)} disabled={loading}
                    className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50">{q}</button>
                ))}
              </div>
              <div className="flex gap-1.5 items-center">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Ask the Oracle..." disabled={loading}
                  className="flex-1 bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
                <button onClick={() => send()} disabled={loading || !input.trim()}
                  className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function CollapsibleSection({ icon, title, defaultOpen, children }: {
  icon: string; title: string; defaultOpen: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 game-panel px-3 py-2 rounded-xl border border-border/30">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-display text-foreground flex-1 text-left">{title}</span>
        <span className="text-[10px] text-muted-foreground">{open ? '▼' : '▶'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VillageGrid() {
  const { buildings, upgradeBuilding, demolishBuilding, canAfford, canAffordSteel, isBuildingUpgrading, getBuildTime, resources, steel, settlementType, upgradeSettlement, isSettlementUpgrading, settlementUpgradeFinishTime } = useGame();
  const { getBuildingSprite } = useTroopSkins();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [buildPosition, setBuildPosition] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Force re-render every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(v => v + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const townhallLevel = buildings.find(b => b.type === 'townhall')?.level || 1;
  const gridSize = getGridSize(settlementType);
  const gridCols = getGridCols(gridSize);

  const grid = Array.from({ length: gridSize }, (_, i) => {
    return buildings.find(b => b.position === i) || null;
  });

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-3">
        <div className={`grid gap-2.5 w-full max-w-xs`} style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
          {grid.map((building, i) => {
            const type = building?.type as Exclude<BuildingType, 'empty'> | undefined;
            const sprite = type ? getBuildingSprite(type) : null;
            const worker = type ? WORKER_FOR_BUILDING[type] : null;
            const upgrading = building ? isBuildingUpgrading(building.id) : undefined;
            const isUnderConstruction = building && building.level === 0;
            const isMaxLevel = type ? building!.level >= BUILDING_INFO[type].maxLevel : false;

            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  if (building && !isUnderConstruction) setSelectedBuilding(building);
                  else if (!building) setBuildPosition(i);
                }}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden ${
                  building
                    ? 'game-panel border-glow'
                    : 'border-2 border-dashed border-border/50 bg-muted/30 hover:border-primary/50'
                }`}
              >
                {building && sprite ? (
                  <>
                    <img
                      src={sprite}
                      alt={BUILDING_INFO[type!].name}
                      className={`w-16 h-16 object-contain drop-shadow-lg ${(upgrading || isUnderConstruction) ? 'opacity-50 grayscale' : ''}`}
                      loading="lazy"
                    />
                    {/* Build/upgrade timer overlay */}
                    {(upgrading || isUnderConstruction) && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-xl">
                        <ResourceIcon type="hammer" size={24} className="animate-pulse" />
                        {upgrading && (
                          <span className="text-[10px] font-display text-primary font-bold">
                            {formatTime(upgrading.finishTime - Date.now())}
                          </span>
                        )}
                        <span className="text-[8px] text-muted-foreground">
                          {isUnderConstruction ? 'Building...' : `→ Lv.${upgrading?.targetLevel}`}
                        </span>
                      </div>
                    )}
                    {/* Worker sprite */}
                    {worker && building.level > 0 && !upgrading && (
                      <div className="absolute bottom-7 right-1 w-5 h-5 overflow-hidden">
                        <img
                          src={WORKERS_SPRITE}
                          alt={worker.name}
                          className="h-5 object-cover animate-float"
                          style={{
                            objectPosition: `${worker.clipX}% center`,
                            width: '20px',
                          }}
                          loading="lazy"
                        />
                      </div>
                    )}
                    {!upgrading && !isUnderConstruction && (
                      <div className="absolute bottom-0 inset-x-0 bg-background/70 backdrop-blur-sm px-1 py-px flex items-center justify-center gap-1 leading-none">
                        <span className="text-[7px] font-display text-foreground/90 truncate">
                          {type === 'townhall' && building.level >= 7 ? 'Castle' : BUILDING_INFO[type!].name}
                        </span>
                        <span className={`text-[7px] font-bold ${isMaxLevel ? 'text-amber-400' : 'text-primary'}`}>
                          {isMaxLevel ? '✦MAX' : `Lv${building.level}`}
                        </span>
                      </div>
                    )}
                    {/* Max level star badge */}
                    {isMaxLevel && !upgrading && !isUnderConstruction && (
                      <div className="absolute top-0.5 right-0.5 text-amber-400 text-[10px] drop-shadow-[0_0_4px_rgba(251,191,36,0.7)]">⭐</div>
                    )}
                  </>
                ) : (
                  <span className="text-2xl opacity-30">＋</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Inline Oracle Widget */}
      <OracleWidget />

      {/* Inline Army & Stats */}
      <div className="px-3 pb-2 space-y-2">
        <CollapsibleSection icon="⚔️" title="Army" defaultOpen={false}>
          <Suspense fallback={<div className="text-center text-muted-foreground text-xs py-4">Loading...</div>}>
            <MilitaryPanel />
          </Suspense>
        </CollapsibleSection>
        <CollapsibleSection icon="📊" title="Stats" defaultOpen={false}>
          <Suspense fallback={<div className="text-center text-muted-foreground text-xs py-4">Loading...</div>}>
            <StatSheet />
          </Suspense>
        </CollapsibleSection>
      </div>

      {/* Building detail sheet */}
      <AnimatePresence>
        {selectedBuilding && selectedBuilding.type !== 'empty' && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 game-panel border-t border-glow rounded-t-2xl p-4 pb-20 max-h-[60vh]"
          >
            <button
              onClick={() => setSelectedBuilding(null)}
              className="absolute top-3 right-3 text-muted-foreground text-sm"
            >✕</button>
            <BuildingDetail
              building={selectedBuilding}
              onUpgrade={async () => {
                const success = await upgradeBuilding(selectedBuilding.id);
                if (success) {
                  setSelectedBuilding(null);
                }
              }}
              onDemolish={async () => {
                const success = await demolishBuilding(selectedBuilding.id);
                if (success) {
                  setSelectedBuilding(null);
                }
              }}
              canAfford={canAfford}
              canAffordSteel={canAffordSteel}
              resources={resources}
              steel={steel}
              isBuildingUpgrading={isBuildingUpgrading}
              getBuildTime={getBuildTime}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {buildPosition !== null && (
          <BuildModal
            position={buildPosition}
            onClose={() => setBuildPosition(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function BuildingDetail({ building, onUpgrade, onDemolish, canAfford, canAffordSteel, resources, steel, isBuildingUpgrading, getBuildTime }: {
  building: Building;
  onUpgrade: () => void;
  onDemolish: () => void;
  canAfford: (cost: any) => boolean;
  canAffordSteel: (amount: number) => boolean;
  resources: { gold: number; wood: number; stone: number; food: number };
  steel: number;
  isBuildingUpgrading: (id: string) => any;
  getBuildTime: (type: Exclude<BuildingType, 'empty'>, level: number) => number;
}) {
  const [confirmDemolish, setConfirmDemolish] = useState(false);
  const [steelPopup, setSteelPopup] = useState(false);
  const { getBuildingSprite } = useTroopSkins();
  const type = building.type as Exclude<BuildingType, 'empty'>;
  const info = BUILDING_INFO[type];
  const sprite = getBuildingSprite(type);
  const upgradeCost = getUpgradeCost(type, building.level);
  const production = getProduction(type, building.level);
  const steelProd = getSteelProduction(type, building.level);
  const affordable = canAfford(upgradeCost) && (upgradeCost.steel <= 0 || canAffordSteel(upgradeCost.steel));
  const maxed = building.level >= info.maxLevel;
  const upgrading = isBuildingUpgrading(building.id);
  const buildTime = getBuildTime(type, building.level);

  // Per-resource affordability for highlighting
  const resourceCheck: Record<string, boolean> = {
    gold: resources.gold >= upgradeCost.gold,
    wood: resources.wood >= upgradeCost.wood,
    stone: resources.stone >= upgradeCost.stone,
    food: resources.food >= upgradeCost.food,
    steel: steel >= upgradeCost.steel,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <img src={sprite} alt={info.name} className="w-16 h-16 object-contain" />
        <div>
          <h3 className="font-display text-lg text-foreground">
            {type === 'townhall' && building.level >= 7 ? '🏰 Castle' : info.name}
          </h3>
          <p className="text-xs text-primary font-bold">Level {building.level} / {info.maxLevel}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{info.description}</p>

      {(Object.keys(production).length > 0 || steelProd > 0) && (
        <div className="flex gap-3 text-xs">
          <span className="text-muted-foreground">Production:</span>
          {Object.entries(production).map(([key, val]) => (
            <span key={key} className="text-foreground">+{val} {key}/min</span>
          ))}
          {steelProd > 0 && (
            <span className="text-foreground flex items-center gap-0.5">
              +{steelProd} <ResourceIcon type="steel" size={12} />/min
            </span>
          )}
        </div>
      )}

      {upgrading && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center space-y-1">
          <p className="text-xs font-display text-primary animate-pulse">🔨 Upgrading to Level {upgrading.targetLevel}...</p>
          <p className="text-sm font-bold text-foreground">{formatTime(upgrading.finishTime - Date.now())}</p>
        </div>
      )}

      {!maxed && !upgrading && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-display">Upgrade Cost:</p>
          <div className="flex gap-3 text-xs">
                  {Object.entries(upgradeCost).filter(([, v]) => v > 0).map(([key, val]) => {
                    const rType = getResourceType(key);
                    const canAffordThis = resourceCheck[key] !== false;
                    return (
                      <span key={key} className={`flex items-center gap-0.5 ${canAffordThis ? 'text-foreground' : 'text-destructive font-bold'}`}>
                        {rType ? <ResourceIcon type={rType} size={12} /> : key}
                        {val}
                      </span>
                    );
                  })}
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><ResourceIcon type="timer" size={10} /> Build time: {formatTime(buildTime * 1000)}</p>
          {(() => {
            const needsSteel = upgradeCost.steel > 0 && !canAffordSteel(upgradeCost.steel);
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (needsSteel) { setSteelPopup(true); return; }
                  onUpgrade();
                }}
                disabled={!affordable && !needsSteel}
                className={`w-full py-2.5 rounded-lg font-display text-sm font-bold transition-all ${
                  affordable
                    ? 'bg-primary text-primary-foreground glow-gold'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {affordable ? `Upgrade to Level ${building.level + 1}` : 'Not Enough Resources'}
              </motion.button>
            );
          })()}
        </div>
      )}

      {maxed && !upgrading && (
        <div className="text-center py-2 text-primary font-display text-sm animate-pulse-gold rounded-lg border border-primary/30">
          ✦ Maximum Level ✦
        </div>
      )}

      {/* Demolish button — not for townhall */}
      {building.type !== 'townhall' && !upgrading && (
        <div className="pt-2 border-t border-border/30">
          {!confirmDemolish ? (
            <button
              onClick={() => setConfirmDemolish(true)}
              className="w-full py-2 rounded-lg font-display text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
            >
              🏚️ Demolish Building
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-destructive text-center">Are you sure? You'll recover 30% of invested resources.</p>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={onDemolish}
                  className="flex-1 py-2 rounded-lg font-display text-xs bg-destructive text-destructive-foreground">
                  Confirm
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmDemolish(false)}
                  className="flex-1 py-2 rounded-lg font-display text-xs bg-muted text-muted-foreground">
                  Cancel
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steel popup */}
      <AnimatePresence>
        {steelPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6"
            onClick={() => setSteelPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="game-panel border border-destructive/50 rounded-2xl p-5 max-w-sm w-full space-y-3 text-center"
            >
              <div className="text-3xl">⚒️</div>
              <h4 className="font-display text-lg text-destructive">Not enough Steel!</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Steel is obtained by capturing mines on the map. Create some soldiers and go claim them!
              </p>
              <button
                onClick={() => setSteelPopup(false)}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-display text-sm"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
