

# Resource Budget Tooltips (EU4-style breakdown)

## What we're building
Each resource in the ResourceBar gets a tooltip showing a line-by-line breakdown of income sources and costs, so the player knows exactly why they're losing 12 food/min.

Example tooltip for Food:
```text
Food Budget
──────────────
🌾 Farms:        +14/min
🏛️ Alliance Tax: -1/min
⚔️ Army Upkeep:  -8/min
🍞 Pop Rations:  -17/min
──────────────
Net:             -12/min
```

## Data needed
The breakdown components already exist in `useProduction` but aren't exposed individually. We need:
- **Building production** per resource type (from `grossProduction`)
- **Alliance tax** deduction (fraction of gross)
- **Army food/gold upkeep** (from `armyUpkeep()`)
- **Population food cost** (`popFoodCost`) — already exposed
- **Population tax income** (`popTaxIncome`) — already exposed

## Implementation

### 1. Expose `grossProduction` from game context
- **`src/hooks/useGameState.tsx`**: Add `grossProduction: Resources` to `GameContextType` interface and include it in the Provider value (it's already computed, just not passed through)

### 2. Compute per-resource breakdown in ResourceBar
- **`src/components/game/ResourceBar.tsx`**: Pull `grossProduction`, `armyUpkeep`, `popFoodCost`, `popTaxIncome`, `rations`, `army` from `useGame()`
- Import `RATIONS_INFO` and `TROOP_INFO` from gameConstants
- For each resource, build a breakdown array of `{ label, icon, value }` entries:
  - **Gold**: Building production, alliance tax, army gold upkeep, pop tax income
  - **Wood**: Building production, alliance tax
  - **Stone**: Building production, alliance tax
  - **Food**: Building production, alliance tax, army food upkeep, population rations cost
- Only show non-zero line items

### 3. Wrap each resource item in a Tooltip
- **`src/components/game/ResourceBar.tsx`**: Wrap each resource's `motion.div` in a `Tooltip` component
- Tooltip content renders the breakdown as a compact table with:
  - Resource name as header
  - Each source/drain on its own line: icon + label + signed value
  - Green for positive, red for negative values
  - Separator line, then bold **Net** total
- Use `text-[10px]` for compact display, `tabular-nums` for alignment

### 4. Also enhance Steel tooltip
- Show building steel production + mine steel production as separate lines

## Technical details
- `TooltipProvider` with `delayDuration={200}` already wraps the happiness indicator; we'll wrap the entire resource row in one `TooltipProvider`
- Each tooltip uses `side="bottom"` to avoid clipping at the top of the screen
- No new hooks or state — all data is already computed, just needs plumbing

## Files changed
1. `src/hooks/useGameState.tsx` — expose `grossProduction` in context type + provider value
2. `src/components/game/ResourceBar.tsx` — add tooltip with breakdown for each resource + steel

