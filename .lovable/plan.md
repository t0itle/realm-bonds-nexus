

# Plan: Scouts Speed Up Marches

Scouts (speed 25, fastest unit) should reduce march time by a percentage per scout included in the army.

## Current Behavior
- `calcMarchTime` uses the **slowest** troop's speed to calculate travel time
- Scouts don't contribute to speed at all — they can only slow things down if they happen to be slowest (they won't, at speed 25)

## Proposed Change

Add a scout speed bonus: each scout in the army reduces march time by **3%**, capped at **30%** (10 scouts). This is applied after the base travel time calculation.

### Files to Change

**1. `src/hooks/useGameState.tsx`** — Update `calcMarchTime` to accept the army and apply scout discount:
```typescript
export function calcMarchTime(distance: number, army: Army): number {
  const speed = getSlowestTroopSpeed(army);
  const base = Math.floor(distance / (speed * 200));
  const scoutCount = army.scout || 0;
  const scoutBonus = Math.min(0.30, scoutCount * 0.03); // 3% per scout, max 30%
  return Math.max(5, Math.floor(base * (1 - scoutBonus)));
}
```

**2. `src/components/game/WorldMap.tsx`** (line ~1440) — Apply the same scout bonus to the inline march time calculation in `createMarch`:
```typescript
const scoutBonus = Math.min(0.30, (army.scout || 0) * 0.03);
const actualTravelSec = Math.max(5, Math.floor(pathDist / (getSlowestTroopSpeed(army) * 200) * (1 - scoutBonus)));
```

Two files, minimal changes. The travel time preview in `calcTravelTime` will automatically reflect the bonus since it already calls `calcMarchTime`.

