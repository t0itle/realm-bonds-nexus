import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame, TROOP_INFO, TroopType } from '@/hooks/useGameState';

const TROOP_TYPES: TroopType[] = ['militia', 'archer', 'knight', 'cavalry', 'siege'];

export default function MilitaryPanel() {
  const { army, trainingQueue, battleLogs, trainTroops, getBarracksLevel, canAfford, totalArmyPower } = useGame();
  const [trainCount, setTrainCount] = useState<Record<TroopType, number>>({ militia: 1, archer: 1, knight: 1, cavalry: 1, siege: 1 });
  const barracksLevel = getBarracksLevel();
  const power = totalArmyPower();

  if (barracksLevel === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
        <span className="text-5xl">⚔️</span>
        <h2 className="font-display text-lg text-foreground">No Barracks</h2>
        <p className="text-sm text-muted-foreground">Build a Barracks in your village to train troops and wage war.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto pb-20">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Military</h2>

      {/* Army overview */}
      <div className="game-panel border-glow rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground font-display">Total Army</p>
          <div className="flex gap-2 mt-1">
            {TROOP_TYPES.map(type => army[type] > 0 && (
              <span key={type} className="text-xs text-foreground">
                {TROOP_INFO[type].emoji}{army[type]}
              </span>
            ))}
            {Object.values(army).every(v => v === 0) && (
              <span className="text-xs text-muted-foreground">No troops</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-primary font-bold">⚔️ {power.attack}</p>
          <p className="text-xs text-foreground">🛡️ {power.defense}</p>
        </div>
      </div>

      {/* Training queue */}
      {trainingQueue.length > 0 && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-2">
          <h3 className="font-display text-xs text-foreground">Training Queue</h3>
          {trainingQueue.map((q, i) => {
            const remaining = Math.max(0, Math.ceil((q.finishTime - Date.now()) / 1000));
            const info = TROOP_INFO[q.type];
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{info.emoji} {info.name} x{q.count}</span>
                <span className="text-primary font-mono">{Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recruit */}
      <div className="space-y-2">
        <h3 className="font-display text-sm text-foreground">Recruit Troops</h3>
        <p className="text-[10px] text-muted-foreground">Barracks Level {barracksLevel}</p>

        {TROOP_TYPES.map(type => {
          const info = TROOP_INFO[type];
          const unlocked = barracksLevel >= info.requiredBarracksLevel;
          const count = trainCount[type];
          const totalCost = {
            gold: info.cost.gold * count, wood: info.cost.wood * count,
            stone: info.cost.stone * count, food: info.cost.food * count,
          };
          const affordable = unlocked && canAfford(totalCost);

          return (
            <div key={type} className={`game-panel rounded-xl p-3 ${unlocked ? 'border-glow' : 'opacity-40'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{info.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs text-foreground">{info.name}</span>
                    {!unlocked && <span className="text-[9px] text-destructive">Req. Barracks Lv.{info.requiredBarracksLevel}</span>}
                  </div>
                  <p className="text-[9px] text-muted-foreground truncate">{info.description}</p>
                  <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                    <span>⚔️{info.attack}</span>
                    <span>🛡️{info.defense}</span>
                    <span>💨{info.speed}</span>
                    <span>⏱️{info.trainTime}s</span>
                  </div>
                </div>
              </div>

              {unlocked && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setTrainCount(p => ({ ...p, [type]: Math.max(1, p[type] - 1) }))}
                      className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">−</motion.button>
                    <span className="text-xs text-foreground w-6 text-center font-bold">{count}</span>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setTrainCount(p => ({ ...p, [type]: Math.min(50, p[type] + 1) }))}
                      className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">+</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setTrainCount(p => ({ ...p, [type]: 10 }))}
                      className="text-[9px] text-muted-foreground px-1">x10</motion.button>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                    {Object.entries(totalCost).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k}>{k === 'gold' ? '💰' : k === 'wood' ? '🪵' : k === 'stone' ? '🪨' : '🌾'}{v}</span>
                    ))}
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => { if (trainTroops(type, count)) setTrainCount(p => ({ ...p, [type]: 1 })); }}
                    disabled={!affordable}
                    className={`font-display text-[10px] py-1 px-3 rounded-lg whitespace-nowrap ${
                      affordable ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'
                    }`}>
                    Train
                  </motion.button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Battle logs */}
      {battleLogs.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm text-foreground">Battle Reports</h3>
          {battleLogs.slice(0, 5).map(log => (
            <div key={log.id} className={`game-panel rounded-xl p-2.5 border ${
              log.result === 'victory' ? 'border-food/30' : 'border-destructive/30'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs text-foreground">{log.target}</span>
                <span className={`text-[10px] font-bold ${log.result === 'victory' ? 'text-food' : 'text-destructive'}`}>
                  {log.result === 'victory' ? '⚔️ Victory!' : '💀 Defeat'}
                </span>
              </div>
              <div className="flex gap-2 text-[9px] text-muted-foreground mt-1">
                {Object.entries(log.troopsLost).filter(([, v]) => v && v > 0).map(([type, count]) => (
                  <span key={type}>-{count} {TROOP_INFO[type as TroopType].emoji}</span>
                ))}
              </div>
              {log.resourcesGained && (
                <div className="flex gap-2 text-[9px] text-primary mt-0.5">
                  {Object.entries(log.resourcesGained).filter(([, v]) => v && v > 0).map(([k, v]) => (
                    <span key={k}>+{v} {k}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
