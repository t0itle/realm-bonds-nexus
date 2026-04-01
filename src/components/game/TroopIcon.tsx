import { TROOP_SPRITES, SPY_SPRITE } from './troopSprites';
import { FACTION_TROOP_SPRITES } from './factionTroopSprites';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import type { TroopType } from '@/lib/gameTypes';

interface TroopIconProps {
  type: TroopType | 'spy';
  size?: number;
  className?: string;
  /** Fallback emoji shown if sprite fails to load */
  fallbackEmoji?: string;
}

export default function TroopIcon({ type, size = 16, className = '', fallbackEmoji }: TroopIconProps) {
  let sprite: string | undefined;

  try {
    const { activeSkin } = useTroopSkins();
    const skinId = activeSkin.id;

    if (type === 'spy') {
      sprite = SPY_SPRITE;
    } else if (skinId !== 'default' && FACTION_TROOP_SPRITES[skinId]?.[type]) {
      sprite = FACTION_TROOP_SPRITES[skinId][type];
    } else {
      sprite = TROOP_SPRITES[type];
    }
  } catch {
    // Outside provider — use defaults
    sprite = type === 'spy' ? SPY_SPRITE : TROOP_SPRITES[type];
  }

  if (!sprite && fallbackEmoji) {
    return <span style={{ fontSize: size * 0.8 }}>{fallbackEmoji}</span>;
  }

  return (
    <img
      src={sprite}
      alt={type}
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      loading="lazy"
      style={{ width: size, height: size, minWidth: size }}
    />
  );
}
