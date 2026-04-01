

# Plan: Nerf All Resource Production by 15%

Production is calculated in two places with the same formula. Both need the multiplier reduced.

## Changes

### 1. Client-side: `src/hooks/useGameState.tsx` (line 75)

Current multiplier chain: `val * level * 1.2 * workerBonus * 0.8` (the `0.8` is a previous 20% nerf).

Change `0.8` → `0.68` (0.8 × 0.85 = 0.68), applying an additional 15% reduction on top of the existing nerf.

### 2. Server-side: `supabase/functions/resource-tick/index.ts` (line 76)

Same formula with `0.8` multiplier — change to `0.68` to match.

Both files stay in sync so the UI preview and the actual tick produce consistent numbers.

