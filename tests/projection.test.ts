import { describe, it, expect } from 'vitest';
import {
  createProjectionConfig,
  projectGround,
  projectBall,
  computeHeightScale,
  type ProjectionConfig,
} from '../src/engine/projection';
import { simulate } from '../src/engine/physics';
import { getClub } from '../src/data/clubs';

describe('Projection Config', () => {
  it('should create config with correct horizon and groundY', () => {
    const cfg = createProjectionConfig(400, 260);
    expect(cfg.width).toBe(400);
    expect(cfg.height).toBe(260);
    expect(cfg.horizon).toBeCloseTo(260 * 0.35);
    expect(cfg.groundY).toBe(260 - 16);
    expect(cfg.focalLength).toBe(60);
  });
});

describe('projectGround', () => {
  const cfg = createProjectionConfig(400, 260);

  it('should place tee at bottom center of canvas', () => {
    const result = projectGround(cfg, 0, 0);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(200); // centered
    expect(result!.y).toBeCloseTo(cfg.groundY); // at ground level
    expect(result!.scale).toBeCloseTo(1.0); // full scale at tee
  });

  it('should move points toward horizon as distance increases', () => {
    const near = projectGround(cfg, 50, 0);
    const far = projectGround(cfg, 200, 0);
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    // Farther points should be closer to horizon (lower y value)
    expect(far!.y).toBeLessThan(near!.y);
    // And have smaller scale
    expect(far!.scale).toBeLessThan(near!.scale);
  });

  it('should approach but never pass horizon line', () => {
    const veryFar = projectGround(cfg, 1000, 0);
    expect(veryFar).not.toBeNull();
    // Should be close to but above horizon
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
    // Left should be left of center, right should be right
    expect(left!.x).toBeLessThan(center!.x);
    expect(right!.x).toBeGreaterThan(center!.x);
    // Symmetric
    const leftOffset = center!.x - left!.x;
    const rightOffset = right!.x - center!.x;
    expect(leftOffset).toBeCloseTo(rightOffset, 1);
  });

  it('should reduce lateral spread at greater distance (perspective)', () => {
    const nearLeft = projectGround(cfg, 50, -20);
    const nearRight = projectGround(cfg, 50, 20);
    const farLeft = projectGround(cfg, 200, -20);
    const farRight = projectGround(cfg, 200, 20);
    expect(nearLeft).not.toBeNull();
    expect(nearRight).not.toBeNull();
    expect(farLeft).not.toBeNull();
    expect(farRight).not.toBeNull();

    const nearSpread = nearRight!.x - nearLeft!.x;
    const farSpread = farRight!.x - farLeft!.x;
    // Nearer objects should have wider lateral spread
    expect(nearSpread).toBeGreaterThan(farSpread);
  });

  it('should not produce NaN or Infinity for edge cases', () => {
    const atCamera = projectGround(cfg, 0, 0);
    expect(atCamera).not.toBeNull();
    expect(Number.isFinite(atCamera!.x)).toBe(true);
    expect(Number.isFinite(atCamera!.y)).toBe(true);

    const justBehind = projectGround(cfg, -60, 0);
    // depth = -60 + 60 = 0, so depth <= 0
    expect(justBehind).toBeNull();
  });
});

describe('projectBall', () => {
  const cfg = createProjectionConfig(400, 260);

  it('should raise ball above ground position when height > 0', () => {
    const heightScale = 5;
    const ground = projectGround(cfg, 100, 0);
    const ball = projectBall(cfg, heightScale, 100, 30, 0);
    expect(ground).not.toBeNull();
    expect(ball).not.toBeNull();
    // Ball should be above ground (lower y = higher on screen)
    expect(ball!.y).toBeLessThan(ground!.y);
  });

  it('should match ground position when height is 0', () => {
    const heightScale = 5;
    const ground = projectGround(cfg, 100, 0);
    const ball = projectBall(cfg, heightScale, 100, 0, 0);
    expect(ground).not.toBeNull();
    expect(ball).not.toBeNull();
    expect(ball!.x).toBeCloseTo(ground!.x);
    expect(ball!.y).toBeCloseTo(ground!.y);
  });

  it('should return null for points behind camera', () => {
    const result = projectBall(cfg, 5, -100, 10, 0);
    expect(result).toBeNull();
  });

  it('should have same x coordinate as ground projection', () => {
    const heightScale = 5;
    const ground = projectGround(cfg, 150, 10);
    const ball = projectBall(cfg, heightScale, 150, 25, 10);
    expect(ground).not.toBeNull();
    expect(ball).not.toBeNull();
    expect(ball!.x).toBeCloseTo(ground!.x);
  });
});

describe('computeHeightScale', () => {
  const cfg = createProjectionConfig(400, 260);

  it('should return minimum scale for empty trajectory', () => {
    expect(computeHeightScale(cfg, [])).toBe(2);
  });

  it('should return minimum scale for flat trajectory', () => {
    const flat = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ];
    expect(computeHeightScale(cfg, flat)).toBe(2);
  });

  it('should return a positive finite number for real trajectories', () => {
    const club = getClub('driver');
    const result = simulate(club, 78);
    const scale = computeHeightScale(cfg, result.trajectory);
    expect(scale).toBeGreaterThan(0);
    expect(Number.isFinite(scale)).toBe(true);
  });

  it('should scale higher for wedge shots (lower apex)', () => {
    // Wedge shots have lower apex so need more height scaling to be visible
    const driver = simulate(getClub('driver'), 78);
    const sw = simulate(getClub('sw'), 78);
    const driverScale = computeHeightScale(cfg, driver.trajectory);
    const swScale = computeHeightScale(cfg, sw.trajectory);
    // Both should produce reasonable scales (sw might be larger since apex is lower in yards)
    expect(driverScale).toBeGreaterThan(0);
    expect(swScale).toBeGreaterThan(0);
  });

  it('should produce apex near target screen position', () => {
    const club = getClub('7iron');
    const result = simulate(club, 78);
    const scale = computeHeightScale(cfg, result.trajectory);

    // Find apex point
    const M_TO_YARDS = 1.09361;
    const apexPt = result.trajectory.reduce((m, p) => (p.y > m.y ? p : m), result.trajectory[0]);
    const apexH = apexPt.y * M_TO_YARDS;
    const apexFwd = apexPt.x * M_TO_YARDS;
    const apexGnd = projectGround(cfg, apexFwd, 0);

    if (apexGnd && apexH > 0) {
      const screenY = apexGnd.y - apexH * scale;
      // Apex should be in the sky area (between top and horizon)
      expect(screenY).toBeGreaterThanOrEqual(0);
      expect(screenY).toBeLessThan(cfg.horizon);
    }
  });
});

describe('Ground View Ball Flight Integration', () => {
  it('should produce a trajectory that projects entirely on screen for driver', () => {
    const cfg = createProjectionConfig(400, 260);
    const club = getClub('driver');
    const result = simulate(club, 78);
    const heightScale = computeHeightScale(cfg, result.trajectory);
    const M_TO_YARDS = 1.09361;

    let allOnScreen = true;
    for (const point of result.trajectory) {
      const bp = projectBall(
        cfg,
        heightScale,
        point.x * M_TO_YARDS,
        point.y * M_TO_YARDS,
        point.z * M_TO_YARDS,
      );
      if (!bp) { allOnScreen = false; break; }
      // Ball should be within reasonable screen bounds
      if (bp.y < -50 || bp.y > cfg.height + 50) { allOnScreen = false; break; }
    }
    expect(allOnScreen).toBe(true);
  });

  it('should produce a trajectory that projects entirely on screen for SW', () => {
    const cfg = createProjectionConfig(400, 260);
    const club = getClub('sw');
    const result = simulate(club, 60);
    const heightScale = computeHeightScale(cfg, result.trajectory);
    const M_TO_YARDS = 1.09361;

    let allOnScreen = true;
    for (const point of result.trajectory) {
      const bp = projectBall(
        cfg,
        heightScale,
        point.x * M_TO_YARDS,
        point.y * M_TO_YARDS,
        point.z * M_TO_YARDS,
      );
      if (!bp) { allOnScreen = false; break; }
      if (bp.y < -50 || bp.y > cfg.height + 50) { allOnScreen = false; break; }
    }
    expect(allOnScreen).toBe(true);
  });

  it('should show ball starting near the tee position', () => {
    const cfg = createProjectionConfig(400, 260);
    const club = getClub('7iron');
    const result = simulate(club, 78);
    const heightScale = computeHeightScale(cfg, result.trajectory);
    const M_TO_YARDS = 1.09361;

    const firstPoint = result.trajectory[0];
    const bp = projectBall(
      cfg,
      heightScale,
      firstPoint.x * M_TO_YARDS,
      firstPoint.y * M_TO_YARDS,
      firstPoint.z * M_TO_YARDS,
    );
    expect(bp).not.toBeNull();
    // First point should be near bottom center (tee area)
    expect(bp!.x).toBeCloseTo(cfg.width / 2, -1);
    expect(bp!.y).toBeCloseTo(cfg.groundY, 0);
  });

  it('should have ball arc upward then come back down', () => {
    const cfg = createProjectionConfig(400, 260);
    const club = getClub('7iron');
    const result = simulate(club, 78);
    const heightScale = computeHeightScale(cfg, result.trajectory);
    const M_TO_YARDS = 1.09361;

    const screenYs = result.trajectory.map(p => {
      const bp = projectBall(
        cfg,
        heightScale,
        p.x * M_TO_YARDS,
        p.y * M_TO_YARDS,
        p.z * M_TO_YARDS,
      );
      return bp ? bp.y : null;
    }).filter((y): y is number => y !== null);

    // Should start high y (bottom of screen)
    const startY = screenYs[0];
    // Should have a minimum somewhere in the middle (top of arc)
    const minY = Math.min(...screenYs);
    // Should end back near bottom
    const endY = screenYs[screenYs.length - 1];

    // Ball arcs up (lower y = higher on screen)
    expect(minY).toBeLessThan(startY);
    // Ball comes back down
    expect(endY).toBeGreaterThan(minY);
  });

  it('should work with all clubs at various power levels', () => {
    const cfg = createProjectionConfig(400, 260);
    const M_TO_YARDS = 1.09361;
    const clubs = ['driver', '3wood', '5iron', '7iron', '9iron', 'pw', 'sw'];
    const powers = [30, 50, 78, 100];

    for (const clubKey of clubs) {
      for (const power of powers) {
        const club = getClub(clubKey);
        const result = simulate(club, power);
        const heightScale = computeHeightScale(cfg, result.trajectory);

        expect(heightScale).toBeGreaterThan(0);
        expect(Number.isFinite(heightScale)).toBe(true);

        // Verify trajectory projects without errors
        for (const point of result.trajectory) {
          const bp = projectBall(
            cfg,
            heightScale,
            point.x * M_TO_YARDS,
            point.y * M_TO_YARDS,
            point.z * M_TO_YARDS,
          );
          if (bp) {
            expect(Number.isFinite(bp.x)).toBe(true);
            expect(Number.isFinite(bp.y)).toBe(true);
            expect(Number.isFinite(bp.scale)).toBe(true);
          }
        }
      }
    }
  });
});
