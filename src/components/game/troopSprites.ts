import woodenArmor from '@/assets/sprites/troops/wooden_armor.png';
import leatherArmor from '@/assets/sprites/troops/leather_armor.png';
import leatherHelmet from '@/assets/sprites/troops/leather_helmet.png';
import leatherBoot from '@/assets/sprites/troops/leather_boot.png';
import ironArmor from '@/assets/sprites/troops/iron_armor.png';
import ironHelmet from '@/assets/sprites/troops/iron_helmet.png';
import ironBoot from '@/assets/sprites/troops/iron_boot.png';
import wizardHat from '@/assets/sprites/troops/wizard_hat.png';
import type { TroopType } from '@/lib/gameTypes';

export const TROOP_SPRITES: Record<TroopType, string> = {
  militia: woodenArmor,
  archer: leatherArmor,
  scout: leatherBoot,
  knight: ironArmor,
  cavalry: ironHelmet,
  siege: ironBoot,
};

/** Wizard hat used for spy/special unit icons */
export const SPY_SPRITE = wizardHat;

/** Worker badge icon */
export const WORKER_BADGE_SPRITE = leatherHelmet;
