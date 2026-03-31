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

const BASE_PRODUCTION: Record<string, Partial<Record<string, number>>> = {
  farm: { food: 2 },
  lumbermill: { wood: 2 },
  quarry: { stone: 1 },
  goldmine: { gold: 1 },
};

const HOUSING_PER_LEVEL = 8;

const TROOP_UPKEEP: Record<string, { food: number; gold: number; popCost: number }> = {
  militia:  { food: 0.5, gold: 0, popCost: 1 },
  archer:   { food: 0.5, gold: 0.5, popCost: 1 },
  knight:   { food: 1, gold: 1, popCost: 2 },
  cavalry:  { food: 1.5, gold: 1, popCost: 2 },
  siege:    { food: 1, gold: 1.5, popCost: 3 },
  scout:    { food: 0.5, gold: 0.5, popCost: 1 },
};

const RATIONS_MULTIPLIER: Record<string, number> = {
  scarce: 0.5,
  normal: 1.0,
  generous: 2.0,
};

const RATIONS_HAPPINESS: Record<string, number> = {
  scarce: -15,
  normal: 0,
  generous: 15,
};

function getProduction(type: string, level: number, workers: number): Record<string, number> {
  const base = BASE_PRODUCTION[type];
  if (!base) return {};
  const result: Record<string, number> = {};
  const workerBonus = 1 + workers * 0.35;
  for (const [key, val] of Object.entries(base)) {
    result[key] = Math.floor(val! * level * 1.2 * workerBonus);
  }
  return result;
}

function getSteelProduction(type: string, level: number, workers: number): number {
  if (type !== 'quarry' || level < 3) return 0;
  const workerBonus = 1 + workers * 0.35;
  return Math.floor((level - 2) * 1 * workerBonus);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all villages
    const { data: villages, error: vErr } = await supabase
      .from("villages")
      .select("*");
    if (vErr) throw vErr;
    if (!villages || villages.length === 0) {
      return new Response(JSON.stringify({ ticked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all buildings
    const { data: allBuildings, error: bErr } = await supabase
      .from("buildings")
      .select("*");
    if (bErr) throw bErr;

    // Group buildings by village_id
    const buildingsByVillage = new Map<string, BuildingRow[]>();
    for (const b of (allBuildings || [])) {
      const list = buildingsByVillage.get(b.village_id) || [];
      list.push(b as BuildingRow);
      buildingsByVillage.set(b.village_id, list);
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
      const rationsMultiplier = RATIONS_MULTIPLIER[village.rations] ?? 1.0;
      happinessVal += RATIONS_HAPPINESS[village.rations] ?? 0;

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

      const civilians = Math.max(0, village.population - totalWorkers - totalSoldiers);

      // Pop food cost per hour
      const popFoodCost = Math.floor(civilians * rationsMultiplier);

      // Tax income per hour
      const popTaxIncome = Math.floor(civilians * village.pop_tax_rate / 100 * 2);

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

      const newGold = Math.max(0, Math.floor(village.gold + netGold));
      const newWood = Math.max(0, Math.floor(village.wood + netWood));
      const newStone = Math.max(0, Math.floor(village.stone + netStone));
      let newFood = Math.max(0, Math.floor(village.food + netFood));
      const newSteel = Math.max(0, Math.floor(village.steel + grossSteel * elapsedMinutes));

      // Population growth
      let newPop = village.population;
      if (newPop < housingCap && newFood >= 50) {
        const growthChance = happinessVal / 100 * 0.5;
        // For server tick, scale by elapsed hours
        const growthRolls = Math.floor(elapsedMinutes); // ~1 roll per minute
        for (let i = 0; i < Math.min(growthRolls, 60); i++) {
          if (newPop < housingCap && Math.random() < growthChance) {
            newPop++;
          }
        }
      }

      // Starvation: lose at most 1 troop per tick if food is 0
      let updatedArmy = { ...armyCounts };
      if (newFood <= 0) {
        newFood = 0; // floor at 0
        const desertOrder = ["siege", "cavalry", "knight", "archer", "militia", "scout"];
        for (const t of desertOrder) {
          if (updatedArmy[t] > 0) {
            updatedArmy[t]--;
            newPop = Math.max(1, newPop - (TROOP_UPKEEP[t]?.popCost || 1));
            break; // only 1 troop lost per tick
          }
        }
      }

      // Update village
      await supabase.from("villages").update({
        gold: newGold,
        wood: newWood,
        stone: newStone,
        food: newFood,
        steel: newSteel,
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
