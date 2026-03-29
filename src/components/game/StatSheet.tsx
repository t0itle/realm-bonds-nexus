import { useGame, TROOP_INFO, TroopType, BUILDING_INFO, BuildingType } from '@/hooks/useGameState';

export default function StatSheet() {
  const { population, army, armyUpkeep, totalProduction, resources, steel, buildings, workerAssignments, assignWorker, unassignWorker, getMaxWorkers } = useGame();
  const upkeep = armyUpkeep();

  const totalTroops = Object.values(army).reduce((s, v) => s + v, 0);

  return (
    <div className="flex-1 flex flex-col p-3 space-y-3 overflow-y-auto pb-20">
      <h2 className="font-display text-lg text-foreground text-shadow-gold">Kingdom Stats</h2>

      {/* Population Overview */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <h3 className="font-display text-xs text-foreground flex items-center gap-1">👥 Population</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
            <div className="h-full flex">
              <div className="bg-primary h-full" style={{ width: `${(population.soldiers / Math.max(1, population.max)) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(population.workers / Math.max(1, population.max)) * 100}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${(population.civilians / Math.max(1, population.max)) * 100}%` }} />
            </div>
          </div>
          <span className="text-xs text-foreground font-bold tabular-nums">{population.current}/{population.max}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-primary/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground">Soldiers</p>
            <p className="text-xs font-bold text-primary">⚔️ {population.soldiers}</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground">Workers</p>
            <p className="text-xs font-bold text-amber-500">🔨 {population.workers}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-1.5">
            <p className="text-[9px] text-muted-foreground">Idle</p>
            <p className="text-xs font-bold text-emerald-500">🏠 {population.civilians}</p>
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground">Army Cap: ⚔️ {population.armyCap} (from Barracks + workers)</p>
      </div>

      {/* Resources & Steel */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-1.5">
        <h3 className="font-display text-xs text-foreground">📊 Resource Summary</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">💰 Gold</span><span className="text-foreground">{resources.gold.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+/min</span><span className="text-primary">+{totalProduction.gold}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">🪵 Wood</span><span className="text-foreground">{resources.wood.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+/min</span><span className="text-primary">+{totalProduction.wood}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">🪨 Stone</span><span className="text-foreground">{resources.stone.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+/min</span><span className="text-primary">+{totalProduction.stone}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">🌾 Food</span><span className="text-foreground">{resources.food.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">+/min</span><span className="text-primary">+{totalProduction.food}</span></div>
          <div className="flex justify-between col-span-2 border-t border-border pt-1 mt-1">
            <span className="text-muted-foreground font-bold">⚙️ Steel</span>
            <span className="text-foreground font-bold">{steel}</span>
          </div>
          <p className="text-[9px] text-muted-foreground col-span-2">Steel is obtained by capturing mines on the Map</p>
        </div>
      </div>

      {/* Army Cost Breakdown */}
      {totalTroops > 0 && (
        <div className="game-panel border-glow rounded-xl p-3 space-y-2">
          <h3 className="font-display text-xs text-foreground">⚔️ Army Upkeep</h3>
          <div className="space-y-1">
            {(['militia', 'archer', 'knight', 'cavalry', 'siege'] as TroopType[]).map(type => {
              const count = army[type];
              if (count === 0) return null;
              const info = TROOP_INFO[type];
              return (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{info.emoji} {info.name} x{count}</span>
                  <span className="text-destructive">🌾-{info.foodUpkeep * count}/min {info.goldUpkeep > 0 ? `💰-${info.goldUpkeep * count}/min` : ''}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border pt-1.5 flex justify-between text-xs font-bold">
            <span className="text-foreground">Total Upkeep</span>
            <span className="text-destructive">🌾-{upkeep.food * 60}/min 💰-{upkeep.gold * 60}/min</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Net Food</span>
            <span className={totalProduction.food - upkeep.food * 60 >= 0 ? 'text-emerald-500' : 'text-destructive'}>
              {totalProduction.food - upkeep.food * 60 >= 0 ? '+' : ''}{totalProduction.food - upkeep.food * 60}/min
            </span>
          </div>
        </div>
      )}

      {/* Worker Assignments */}
      <div className="game-panel border-glow rounded-xl p-3 space-y-2">
        <h3 className="font-display text-xs text-foreground">🔨 Worker Assignments</h3>
        <p className="text-[9px] text-muted-foreground">Assign idle civilians ({population.civilians} available) to buildings for production bonuses</p>
        {buildings.filter(b => b.type !== 'empty' && BUILDING_INFO[b.type as Exclude<BuildingType, 'empty'>].workersPerLevel > 0).map(b => {
          const info = BUILDING_INFO[b.type as Exclude<BuildingType, 'empty'>];
          const current = workerAssignments[b.id] || 0;
          const max = getMaxWorkers(b);
          return (
            <div key={b.id} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{info.icon}</span>
                <div>
                  <span className="text-xs text-foreground">{info.name} Lv.{b.level}</span>
                  <p className="text-[9px] text-muted-foreground">{current}/{max} workers</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => unassignWorker(b.id)}
                  disabled={current <= 0}
                  className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center disabled:opacity-30"
                >−</button>
                <span className="text-xs font-bold text-foreground w-4 text-center">{current}</span>
                <button
                  onClick={() => assignWorker(b.id)}
                  disabled={current >= max || population.civilians <= 0}
                  className="w-6 h-6 rounded bg-muted text-foreground text-xs flex items-center justify-center disabled:opacity-30"
                >+</button>
              </div>
            </div>
          );
        })}
        {buildings.filter(b => b.type !== 'empty' && BUILDING_INFO[b.type as Exclude<BuildingType, 'empty'>].workersPerLevel > 0).length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Build production buildings to assign workers</p>
        )}
      </div>

      {/* Civilian Cost */}
      <div className="game-panel rounded-xl p-3 space-y-1">
        <h3 className="font-display text-xs text-foreground">🏠 Civilian Costs</h3>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Civilian food consumption</span>
          <span className="text-destructive">🌾-{Math.floor(population.civilians * 0.5)}/min</span>
        </div>
        <p className="text-[9px] text-muted-foreground">Each idle civilian consumes 0.5 food/min. Workers and soldiers have separate upkeep.</p>
      </div>
    </div>
  );
}
