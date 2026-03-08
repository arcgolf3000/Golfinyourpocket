import { describe, it, expect } from 'vitest';
import { simulate, type ShotResult } from '../src/engine/physics';
import { getClub, CLUBS } from '../src/data/clubs';

describe('Physics Engine', () => {
  it('should return a valid ShotResult for driver at full power', () => {
    const club = getClub('driver');
    const result = simulate(club, 78); // sweet spot

    expect(result.carry).toBeGreaterThan(150);
    expect(result.carry).toBeLessThan(350);
    expect(result.total).toBeGreaterThanOrEqual(result.carry);
    expect(result.ballSpeed).toBeGreaterThan(100);
    expect(result.clubSpeed).toBeGreaterThan(100);
    expect(result.launchAngle).toBeGreaterThan(5);
    expect(result.launchAngle).toBeLessThan(20);
    expect(result.spinRate).toBeGreaterThan(1500);
    expect(result.hangTime).toBeGreaterThan(2);
    expect(result.apex).toBeGreaterThan(10);
    expect(result.trajectory.length).toBeGreaterThan(10);
    expect(['L', 'R', 'ST']).toContain(result.dir);
  });

  it('should produce shorter distances with lower power', () => {
    const club = getClub('7iron');
    const results: ShotResult[] = [];
    // Average over multiple shots due to variance
    for (let i = 0; i < 20; i++) {
      results.push(simulate(club, 40));
    }
    const avgLow = results.reduce((s, r) => s + r.carry, 0) / results.length;

    const resultsHigh: ShotResult[] = [];
    for (let i = 0; i < 20; i++) {
      resultsHigh.push(simulate(club, 78));
    }
    const avgHigh = resultsHigh.reduce((s, r) => s + r.carry, 0) / resultsHigh.length;

    expect(avgHigh).toBeGreaterThan(avgLow);
  });

  it('should produce shorter carry for shorter clubs', () => {
    const driverAvg = avgCarry('driver', 50);
    const ironAvg = avgCarry('7iron', 50);
    const swAvg = avgCarry('sw', 50);

    expect(driverAvg).toBeGreaterThan(ironAvg);
    expect(ironAvg).toBeGreaterThan(swAvg);
  });

  it('should produce trajectory starting at origin', () => {
    const club = getClub('pw');
    const result = simulate(club, 70);

    expect(result.trajectory[0].x).toBe(0);
    expect(result.trajectory[0].y).toBe(0);
    expect(result.trajectory[0].z).toBe(0);
  });

  it('should have higher spin rates for wedges vs driver', () => {
    const driverSpins: number[] = [];
    const swSpins: number[] = [];
    for (let i = 0; i < 20; i++) {
      driverSpins.push(simulate(getClub('driver'), 78).spinRate);
      swSpins.push(simulate(getClub('sw'), 78).spinRate);
    }
    const avgDriverSpin = driverSpins.reduce((a, b) => a + b) / driverSpins.length;
    const avgSwSpin = swSpins.reduce((a, b) => a + b) / swSpins.length;

    expect(avgSwSpin).toBeGreaterThan(avgDriverSpin);
  });

  it('should generate all 7 clubs from club data', () => {
    expect(CLUBS).toHaveLength(7);
    expect(getClub('driver').name).toBe('Driver');
    expect(getClub('3wood').name).toBe('3 Wood');
    expect(getClub('5iron').name).toBe('5 Iron');
    expect(getClub('7iron').name).toBe('7 Iron');
    expect(getClub('9iron').name).toBe('9 Iron');
    expect(getClub('pw').name).toBe('PW');
    expect(getClub('sw').name).toBe('SW');
  });

  it('should throw for unknown club', () => {
    expect(() => getClub('putter')).toThrow('Unknown club: putter');
  });

  it('should calculate smash factor correctly', () => {
    const club = getClub('driver');
    const result = simulate(club, 78);
    // Smash factor should be close to club's defined smash
    expect(result.smash).toBeGreaterThan(1.0);
    expect(result.smash).toBeLessThan(1.6);
  });
});

function avgCarry(clubKey: string, n: number): number {
  const club = getClub(clubKey);
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += simulate(club, 78).carry;
  }
  return total / n;
}
