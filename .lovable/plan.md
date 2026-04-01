
# World Boss Events

## Overview
Add three rare, powerful "world boss" events to the map that persist for one week, have tiered armies, gain resources and troops over time, and attack nearby powerful players daily.

## New Concepts

**World Boss Events** differ from regular events:
- Only ONE exists on the entire map at a time
- Rotates weekly (not every 30 minutes)
- Much higher power level (500-1500+ base)
- Has 3 tiers of custom soldiers with flavor names
- Gains resources and recruits troops over time
- Sends attack marches to nearby powerful players once per day
- Uses a unique `'worldboss'` event type and distinct visual treatment

## The Three Bosses

| Boss | Emoji | Weak | Average | Elite |
|------|-------|------|---------|-------|
| Necromancer's Tower | 🏚️ | Skeletons | Zombies | Death Knights |
| Demonic Portal | 🌀 | Imps | Succubi | Demon Warriors |
| Dreadkeep | 🧛 | Thralls | Blood Knights | Nosferatus |

Each boss has:
- **Base army**: starts with weak troops, recruits more each tick
- **Resource stockpile**: grows over time, awarded on defeat
- **Power scaling**: grows stronger the longer it exists (days alive)

## Implementation Plan

### 1. Add world boss constants and types (WorldMap.tsx)

Add a `WORLD_BOSS_BASES` array with the 3 bosses. Each entry defines:
- name, emoji, description, lore
- troop tiers (weak/average/elite) with names, counts, attack/defense stats
- base power, growth rate, reward multiplier

Add a `ProceduralWorldBoss` interface extending `ProceduralEvent` with extra fields: `bossType`, `troops` (per tier), `daysAlive`, `threatLevel`.

### 2. Deterministic single-boss spawning (WorldMap.tsx)

In the chunk generation or at a higher level, use a **weekly time seed** (`Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7))`) to:
- Pick which boss type spawns (index into the 3 bosses)
- Pick which chunk it spawns in (seeded from weekly seed, within a reasonable range of origin)
- Calculate days alive within the current week for power scaling

This is purely client-side and deterministic — all players see the same boss in the same location.

### 3. Visual rendering on map (WorldMap.tsx)

- Give world bosses a larger icon size (1.5x normal events)
- Add a pulsing red/purple glow effect
- Show troop tier breakdown in the selection tooltip
- Use a distinct sprite or colored border to differentiate from regular events

### 4. Combat interaction (WorldMap.tsx handleInvestigate)

When a player attacks a world boss:
- The boss power scales with days alive: `basePower + daysAlive * growthRate`
- Victory awards scaled resources (much higher than normal events)
- Defeating the boss marks it as claimed (disappears for that player)
- The boss remains for other players until the weekly rotation

### 5. Daily attack marches (new edge function or client-side)

**Client-side approach** (simpler, no new infra):
- When the world boss chunk loads, calculate if a "raid" is due based on the current day
- Use deterministic seeding to pick the target (highest-level village within a radius)
- Create an incoming attack alert (using existing `IncomingAttackAlert` system)
- The raid army scales with the boss's current troop count

This uses the existing `active_marches` table to create NPC attack marches.

### 6. Database changes

**New table: `world_boss_defeats`** — tracks which players have defeated the current week's boss:
- `id`, `user_id`, `boss_week_seed` (integer), `boss_type` (text), `defeated_at` (timestamp)
- RLS: users can insert/select own records

This prevents the same player from farming the boss repeatedly in the same week.

### Files Modified
- `src/components/game/WorldMap.tsx` — boss definitions, spawning logic, rendering, combat handling
- New migration for `world_boss_defeats` table
- Possibly a small edge function or cron job for daily attack marches (can also be client-side)

### Technical Notes
- The weekly seed ensures all clients agree on boss location without server coordination
- Power scaling: `basePower * (1 + 0.15 * daysAlive)` — grows ~15% per day
- Troop recruitment: `baseTroops * (1 + 0.1 * daysAlive)` per tier
- Rewards: 5-10x normal event rewards, plus bonus steel
