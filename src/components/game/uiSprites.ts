// Medieval UI texture sprites extracted from the sprite sheet
import woodPanelFramed from '@/assets/ui/wood-panel-framed.png';
import woodGrain from '@/assets/ui/wood-grain.png';
import woodButton from '@/assets/ui/wood-button.png';
import woodButtonLight from '@/assets/ui/wood-button-light.png';
import woodPlankH from '@/assets/ui/wood-plank-h.png';
import parchment from '@/assets/ui/parchment.png';

export {
  woodPanelFramed,
  woodGrain,
  woodButton,
  woodButtonLight,
  woodPlankH,
  parchment,
};

/** Inline style to apply wood grain background to a panel */
export const woodPanelStyle: React.CSSProperties = {
  backgroundImage: `url(${woodGrain})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};

/** Inline style for parchment background */
export const parchmentStyle: React.CSSProperties = {
  backgroundImage: `url(${parchment})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};

/** Inline style for wood plank (horizontal bar) */
export const woodPlankStyle: React.CSSProperties = {
  backgroundImage: `url(${woodPlankH})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  imageRendering: 'pixelated',
};
