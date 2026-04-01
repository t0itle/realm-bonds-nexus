import { useContext } from 'react';
import { TROOP_SPRITES, SPY_SPRITE } from './troopSprites';
import { FACTION_TROOP_SPRITES } from './factionTroopSprites';
import { useTroopSkins, TroopSkinContext } from '@/hooks/useTroopSkins';
import type { TroopType } from '@/lib/gameTypes';

interface TroopIconProps {
  type: TroopType | 'spy';
  size?: number;
  className?: string;
  fallbackEmoji?: string;
}

export default function TroopIcon({ type, size = 16, className = '', fallbackEmoji }: TroopIconProps) {
  // Safe context check — returns null if outside provider
  const skinCtx = useContext(TroopSkinContext);
  const skinId = skinCtx?.activeSkin?.id ?? 'default';

  let sprite: string | undefined;
  if (type === 'spy') {
    sprite = SPY_SPRITE;
  } else if (skinId !== 'default' && FACTION_TROOP_SPRITES[skinId]?.[type]) {
    sprite = FACTION_TROOP_SPRITES[skinId][type];
  } else {
    sprite = TROOP_SPRITES[type];
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
