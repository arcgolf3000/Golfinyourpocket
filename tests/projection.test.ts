import { describe, it, expect } from 'vitest';
import { simulate } from '../src/engine/physics';
import { getClub } from '../src/data/clubs';

const M_TO_YARDS = 1.09361;

// These helpers mirror the inline math in drawGroundView exactly.
// If those change, these must change too.
const FL = 60;
const fwdToGndY = (fwd: number, groundY: number, groundH: number) => {
  const s = FL / (fwd + FL);
  return groundY - groundH * (1 - s);
};
const scaleAt = (fwd: number) => FL / (fwd + FL);

describe('Ground View Inline Projection', () => {
  // Canvas: 400 wide, 340 tall (0.85 ratio)
  const W = 400, H = 340;
  const horizon = H * 0.35;          // 119
  const groundY = H - 16;            // 324
  const groundH = groundY - horizon;  // 205

  it('tee (fwd=0) should map to groundY', () => {
    expect(fwdToGndY(0, groundY, groundH)).toBeCloseTo(groundY);
  });

  it('far distance should approach horizon but not pass it', () => {
    const y = fwdToGndY(1000, groundY, groundH);
    expect(y).toBeGreaterThan(horizon);
    expect(y).toBeLessThan(groundY);
  });

  it('scale at tee should be 1', () => {
    expect(scaleAt(0)).toBeCloseTo(1);
  });

  it('scale should decrease with distance', () => {
    expect(scaleAt(100)).toBeLessThan(scaleAt(50));
    expect(scaleAt(300)).toBeLessThan(scaleAt(100));
  });

  it('ball at apex should be above horizon (visible in sky)', () => {
    const club = getClub('7iron');
    const result = simulate(club, 78);

    // Find apex
    let maxH = 0, apexFwd = 0;
    for (const p of result.trajectory) {
      const hy = p.y * M_TO_YARDS;
      if (hy > maxH) { maxH = hy; apexFwd = p.x * M_TO_YARDS; }
    }

    const apexGndY = fwdToGndY(apexFwd, groundY, groundH);
    const targetY = H * 0.10;
    const hScale = maxH > 0 ? Math.max((apexGndY - targetY) / maxH, 2) : 2;

    const apexScreenY = apexGndY - maxH * hScale;
    // Apex should be near the target (in the sky, above horizon)
    expect(apexScreenY).toBeLessThan(horizon);
    expect(apexScreenY).toBeGreaterThanOrEqual(0);
  });

  it('ball arc should go up then come back down', () => {
    const club = getClub('driver');
    const result = simulate(club, 78);

    let maxH = 0, apexFwd = 0;
    for (const p of result.trajectory) {
      const hy = p.y * M_TO_YARDS;
      if (hy > maxH) { maxH = hy; apexFwd = p.x * M_TO_YARDS; }
    }
    const apexGndY = fwdToGndY(apexFwd, groundY, groundH);
    const targetY = H * 0.10;
    const hScale = maxH > 0 ? Math.max((apexGndY - targetY) / maxH, 2) : 2;

    const toScreenY = (p: { x: number; y: number }) => {
      const fwd = p.x * M_TO_YARDS;
      const h = p.y * M_TO_YARDS;
      return fwdToGndY(fwd, groundY, groundH) - h * hScale;
    };

    const startY = toScreenY(result.trajectory[0]);
    const screenYs = result.trajectory.map(p => toScreenY(p));
    const minY = Math.min(...screenYs);
    const endY = toScreenY(result.trajectory[result.trajectory.length - 1]);

    // Goes up (lower y = higher on screen)
    expect(minY).toBeLessThan(startY - 30);
    // Comes back down
    expect(endY).toBeGreaterThan(minY + 30);
  });

  it('should work for all clubs at various power levels without NaN', () => {
    const clubs = ['driver', '3wood', '5iron', '7iron', '9iron', 'pw', 'sw'];
    const powers = [30, 50, 78, 100];

    for (const key of clubs) {
      for (const pwr of powers) {
        const club = getClub(key);
        const result = simulate(club, pwr);

        let maxH = 0, apexFwd = 0;
        for (const p of result.trajectory) {
          const hy = p.y * M_TO_YARDS;
          if (hy > maxH) { maxH = hy; apexFwd = p.x * M_TO_YARDS; }
        }
        const apexGndY = fwdToGndY(apexFwd, groundY, groundH);
        const hScale = maxH > 0 ? Math.max((apexGndY - H * 0.10) / maxH, 2) : 2;

        expect(Number.isFinite(hScale)).toBe(true);
        expect(hScale).toBeGreaterThanOrEqual(2);

        for (const p of result.trajectory) {
          const fwd = p.x * M_TO_YARDS;
          const h = p.y * M_TO_YARDS;
          const lat = p.z * M_TO_YARDS;
          const s = scaleAt(fwd);
          const sx = W / 2 + lat * s * (W / 60);
          const sy = fwdToGndY(fwd, groundY, groundH) - h * hScale;

          expect(Number.isFinite(sx)).toBe(true);
          expect(Number.isFinite(sy)).toBe(true);
        }
      }
    }
  });

  it('short wedge shot should still produce a visible arc', () => {
    const club = getClub('sw');
    const result = simulate(club, 40);

    let maxH = 0, apexFwd = 0;
    for (const p of result.trajectory) {
      const hy = p.y * M_TO_YARDS;
      if (hy > maxH) { maxH = hy; apexFwd = p.x * M_TO_YARDS; }
    }
    const apexGndY = fwdToGndY(apexFwd, groundY, groundH);
    const hScale = maxH > 0 ? Math.max((apexGndY - H * 0.10) / maxH, 2) : 2;

    const startY = groundY; // starts at tee
    const apexScreenY = apexGndY - maxH * hScale;
    // Even a short wedge should arc at least 20px above start
    expect(startY - apexScreenY).toBeGreaterThan(20);
  });
});
