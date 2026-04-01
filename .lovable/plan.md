

# Plan: Fix Worker Production Bug + Map System Overhaul

## Bug Fix: Workers Only Increase Food

**Root cause**: When a worker is assigned to ANY building, it reduces the `civilians` count, which reduces `popFoodCost` (civilian food consumption). This food savings (~1 food/min per worker reassigned) is much more visible than the small 15% production bonus per worker on the building's actual resource. The production logic itself is correct — the issue is that the food savings side-effect dominates.

**Fix**: Increase the worker production bonus from 15% to 30-40% per worker so the target resource boost is more noticeable than the food savings. Also display per-building production rates in the worker assignment UI so players can see the actual impact.

---

## Map System Overhaul

### 1. Visible Army Movement on Map
Currently marches are just timers with toast notifications. We'll render animated troop sprites moving across the map grid in real-time.

- Add a `March` interface with `startPos`, `endPos`, `startTime`, `arrivalTime`, `troopComposition`, `purpose` (attack/scout/collect/settle)
- Render an animated sprite on the map that interpolates position between start and end based on elapsed time
- Use the existing `mapPlayer` sprite for army movement, show troop count badge
- Draw a dotted line from origin to destination showing the march path

### 2. Scouts Must Physically Travel to Locations
Currently events can be claimed instantly if in range. Change so that:
- Scouts must physically march to locations (already partially implemented via `marches` state)
- Scouting reveals fog-of-war — areas near your village and where scouts have traveled are visible, rest is dimmed
- Scout speed determines travel time (already in TROOP_INFO: speed 25)

### 3. Settlement Expansion System
Allow players to found new settlements when Town Hall reaches certain levels.

- **Database**: Add `settlement_type` column to `villages` table (`village` | `town` | `castle` | `outpost`)
- **Founding outposts**: Town Hall Lv.5+ can send settlers (costs resources + population) to a map location to establish an outpost
- Outposts have a limited building grid (6 slots) and serve as forward bases
- Player can switch between settlements in the UI

### 4. Town Hall → Castle Upgrade
When Town Hall reaches level 7+, it visually becomes a Castle.

- Add a `castle` sprite (or reuse existing castle sprites)
- Change the building name display from "Town Hall" to "Castle" at Lv.7+
- Update the player's map sprite to reflect: village (Lv.1-4), town (Lv.5-6), castle (Lv.7+)
- The `settlement_type` in the DB tracks this progression

### 5. Dynamic Player Map Sprite
Currently all players use `mapVillage` sprite. Change to use different sprites based on Town Hall level:

- Lv.1-4: Small village sprite (current `mapVillage`)
- Lv.5-6: Larger town sprite (use `mapCastleNeutral` or new asset)
- Lv.7+: Castle sprite (use `mapCastleFriendly` or new asset)
- Player's own settlement gets the golden glow treatment (already exists)

---

## Technical Details

### Files to modify:
1. **`src/hooks/useGameState.tsx`** — Increase worker bonus from 0.15 to 0.35; add settlement type tracking; add `foundOutpost` action
2. **`supabase/functions/resource-tick/index.ts`** — Mirror the worker bonus increase server-side
3. **`src/components/game/WorldMap.tsx`** — Render animated march sprites on map; change player sprite based on TH level; add settlement founding UI; add fog-of-war overlay
4. **`src/components/game/VillageGrid.tsx`** — Show "Castle" name when TH ≥ 7
5. **`src/components/game/StatSheet.tsx`** — Show per-building production with worker impact
6. **Database migration** — Add `settlement_type` column to `villages` table

### March rendering approach:
```text
Player Village ----→ [🗡️ 15 troops] ----→ Target
  (startPos)      (interpolated pos)     (endPos)
                  dotted line path
```

The march sprite position is calculated each frame as:
`pos = lerp(startPos, endPos, (now - startTime) / (arrivalTime - startTime))`

### Settlement founding flow:
1. Player opens map, clicks empty area
2. "Found Outpost" button appears (requires TH Lv.5+, 500g/300w/200s/100f + 5 population)
3. Settlers march to location (visible on map)
4. On arrival, new village row created in DB at that position
5. Player can switch between settlements via a dropdown

