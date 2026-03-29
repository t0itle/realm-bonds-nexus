import goldSprite from '@/assets/sprites/gold.png';
import woodSprite from '@/assets/sprites/wood.png';
import stoneSprite from '@/assets/sprites/stone.png';
import foodSprite from '@/assets/sprites/food.png';
import steelSprite from '@/assets/sprites/steel.png';
import populationSprite from '@/assets/sprites/population.png';
import timerSprite from '@/assets/sprites/timer.png';
import hammerSprite from '@/assets/sprites/hammer.png';
import happinessSprite from '@/assets/sprites/happiness.png';

export type ResourceType = 'gold' | 'wood' | 'stone' | 'food' | 'steel' | 'population' | 'timer' | 'hammer' | 'happiness';

const RESOURCE_SPRITES: Record<ResourceType, string> = {
  gold: goldSprite,
  wood: woodSprite,
  stone: stoneSprite,
  food: foodSprite,
  steel: steelSprite,
  population: populationSprite,
  timer: timerSprite,
  hammer: hammerSprite,
  happiness: happinessSprite,
};

interface ResourceIconProps {
  type: ResourceType;
  size?: number;
  className?: string;
}

export default function ResourceIcon({ type, size = 16, className = '' }: ResourceIconProps) {
  return (
    <img
      src={RESOURCE_SPRITES[type]}
      alt={type}
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      loading="lazy"
      style={{ width: size, height: size, minWidth: size }}
    />
  );
}

/** Helper to get the icon for a resource key string */
export function getResourceType(key: string): ResourceType | null {
  if (key in RESOURCE_SPRITES) return key as ResourceType;
  return null;
}

export { RESOURCE_SPRITES };
