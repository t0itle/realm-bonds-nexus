import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame, TROOP_INFO, TroopType, SPY_MISSION_INFO, SpyMission } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ResourceIcon, { getResourceType } from './ResourceIcon';
import VassalPanel from './VassalPanel';

const TROOP_TYPES: TroopType[] = ['militia', 'archer', 'knight', 'cavalry', 'siege', 'scout'];
const SPY_MISSIONS: SpyMission[] = ['scout', 'sabotage', 'demoralize'];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MilitaryPanel() {
  const {
    army, trainingQueue, battleLogs, trainTroops, getBarracksLevel, canAfford, canAffordSteel,
    totalArmyPower, armyUpkeep, population, steel,
    spies, trainSpies, sendSpyMission, activeSpyMissions, spyTrainingQueue, intelReports, allVillages, getWatchtowerLevel,
    injuredTroops, poisons, healTroops, craftPoison, getApothecaryLevel, resources,
  } = useGame();
  const [trainCount, setTrainCount] = useState<Record<TroopType, number>>({ militia: 1, archer: 1, knight: 1, cavalry: 1, siege: 1, scout: 1 });
  const [spyTrainCount, setSpyTrainCount] = useState(1);
  const [tab, setTab] = useState<'troops' | 'espionage' | 'apothecary' | 'warlog'>('troops');
  const apothecaryLevel = getApothecaryLevel();
  const totalInjured = Object.values(injuredTroops).reduce((s, v) => s + v, 0);
  const [, forceUpdate] = useState(0);
  const barracksLevel = getBarracksLevel();
  const power = totalArmyPower();
  const upkeep = armyUpkeep();

  // Force re-render for timers
  useEffect(() => {
    if (trainingQueue.length === 0 && activeSpyMissions.length === 0 && spyTrainingQueue.length === 0) return;
    const t = setInterval(() => forceUpdate(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [trainingQueue.length, activeSpyMissions.length]);

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
      <div className="game-panel border-glow rounded-xl p-3">
        <div className="flex items-center justify-between">
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
              {spies > 0 && <span className="text-xs text-foreground">🕵️{spies}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary font-bold">⚔️ {power.attack}</p>
            <p className="text-xs text-foreground">🛡️ {power.defense}</p>
          </div>
        </div>
        <div className="border-t border-border/50 mt-2 pt-2 flex items-center justify-between text-[9px]">
          <span className="text-muted-foreground">Army: {population.soldiers}/{population.armyCap} cap</span>
          {(upkeep.food > 0 || upkeep.gold > 0) && (
            <span className="text-destructive flex items-center gap-1">Upkeep: <ResourceIcon type="food" size={10} />{upkeep.food}/min <ResourceIcon type="gold" size={10} />{upkeep.gold}/min</span>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1">
        <button onClick={() => setTab('troops')}
          className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors ${tab === 'troops' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          ⚔️ Troops
        </button>
        <button onClick={() => setTab('espionage')}
          className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors relative ${tab === 'espionage' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          🕵️ Espionage
          {activeSpyMissions.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
              {activeSpyMissions.length}
            </span>
          )}
        </button>
        {apothecaryLevel > 0 && (
          <button onClick={() => setTab('apothecary')}
            className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors relative ${tab === 'apothecary' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            ⚗️ Apothecary
            {totalInjured > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                {totalInjured}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setTab('warlog')}
          className={`flex-1 font-display text-[10px] py-1.5 rounded-lg transition-colors ${tab === 'warlog' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          📜 War Log
        </button>
      </div>

      {/* ===== TROOPS TAB ===== */}
      {tab === 'troops' && (
        <>
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
                    <span className="text-primary font-mono">{formatTime(remaining)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recruit */}
          <div className="space-y-2">
            <h3 className="font-display text-sm text-foreground">Recruit Troops</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">Barracks Level {barracksLevel} · Civilians: {population.civilians} · <ResourceIcon type="steel" size={10} /> Steel: {steel}</p>

            {TROOP_TYPES.map(type => {
              const info = TROOP_INFO[type];
              const unlocked = barracksLevel >= info.requiredBarracksLevel;
              const count = trainCount[type];
              const totalCost = {
                gold: info.cost.gold * count, wood: info.cost.wood * count,
                stone: info.cost.stone * count, food: info.cost.food * count,
              };
              const totalSteelCost = info.steelCost * count;
              const popNeeded = info.popCost * count;
              const affordable = unlocked && canAfford(totalCost) && canAffordSteel(totalSteelCost) && population.civilians >= popNeeded && population.soldiers + popNeeded <= population.armyCap;

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
                        <span className="flex items-center gap-px"><ResourceIcon type="timer" size={8} />{info.trainTime}s</span>
                        <span className="flex items-center gap-px"><ResourceIcon type="population" size={8} />{info.popCost}</span>
                        {info.steelCost > 0 && <span className="flex items-center gap-px"><ResourceIcon type="steel" size={8} />{info.steelCost}</span>}
                      </div>
                    </div>
                  </div>

                  {unlocked && (
                    <div className="space-y-1">
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
                          {Object.entries(totalCost).filter(([, v]) => v > 0).map(([k, v]) => {
                            const rt = getResourceType(k);
                            return <span key={k} className="flex items-center gap-px">{rt ? <ResourceIcon type={rt} size={9} /> : k}{v}</span>;
                          })}
                          {totalSteelCost > 0 && <span className="flex items-center gap-px"><ResourceIcon type="steel" size={9} />{totalSteelCost}</span>}
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
                      {!affordable && (() => {
                        const reasons: string[] = [];
                        if (!canAfford(totalCost)) reasons.push('Not enough resources');
                        if (totalSteelCost > 0 && !canAffordSteel(totalSteelCost)) reasons.push('Not enough steel');
                        if (population.civilians < popNeeded) reasons.push(`Need ${popNeeded} civilians (have ${population.civilians})`);
                        if (population.soldiers + popNeeded > population.armyCap) reasons.push(`Army cap reached (${population.soldiers}/${population.armyCap})`);
                        return reasons.length > 0 ? (
                          <p className="text-[9px] text-destructive">{reasons.join(' · ')}</p>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Vassal status */}
          <VassalPanel />

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
                    <span className="text-destructive/70">Your losses:</span>
                    {Object.entries(log.troopsLost).filter(([, v]) => v && v > 0).map(([type, count]) => (
                      <span key={type}>-{count} {TROOP_INFO[type as TroopType].emoji}</span>
                    ))}
                  </div>
                  {log.defenderTroopsLost && Object.values(log.defenderTroopsLost).some(v => v && v > 0) && (
                    <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                      <span className="text-food/70">Enemy losses:</span>
                      {Object.entries(log.defenderTroopsLost).filter(([, v]) => v && v > 0).map(([type, count]) => (
                        <span key={type}>-{count} {TROOP_INFO[type as TroopType].emoji}</span>
                      ))}
                    </div>
                  )}
                  {log.resourcesGained && (
                    <div className="flex gap-2 text-[9px] text-primary mt-0.5">
                      <span>Raided:</span>
                      {Object.entries(log.resourcesGained).filter(([, v]) => v && v > 0).map(([k, v]) => (
                        <span key={k}>+{v} {k}</span>
                      ))}
                    </div>
                  )}
                  {log.buildingDamaged && (
                    <p className="text-[9px] text-destructive mt-0.5">🏚️ Damaged enemy {log.buildingDamaged} (-{log.buildingDamageLevels} level)</p>
                  )}
                  {log.vassalized && (
                    <p className="text-[9px] text-primary font-bold mt-0.5">👑 Enemy vassalized!</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== ESPIONAGE TAB ===== */}
      {tab === 'espionage' && (
        <EspionagePanel
          spies={spies}
          spyTrainCount={spyTrainCount}
          setSpyTrainCount={setSpyTrainCount}
          trainSpies={trainSpies}
          barracksLevel={barracksLevel}
          sendSpyMission={sendSpyMission}
          activeSpyMissions={activeSpyMissions}
          spyTrainingQueue={spyTrainingQueue}
          intelReports={intelReports}
          allVillages={allVillages}
          population={population}
          canAfford={canAfford}
          resources={resources}
        />
      )}

      {/* ===== APOTHECARY TAB ===== */}
      {tab === 'apothecary' && (
        <ApothecaryPanel
          apothecaryLevel={apothecaryLevel}
          injuredTroops={injuredTroops}
          poisons={poisons}
          healTroops={healTroops}
          craftPoison={craftPoison}
          canAfford={canAfford}
          resources={resources}
        />
      )}

      {/* ===== WAR LOG TAB ===== */}
      {tab === 'warlog' && <WarLogPanel />}
    </div>
  );
}

function WarLogPanel() {
  const { user } = useAuth();
  const { battleLogs } = useGame();
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('battle_reports')
        .select('*')
        .or(`attacker_id.eq.${user.id},defender_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(50);
      setReports(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const localReports = battleLogs
    .filter(log => !log.targetUserId)
    .map(log => ({
      id: `local-${log.id}`,
      attacker_id: user?.id,
      defender_id: null,
      attacker_name: 'You',
      defender_name: log.target,
      result: log.result,
      attacker_troops_lost: log.troopsLost,
      defender_troops_lost: log.defenderTroopsLost || {},
      resources_raided: log.resourcesGained || {},
      building_damaged: log.buildingDamaged || null,
      vassalized: log.vassalized || false,
      created_at: new Date(log.timestamp).toISOString(),
      source: 'local',
    }));

  const filtered = [...localReports, ...reports]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter(r => {
    if (filter === 'sent') return r.attacker_id === user?.id;
    if (filter === 'received') return r.defender_id === user?.id;
    return true;
    });

  function timeAgo(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['all', 'sent', 'received'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-[10px] font-display py-1 rounded-lg transition-colors ${filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}>
            {f === 'all' ? '📜 All' : f === 'sent' ? '⚔️ Sent' : '🛡️ Received'}
          </button>
        ))}
      </div>

      {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-6 space-y-2">
          <span className="text-3xl">📜</span>
          <p className="text-sm text-muted-foreground">No battle records yet</p>
        </div>
      )}

      {filtered.map(r => {
        const isSent = r.attacker_id === user?.id;
        const isLocal = r.source === 'local';
        const raided = r.resources_raided || {};
        const raidStr = [
          raided.gold ? `${raided.gold} 💰` : '',
          raided.wood ? `${raided.wood} 🪵` : '',
          raided.stone ? `${raided.stone} 🪨` : '',
          raided.food ? `${raided.food} 🌾` : '',
        ].filter(Boolean).join(' · ');

        const won = isSent ? r.result === 'victory' : r.result !== 'victory';

        return (
          <div key={r.id} className={`game-panel rounded-xl p-3 border ${won ? 'border-primary/30' : 'border-destructive/30'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{isLocal ? '🧭' : isSent ? '⚔️' : '🛡️'}</span>
                <span className="font-display text-xs text-foreground">
                  {isSent ? `→ ${r.defender_name}` : `← ${r.attacker_name}`}
                </span>
                {isLocal && (
                  <span className="text-[8px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    Local
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold ${won ? 'text-primary' : 'text-destructive'}`}>
                  {won ? 'Victory' : 'Defeat'}
                </span>
                <p className="text-[8px] text-muted-foreground">{timeAgo(r.created_at)}</p>
              </div>
            </div>

            {/* Troop losses */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px]">
              {isSent && r.attacker_troops_lost && Object.entries(r.attacker_troops_lost).filter(([, v]) => v && (v as number) > 0).map(([type, count]) => (
                <span key={type} className="text-destructive">-{count as number} {TROOP_INFO[type as TroopType]?.emoji || type}</span>
              ))}
              {!isSent && r.defender_troops_lost && Object.entries(r.defender_troops_lost).filter(([, v]) => v && (v as number) > 0).map(([type, count]) => (
                <span key={type} className="text-destructive">-{count as number} {TROOP_INFO[type as TroopType]?.emoji || type}</span>
              ))}
            </div>

            {/* Resources raided */}
            {raidStr && (
              <p className="text-[9px] mt-0.5">
                <span className={isSent && r.result === 'victory' ? 'text-primary' : 'text-destructive'}>
                  {isSent && r.result === 'victory' ? '📦 Raided: ' : '📦 Lost: '}{raidStr}
                </span>
              </p>
            )}

            {r.building_damaged && (
              <p className="text-[9px] text-muted-foreground mt-0.5">🏚️ {r.building_damaged} damaged</p>
            )}
            {r.vassalized && (
              <p className="text-[9px] text-primary font-bold mt-0.5">👑 {isSent ? 'Enemy vassalized!' : 'You were vassalized!'}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EspionagePanel({
  spies, spyTrainCount, setSpyTrainCount, trainSpies, barracksLevel,
  sendSpyMission, activeSpyMissions, spyTrainingQueue, intelReports, allVillages, population, canAfford, resources,
}: any) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<SpyMission>('scout');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (activeSpyMissions.length === 0) return;
    const t = setInterval(() => forceUpdate(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [activeSpyMissions.length]);

  const canTrainSpy = barracksLevel >= 2 && resources.gold >= 40 * spyTrainCount && resources.food >= 20 * spyTrainCount && population.civilians >= spyTrainCount;
  const missionInfo = SPY_MISSION_INFO[selectedMission];
  const canSend = spies >= missionInfo.spiesRequired && resources.gold >= missionInfo.goldCost && selectedTarget;
  const trainReasons: string[] = [];
  const sendReasons: string[] = [];

  if (barracksLevel < 2) trainReasons.push('Barracks Lv.2 required');
  if (resources.gold < 40 * spyTrainCount) trainReasons.push(`Need ${40 * spyTrainCount} gold (have ${resources.gold})`);
  if (resources.food < 20 * spyTrainCount) trainReasons.push(`Need ${20 * spyTrainCount} food (have ${resources.food})`);
  if (population.civilians < spyTrainCount) trainReasons.push(`Need ${spyTrainCount} civilians (have ${population.civilians})`);

  if (!selectedTarget) sendReasons.push('Choose a target');
  if (spies < missionInfo.spiesRequired) sendReasons.push(`Need ${missionInfo.spiesRequired} spy${missionInfo.spiesRequired > 1 ? 'ies' : ''} (have ${spies})`);
  if (resources.gold < missionInfo.goldCost) sendReasons.push(`Need ${missionInfo.goldCost} gold (have ${resources.gold})`);

  return (
    <div className="space-y-3">
      {/* Spy Roster */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs text-foreground">🕵️ Spy Roster</h3>
          <span className="text-xs text-primary font-bold">{spies} available</span>
        </div>
        <p className="text-[9px] text-muted-foreground">Spies gather intel, sabotage enemies, and spread propaganda. Requires Barracks Lv.2+</p>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setSpyTrainCount(Math.max(1, spyTrainCount - 1))}
              className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">−</motion.button>
            <span className="text-xs text-foreground w-6 text-center font-bold">{spyTrainCount}</span>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setSpyTrainCount(Math.min(10, spyTrainCount + 1))}
              className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center">+</motion.button>
          </div>
          <div className="flex-1 text-[9px] text-muted-foreground">
            <ResourceIcon type="gold" size={10} />{40 * spyTrainCount} <ResourceIcon type="food" size={10} />{20 * spyTrainCount} <ResourceIcon type="population" size={10} />{spyTrainCount} · <ResourceIcon type="timer" size={10} />{20 * spyTrainCount}s
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { if (trainSpies(spyTrainCount)) setSpyTrainCount(1); }}
            disabled={!canTrainSpy}
            className={`font-display text-[10px] py-1 px-3 rounded-lg ${canTrainSpy ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'}`}>
            Recruit
          </motion.button>
        </div>
        {!canTrainSpy && trainReasons.length > 0 && (
          <p className="text-[9px] text-destructive">{trainReasons.join(' · ')}</p>
        )}
      </div>

      {/* Spy Training Queue */}
      {spyTrainingQueue.length > 0 && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-2">
          <h3 className="font-display text-xs text-foreground">🕵️ Training Spies</h3>
          {spyTrainingQueue.map((q: any, i: number) => {
            const remaining = Math.max(0, Math.ceil((q.finishTime - Date.now()) / 1000));
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground">🕵️ Spy x{q.count}</span>
                <span className="text-primary font-mono">{formatTime(remaining)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Missions with travel animation */}
      {activeSpyMissions.length > 0 && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-2">
          <h3 className="font-display text-xs text-foreground">🚶 Active Missions</h3>
          {activeSpyMissions.map((m: any) => {
            const now = Date.now();
            const totalDuration = m.returnTime - m.departTime;
            const elapsed = now - m.departTime;
            const progress = Math.min(1, elapsed / totalDuration);
            const remaining = Math.max(0, Math.ceil((m.returnTime - now) / 1000));
            const phaseEmoji = m.phase === 'traveling' ? '🚶' : m.phase === 'operating' ? '🔍' : '🏃';
            const phaseLabel = m.phase === 'traveling' ? 'En Route' : m.phase === 'operating' ? 'Operating' : 'Returning';

            return (
              <div key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground">{SPY_MISSION_INFO[m.mission as SpyMission].emoji} {SPY_MISSION_INFO[m.mission as SpyMission].name} → {m.targetName}</span>
                  <span className="text-primary font-mono">{formatTime(remaining)}</span>
                </div>
                {/* Travel progress bar */}
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                    style={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] text-foreground font-bold">
                    {phaseEmoji} {phaseLabel} ({m.spiesCount} 🕵️)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send Mission */}
      {spies > 0 && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-3">
          <h3 className="font-display text-xs text-foreground">📋 Send Mission</h3>

          {/* Mission type selector */}
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground font-display">Mission Type</p>
            <div className="flex gap-1">
              {SPY_MISSIONS.map(mission => {
                const info = SPY_MISSION_INFO[mission];
                return (
                  <button key={mission}
                    onClick={() => setSelectedMission(mission)}
                    className={`flex-1 text-[10px] py-2 px-1 rounded-lg border transition-colors ${
                      selectedMission === mission
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-muted/50 text-muted-foreground'
                    }`}>
                    <div className="text-center">
                      <span className="text-lg block">{info.emoji}</span>
                      <span className="font-display block">{info.name}</span>
                      <span className="text-[8px] block mt-0.5 flex items-center justify-center gap-0.5"><ResourceIcon type="gold" size={8} />{info.goldCost} · 🕵️{info.spiesRequired}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-muted-foreground">{missionInfo.description}</p>
            <p className="text-[9px] text-muted-foreground">Base success: <span className="text-primary font-bold">{Math.round(missionInfo.baseSuccessRate * 100)}%</span></p>
          </div>

          {/* Target selector */}
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground font-display">Target</p>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full text-[11px] py-1.5 px-2 rounded-lg bg-muted border border-border text-foreground"
            >
              <option value="">Select target...</option>
              {allVillages.filter((v: any) => v.village.user_id !== undefined).map((v: any) => (
                <option key={v.village.id} value={v.village.id}>
                  {v.profile.display_name} — {v.village.name} (Lv.{v.village.level})
                </option>
              ))}
            </select>
          </div>

          <motion.button whileTap={{ scale: 0.95 }}
            disabled={!canSend}
            onClick={() => {
              const target = allVillages.find((v: any) => v.village.id === selectedTarget);
              if (!target) return;
              // Deterministic position
              let h = 5381;
              for (let i = 0; i < target.village.id.length; i++) h = ((h << 5) + h + target.village.id.charCodeAt(i)) >>> 0;
              const h2 = ((h * 2654435761) >>> 0);
              const tx = 80000 + (h % 40000);
              const ty = 80000 + (h2 % 40000);
              sendSpyMission(selectedMission, target.profile.display_name, target.village.id, tx, ty, 1);
              setSelectedTarget('');
            }}
            className={`w-full font-display text-[11px] py-2 rounded-lg ${
              canSend ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'
            }`}>
            {missionInfo.emoji} Send {missionInfo.name} Mission (<ResourceIcon type="gold" size={10} />{missionInfo.goldCost})
          </motion.button>
          {!canSend && sendReasons.length > 0 && (
            <p className="text-[9px] text-destructive">{sendReasons.join(' · ')}</p>
          )}
        </div>
      )}

      {/* Intel Reports */}
      <div className="space-y-2">
        <h3 className="font-display text-sm text-foreground">📜 Intel Reports ({intelReports.length})</h3>
        {intelReports.length === 0 && (
          <p className="text-[10px] text-muted-foreground game-panel rounded-xl p-3">No intel yet. Send spies to gather information.</p>
        )}
        {intelReports.slice(0, 10).map((report: any) => (
          <div key={report.id} className={`game-panel rounded-xl p-2.5 border ${
            report.result === 'success' ? 'border-food/30' : report.result === 'caught' ? 'border-destructive/30' : 'border-muted-foreground/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-xs text-foreground">
                {SPY_MISSION_INFO[report.mission as SpyMission].emoji} {SPY_MISSION_INFO[report.mission as SpyMission].name} — {report.targetName}
              </span>
              <span className={`text-[10px] font-bold ${
                report.result === 'success' ? 'text-food' : report.result === 'caught' ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {report.result === 'success' ? '✅ Success' : report.result === 'caught' ? '🚨 Caught!' : '❌ Failed'}
              </span>
            </div>

            {report.result === 'success' && report.data && (
              <div className="mt-1.5 space-y-1">
                {/* Scout intel */}
                {report.data.troops && (
                  <div className="text-[9px]">
                    <p className="text-muted-foreground font-display">Troops Spotted:</p>
                    <div className="flex gap-2 text-foreground">
                      {Object.entries(report.data.troops).filter(([, v]) => (v as number) > 0).map(([type, count]) => (
                        <span key={type}>{TROOP_INFO[type as TroopType].emoji}{count as number}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.data.resources && (
                  <div className="text-[9px]">
                    <p className="text-muted-foreground font-display">Est. Resources:</p>
                    <div className="flex gap-2 text-foreground">
                      <span className="flex items-center gap-0.5"><ResourceIcon type="gold" size={10} />{report.data.resources.gold}</span>
                      <span className="flex items-center gap-0.5"><ResourceIcon type="wood" size={10} />{report.data.resources.wood}</span>
                      <span className="flex items-center gap-0.5"><ResourceIcon type="stone" size={10} />{report.data.resources.stone}</span>
                      <span className="flex items-center gap-0.5"><ResourceIcon type="food" size={10} />{report.data.resources.food}</span>
                    </div>
                  </div>
                )}
                {report.data.defenses !== undefined && (
                  <p className="text-[9px] text-muted-foreground">🧱 Wall Level: {report.data.defenses}</p>
                )}
                {/* Sabotage */}
                {report.data.resourcesDestroyed && (
                  <div className="text-[9px]">
                    <p className="text-muted-foreground font-display">Resources Destroyed:</p>
                    <div className="flex gap-2 text-destructive">
                      {Object.entries(report.data.resourcesDestroyed).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
                        <span key={k}>-{v as number} {k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Demoralize */}
                {report.data.happinessDrop && (
                  <p className="text-[9px] text-destructive">😢 Happiness dropped by {report.data.happinessDrop}%</p>
                )}
              </div>
            )}

            {report.result === 'caught' && (
              <p className="text-[9px] text-destructive mt-1">🕵️ Spy was captured. Agent lost.</p>
            )}

            <p className="text-[8px] text-muted-foreground mt-1">
              {new Date(report.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApothecaryPanel({ apothecaryLevel, injuredTroops, poisons, healTroops, craftPoison, canAfford, resources }: any) {
  const [healCounts, setHealCounts] = useState<Record<TroopType, number>>({ militia: 1, archer: 1, knight: 1, cavalry: 1, siege: 1, scout: 1 });
  const [poisonCount, setPoisonCount] = useState(1);

  if (apothecaryLevel === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
        <span className="text-5xl">⚗️</span>
        <h2 className="font-display text-lg text-foreground">No Apothecary</h2>
        <p className="text-sm text-muted-foreground">Build an Apothecary to heal injured troops and craft poisons for your spies.</p>
      </div>
    );
  }

  const totalInjured = (Object.values(injuredTroops) as number[]).reduce((s, v) => s + v, 0);
  const costMult = Math.max(0.4, 1 - apothecaryLevel * 0.1);

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xs text-foreground">⚗️ Apothecary Lv.{apothecaryLevel}</h3>
          <span className="text-[9px] text-muted-foreground">Heal rate: {Math.round(Math.min(60, 20 + apothecaryLevel * 8))}% of losses saved</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-destructive">🩹 {totalInjured} injured</span>
          <span className="text-primary">🧪 {poisons} poisons</span>
        </div>
      </div>

      {/* Heal Injured Troops */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <h3 className="font-display text-xs text-foreground">🩹 Heal Injured Troops</h3>
        {totalInjured === 0 ? (
          <p className="text-[10px] text-muted-foreground">No injured troops. After battle, wounded soldiers will appear here for healing.</p>
        ) : (
          <div className="space-y-2">
            {TROOP_TYPES.map(type => {
              const injured = injuredTroops[type];
              if (injured <= 0) return null;
              const info = TROOP_INFO[type];
              const count = Math.min(healCounts[type], injured);
              const healGold = Math.floor(info.cost.gold * 0.3 * costMult * count);
              const healFood = Math.floor(info.cost.food * 0.5 * costMult * count);
              const healTime = Math.max(5, Math.floor(15 / apothecaryLevel)) * count;
              const affordable = canAfford({ gold: healGold, wood: 0, stone: 0, food: healFood });

              return (
                <div key={type} className="game-panel rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{info.emoji} {info.name}</span>
                    <span className="text-xs text-destructive font-bold">{injured} injured</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setHealCounts(p => ({ ...p, [type]: Math.max(1, p[type] - 1) }))}
                        className="w-5 h-5 rounded bg-muted text-foreground text-[10px] flex items-center justify-center">−</motion.button>
                      <span className="text-[10px] text-foreground w-5 text-center font-bold">{count}</span>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => setHealCounts(p => ({ ...p, [type]: Math.min(injured, p[type] + 1) }))}
                        className="w-5 h-5 rounded bg-muted text-foreground text-[10px] flex items-center justify-center">+</motion.button>
                    </div>
                    <div className="flex-1 text-[9px] text-muted-foreground flex items-center gap-1 flex-wrap">
                      <span className="flex items-center gap-px"><ResourceIcon type="gold" size={9} />{healGold}</span>
                      <span className="flex items-center gap-px"><ResourceIcon type="food" size={9} />{healFood}</span>
                      <span className="flex items-center gap-px"><ResourceIcon type="timer" size={9} />{healTime}s</span>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => { if (healTroops(type, count)) setHealCounts(p => ({ ...p, [type]: 1 })); }}
                      disabled={!affordable}
                      className={`font-display text-[9px] py-1 px-2 rounded-lg ${affordable ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'}`}>
                      Heal
                    </motion.button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Craft Poison */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <h3 className="font-display text-xs text-foreground">🧪 Craft Poison</h3>
        <p className="text-[9px] text-muted-foreground">
          {apothecaryLevel < 2
            ? 'Requires Apothecary Lv.2 to craft poisons.'
            : 'Poisons boost spy sabotage missions, dealing extra damage to enemy resources.'}
        </p>
        {apothecaryLevel >= 2 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setPoisonCount(Math.max(1, poisonCount - 1))}
                className="w-5 h-5 rounded bg-muted text-foreground text-[10px] flex items-center justify-center">−</motion.button>
              <span className="text-[10px] text-foreground w-5 text-center font-bold">{poisonCount}</span>
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => setPoisonCount(Math.min(10, poisonCount + 1))}
                className="w-5 h-5 rounded bg-muted text-foreground text-[10px] flex items-center justify-center">+</motion.button>
            </div>
            <div className="flex-1 text-[9px] text-muted-foreground flex items-center gap-1">
              <span className="flex items-center gap-px"><ResourceIcon type="gold" size={9} />{60 * poisonCount}</span>
              <span className="flex items-center gap-px"><ResourceIcon type="food" size={9} />{30 * poisonCount}</span>
              <span className="flex items-center gap-px"><ResourceIcon type="timer" size={9} />{15 * poisonCount}s</span>
            </div>
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={() => { if (craftPoison(poisonCount)) setPoisonCount(1); }}
              disabled={!canAfford({ gold: 60 * poisonCount, wood: 0, stone: 0, food: 30 * poisonCount })}
              className={`font-display text-[9px] py-1 px-2 rounded-lg ${canAfford({ gold: 60 * poisonCount, wood: 0, stone: 0, food: 30 * poisonCount }) ? 'bg-primary text-primary-foreground glow-gold-sm' : 'bg-muted text-muted-foreground'}`}>
              Craft
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
