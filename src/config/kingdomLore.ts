// Kingdom sprites
import chandrakhiaSprite from '@/assets/sprites/kingdoms/chandrakhia.png';
import pengSprite from '@/assets/sprites/kingdoms/peng.png';
import zezGuoSprite from '@/assets/sprites/kingdoms/zez_guo.png';
import chingiaSprite from '@/assets/sprites/kingdoms/chingia.png';
import aukiaSprite from '@/assets/sprites/kingdoms/aukia.png';
import alalahaSprite from '@/assets/sprites/kingdoms/alalaha.png';
import jecheonSprite from '@/assets/sprites/kingdoms/jecheon.png';
import keahuiaSprite from '@/assets/sprites/kingdoms/keahuia.png';
import alBuwaqaSprite from '@/assets/sprites/kingdoms/al_buwaqa.png';
import tongchunGuoSprite from '@/assets/sprites/kingdoms/tongchun_guo.png';
import zhenSprite from '@/assets/sprites/kingdoms/zhen.png';
import gwangyangSprite from '@/assets/sprites/kingdoms/gwangyang.png';
import hamheSprite from '@/assets/sprites/kingdoms/hamhe.png';
import goaygukSprite from '@/assets/sprites/kingdoms/goayguk.png';
import hayangSprite from '@/assets/sprites/kingdoms/hayang.png';
import pukuhiaSprite from '@/assets/sprites/kingdoms/pukuhia.png';

export interface KingdomLore {
  stateId: number;
  name: string;
  color: string;
  sprite: string;
  type: string;
  lore: string;
}

export const KINGDOM_LORE: KingdomLore[] = [
  {
    stateId: 1,
    name: 'Chandrakhia',
    color: '#66c2a5',
    sprite: chandrakhiaSprite,
    type: 'River',
    lore: 'A sacred river kingdom where golden-domed temples line terraced banks. Their priest-kings channel the floodwaters to nourish vast rice paddies, and their philosophers are renowned across the known world.',
  },
  {
    stateId: 2,
    name: 'Peng',
    color: '#fc8d62',
    sprite: pengSprite,
    type: 'Naval',
    lore: 'A sprawling port empire built on trade and cunning diplomacy. Peng\'s red-sailed junks dominate the eastern sea lanes, and their merchant-admirals wield more power than any throne.',
  },
  {
    stateId: 3,
    name: 'Zez Guo',
    color: '#8da0cb',
    sprite: zezGuoSprite,
    type: 'Naval',
    lore: 'An iron-walled naval fortress-state ruled by a council of war-strategists. Their jade-roofed citadels guard the straits, and no fleet passes without paying tribute or facing their armored warships.',
  },
  {
    stateId: 4,
    name: 'Chingia',
    color: '#e78ac3',
    sprite: chingiaSprite,
    type: 'Generic',
    lore: 'Fierce steppe riders who follow the herds across endless grasslands. Their mounted archers are unmatched, and their Great Khan unites the clans through strength, vision, and the ancient horse-bond.',
  },
  {
    stateId: 5,
    name: 'Aukia',
    color: '#a6d854',
    sprite: aukiaSprite,
    type: 'Generic',
    lore: 'Highland fortress-builders who carve citadels from living rock. Aukian engineers are legendary, and their terraced farms feed a proud, independent people who have never been conquered.',
  },
  {
    stateId: 6,
    name: 'Alalaha',
    color: '#ffd92f',
    sprite: alalahaSprite,
    type: 'Generic',
    lore: 'An oasis empire thriving amid golden dunes, where spice caravans converge beneath grand domed bazaars. Their scholars preserve ancient knowledge, and their hospitality is as boundless as the desert.',
  },
  {
    stateId: 7,
    name: 'Jecheon',
    color: '#73bcbb',
    sprite: jecheonSprite,
    type: 'Naval',
    lore: 'A disciplined coastal kingdom blending martial tradition with refined artistry. Jecheon\'s curved-roof fortresses guard rich fishing grounds, and their celadon pottery is treasured by collectors everywhere.',
  },
  {
    stateId: 8,
    name: 'Keahuia',
    color: '#ffb36b',
    sprite: keahuiaSprite,
    type: 'Generic',
    lore: 'Volcanic island folk who navigate by stars and read the sea like scripture. Their outrigger canoes connect scattered atolls, and their fire-dancers honor the sleeping mountain that birthed their homeland.',
  },
  {
    stateId: 9,
    name: 'Al Buwaqa',
    color: '#af9dd9',
    sprite: alBuwaqaSprite,
    type: 'Generic',
    lore: 'A desert caliphate of towering minarets and walled caravanserais. Al Buwaqa\'s warrior-monks guard the pilgrim roads, and their astronomers map the heavens from sand-swept observatories.',
  },
  {
    stateId: 10,
    name: 'Tongchun Guo',
    color: '#efb1c1',
    sprite: tongchunGuoSprite,
    type: 'Naval',
    lore: 'The grandest imperial court in the east, where red-lacquered palaces tower above bustling harbors. Their bureaucracy is vast, their navy formidable, and their silk worth more than gold.',
  },
  {
    stateId: 11,
    name: 'Zhen',
    color: '#bcce73',
    sprite: zhenSprite,
    type: 'Naval',
    lore: 'A merchant republic of canals, clocktowers, and counting houses. Zhen bankers finance wars across the continent, and their trade guilds set the price of everything from grain to gemstones.',
  },
  {
    stateId: 12,
    name: 'Gwangyang',
    color: '#fad051',
    sprite: gwangyangSprite,
    type: 'Naval',
    lore: 'A prosperous maritime kingdom where towering pagodas overlook shipyards that never sleep. Gwangyang\'s admirals command the largest warfleet in the southern seas, protecting a thriving spice trade.',
  },
  {
    stateId: 13,
    name: 'Hamhe',
    color: '#72e4a8',
    sprite: hamheSprite,
    type: 'Naval',
    lore: 'A fjord-dwelling seafaring people of red-roofed stilt houses and longboats. Hamhe fishers brave icy waters for legendary catches, and their sagas of sea-monsters draw adventurers from distant shores.',
  },
  {
    stateId: 14,
    name: 'Goayguk',
    color: '#e6a983',
    sprite: goaygukSprite,
    type: 'Naval',
    lore: 'Coastal raiders who carve totems to honor storm-spirits. Goayguk war-canoes strike fast and vanish into mangrove labyrinths, and their chieftains earn rank through daring raids, not birthright.',
  },
  {
    stateId: 15,
    name: 'Hayang',
    color: '#8babe6',
    sprite: hayangSprite,
    type: 'Naval',
    lore: 'An island realm of scholar-monks and star-gazers. Hayang\'s white-washed monasteries house the greatest libraries known, and their navigators chart courses that other sailors dare not follow.',
  },
  {
    stateId: 16,
    name: 'Pukuhia',
    color: '#e38dda',
    sprite: pukuhiaSprite,
    type: 'Generic',
    lore: 'Jungle temple-builders who raise stepped pyramids above the canopy. Pukuhia shamans commune with forest spirits, and their jade-masked warriors guard ruins older than memory itself.',
  },
];

/** Look up kingdom lore by Azgaar state ID */
export function getKingdomByStateId(stateId: number): KingdomLore | undefined {
  return KINGDOM_LORE.find(k => k.stateId === stateId);
}

/** Map of stateId -> sprite URL for quick access */
export const KINGDOM_SPRITES: Record<number, string> = Object.fromEntries(
  KINGDOM_LORE.map(k => [k.stateId, k.sprite])
);
