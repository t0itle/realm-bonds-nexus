

# Plan: Disband Troops (Demote Soldiers to Civilians)

Add a "Disband" button next to each troop type in the Military Panel, allowing players to convert soldiers back into civilians to reduce food upkeep.

## Changes

### 1. `src/hooks/useGameState.tsx` — Add `disbandTroops` function
- New function: `disbandTroops(type: TroopType, count: number)` that reduces `army[type]` by `count`, persists to DB, and increases civilian population accordingly (by `popCost * count`).
- Export it from the game context interface.

### 2. `src/components/game/MilitaryPanel.tsx` — Add disband UI
- For each troop type row that has `army[type] > 0`, add a "Disband" button with a count input (defaulting to 1).
- Clicking it calls `disbandTroops(type, count)` and shows a toast confirming the dismissal.
- Style it with a destructive/muted variant to differentiate from training.

Two files, straightforward addition. No resources refunded — troops are simply dismissed back to civilian life.

