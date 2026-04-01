import militia from '@/assets/sprites/troops/militia.png';
import archer from '@/assets/sprites/troops/archer.png';
import knight from '@/assets/sprites/troops/knight.png';
import cavalry from '@/assets/sprites/troops/cavalry.png';
import siege from '@/assets/sprites/troops/siege.png';
import scout from '@/assets/sprites/troops/scout.png';
import spy from '@/assets/sprites/troops/spy.png';
import type { TroopType } from '@/lib/gameTypes';

export const TROOP_SPRITES: Record<TroopType, string> = {
  militia,
  archer,
  knight,
  cavalry,
  siege,
  scout,
};

/** Spy/assassin sprite */
export const SPY_SPRITE = spy;

/** Worker badge icon (reuse militia) */
export const WORKER_BADGE_SPRITE = militia;
