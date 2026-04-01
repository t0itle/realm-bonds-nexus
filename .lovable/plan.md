

# Plan: Fix Battle Calculation Bugs

## Problems Found

There are **three bugs** in `resolveCombat()` (line 231, `src/hooks/useGameState.tsx`):

### Bug 1: Attacker score uses only attack; defender score uses attack + 50% defense (asymmetric formula)
**Line 276-277:**
```
attackerScore = atkPower.attack * (0.85 + Math.random() * 0.3)
defenderScore = defPower.attack + defPower.defense * 0.5
```
The attacker's defense stat is completely ignored, while the defender gets both attack AND defense contributing to their score. This means a massive army's defensive strength counts for nothing offensively. An army of 100 knights (high defense) attacking 10 militia could lose because the attacker's defense is thrown away.

### Bug 2: Counter bonus stacks incorrectly — multiplied per enemy TYPE presence, not per unit
**Lines 254-261:** The counter bonus adds `info.attack * count * 0.3` for each enemy type that exists, regardless of how many enemy units there are. If the enemy has even 1 archer and 1 militia, and your troop counters both, you get the full bonus twice. But more importantly, the bonus doesn't scale with enemy composition — it's all-or-nothing per type.

### Bug 3: PvP passes attacker's wall level as the attacker wall bonus
**Line 1623:** `resolveCombat(attackingArmy, defArmy, getWallLevel(), defWallLevel)` — the attacker's wall level is passed as the 3rd argument, but walls should only benefit defenders. The function itself ignores the attacker wall param (only applies wall bonus to `isDefender`), so this is cosmetic but confusing.

## Fix

### Rewrite `resolveCombat` with a balanced formula:

1. **Both sides use attack + defense** — Attacker total = `attack * 1.0 + defense * 0.3`, Defender total = `attack * 0.7 + defense * 1.0 + wallBonus`. This gives attackers an offensive edge while defenders benefit more from defense stats and walls.

2. **Fix counter scaling** — Counter bonuses should scale based on the proportion of countered units in the enemy army, not just their presence.

3. **Remove attacker wall param** — Pass `0` for attacker wall in all calls since walls only help defenders.

4. **Reduce randomness** — Change from ±15% to ±10% to prevent upsets when power difference is large.

## Technical Details

### File: `src/hooks/useGameState.tsx`

**`resolveCombat` function (lines 231-304):** Rewrite the scoring formula:
```
// Both sides get a combined score
attackerTotal = atkPower.attack + atkPower.defense * 0.3
defenderTotal = defPower.attack * 0.7 + defPower.defense + wallBonus

// Smaller randomness window
attackerScore = attackerTotal * (0.9 + Math.random() * 0.2)
defenderScore = defenderTotal * (0.9 + Math.random() * 0.2)
```

**Counter bonus fix (lines 254-261):** Scale by proportion of countered units:
```
// Calculate enemy army total count once
// Bonus = 0.3 * (enemyCounteredUnits / totalEnemyUnits)
```

**Line 1623:** Change `getWallLevel()` to `0` for the attacker wall parameter.

