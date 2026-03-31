import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGame, TROOP_INFO, TroopType, Army, SPY_MISSION_INFO, SpyMission } from '@/hooks/useGameState';

const TROOP_TYPES: TroopType[] = ['militia', 'archer', 'knight', 'cavalry', 'siege', 'scout'];
const SPY_MISSIONS: SpyMission[] = ['scout', 'sabotage', 'demoralize'];

interface AttackConfigPanelProps {
  targetName: string;
  targetPower?: number;
  targetId?: string;
  targetX: number;
  targetY: number;
  travelTime: number;
  onConfirmAttack: (sentArmy: Partial<Army>) => void;
  onConfirmEspionage: (mission: SpyMission, spiesCount: number) => void;
  onCancel: () => void;
  showEspionage?: boolean;
}

export default function AttackConfigPanel({
  targetName, targetPower, travelTime,
  onConfirmAttack, onConfirmEspionage, onCancel, showEspionage = true,
}: AttackConfigPanelProps) {
  const { army, spies, resources } = useGame();
  const [mode, setMode] = useState<'attack' | 'espionage'>('attack');
  const [troopCounts, setTroopCounts] = useState<Record<TroopType, number>>(() => {
    const init: Record<TroopType, number> = { militia: 0, archer: 0, knight: 0, cavalry: 0, siege: 0, scout: 0 };
    // Default: send all troops
    for (const t of TROOP_TYPES) init[t] = army[t];
    return init;
  });
  const [spyMission, setSpyMission] = useState<SpyMission>('scout');
  const [spyCount, setSpyCount] = useState(1);

  const totalSending = useMemo(() => {
    let count = 0, atk = 0, def = 0;
    for (const t of TROOP_TYPES) {
      const c = troopCounts[t];
      count += c;
      atk += c * TROOP_INFO[t].attack;
      def += c * TROOP_INFO[t].defense;
    }
    return { count, attack: atk, defense: def };
  }, [troopCounts]);

  const setCount = (type: TroopType, val: number) => {
    setTroopCounts(prev => ({ ...prev, [type]: Math.max(0, Math.min(army[type], val)) }));
  };

  const selectAll = () => {
    const next = { ...troopCounts };
    for (const t of TROOP_TYPES) next[t] = army[t];
    setTroopCounts(next);
  };

  const selectNone = () => {
    const next = { ...troopCounts };
    for (const t of TROOP_TYPES) next[t] = 0;
    setTroopCounts(next);
  };

  const selectHalf = () => {
    const next = { ...troopCounts };
    for (const t of TROOP_TYPES) next[t] = Math.floor(army[t] / 2);
    setTroopCounts(next);
  };

  const missionInfo = SPY_MISSION_INFO[spyMission];
  const maxSpyOperatives = Math.max(1, Math.floor(spies / missionInfo.spiesRequired));
  const canSendSpies = spies >= missionInfo.spiesRequired * spyCount && resources.gold >= missionInfo.goldCost * spyCount;
  const spyIssues: string[] = [];

  if (spies < missionInfo.spiesRequired * spyCount) {
    spyIssues.push(`Need ${missionInfo.spiesRequired * spyCount} spies (have ${spies})`);
  }
  if (resources.gold < missionInfo.goldCost * spyCount) {
    spyIssues.push(`Need ${missionInfo.goldCost * spyCount} gold (have ${resources.gold})`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-foreground">⚔️ Deploy to {targetName}</h3>
        <button onClick={onCancel} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
      </div>

      {targetPower !== undefined && targetPower > 0 && (
        <p className="text-[9px] text-destructive">Enemy Power: ⚔️{targetPower}</p>
      )}
      <p className="text-[9px] text-muted-foreground">Travel time: ~{travelTime}s</p>

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button onClick={() => setMode('attack')}
          className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors ${mode === 'attack' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
          ⚔️ Attack
        </button>
        {showEspionage && spies > 0 && (
          <button onClick={() => setMode('espionage')}
            className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors ${mode === 'espionage' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            🕵️ Espionage
          </button>
        )}
      </div>

      {mode === 'attack' && (
        <>
          {/* Quick select */}
          <div className="flex gap-1.5">
            <button onClick={selectAll} className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded">All</button>
            <button onClick={selectHalf} className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded">Half</button>
            <button onClick={selectNone} className="text-[9px] text-muted-foreground bg-muted px-2 py-0.5 rounded">None</button>
          </div>

          {/* Troop sliders */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {TROOP_TYPES.map(type => {
              const info = TROOP_INFO[type];
              const available = army[type];
              if (available === 0) return null;
              const count = troopCounts[type];
              return (
                <div key={type} className="game-panel rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{info.emoji} {info.name}</span>
                    <span className="text-[10px] text-muted-foreground">{count}/{available}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setCount(type, count - 1)}
                      className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">−</motion.button>
                    <input
                      type="range" min={0} max={available} value={count}
                      onChange={e => setCount(type, Number(e.target.value))}
                      className="flex-1 h-1.5 accent-primary"
                    />
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setCount(type, count + 1)}
                      className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">+</motion.button>
                  </div>
                  <div className="flex gap-2 text-[8px] text-muted-foreground mt-0.5">
                    <span>⚔️{info.attack * count}</span>
                    <span>🛡️{info.defense * count}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="game-panel border-glow rounded-lg p-2 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-foreground font-display">Sending: {totalSending.count} troops</p>
              <p className="text-[9px] text-muted-foreground">⚔️{totalSending.attack} 🛡️{totalSending.defense}</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (totalSending.count === 0) return;
                onConfirmAttack(troopCounts);
              }}
              disabled={totalSending.count === 0}
              className={`font-display text-[11px] py-2 px-4 rounded-lg ${
                totalSending.count > 0 ? 'bg-destructive text-destructive-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'
              }`}>
              ⚔️ March!
            </motion.button>
          </div>
        </>
      )}

      {mode === 'espionage' && (
        <div className="space-y-2">
          <p className="text-[9px] text-muted-foreground">🕵️ {spies} spies available</p>

          {/* Mission select */}
          <div className="space-y-1">
            {SPY_MISSIONS.map(m => {
              const info = SPY_MISSION_INFO[m];
              return (
                <button key={m} onClick={() => setSpyMission(m)}
                  className={`w-full text-left game-panel rounded-lg p-2 transition-colors ${spyMission === m ? 'border-glow ring-1 ring-primary/50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-display">{info.emoji} {info.name}</span>
                    <span className="text-[9px] text-muted-foreground">🕵️{info.spiesRequired} · 💰{info.goldCost}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mt-0.5">{info.description}</p>
                </button>
              );
            })}
          </div>

          {/* Spy count */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-foreground">Operatives:</span>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setSpyCount(Math.max(1, spyCount - 1))}
              className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">−</motion.button>
            <span className="text-xs text-foreground font-bold w-6 text-center">{spyCount}</span>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setSpyCount(Math.min(maxSpyOperatives, spyCount + 1))}
              className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">+</motion.button>
            <span className="text-[9px] text-muted-foreground ml-auto">Cost: 💰{missionInfo.goldCost * spyCount}</span>
          </div>

          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => canSendSpies && onConfirmEspionage(spyMission, spyCount)}
            disabled={!canSendSpies}
            className={`w-full font-display text-[11px] py-2 rounded-lg ${
              canSendSpies ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'
            }`}>
            🕵️ Send Spies
          </motion.button>
          {!canSendSpies && spyIssues.length > 0 && (
            <p className="text-[9px] text-destructive">{spyIssues.join(' · ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
