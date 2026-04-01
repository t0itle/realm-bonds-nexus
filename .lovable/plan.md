

# Incoming Attack Warnings, Allied Defense, and Gratitude System

## Overview
Three interconnected features: (1) notify defenders when an attack march begins targeting them, (2) notify alliance members and let them send reinforcements, (3) post-battle gratitude resource sharing.

---

## Feature 1: Incoming Attack Notification

**Problem**: When a player launches a PvP attack, the march is saved to `active_marches` but the defender has no idea until troops arrive.

**Approach**:
- Add `target_user_id` column to `active_marches` so we know who's being attacked
- Subscribe defenders to realtime changes on `active_marches` where they are the target
- Show a toast + persistent alert in `NotificationsPanel` with attacker name, ETA, and troop count estimate
- In `GameLayout.tsx`, listen for incoming attacks and display an urgent banner/toast

**Database change**:
- Migration: `ALTER TABLE active_marches ADD COLUMN target_user_id uuid;`
- Add `sent_army jsonb DEFAULT '{}'` to `active_marches` so defenders (and allies) can see approximate threat level
- Update the PvP march insert in `WorldMap.tsx` to include `target_user_id` and `sent_army`

**UI**: A red pulsing toast: "⚠️ {attacker} is marching on your village! ETA: {time}" with option to switch to map tab.

---

## Feature 2: Alliance Defense Coordination

**Approach**:
- When an incoming attack targets an alliance member, all online alliance members get notified via the same realtime subscription on `active_marches`
- In `GameLayout.tsx` or a new `IncomingAttackAlert` component, check if the target is an alliance mate
- Show a dialog: "Your ally {name} is under attack! ETA: {time}. Send reinforcements?" with the existing `AttackConfigPanel` troop selector
- Calculate if the player's troops can reach the ally's village before the attacker arrives — display feasibility
- If troops are sent, create a new march of type `reinforce` targeting the ally's village
- Add `reinforcements` column (jsonb) to `villages` or track in a new lightweight approach: when reinforcement march arrives, temporarily add those troops to the defender's army counts for the duration of the battle

**Database change**:
- Add march_type `'reinforce'` support (already a text column, no schema change needed)
- New table `active_reinforcements` to track allied troops stationed at another player's village:
  ```sql
  CREATE TABLE active_reinforcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    host_village_id uuid NOT NULL,
    troops jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz -- auto-recall after X hours
  );
  ```
- RLS: owner and host can view; owner can insert/delete; host can view

**Battle resolution change**: When a player is attacked, also fetch `active_reinforcements` for their village and add those troops to their defense power. After battle, subtract losses from reinforcements first.

---

## Feature 3: Post-Battle Gratitude (Resource Sharing)

**Approach**:
- After a successful defense where `active_reinforcements` were present, show a modal dialog to the defender
- Dialog: "You successfully defended with help from {ally}! Would you like to send them a thank-you gift?"
- For each resource (gold, wood, stone, food, steel), show a slider from 0 to current amount
- On confirm, deduct resources from defender and add to the ally via a direct Supabase update (similar to `AllianceResourceSharing`)
- Log the transfer in `alliance_resource_transfers` with a special message

**UI Component**: New `GratitudeModal.tsx`
- Slider for each resource type (using existing `Slider` component)
- Shows current balance next to each slider
- "Send Thanks" button that transfers resources
- "Skip" button to dismiss

---

## Technical Details

### Files to create:
- `src/components/game/IncomingAttackAlert.tsx` — realtime listener + alert UI for incoming attacks (own + ally)
- `src/components/game/AllyDefenseModal.tsx` — troop selector dialog for sending reinforcements to allies
- `src/components/game/GratitudeModal.tsx` — post-battle resource sharing modal

### Files to modify:
- `src/components/game/WorldMap.tsx` — update PvP `createMarch` to include `target_user_id` and `sent_army` in `active_marches` insert; handle `reinforce` march arrival; integrate reinforcement troops into defense calculations
- `src/components/game/GameLayout.tsx` — mount `IncomingAttackAlert` component; show gratitude modal after successful allied defense
- `src/components/game/NotificationsPanel.tsx` — show incoming attack warnings and allied defense events
- `src/hooks/useGameState.tsx` — add helper to fetch active reinforcements for defense calculation; update `attackPlayer` to account for reinforcements

### Database migrations:
1. Add columns to `active_marches`: `target_user_id uuid`, `sent_army jsonb DEFAULT '{}'`
2. Create `active_reinforcements` table with RLS policies
3. Enable realtime on `active_marches` (if not already via the existing publication)

### Flow summary:
```text
Player A attacks Player B
  → active_marches INSERT with target_user_id = B, sent_army = {...}
  → B gets realtime notification: "Incoming attack! ETA: Xs"
  → B's alliance members get notification: "Ally B under attack!"
  → Ally C opens defense modal, selects troops, sends reinforcement march
  → Reinforcement arrives → stored in active_reinforcements
  → Attack arrives → defense calc includes reinforcements
  → If defense succeeds → B sees GratitudeModal to thank C
  → Resources transferred via slider selection
```

