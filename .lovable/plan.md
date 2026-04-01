

# Polish: Replace Troop Emojis with Pixel Art Sprites

The uploaded sprites (Wooden Armor, Leather set, Iron set, Wizard Hat) map naturally to existing troop tiers as visual upgrades — no new mechanics, just replacing emojis with pixel art icons.

## Sprite-to-Troop Mapping

```text
Militia    → Wooden_Armor.png   (basic gear)
Archer     → Leather_Armor.png  (light armor)
Scout      → Leather_Boot.png   (speed-focused)
Knight     → Iron_Armor.png     (heavy armor)
Cavalry    → Iron_Helmet.png    (mounted warrior)
Siege      → Iron_Boot.png      (heavy unit)
Special    → Wizard_Hat.png     (spies / spy guild icon)
```

## Changes

**1. Add sprites to project**
- Copy all 8 PNGs into `src/assets/sprites/troops/`

**2. Create troop sprite map** (`src/components/game/troopSprites.ts`)
- Import all 8 sprites, export a `TROOP_SPRITES: Record<TroopType, string>` lookup

**3. Create `TroopIcon` component** (`src/components/game/TroopIcon.tsx`)
- Similar to existing `ResourceIcon` — takes a `TroopType`, renders the sprite at a given size
- Falls back to emoji if sprite missing

**4. Update `useTroopSkins.tsx`**
- Add a `sprite` field alongside existing `emoji` in `getTroopDisplay()` return
- Faction skins keep their own emoji fallbacks; default faction uses the new sprites

**5. Replace emoji usage in existing panels**
- `MilitaryPanel.tsx` — troop list, army overview, training UI
- `VillageGrid.tsx` — army section troop counts
- `StatSheet.tsx` — upkeep display
- `AttackConfigPanel.tsx` — troop selection
- `AllyDefenseModal.tsx` — troop commitment
- `IncomingAttackAlert.tsx` — threat display
- Use `Wizard_Hat.png` for the spy guild building icon and spy-related UI in `MilitaryPanel`

**6. Use `Leather_Helmet.png` as worker badge icon**
- Replace the `👷` emoji in the worker count badge on `VillageGrid.tsx` tiles

### Files Changed
| File | Action |
|------|--------|
| `src/assets/sprites/troops/*.png` | Add 8 sprites |
| `src/components/game/troopSprites.ts` | New — sprite map |
| `src/components/game/TroopIcon.tsx` | New — reusable icon component |
| `src/hooks/useTroopSkins.tsx` | Edit — add sprite path to display |
| `src/components/game/MilitaryPanel.tsx` | Edit — use TroopIcon |
| `src/components/game/VillageGrid.tsx` | Edit — use TroopIcon + worker badge |
| `src/components/game/StatSheet.tsx` | Edit — use TroopIcon |
| `src/components/game/AttackConfigPanel.tsx` | Edit — use TroopIcon |
| `src/components/game/AllyDefenseModal.tsx` | Edit — use TroopIcon |

