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

export const CLUBS: ClubData[] = [
  { name: 'Driver',  key: 'driver', loft: 10.5, speed: 167, spin: 2700,  launch: 10.9, smash: 1.48, rollPercent: 0.11 },
  { name: '3 Wood',  key: '3wood',  loft: 15,   speed: 158, spin: 3400,  launch: 9.2,  smash: 1.44, rollPercent: 0.07 },
  { name: '5 Iron',  key: '5iron',  loft: 27,   speed: 140, spin: 5300,  launch: 12.1, smash: 1.38, rollPercent: 0.025 },
  { name: '7 Iron',  key: '7iron',  loft: 34,   speed: 130, spin: 7100,  launch: 16.3, smash: 1.34, rollPercent: 0.025 },
  { name: '9 Iron',  key: '9iron',  loft: 42,   speed: 120, spin: 8600,  launch: 20.4, smash: 1.30, rollPercent: 0.025 },
  { name: 'PW',      key: 'pw',     loft: 48,   speed: 112, spin: 9300,  launch: 24.2, smash: 1.27, rollPercent: 0.025 },
  { name: 'SW',      key: 'sw',     loft: 56,   speed: 100, spin: 10200, launch: 30.5, smash: 1.23, rollPercent: 0.025 },
];

export function getClub(key: string): ClubData {
  const club = CLUBS.find(c => c.key === key);
  if (!club) throw new Error(`Unknown club: ${key}`);
  return club;
}
