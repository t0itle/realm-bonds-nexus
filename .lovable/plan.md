

# World Map Redesign: Continental Map System

## Overview
Replace the current infinite procedural chunk system with a fixed, bounded world containing 5 named continents separated by ocean, with islands scattered between them. Rivers become major strategic barriers requiring bridges, and mountains form large impassable ranges.

## World Layout

```text
┌─────────────────────────────────────────────────────┐
│              OCEAN                                   │
│    ┌──────┐          ┌─────────┐                    │
│    │NORTH │   🏝️    │ DESERT  │     ┌──────┐       │
│    │LANDS │         │CONTINENT│     │EASTERN│       │
│    └──────┘          └─────────┘     │ REALM │       │
│         🏝️     🏝️                  └──────┘       │
│              ┌──────────┐       🏝️                  │
│              │ CENTRAL  │                            │
│    🏝️       │CONTINENT │         🏝️                │
│              └──────────┘                            │
│                    🏝️        ┌─────────┐            │
│                              │SOUTHERN │            │
│         🏝️                  │ WILDS   │            │
│                              └─────────┘            │
│              OCEAN                                   │
└─────────────────────────────────────────────────────┘
```

## Key Changes

### 1. Fixed World with Continent Definitions
- Replace `generateChunk` with a **continent-aware** chunk generator
- Define 5 continents as large polygonal regions in world space (~300k–500k units each)
- One continent is flagged as desert biome (always generates desert terrain)
- Chunks that fall in ocean render as water with occasional islands
- World bounded to roughly 1,000,000 × 1,000,000 units total (camera clamped)

### 2. Ocean & Islands
- Chunks outside continent polygons render as deep ocean (blue fill, wave texture)
- Ocean is impassable without future naval mechanics (troops cannot march across)
- 30-50 procedural islands scattered in ocean zones, varying sizes
- Islands can host events, mines, or be settleable

### 3. Massive Rivers with Bridges
- Rivers span entire continents (multi-chunk), width increased 3-5× (from ~1500 to ~5000-8000 units)
- Each continent gets 1-3 major rivers defined at the continent level, not per-chunk
- Bridges are rare (1-2 per river) — players can also build bridges at outpost locations near rivers
- Bridges are destructible strategic points (tied to existing wall/siege mechanics)
- `isCellBlocked` already handles river blocking + bridge exceptions — just needs wider rivers

### 4. Expansive Mountain Ranges
- Mountains become ranges (chains of connected ellipses) rather than isolated peaks
- Each continent gets 1-2 mountain ranges spanning 100k-200k units
- Ranges are impassable — troops must path around them (A* already handles this)
- Players can build outposts in mountain passes for defensive advantage
- Mountain-adjacent outposts get a defense bonus

### 5. Desert Continent
- One continent always uses Desert biome for all its chunks
- Minimal trees, lots of rocks, sand-colored terrain
- Unique events and harsher resource penalties
- Special oasis terrain features (small lakes with bonus food)

## Technical Approach

### Files to Modify

1. **`src/components/game/WorldMap.tsx`** — Major changes:
   - Add continent definitions (center, radius/polygon, biome, name, rivers, mountain ranges)
   - New `getChunkBiome(cx, cy)` that checks which continent a chunk belongs to (or ocean)
   - Modify `generateChunk` to use continent biome instead of random biome; ocean chunks get water fill + possible islands
   - Define continent-level rivers and mountain ranges that persist across chunks
   - Render ocean as blue background for non-continent chunks
   - Clamp camera to world bounds
   - Render continent labels at zoomed-out views
   - Increase river width from `800 + rng() * 1500` to `4000 + rng() * 4000`
   - Generate mountain ranges as chains of overlapping ellipses along a spine

2. **`src/components/game/WorldMap.tsx`** (rendering section):
   - Add ocean tile rendering (blue gradient with subtle wave pattern)
   - Continent coastline rendering (beach/shore gradient at land-ocean boundary)
   - Mountain range rendering as connected ridgelines instead of isolated peaks
   - Bridge interaction UI — click bridge to see health, option to destroy with siege

### New Data Structures

```typescript
interface Continent {
  name: string;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  biome: string; // forced biome for all chunks
  rivers: ContinentRiver[];
  mountainRanges: MountainRange[];
}

interface ContinentRiver {
  name: string;
  points: { x: number; y: number }[];
  width: number; // 4000-8000
  bridges: { x: number; y: number; health: number; maxHealth: number }[];
}

interface MountainRange {
  name: string;
  spine: { x: number; y: number }[]; // center line
  width: number; // how wide the range is
}
```

### Continent Placement (approximate world coordinates)
- **Nordheim** (North): center (200k, 150k), forest/tundra
- **Ashara** (Desert): center (550k, 180k), desert — always desert biome
- **Heartlands** (Central): center (400k, 450k), plains/forest — largest continent
- **Jade Reaches** (East): center (750k, 300k), jungle/coast
- **Grimwild** (South): center (500k, 750k), marsh/badlands

### How Chunks Map to Continents
Each chunk checks if its center falls within any continent's ellipse. If yes, it uses that continent's forced biome. If no, it's ocean. This replaces the random `regionBiome` selection.

### Bridge Mechanics
- Bridges on continent rivers are defined at world generation (static positions)
- Player-built bridges require an outpost adjacent to a river + resources + build time
- Bridges have HP and can be destroyed by siege weapons or sabotage
- Destroyed bridges block crossing until rebuilt

### Performance
- Same chunk caching system — just the generation logic changes
- Continent membership check is a simple ellipse test (fast)
- Mountain ranges reuse existing ellipse-based blocking
- No new database tables needed for the map itself (bridges could use `wall_segments` table pattern if persisted)

