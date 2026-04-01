import { TROOP_SPRITES, SPY_SPRITE } from './troopSprites';
import { FACTION_TROOP_SPRITES } from './factionTroopSprites';
import { useTroopSkins } from '@/hooks/useTroopSkins';
import type { TroopType } from '@/lib/gameTypes';

interface TroopIconProps {
  type: TroopType | 'spy';
  size?: number;
  className?: string;
  fallbackEmoji?: string;
}

function SkinAwareTroopIcon({ type, size = 16, className = '', fallbackEmoji }: TroopIconProps) {
  const { activeSkin } = useTroopSkins();
  const skinId = activeSkin.id;

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

function DefaultTroopIcon({ type, size = 16, className = '', fallbackEmoji }: TroopIconProps) {
  const sprite = type === 'spy' ? SPY_SPRITE : TROOP_SPRITES[type];

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

export default function TroopIcon(props: TroopIconProps) {
  // MilitaryPanel and other game panels are always inside TroopSkinProvider,
  // so SkinAwareTroopIcon should always work in-game.
  // DefaultTroopIcon is only for edge cases outside the provider.
  try {
    return <SkinAwareTroopIcon {...props} />;
  } catch {
    return <DefaultTroopIcon {...props} />;
  }
}
