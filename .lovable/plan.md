

# Global UI Readability Overhaul

## Overview
Increase text sizes, padding, and gaps across all game components to improve mobile readability. This is a bulk find-and-replace operation across ~28 files.

## Changes

### 1. Base font size (`src/index.css`)
Add `font-size: 14px` to the `body` rule.

### 2. Text size replacements (26 game component files + 2 page files)

| Find | Replace | Effective size |
|------|---------|---------------|
| `text-[7px]` | `text-[11px]` | 11px |
| `text-[8px]` | `text-xs` | 12px |
| `text-[9px]` | `text-xs` | 12px |
| `text-[10px]` | `text-sm` | 14px |
| `text-xs` (primary content) | `text-sm` | 14px |

The `text-xs` → `text-sm` replacement needs care: only apply where `text-xs` is used for readable content (labels, values, descriptions), NOT for badge indicators or icon sizing contexts. Will review each file individually.

### 3. Padding increases (all game components)

| Find | Replace |
|------|---------|
| `px-2 ` | `px-3 ` |
| `px-3 ` | `px-4 ` |
| `py-1 ` | `py-2 ` |
| `py-1.5` | `py-2.5` |
| `py-2 ` | `py-3 ` |

### 4. Gap increases (all game components)

| Find | Replace |
|------|---------|
| `gap-1 ` | `gap-2 ` |
| `gap-1.5` | `gap-2.5` |
| `gap-2 ` | `gap-3 ` |

### Files affected
All files in `src/components/game/`: ResourceBar, VillageGrid, MilitaryPanel, StatSheet, BuildModal, AttackConfigPanel, NotificationsPanel, AlliancePanel, SocialPanel, ProfilePanel, WorldMap, GuildChat, GuildContracts, GuildTaxPanel, GuildVoting, CaravanPanel, MessagesPanel, IncomingAttackAlert, NPCInteractionPanel, NPCDiplomacyInfo, NPCMercenaryPanel, DungeonMasterPanel, AllianceResourceSharing, AllyDefenseModal, GratitudeModal, TroopTransferPanel, VassalPanel, PatchNotesModal

Plus: `src/index.css`, `src/pages/AuthPage.tsx`, `src/pages/LandingPage.tsx`

### What stays unchanged
- `font-display` (Cinzel) heading sizes
- `text-lg`, `text-xl`, `text-2xl` etc.
- Layout structure and logic
- Colors and animations

### Risk
Padding/gap increases compound — some panels may overflow on small screens. The text-xs → text-sm promotion is the riskiest since text-xs appears in many contexts. Will be selective and skip badge counters, tooltip micro-text, and decorative labels.

