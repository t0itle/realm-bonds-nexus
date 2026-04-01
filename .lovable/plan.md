
# Plan: Block River Crossing Without Bridges

## Problem
`findPath()` falls back to a straight line (line 190) when A* can't find a route, allowing armies to cross rivers without bridges.

## Fix (2 changes in WorldMap.tsx)

### 1. `findPath` returns empty array on failure instead of straight line
Change line 190 from returning `[start, end]` to returning `[]` when no path is found.

### 2. `createMarch` checks for empty path and blocks the march
After calling `findPath`, if the result is empty (or only has start/end with a river between), show an error toast: "🌊 Path blocked by a river! Build a bridge outpost to cross." and abort the march.

### 3. Add a helper to check if straight line crosses a river
For cases where pathfinding succeeds with straight line (start==end grid cell), also verify the direct path doesn't cross a river without a bridge.

This ensures rivers are truly impassable without bridge outposts.
