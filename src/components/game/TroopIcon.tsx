import { TROOP_SPRITES, SPY_SPRITE } from './troopSprites';
import type { TroopType } from '@/lib/gameTypes';

interface TroopIconProps {
  type: TroopType | 'spy';
  size?: number;
  className?: string;
  /** Fallback emoji shown if sprite fails to load */
  fallbackEmoji?: string;
}

export default function TroopIcon({ type, size = 16, className = '', fallbackEmoji }: TroopIconProps) {
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
