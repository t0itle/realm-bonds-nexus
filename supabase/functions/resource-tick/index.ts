import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mirror of client-side production logic
interface BuildingRow {
  id: string;
  village_id: string;
  user_id: string;
  type: string;
  level: number;
  position: number;
  workers: number;
}

interface VillageRow {
  id: string;
  user_id: string;
  gold: number;
  wood: number;
  stone: number;
  food: number;
  steel: number;
  level: number;
  population: number;
  max_population: number;
  happiness: number;
  pop_tax_rate: number;
  rations: string;
  army_militia: number;
  army_archer: number;
  army_knight: number;
  army_cavalry: number;
  army_siege: number;
  army_scout: number;
  last_resource_tick: string;
}

interface BuildQueueRow {
  id: string;
  village_id: string | null;
  user_id: string;
  building_id: string;
  building_type: string;
  target_level: number;
  finish_time: string;
}

interface ResourceState {
  gold: number;
  wood: number;
  stone: number;
  food: number;
  steel: number;
}

const BUILDING_QUEUE_IGNORED_TYPES = new Set([
  "outpost_upgrade",
  "outpost_wall",
  "settlement_upgrade",
]);

const BUILDING_META: Record<string, {
  baseCost: { gold: number; wood: number; stone: number; food: number };
  steelCost?: number;
  maxLevel: number;
  buildTime: number;
}> = {
  townhall: { baseCost: { gold: 100, wood: 50, stone: 50, food: 0 }, steelCost: 5, maxLevel: 20, buildTime: 120 },
  house: { baseCost: { gold: 20, wood: 40, stone: 20, food: 0 }, maxLevel: 5, buildTime: 40 },
  temple: { baseCost: { gold: 60, wood: 30, stone: 50, food: 0 }, steelCost: 2, maxLevel: 5, buildTime: 90 },
  farm: { baseCost: { gold: 30, wood: 40, stone: 10, food: 0 }, maxLevel: 10, buildTime: 30 },
  lumbermill: { baseCost: { gold: 30, wood: 10, stone: 20, food: 0 }, maxLevel: 10, buildTime: 30 },
  quarry: { baseCost: { gold: 40, wood: 20, stone: 10, food: 0 }, maxLevel: 10, buildTime: 40 },
  goldmine: { baseCost: { gold: 10, wood: 30, stone: 40, food: 0 }, steelCost: 3, maxLevel: 10, buildTime: 50 },
  barracks: { baseCost: { gold: 80, wood: 60, stone: 40, food: 20 }, steelCost: 8, maxLevel: 8, buildTime: 80 },
  wall: { baseCost: { gold: 20, wood: 10, stone: 60, food: 0 }, steelCost: 4, maxLevel: 10, buildTime: 60 },
  watchtower: { baseCost: { gold: 50, wood: 40, stone: 30, food: 0 }, maxLevel: 5, buildTime: 50 },
  apothecary: { baseCost: { gold: 70, wood: 30, stone: 30, food: 20 }, steelCost: 2, maxLevel: 5, buildTime: 70 },
  warehouse: { baseCost: { gold: 50, wood: 80, stone: 60, food: 0 }, maxLevel: 10, buildTime: 50 },
  spyguild: { baseCost: { gold: 100, wood: 50, stone: 40, food: 30 }, steelCost: 5, maxLevel: 5, buildTime: 90 },
  administrator: { baseCost: { gold: 200, wood: 100, stone: 80, food: 50 }, steelCost: 3, maxLevel: 1, buildTime: 120 },
};

const BASE_PRODUCTION: Record<string, Partial<Record<string, number>>> = {
  farm: { food: 2 },
  lumbermill: { wood: 2 },
  quarry: { stone: 1 },
  goldmine: { gold: 1 },
};

const HOUSING_PER_LEVEL = 8;

const TROOP_UPKEEP: Record<string, { food: number; gold: number; popCost: number }> = {
  militia:  { food: 1, gold: 0, popCost: 1 },
  archer:   { food: 1, gold: 0, popCost: 1 },
  knight:   { food: 2, gold: 1, popCost: 2 },
  cavalry:  { food: 3, gold: 1, popCost: 2 },
  siege:    { food: 4, gold: 1, popCost: 3 },
  scout:    { food: 1, gold: 0, popCost: 1 },
};

// Rations is now a 0-100 slider value; legacy string values are converted
function parseRations(raw: string): number {
  if (raw === 'scarce') return 0;
  if (raw === 'normal') return 50;
  if (raw === 'generous') return 100;
  const n = Number(raw);
  return isNaN(n) ? 50 : Math.max(0, Math.min(100, n));
}
function getRationsMultiplier(level: number): number {
  if (level <= 50) return 0.5 + (level / 50) * 0.5;
  return 1.0 + ((level - 50) / 50) * 1.0;
}
function getRationsHappiness(level: number): number {
  if (level <= 50) return Math.round(-15 + (level / 50) * 15);
  return Math.round(((level - 50) / 50) * 15);
}

function getProduction(type: string, level: number, workers: number): Record<string, number> {
  const base = BASE_PRODUCTION[type];
  if (!base) return {};
  const result: Record<string, number> = {};
  const workerBonus = 1 + workers * 0.35;
  for (const [key, val] of Object.entries(base)) {
    result[key] = Math.floor(val! * level * 1.2 * workerBonus * 0.72); // 28% nerf (20% + 10%)
  }
  return result;
}

function getSteelProduction(_type: string, _level: number, _workers: number): number {
  return 0; // Steel now comes from iron ore deposits on the world map
}

function getUpgradeCost(type: string, level: number): ResourceState | null {
  const info = BUILDING_META[type];
  if (!info) return null;

  const mult = Math.pow(1.5, level);
  return {
    gold: Math.floor(info.baseCost.gold * mult),
    wood: Math.floor(info.baseCost.wood * mult),
    stone: Math.floor(info.baseCost.stone * mult),
    food: Math.floor(info.baseCost.food * mult),
    steel: level >= 3 && info.steelCost ? Math.floor(info.steelCost * (level - 2)) : 0,
  };
}

function getBuildTimeSeconds(type: string, level: number): number {
  const info = BUILDING_META[type];
  if (!info) return 0;
  return Math.floor(info.buildTime * 3 * Math.pow(1.3, level));
}

function getTownhallLevel(buildings: BuildingRow[], fallback: number): number {
  return buildings.find((building) => building.type === "townhall")?.level ?? fallback;
}

function getMaxBuildingLevel(type: string, townhallLevel: number): number {
  const info = BUILDING_META[type];
  if (!info) return 0;
  if (type === "townhall") return info.maxLevel;
  return townhallLevel >= 20 ? 20 : info.maxLevel;
}

function canAffordResources(resources: ResourceState, cost: ResourceState): boolean {
  return resources.gold >= cost.gold
    && resources.wood >= cost.wood
    && resources.stone >= cost.stone
    && resources.food >= cost.food
    && resources.steel >= cost.steel;
}

function spendResources(resources: ResourceState, cost: ResourceState): ResourceState {
  return {
    gold: resources.gold - cost.gold,
    wood: resources.wood - cost.wood,
    stone: resources.stone - cost.stone,
    food: resources.food - cost.food,
    steel: resources.steel - cost.steel,
  };
}

function getFirstEmptyPosition(buildings: BuildingRow[]): number {
  const occupiedPositions = new Set(buildings.map((building) => building.position));
  for (let position = 0; position < 25; position++) {
    if (!occupiedPositions.has(position)) return position;
  }
  return -1;
}

async function processCompletedBuildQueueForVillage(
  supabase: ReturnType<typeof createClient>,
  buildings: BuildingRow[],
  queueRows: BuildQueueRow[],
  now: Date,
): Promise<BuildQueueRow[]> {
  const villageQueue = queueRows.filter((row) => !BUILDING_QUEUE_IGNORED_TYPES.has(row.building_type));
  const completed = villageQueue.filter((row) => new Date(row.finish_time).getTime() <= now.getTime());
  const active = villageQueue.filter((row) => new Date(row.finish_time).getTime() > now.getTime());

  if (completed.length === 0) return active;

  for (const row of completed) {
    const building = buildings.find((entry) => entry.id === row.building_id);
    if (building) building.level = row.target_level;
  }

  const queueIds = completed.map((row) => row.id);
  await Promise.all([
    ...completed.map((row) =>
      supabase
        .from("buildings")
        .update({ level: row.target_level })
        .eq("id", row.building_id)
    ),
    supabase.from("build_queue").delete().in("id", queueIds),
  ]);

  return active;
}

async function maybeRunAdministratorAutomation({
  supabase,
  village,
  buildings,
  activeQueue,
  resources,
  population,
  housingCapacity,
  now,
}: {
  supabase: ReturnType<typeof createClient>;
  village: VillageRow;
  buildings: BuildingRow[];
  activeQueue: BuildQueueRow[];
  resources: ResourceState;
  population: number;
  housingCapacity: number;
  now: Date;
}): Promise<ResourceState> {
  const hasAdministrator = buildings.some((building) => building.type === "administrator" && building.level >= 1);
  if (!hasAdministrator || activeQueue.length >= 2) return resources;

  const townhallLevel = getTownhallLevel(buildings, village.level || 1);
  const currentHouses = buildings.filter((building) => building.type === "house").length;
  const maxHouses = townhallLevel * 2;
  const emptyPosition = getFirstEmptyPosition(buildings);
  const queuedIds = new Set(activeQueue.map((queueItem) => queueItem.building_id));

  const enqueueNewBuilding = async (type: "house" | "farm") => {
    if (emptyPosition === -1) return null;

    const cost = getUpgradeCost(type, 0);
    if (!cost || !canAffordResources(resources, cost)) return null;

    const { data: createdBuilding, error: buildingError } = await supabase
      .from("buildings")
      .insert({
        village_id: village.id,
        user_id: village.user_id,
        type,
        level: 0,
        position: emptyPosition,
        workers: 0,
      })
      .select("id")
      .single();

    if (buildingError || !createdBuilding) {
      console.error("Administrator failed to create building", {
        villageId: village.id,
        type,
        error: buildingError?.message,
      });
      return null;
    }

    const finishTime = new Date(now.getTime() + getBuildTimeSeconds(type, 0) * 1000).toISOString();
    const { error: queueError } = await supabase.from("build_queue").insert({
      user_id: village.user_id,
      building_id: createdBuilding.id,
      building_type: type,
      target_level: 1,
      finish_time: finishTime,
      village_id: village.id,
    });

    if (queueError) {
      await supabase.from("buildings").delete().eq("id", createdBuilding.id);
      console.error("Administrator failed to queue new building", {
        villageId: village.id,
        type,
        error: queueError.message,
      });
      return null;
    }

    console.log("Administrator queued building", {
      villageId: village.id,
      buildingId: createdBuilding.id,
      type,
      finishTime,
    });

    return spendResources(resources, cost);
  };

  const enqueueUpgrade = async (building: BuildingRow) => {
    const cost = getUpgradeCost(building.type, building.level);
    if (!cost || !canAffordResources(resources, cost)) return null;

    const finishTime = new Date(now.getTime() + getBuildTimeSeconds(building.type, building.level) * 1000).toISOString();
    const { error } = await supabase.from("build_queue").insert({
      user_id: village.user_id,
      building_id: building.id,
      building_type: building.type,
      target_level: building.level + 1,
      finish_time: finishTime,
      village_id: village.id,
    });

    if (error) {
      console.error("Administrator failed to queue upgrade", {
        villageId: village.id,
        buildingId: building.id,
        buildingType: building.type,
        error: error.message,
      });
      return null;
    }

    console.log("Administrator queued upgrade", {
      villageId: village.id,
      buildingId: building.id,
      buildingType: building.type,
      targetLevel: building.level + 1,
      finishTime,
    });

    return spendResources(resources, cost);
  };

  if (population >= housingCapacity * 0.85 && currentHouses < maxHouses) {
    const nextResources = await enqueueNewBuilding("house");
    if (nextResources) return nextResources;
  }

  const farms = buildings.filter((building) => building.type === "farm").length;
  if ((farms < 3 || population > farms * 8) && emptyPosition !== -1) {
    const nextResources = await enqueueNewBuilding("farm");
    if (nextResources) return nextResources;
  }

  const upgradeableBuildings = buildings
    .filter((building) => building.type !== "administrator" && !queuedIds.has(building.id))
    .filter((building) => building.level < getMaxBuildingLevel(building.type, townhallLevel))
    .sort((left, right) => left.level - right.level);

  for (const building of upgradeableBuildings) {
    const nextResources = await enqueueUpgrade(building);
    if (nextResources) return nextResources;
  }

  return resources;
}

// ── NPC Autonomy Simulation ──
const NPC_ACTIONS = [
  'Expanded borders',
  'Raised an army',
  'Built fortifications',
  'Signed a trade deal',
  'Declared war',
  'Formed an alliance',
  'Conquered a territory',
  'Lost territory',
  'Held a festival',
  'Suffered a plague',
  'Discovered new resources',
  'Trained elite guards',
];

const NPC_WAR_EVENTS = [
  'border skirmish',
  'trade dispute',
  'broken treaty',
  'territorial claim',
  'assassination attempt',
  'resource competition',
];

const NPC_ALLIANCE_EVENTS = [
  'mutual defense pact',
  'trade agreement',
  'royal marriage',
  'shared enemy',
  'cultural exchange',
];

async function simulateNPCAutonomy(supabase: ReturnType<typeof createClient>) {
  // Get existing NPC town states
  const { data: existingStates } = await supabase
    .from("npc_town_state")
    .select("*");

  const states = existingStates || [];

  // Only simulate if we have states, or seed initial ones
  // Seed: generate states for ~20 NPC towns from nearby chunks (chunk coords -2 to 2)
  if (states.length === 0) {
    const initialStates: { npc_town_id: string; current_power: number; available_mercenaries: Record<string, number> }[] = [];
    for (let cx = -2; cx <= 2; cx++) {
      for (let cy = -2; cy <= 2; cy++) {
        // Generate 0-2 realm IDs per chunk (matching client deterministic generation)
        for (let i = 0; i < 2; i++) {
          const id = `realm-${cx}-${cy}-${i}`;
          const power = 50 + Math.floor(Math.random() * 300);
          initialStates.push({
            npc_town_id: id,
            current_power: power,
            available_mercenaries: {
              militia: 10 + Math.floor(Math.random() * 20),
              archer: 5 + Math.floor(Math.random() * 10),
              knight: Math.floor(Math.random() * 8),
              cavalry: Math.floor(Math.random() * 5),
            },
          });
        }
      }
    }
    if (initialStates.length > 0) {
      await supabase.from("npc_town_state").upsert(initialStates, { onConflict: 'npc_town_id' });
    }
    return; // First tick just seeds, next tick will simulate
  }

  // Simulate each NPC town action (random chance per tick)
  for (const state of states) {
    // ── Passive resource regeneration ──
    const regenPerTick: Record<string, number> = {
      stock_gold: 5 + Math.floor((state.current_power as number) * 0.05),
      stock_wood: 4 + Math.floor((state.current_power as number) * 0.04),
      stock_stone: 3 + Math.floor((state.current_power as number) * 0.03),
      stock_food: 5 + Math.floor((state.current_power as number) * 0.05),
      stock_steel: 1 + Math.floor((state.current_power as number) * 0.005),
    };
    const maxStock: Record<string, number> = {
      stock_gold: (state.current_power as number) * 15,
      stock_wood: (state.current_power as number) * 12,
      stock_stone: (state.current_power as number) * 10,
      stock_food: (state.current_power as number) * 14,
      stock_steel: Math.max(20, (state.current_power as number)),
    };
    const regenUpdate: Record<string, number> = {};
    for (const [key, rate] of Object.entries(regenPerTick)) {
      const current = (state as any)[key] ?? 0;
      regenUpdate[key] = Math.min(maxStock[key], current + rate);
    }

    if (Math.random() > 0.15) {
      // No action this tick, just regen resources
      await supabase.from("npc_town_state").update({
        ...regenUpdate,
        last_regen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("npc_town_id", state.npc_town_id);
      continue;
    }

    const action = NPC_ACTIONS[Math.floor(Math.random() * NPC_ACTIONS.length)];
    let powerDelta = 0;
    const newMercs = { ...(state.available_mercenaries as Record<string, number>) };
    const claimedRegions = [...((state.claimed_regions as string[]) || [])];

    switch (action) {
      case 'Expanded borders':
      case 'Conquered a territory': {
        const regionId = `region-${Math.floor(Math.random() * 100)}`;
        if (!claimedRegions.includes(regionId)) {
          claimedRegions.push(regionId);
        }
        powerDelta = 10 + Math.floor(Math.random() * 20);
        break;
      }
      case 'Raised an army':
        newMercs.militia = (newMercs.militia || 0) + 5 + Math.floor(Math.random() * 10);
        newMercs.archer = (newMercs.archer || 0) + 2 + Math.floor(Math.random() * 5);
        powerDelta = 5;
        break;
      case 'Built fortifications':
        powerDelta = 15;
        break;
      case 'Lost territory':
        if (claimedRegions.length > 0) claimedRegions.pop();
        powerDelta = -10 - Math.floor(Math.random() * 15);
        break;
      case 'Suffered a plague':
        newMercs.militia = Math.max(0, (newMercs.militia || 0) - 5);
        powerDelta = -20;
        break;
      case 'Trained elite guards':
        newMercs.knight = (newMercs.knight || 0) + 1 + Math.floor(Math.random() * 3);
        powerDelta = 8;
        break;
      case 'Discovered new resources':
        powerDelta = 10;
        // Bonus resource discovery
        regenUpdate.stock_gold = (regenUpdate.stock_gold || 0) + 200;
        regenUpdate.stock_steel = (regenUpdate.stock_steel || 0) + 20;
        break;
      default:
        powerDelta = Math.floor(Math.random() * 10) - 3;
        break;
    }

    await supabase.from("npc_town_state").update({
      current_power: Math.max(10, (state.current_power as number) + powerDelta),
      claimed_regions: claimedRegions,
      available_mercenaries: newMercs,
      last_action: action,
      last_action_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...regenUpdate,
      last_regen_at: new Date().toISOString(),
    }).eq("npc_town_id", state.npc_town_id);
  }

  // Simulate NPC-to-NPC relations (random events between pairs)
  if (states.length >= 2 && Math.random() < 0.25) {
    const idx1 = Math.floor(Math.random() * states.length);
    let idx2 = Math.floor(Math.random() * states.length);
    while (idx2 === idx1) idx2 = Math.floor(Math.random() * states.length);

    const townA = states[idx1].npc_town_id;
    const townB = states[idx2].npc_town_id;
    const [sortedA, sortedB] = townA < townB ? [townA, townB] : [townB, townA];

    const roll = Math.random();
    let relationType: string;
    let event: string;

    if (roll < 0.3) {
      relationType = 'hostile';
      event = NPC_WAR_EVENTS[Math.floor(Math.random() * NPC_WAR_EVENTS.length)];
    } else if (roll < 0.5) {
      relationType = 'war';
      event = NPC_WAR_EVENTS[Math.floor(Math.random() * NPC_WAR_EVENTS.length)];
    } else if (roll < 0.8) {
      relationType = 'allied';
      event = NPC_ALLIANCE_EVENTS[Math.floor(Math.random() * NPC_ALLIANCE_EVENTS.length)];
    } else {
      relationType = 'neutral';
      event = 'tensions eased';
    }

    await supabase.from("npc_town_relations").upsert({
      town_a_id: sortedA,
      town_b_id: sortedB,
      relation_type: relationType,
      strength: 30 + Math.floor(Math.random() * 70),
      last_event: event,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'town_a_id,town_b_id' });
  }

  // Expire old mercenary contracts
  await supabase.from("npc_mercenary_contracts")
    .delete()
    .lt("expires_at", new Date().toISOString());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse optional user_id from request body to scope the tick
    let targetUserId: string | null = null;
    let currentVillageId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id || null;
      currentVillageId = body?.current_village_id || null;
    } catch { /* no body is fine */ }

    // ── NPC Autonomy Simulation — only run if no specific user (i.e. a cron job) ──
    if (!targetUserId) {
      try {
        await simulateNPCAutonomy(supabase);
      } catch (npcErr) {
        console.error("NPC simulation error (non-fatal):", npcErr);
      }
    }

    // Fetch villages — scoped to one user if provided
    let villageQuery = supabase.from("villages").select("*");
    if (targetUserId) {
      villageQuery = villageQuery.eq("user_id", targetUserId);
    }
    const { data: villages, error: vErr } = await villageQuery;
    if (vErr) throw vErr;
    if (!villages || villages.length === 0) {
      return new Response(JSON.stringify({ ticked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch buildings — scoped to relevant villages only
    const villageIds = villages.map((v: any) => v.id);
    const { data: allBuildings, error: bErr } = await supabase
      .from("buildings")
      .select("*")
      .in("village_id", villageIds);
    if (bErr) throw bErr;

    const { data: allBuildQueue, error: bqErr } = await supabase
      .from("build_queue")
      .select("*")
      .in("village_id", villageIds);
    if (bqErr) throw bqErr;

    // Group buildings by village_id
    const buildingsByVillage = new Map<string, BuildingRow[]>();
    for (const b of (allBuildings || [])) {
      const list = buildingsByVillage.get(b.village_id) || [];
      list.push(b as BuildingRow);
      buildingsByVillage.set(b.village_id, list);
    }

    const buildQueueByVillage = new Map<string, BuildQueueRow[]>();
    for (const queueRow of (allBuildQueue || [])) {
      if (!queueRow.village_id) continue;
      const list = buildQueueByVillage.get(queueRow.village_id) || [];
      list.push(queueRow as BuildQueueRow);
      buildQueueByVillage.set(queueRow.village_id, list);
    }

    // Fetch alliance memberships and tax rates in bulk
    const { data: allianceMembers } = await supabase
      .from("alliance_members")
      .select("user_id, alliance_id");
    const { data: alliances } = await supabase
      .from("alliances")
      .select("id, tax_rate, treasury_gold, treasury_wood, treasury_stone, treasury_food");

    const userAlliance = new Map<string, string>();
    for (const m of (allianceMembers || [])) {
      userAlliance.set(m.user_id, m.alliance_id);
    }
    const allianceMap = new Map<string, any>();
    for (const a of (alliances || [])) {
      allianceMap.set(a.id, a);
    }

    // Track treasury additions per alliance
    const treasuryAdds = new Map<string, { gold: number; wood: number; stone: number; food: number }>();

    const now = new Date();

    for (const village of villages as VillageRow[]) {
      const lastTick = new Date(village.last_resource_tick);
      const elapsedMs = now.getTime() - lastTick.getTime();
      // Only tick if at least 30 seconds have passed
      if (elapsedMs < 30000) continue;
      // Calculate how many minutes have elapsed (fractional)
      const elapsedMinutes = elapsedMs / 60000;

      const buildings = buildingsByVillage.get(village.id) || [];
      const activeBuildQueue = await processCompletedBuildQueueForVillage(
        supabase,
        buildings,
        buildQueueByVillage.get(village.id) || [],
        now,
      );
      const currentTownhallLevel = getTownhallLevel(buildings, village.level || 1);

      // Calculate gross production per hour
      let grossGold = 0, grossWood = 0, grossStone = 0, grossFood = 0;
      let grossSteel = 0;
      let housingCap = 10; // base
      let happinessVal = 50;
      let totalWorkers = 0;

      for (const b of buildings) {
        const prod = getProduction(b.type, b.level, b.workers);
        grossGold += prod.gold || 0;
        grossWood += prod.wood || 0;
        grossStone += prod.stone || 0;
        grossFood += prod.food || 0;
        grossSteel += getSteelProduction(b.type, b.level, b.workers);
        totalWorkers += b.workers;

        if (b.type === "house") {
          housingCap += HOUSING_PER_LEVEL * b.level;
        }
        if (b.type === "townhall") {
          housingCap += b.level * 5;
        }
        if (b.type === "temple") {
          happinessVal += b.level * 10 + b.workers * 5;
        }
      }

      // Rations
      const rationsLevel = parseRations(village.rations);
      const rationsMultiplier = getRationsMultiplier(rationsLevel);
      happinessVal += getRationsHappiness(rationsLevel);

      // Army stats
      const armyCounts: Record<string, number> = {
        militia: village.army_militia,
        archer: village.army_archer,
        knight: village.army_knight,
        cavalry: village.army_cavalry,
        siege: village.army_siege,
        scout: village.army_scout,
      };

      let totalSoldiers = 0;
      let armyFoodUpkeep = 0;
      let armyGoldUpkeep = 0;
      for (const [type, count] of Object.entries(armyCounts)) {
        const info = TROOP_UPKEEP[type];
        if (!info) continue;
        totalSoldiers += info.popCost * count;
        armyFoodUpkeep += info.food * count;
        armyGoldUpkeep += info.gold * count;
      }

      // Workers still eat — only soldiers have separate upkeep
      const nonSoldiers = Math.max(0, village.population - totalSoldiers);

      // Pop food cost per hour
      const popFoodCost = Math.floor(nonSoldiers * rationsMultiplier);

      // Tax income per hour
      const popTaxIncome = Math.floor(nonSoldiers * village.pop_tax_rate / 100 * 2);

      // Overcrowding penalty
      if (village.population > housingCap * 0.9) {
        happinessVal -= Math.floor((village.population - housingCap * 0.9) * 2);
      }
      if (village.pop_tax_rate > 10) {
        happinessVal -= (village.pop_tax_rate - 10) * 2;
      }
      happinessVal = Math.max(0, Math.min(100, happinessVal));

      // Alliance tax
      const allianceId = userAlliance.get(village.user_id);
      let taxFraction = 0;
      if (allianceId) {
        const alliance = allianceMap.get(allianceId);
        if (alliance) taxFraction = alliance.tax_rate / 100;
      }

      // Calculate net production for the elapsed period (per minute)
      const netGold = (grossGold * (1 - taxFraction) - armyGoldUpkeep + popTaxIncome) * elapsedMinutes;
      const netWood = (grossWood * (1 - taxFraction)) * elapsedMinutes;
      const netStone = (grossStone * (1 - taxFraction)) * elapsedMinutes;
      const netFood = (grossFood * (1 - taxFraction) - armyFoodUpkeep - popFoodCost) * elapsedMinutes;

      // Treasury contributions
      if (taxFraction > 0 && allianceId) {
        const taxGold = Math.floor(grossGold * taxFraction * elapsedMinutes);
        const taxWood = Math.floor(grossWood * taxFraction * elapsedMinutes);
        const taxStone = Math.floor(grossStone * taxFraction * elapsedMinutes);
        const taxFood = Math.floor(grossFood * taxFraction * elapsedMinutes);
        const prev = treasuryAdds.get(allianceId) || { gold: 0, wood: 0, stone: 0, food: 0 };
        prev.gold += taxGold;
        prev.wood += taxWood;
        prev.stone += taxStone;
        prev.food += taxFood;
        treasuryAdds.set(allianceId, prev);
      }

      let villageResources: ResourceState = {
        gold: Math.max(0, Math.floor(village.gold + netGold)),
        wood: Math.max(0, Math.floor(village.wood + netWood)),
        stone: Math.max(0, Math.floor(village.stone + netStone)),
        food: Math.max(0, Math.floor(village.food + netFood)),
        steel: Math.max(0, Math.floor(village.steel + grossSteel * elapsedMinutes)),
      };

      // Population growth
      let newPop = village.population;
      if (newPop < housingCap && villageResources.food >= 50) {
        const growthChance = happinessVal / 100 * 0.5;
        const growthRolls = Math.floor(elapsedMinutes);
        for (let i = 0; i < Math.min(growthRolls, 60); i++) {
          if (newPop < housingCap && Math.random() < growthChance) {
            newPop++;
          }
        }
      }

      // Starvation: lose at most 1 troop per tick if food is 0
      let updatedArmy = { ...armyCounts };
      if (villageResources.food <= 0) {
        villageResources.food = 0;
        const desertOrder = ["siege", "cavalry", "knight", "archer", "militia", "scout"];
        for (const t of desertOrder) {
          if (updatedArmy[t] > 0) {
            updatedArmy[t]--;
            newPop = Math.max(1, newPop - (TROOP_UPKEEP[t]?.popCost || 1));
            break;
          }
        }
      }

      if (village.id !== currentVillageId) {
        villageResources = await maybeRunAdministratorAutomation({
          supabase,
          village,
          buildings,
          activeQueue: activeBuildQueue,
          resources: villageResources,
          population: newPop,
          housingCapacity: housingCap,
          now,
        });
      }

      // Update village
      await supabase.from("villages").update({
        gold: villageResources.gold,
        wood: villageResources.wood,
        stone: villageResources.stone,
        food: villageResources.food,
        steel: villageResources.steel,
        level: currentTownhallLevel,
        population: newPop,
        max_population: housingCap,
        happiness: happinessVal,
        army_militia: updatedArmy.militia,
        army_archer: updatedArmy.archer,
        army_knight: updatedArmy.knight,
        army_cavalry: updatedArmy.cavalry,
        army_siege: updatedArmy.siege,
        army_scout: updatedArmy.scout,
        last_resource_tick: now.toISOString(),
      }).eq("id", village.id);
    }

    // ── Deliver arrived caravans server-side ──
    const { data: arrivedCaravans } = await supabase
      .from("caravans")
      .select("*")
      .eq("status", "in_transit")
      .lte("arrives_at", now.toISOString());

    if (arrivedCaravans && arrivedCaravans.length > 0) {
      for (const c of arrivedCaravans) {
        await supabase.rpc("deliver_caravan", {
          p_caravan_id: c.id,
          p_user_id: c.user_id,
        });
      }
    }

    // Update alliance treasuries
    for (const [allianceId, adds] of treasuryAdds.entries()) {
      if (adds.gold + adds.wood + adds.stone + adds.food > 0) {
        await supabase.rpc("add_to_alliance_treasury", {
          p_alliance_id: allianceId,
          p_gold: adds.gold,
          p_wood: adds.wood,
          p_stone: adds.stone,
          p_food: adds.food,
        });
      }
    }

    return new Response(JSON.stringify({ ticked: villages.length, time: now.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Resource tick error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
