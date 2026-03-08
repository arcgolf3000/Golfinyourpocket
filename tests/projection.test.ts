import { describe, it, expect } from 'vitest';
import {
  createProjectionConfig,
  projectGround,
  computeBallScreenPos,
  type ProjectionConfig,
} from '../src/engine/projection';
import { simulate } from '../src/engine/physics';
import { getClub } from '../src/data/clubs';

const M_TO_YARDS = 1.09361;

describe('Projection Config', () => {
  it('should create config with correct horizon and groundY', () => {
    const cfg = createProjectionConfig(400, 340);
    expect(cfg.width).toBe(400);
    expect(cfg.height).toBe(340);
    expect(cfg.horizon).toBeCloseTo(340 * 0.35);
    expect(cfg.groundY).toBe(340 - 16);
    expect(cfg.focalLength).toBe(60);
  });
});

describe('projectGround', () => {
  const cfg = createProjectionConfig(400, 340);

  it('should place tee at bottom center of canvas', () => {
    const result = projectGround(cfg, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(200);
    expect(result!.y).toBeCloseTo(cfg.groundY);
    expect(result!.scale).toBeCloseTo(1.0);
  });

  it('should move points toward horizon as distance increases', () => {
    const near = projectGround(cfg, 50, 0);
    const far = projectGround(cfg, 200, 0);
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    expect(far!.y).toBeLessThan(near!.y);
    expect(far!.scale).toBeLessThan(near!.scale);
  });

  it('should approach but never pass horizon line', () => {
    const veryFar = projectGround(cfg, 1000, 0);
    expect(veryFar).not.toBeNull();
    expect(veryFar!.y).toBeGreaterThan(cfg.horizon);
    expect(veryFar!.y).toBeLessThan(cfg.groundY);
  });

  it('should return null for points behind camera', () => {
    const result = projectGround(cfg, -100, 0);
    expect(result).toBeNull();
  });

  it('should offset laterally with perspective scaling', () => {
    const center = projectGround(cfg, 100, 0);
    const left = projectGround(cfg, 100, -20);
    const right = projectGround(cfg, 100, 20);
    expect(center).not.toBeNull();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.x).toBeLessThan(center!.x);
    expect(right!.x).toBeGreaterThan(center!.x);
    const leftOffset = center!.x - left!.x;
    const rightOffset = right!.x - center!.x;
    expect(leftOffset).toBeCloseTo(rightOffset, 1);
  });

  it('should reduce lateral spread at greater distance', () => {
    const nearLeft = projectGround(cfg, 50, -20);
    const nearRight = projectGround(cfg, 50, 20);
    const farLeft = projectGround(cfg, 200, -20);
    const farRight = projectGround(cfg, 200, 20);

    const nearSpread = nearRight!.x - nearLeft!.x;
    const farSpread = farRight!.x - farLeft!.x;
    expect(nearSpread).toBeGreaterThan(farSpread);
  });

  it('should not produce NaN or Infinity', () => {
    const atCamera = projectGround(cfg, 0, 0);
    expect(atCamera).not.toBeNull();
    expect(Number.isFinite(atCamera!.x)).toBe(true);
    expect(Number.isFinite(atCamera!.y)).toBe(true);

    const justBehind = projectGround(cfg, -60, 0);
    expect(justBehind).toBeNull();
  });
});

describe('computeBallScreenPos', () => {
  const cfg = createProjectionConfig(400, 340);

  it('should return null for empty trajectory', () => {
    expect(computeBallScreenPos(cfg, [], { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('should place starting point near tee (bottom center)', () => {
    const club = getClub('7iron');
    const result = simulate(club, 78);
    const startPos = computeBallScreenPos(cfg, result.trajectory, result.trajectory[0]);
    expect(startPos).not.toBeNull();
    // Starting point should be near bottom center
    expect(startPos!.x).toBeCloseTo(cfg.width / 2, -1);
    expect(startPos!.y).toBeCloseTo(cfg.groundY, 0);
  });

  it('should place apex above horizon (in the sky)', () => {
    const club = getClub('7iron');
    const result = simulate(club, 78);
    // Find apex point
    const apexPt = result.trajectory.reduce((m, p) => (p.y > m.y ? p : m), result.trajectory[0]);
    const apexPos = computeBallScreenPos(cfg, result.trajectory, apexPt);
    expect(apexPos).not.toBeNull();
    // Apex should be in the sky (above horizon, lower y = higher on screen)
    expect(apexPos!.y).toBeLessThan(cfg.horizon);
    // And on screen (not negative)
    expect(apexPos!.y).toBeGreaterThanOrEqual(0);
  });

  it('should place landing point near ground level', () => {
    const club = getClub('driver');
    const result = simulate(club, 78);
    const lastPt = result.trajectory[result.trajectory.length - 1];
    const landPos = computeBallScreenPos(cfg, result.trajectory, lastPt);
    expect(landPos).not.toBeNull();
    // Landing point height should be near 0, so screen Y should be near ground projection
    const landGnd = projectGround(cfg, lastPt.x * M_TO_YARDS, lastPt.z * M_TO_YARDS);
    expect(landGnd).not.toBeNull();
    // Allow some tolerance since the last trajectory point may have small residual height
    expect(Math.abs(landPos!.y - landGnd!.y)).toBeLessThan(30);
  });

  it('should produce an arc shape (ball goes up then comes down)', () => {
    const club = getClub('7iron');
    const result = simulate(club, 78);

    const positions = result.trajectory.map(p =>
      computeBallScreenPos(cfg, result.trajectory, p),
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    // Start near bottom
    const startY = positions[0].y;
    // Find minimum Y (highest point on screen)
    const minY = Math.min(...positions.map(p => p.y));
    // End should come back toward ground
    const endY = positions[positions.length - 1].y;

    // Ball goes UP (lower y = higher on screen)
    expect(minY).toBeLessThan(startY - 30); // at least 30px above start
    // Ball comes back DOWN
    expect(endY).toBeGreaterThan(minY + 30); // at least 30px below peak
  });

  it('should keep all trajectory points on screen', () => {
    const club = getClub('driver');
    const result = simulate(club, 78);

    for (const point of result.trajectory) {
      const pos = computeBallScreenPos(cfg, result.trajectory, point);
      if (pos) {
        expect(pos.y).toBeGreaterThanOrEqual(-20); // small tolerance for top
        expect(pos.y).toBeLessThanOrEqual(cfg.height + 20);
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
    }
  });

  it('should work with all clubs at various power levels', () => {
    const clubs = ['driver', '3wood', '5iron', '7iron', '9iron', 'pw', 'sw'];
    const powers = [30, 50, 78, 100];

    for (const clubKey of clubs) {
      for (const power of powers) {
        const club = getClub(clubKey);
        const result = simulate(club, power);

        // Every trajectory should produce valid screen positions
        let hasValidPoints = false;
        for (const point of result.trajectory) {
          const pos = computeBallScreenPos(cfg, result.trajectory, point);
          if (pos) {
            hasValidPoints = true;
            expect(Number.isFinite(pos.x)).toBe(true);
            expect(Number.isFinite(pos.y)).toBe(true);
            expect(Number.isFinite(pos.scale)).toBe(true);
          }
        }
        expect(hasValidPoints).toBe(true);
      }
    }
  });

  it('should produce visible arc for short wedge shots', () => {
    const club = getClub('sw');
    const result = simulate(club, 40); // low power wedge

    const positions = result.trajectory.map(p =>
      computeBallScreenPos(cfg, result.trajectory, p),
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    expect(positions.length).toBeGreaterThan(5);

    const startY = positions[0].y;
    const minY = Math.min(...positions.map(p => p.y));
    // Even a short shot should have a visible arc (at least 15px)
    expect(startY - minY).toBeGreaterThan(15);
  });
});
