
# Game Rework Plan

## Phase 1: Parse & Store Azgaar Map Data
- Parse the uploaded Azgaar JSON to extract: biomes, rivers, states/cultures, burgs (towns/cities), terrain heightmap
- Create a `world_map_data` table to store parsed map features (NPC towns, biomes, regions)
- Store map metadata (dimensions, coordinate system) for rendering

## Phase 2: Data Wipe Migration
- Delete all rows from: villages, buildings, build_queue, training_queue, armies, battle_reports, vassalages, outposts, caravans, trade_routes, roads, research_progress, active_marches, active_spy_missions, intel_reports, spy_training_queue, etc.
- Keep: profiles, alliances (optional), auth users
- Reset all player data to zero

## Phase 3: Redesign Progression System (3-4 Tiers, Deep Sub-Levels)
**Tier 1: Camp** (Sub-levels 1-20)
- Start with a campfire and a tent. Each sub-level adds tiny improvements.
- Sub-levels unlock: basic gathering → lean-to → firepit → storage cache → palisade stakes → scout post → herb garden → etc.
- Very small resource gains per level (+2-5% per sub-level)

**Tier 2: Village** (Sub-levels 1-20)  
- Transition from camp to permanent structures
- Sub-levels unlock: wooden buildings, farming, basic military, simple walls
- Moderate resource gains (+3-7% per sub-level)

**Tier 3: Town** (Sub-levels 1-20)
- Stone construction, advanced military, trade, diplomacy
- Sub-levels unlock: stone walls, barracks upgrades, market, temple
- Larger gains (+5-10% per sub-level)

**Tier 4: City** (Sub-levels 1-15)
- Endgame: fortifications, siege, research, alliances at scale
- Sub-levels: castle, university, grand temple, etc.

### Key Changes:
- Replace `settlement_type` enum with tier + sub_level system
- Each building has MORE levels (up to 20-30) with SMALLER incremental bonuses
- Building costs scale gradually, not exponentially
- New building types for early game: tent, campfire, lean-to, cache, etc.

## Phase 4: World Map Rework
- Render the Azgaar map as the game world (use extracted polygon/cell data)
- Place NPC towns from the map's burgs data
- Players spawn on the map at valid locations
- Replace procedural world gen with fixed map geography

## Phase 5: Update Game Constants & Types
- New BuildingType additions for camp-tier buildings
- Rebalance all costs, production rates, and progression curves
- Update BUILDING_INFO with 20-30 level buildings
- New sprites for camp-tier buildings

## Phase 6: Update UI Components
- Update CityView/VillageGrid for camp-tier visuals
- Update settlement upgrade UI for sub-level system
- Update world map rendering
- Ensure mobile-first layout

## Execution Order:
1. Migration: wipe data + add new columns (tier, sub_level)
2. Parse Azgaar map → store key data
3. Update gameTypes.ts and gameConstants.ts
4. Update hooks (useSettlementUpgrade, useProduction, etc.)
5. Update UI components
6. Generate camp-tier sprites
