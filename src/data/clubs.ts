export interface ClubData {
  name: string;
  key: string;
  loft: number;        // degrees
  speed: number;       // mph (club head speed)
  spin: number;        // rpm (backspin)
  launch: number;      // degrees (launch angle)
  smash: number;       // smash factor
  rollPercent: number;  // roll as % of carry
}

// Club data calibrated from TrackMan PGA Tour averages (2024).
// Sources: trackman.com/blog/golf/introducing-updated-tour-averages
//          TrackMan PGA Tour Averages PDF (carry, spin, launch, smash)
// Ball speed = clubSpeed × smashFactor. The power meter scales effective
// club speed via a contact-quality curve centred on the sweet spot.
export const CLUBS: ClubData[] = [
  // TrackMan PGA: 113 mph club, 167 mph ball, 1.48 smash, 10.9° launch, 2686 rpm, 275 yd carry
  { name: 'Driver',  key: 'driver', loft: 10.5, speed: 113, spin: 2686,  launch: 10.9, smash: 1.48, rollPercent: 0.08 },
  // TrackMan PGA: 107 mph club, 158 mph ball, 1.48 smash, 9.2° launch, 3655 rpm, 243 yd carry
  { name: '3 Wood',  key: '3wood',  loft: 15,   speed: 107, spin: 3655,  launch: 9.2,  smash: 1.48, rollPercent: 0.07 },
  // TrackMan PGA: 94 mph club, 132 mph ball, 1.41 smash, 12.1° launch, 5361 rpm, 194 yd carry
  { name: '5 Iron',  key: '5iron',  loft: 27,   speed: 94,  spin: 5361,  launch: 12.1, smash: 1.41, rollPercent: 0.04 },
  // TrackMan PGA: 90 mph club, 120 mph ball, 1.33 smash, 16.3° launch, 7097 rpm, 172 yd carry
  { name: '7 Iron',  key: '7iron',  loft: 34,   speed: 90,  spin: 7097,  launch: 16.3, smash: 1.33, rollPercent: 0.03 },
  // TrackMan PGA: 85 mph club, 109 mph ball, 1.28 smash, 20.4° launch, 8647 rpm, 148 yd carry
  { name: '9 Iron',  key: '9iron',  loft: 42,   speed: 85,  spin: 8647,  launch: 20.4, smash: 1.28, rollPercent: 0.015 },
  // TrackMan PGA: 83 mph club, 102 mph ball, 1.23 smash, 24.2° launch, 9304 rpm, 137 yd carry
  { name: 'PW',      key: 'pw',     loft: 48,   speed: 83,  spin: 9304,  launch: 24.2, smash: 1.23, rollPercent: 0.01 },
  // TrackMan PGA: ~80 mph club, ~90 mph ball, ~1.12 smash, ~28° launch, ~10200 rpm, ~103 yd carry
  { name: 'SW',      key: 'sw',     loft: 56,   speed: 80,  spin: 10200, launch: 28.0, smash: 1.12, rollPercent: 0.005 },
];

export function getClub(key: string): ClubData {
  const club = CLUBS.find(c => c.key === key);
  if (!club) throw new Error(`Unknown club: ${key}`);
  return club;
}
