
# World Boss Events

## Overview
Add three rare, powerful "world boss" events to the map that persist for one week, have tiered armies, gain resources and troops over time, and attack nearby powerful players daily.

## The Three Bosses

| Boss | Emoji | Weak | Average | Elite |
|------|-------|------|---------|-------|
| Necromancer's Tower | 🏚️ | Skeletons | Zombies | Death Knights |
| Demonic Portal | 🌀 | Imps | Succubi | Demon Warriors |
| Dreadkeep | 🧛 | Thralls | Blood Knights | Nosferatus |

Each boss starts with a base army and resource stockpile that **grow each day** the boss is alive. Power scales ~15% per day. Only ONE boss exists on the entire map at a time, rotating weekly.

## Implementation

### 1. Database: `world_boss_defeats` table
Tracks which players beat the current week's boss (prevents repeat farming):
- `id`, `user_id`, `boss_week_seed`, `boss_type`, `defeated_at`
- RLS: users can insert/select own records

### 2. World boss definitions and spawning (WorldMap.tsx)
- Add `WORLD_BOSS_BASES` array with 3 bosses, each defining troop tiers (name, attack, defense, count), base power, growth rate, and reward multiplier
- Use a **weekly time seed** to deterministically pick which boss spawns and where (all players see the same thing)
- Calculate `daysAlive` within the week for power/troop scaling
- Add `ProceduralWorldBoss` interface with extra fields: `bossType`, `troops`, `daysAlive`

### 3. Map rendering
- World bosses render at 1.5x normal event size with a pulsing red/purple glow
- Selection tooltip shows troop tier breakdown and scaled power
- Uses existing event sprite system with `danger` type styling

### 4. Combat interaction
- Attacking uses existing `handleInvestigate` flow with higher power
- Victory awards 5-10x normal event rewards plus bonus steel
- Defeating marks it as claimed via `world_boss_defeats` table
- Boss remains for other players until weekly rotation

### 5. Daily attack raids (client-side)
- When the world boss chunk loads, deterministic seeding checks if a raid is due today
- Creates incoming attack march (via `active_marches` table) targeting the highest-power village within range
- Raid army scales with boss's current troop count
- Uses existing `IncomingAttackAlert` system for player notification

### Files
- **New migration**: `world_boss_defeats` table
- **Modified**: `src/components/game/WorldMap.tsx` — boss definitions, spawning, rendering, combat, raid logic

### Technical Details
- Weekly seed: `Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7))`
- Power: `basePower * (1 + 0.15 * daysAlive)`
- Troops per tier: `baseCount * (1 + 0.1 * daysAlive)`
- Rewards: gold 2000-5000, wood/stone/food 1000-3000, steel 50-150 (all scaled by difficulty multiplier)
- Boss spawns within chunks 2-8 from origin (near player activity)
