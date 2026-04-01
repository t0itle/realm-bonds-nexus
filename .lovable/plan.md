

# Plan: Nerf All Resource Production by 10%

Production uses a `0.8` multiplier in two places. Apply an additional 10% reduction: `0.8 × 0.9 = 0.72`.

## Changes

### 1. Client-side: `src/hooks/useGameState.tsx`
Change the production multiplier from `0.8` to `0.72` in the `getProduction` helper.

### 2. Server-side: `supabase/functions/resource-tick/index.ts`
Same change — `0.8` → `0.72` in the `getProduction` function to keep client and server in sync.

