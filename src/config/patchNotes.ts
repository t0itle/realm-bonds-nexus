// Patch notes configuration — update this when pushing new versions
export const CURRENT_VERSION = '0.4.0';

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.4.0',
    date: '2026-03-31',
    title: 'Fortifications & Balance',
    changes: [
      '🧱 Build border walls at outposts to defend territory',
      '⬆️ Outpost upgrades — increase vision, garrison & territory',
      '⏱️ Building times increased 3× for strategic pacing',
      '📉 Resource production reduced 20% across the board',
      '⚒️ Steel now only from captured map mines',
      '⭐ Max-level buildings show a star badge',
      '🚶 Active march tracker on the home screen',
      '🏗️ Disabled recruit buttons now explain why',
      '📦 Warehouse building for extra storage capacity',
      '🐪 Caravan system for transferring resources',
    ],
  },
];
