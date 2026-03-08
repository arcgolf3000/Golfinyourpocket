import { useRef, useEffect, useCallback } from 'react';
import type { TrajectoryPoint } from '../engine/physics';
import type { UnitSystem } from '../data/profile';

export type RangeViewType = 'ground' | 'birdseye';

interface RangeCanvasProps {
  width: number;
  height: number;
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number; // 0 to 1
  shotLandings: Array<{ x: number; z: number; club: string }>;
  units: UnitSystem;
  viewType: RangeViewType;
}

const DISTANCE_MARKERS = [50, 100, 150, 200, 250, 300]; // yards
const M_TO_YARDS = 1.09361;
const YARDS_TO_METRES = 0.9144;

// Perspective projection for ground view
function project(
  forwardYards: number,
  heightYards: number,
  lateralYards: number,
  width: number,
  height: number,
  horizon: number,
  focalLength: number,
): { x: number; y: number; scale: number } | null {
  const depth = forwardYards + focalLength;
  if (depth <= 0) return null;
  const scale = focalLength / depth;
  const cx = width / 2;
  const groundY = height - 40;
  const screenX = cx + lateralYards * scale * 3.5;
  const screenY = groundY - (groundY - horizon) * (1 - scale) - heightYards * scale * 3.5;
  return { x: screenX, y: screenY, scale };
}

// ==================== BIRDS-EYE (TOP-DOWN) VIEW ====================
function drawBirdsEye(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  trajectory: TrajectoryPoint[] | null,
  animationProgress: number,
  shotLandings: Array<{ x: number; z: number; club: string }>,
  units: UnitSystem,
) {
  const padB = 50;
  const padT = 20;
  const plotH = height - padT - padB;
  const cx = width / 2;

  // Max range for scaling
  const maxRange = 300; // yards
  const yScale = plotH / maxRange;
  const xScale = yScale; // uniform

  // Convert forward yards to screen Y (tee at bottom)
  const toY = (yds: number) => height - padB - yds * yScale;
  const toX = (lateralYds: number) => cx + lateralYds * xScale;

  // === FAIRWAY background ===
  const fairwayGrad = ctx.createLinearGradient(0, 0, 0, height);
  fairwayGrad.addColorStop(0, '#0e3d1c');
  fairwayGrad.addColorStop(0.5, '#14522e');
  fairwayGrad.addColorStop(1, '#1e7a40');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, 0, width, height);

  // Mowing stripe pattern
  for (let d = 0; d < maxRange; d += 15) {
    const y1 = toY(d);
    const y2 = toY(d + 7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(0, y2, width, y1 - y2);
  }

  // Fairway boundary lines (perspective tapered)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  const leftBot = toX(-35);
  const rightBot = toX(35);
  const leftTop = toX(-20);
  const rightTop = toX(20);
  ctx.beginPath();
  ctx.moveTo(leftBot, toY(0));
  ctx.lineTo(leftTop, toY(maxRange));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightBot, toY(0));
  ctx.lineTo(rightTop, toY(maxRange));
  ctx.stroke();

  // === DISTANCE ARCS & MARKERS ===
  for (const dist of DISTANCE_MARKERS) {
    const y = toY(dist);
    if (y < padT || y > height - padB) continue;

    // Arc line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target green circle
    const greenR = 8;
    const greenGrad = ctx.createRadialGradient(cx, y, 0, cx, y, greenR);
    greenGrad.addColorStop(0, 'rgba(34, 200, 34, 0.5)');
    greenGrad.addColorStop(0.7, 'rgba(34, 139, 34, 0.25)');
    greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
    ctx.fillStyle = greenGrad;
    ctx.beginPath();
    ctx.arc(cx, y, greenR, 0, 2 * Math.PI);
    ctx.fill();

    // Flag pin
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - 10);
    ctx.stroke();
    ctx.fillStyle = dist <= 150 ? 'rgba(255, 80, 80, 0.8)' : 'rgba(255, 200, 50, 0.7)';
    ctx.beginPath();
    ctx.moveTo(cx, y - 10);
    ctx.lineTo(cx + 5, y - 8);
    ctx.lineTo(cx, y - 6);
    ctx.closePath();
    ctx.fill();

    // Distance label
    const label = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px "DM Sans", system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(label, width - 35, y + 3);
  }

  // === TEE BOX ===
  const teeY = toY(0);
  const teeW = 40, teeH = 16;
  ctx.fillStyle = '#2d8a4e';
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeY - teeH / 2, teeW, teeH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeY - teeH / 2, teeW, teeH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(cx - 8, teeY, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 8, teeY, 3, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '9px "DM Sans", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('TEE', cx, teeY + 22);

  // === PREVIOUS LANDINGS ===
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const sx = toX(lz);
    const sy = toY(lx);
    if (sy < padT || sy > height - padB) continue;

    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // === PREDICTIVE LANDING ZONE ===
  if (trajectory && trajectory.length > 2 && animationProgress > 0) {
    const finalP = trajectory[trajectory.length - 1];
    const landX = finalP.x * M_TO_YARDS;
    const landZ = finalP.z * M_TO_YARDS;
    const sx = toX(landZ);
    const sy = toY(landX);

    const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;

    ctx.strokeStyle = `rgba(255, 204, 51, ${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(255, 204, 51, ${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, 2 * Math.PI);
    ctx.fill();

    if (animationProgress < 1) {
      const distLabel = units === 'metric'
        ? `${Math.round(landX * YARDS_TO_METRES)}m`
        : `${Math.round(landX)} yds`;
      ctx.font = '10px "DM Sans", system-ui';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(distLabel).width + 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(sx - tw / 2, sy - 24, tw, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#ffcc33';
      ctx.fillText(distLabel, sx, sy - 12);
    }
  }

  // === BALL FLIGHT TRAIL ===
  if (trajectory && animationProgress > 0) {
    const pointCount = Math.floor(trajectory.length * animationProgress);

    // Trail with glow
    if (pointCount > 1) {
      for (let i = 1; i < pointCount; i++) {
        const p = trajectory[i];
        const prev = trajectory[i - 1];
        const px = toX(p.z * M_TO_YARDS);
        const py = toY(p.x * M_TO_YARDS);
        const ppx = toX(prev.z * M_TO_YARDS);
        const ppy = toY(prev.x * M_TO_YARDS);

        const alpha = 0.1 + (i / pointCount) * 0.6;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.moveTo(ppx, ppy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      // Current ball
      const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
      const bx = toX(current.z * M_TO_YARDS);
      const by = toY(current.x * M_TO_YARDS);

      // Shadow based on height
      const shadowAlpha = Math.min(0.3, current.y * M_TO_YARDS * 0.01);
      const shadowR = 3 + current.y * M_TO_YARDS * 0.05;
      ctx.beginPath();
      ctx.arc(bx, by, shadowR, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fill();

      // Glow
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 16);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      glow.addColorStop(0.3, 'rgba(255, 204, 51, 0.35)');
      glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      // Ball
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
}

// ==================== GROUND-LEVEL (PERSPECTIVE) VIEW ====================
function drawGroundView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  trajectory: TrajectoryPoint[] | null,
  animationProgress: number,
  shotLandings: Array<{ x: number; z: number; club: string }>,
  units: UnitSystem,
) {
  const horizon = height * 0.30;
  const groundY = height - 40;
  const focalLength = 60;

  // === SKY with realistic gradient ===
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon + 30);
  skyGrad.addColorStop(0, '#0b1a30');
  skyGrad.addColorStop(0.15, '#0f2845');
  skyGrad.addColorStop(0.4, '#1a4065');
  skyGrad.addColorStop(0.65, '#2a5a80');
  skyGrad.addColorStop(0.85, '#4a7a9a');
  skyGrad.addColorStop(1, '#6a9ab5');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizon + 30);

  // Clouds
  const drawCloud = (cx: number, cy: number, size: number, alpha: number) => {
    ctx.fillStyle = `rgba(200, 220, 240, ${alpha})`;
    for (const [ox, oy, r] of [
      [0, 0, size],
      [-size * 0.7, size * 0.1, size * 0.65],
      [size * 0.6, size * 0.15, size * 0.55],
      [-size * 0.3, -size * 0.3, size * 0.5],
      [size * 0.35, -size * 0.25, size * 0.45],
    ]) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  };
  drawCloud(width * 0.2, horizon * 0.25, 12, 0.06);
  drawCloud(width * 0.65, horizon * 0.35, 16, 0.05);
  drawCloud(width * 0.85, horizon * 0.18, 10, 0.04);
  drawCloud(width * 0.42, horizon * 0.5, 14, 0.04);

  // Haze near horizon
  const hazeGrad = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 20);
  hazeGrad.addColorStop(0, 'rgba(106, 154, 181, 0)');
  hazeGrad.addColorStop(0.5, 'rgba(106, 154, 181, 0.15)');
  hazeGrad.addColorStop(1, 'rgba(106, 154, 181, 0)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, horizon - 20, width, 40);

  // === FAIRWAY ===
  const fairwayGrad = ctx.createLinearGradient(0, horizon, 0, height);
  fairwayGrad.addColorStop(0, '#0e3d1c');
  fairwayGrad.addColorStop(0.2, '#14522e');
  fairwayGrad.addColorStop(0.5, '#1a6b38');
  fairwayGrad.addColorStop(0.8, '#1e7a40');
  fairwayGrad.addColorStop(1, '#22884a');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Tree line at horizon
  ctx.fillStyle = '#0b2e15';
  for (let tx = 0; tx < width; tx += 14) {
    const th = 6 + Math.sin(tx * 0.25) * 3 + Math.cos(tx * 0.13) * 2.5 + Math.sin(tx * 0.07) * 2;
    ctx.beginPath();
    ctx.arc(tx, horizon + 1, th, Math.PI, 0);
    ctx.fill();
  }
  // Lighter tree highlights
  ctx.fillStyle = '#0f3b1a';
  for (let tx = 5; tx < width; tx += 22) {
    const th = 3 + Math.sin(tx * 0.4) * 2;
    ctx.beginPath();
    ctx.arc(tx, horizon - 1, th, Math.PI, 0);
    ctx.fill();
  }

  // Mowing stripes
  for (let d = 10; d < 320; d += 15) {
    const p = project(d, 0, 0, width, height, horizon, focalLength);
    if (!p || p.y < horizon) continue;
    const stripe = project(d + 7, 0, 0, width, height, horizon, focalLength);
    if (!stripe) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(0, p.y, width, stripe.y - p.y);
  }

  // Perspective lane lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (const offset of [-40, -20, 20, 40]) {
    const start = project(0, 0, offset, width, height, horizon, focalLength);
    const end = project(300, 0, offset, width, height, horizon, focalLength);
    if (start && end) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }

  // === DISTANCE MARKERS & FLAGS ===
  for (const dist of DISTANCE_MARKERS) {
    const p = project(dist, 0, 0, width, height, horizon, focalLength);
    if (!p || p.y < horizon + 5) continue;

    const pLeft = project(dist, 0, -50, width, height, horizon, focalLength);
    const pRight = project(dist, 0, 50, width, height, horizon, focalLength);
    if (pLeft && pRight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const greenR = Math.max(3, 14 * p.scale);
    const greenGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, greenR);
    greenGrad.addColorStop(0, 'rgba(34, 180, 34, 0.6)');
    greenGrad.addColorStop(0.6, 'rgba(34, 139, 34, 0.3)');
    greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, greenR, 0, 2 * Math.PI);
    ctx.fillStyle = greenGrad;
    ctx.fill();

    const flagHeight = Math.max(4, 14 * p.scale);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + p.scale * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - flagHeight);
    ctx.stroke();

    ctx.fillStyle = dist <= 150 ? 'rgba(255, 80, 80, 0.8)' : 'rgba(255, 200, 50, 0.7)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - flagHeight);
    ctx.lineTo(p.x + 4 * p.scale + 2, p.y - flagHeight + 2);
    ctx.lineTo(p.x, p.y - flagHeight + 4);
    ctx.closePath();
    ctx.fill();

    const distLabel = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + p.scale * 0.3})`;
    ctx.font = `${Math.max(8, Math.round(11 * p.scale))}px "DM Sans", system-ui`;
    ctx.textAlign = 'right';
    const labelP = project(dist, 0, 30, width, height, horizon, focalLength);
    if (labelP && labelP.x < width - 5) {
      ctx.fillText(distLabel, labelP.x, labelP.y - 2);
    }
  }

  // === TEE BOX ===
  const teeW = 44, teeH = 14;
  const teeGrad = ctx.createLinearGradient(
    width / 2 - teeW / 2, groundY - teeH / 2,
    width / 2 + teeW / 2, groundY + teeH / 2,
  );
  teeGrad.addColorStop(0, '#2d8a4e');
  teeGrad.addColorStop(1, '#1f6b38');
  ctx.fillStyle = teeGrad;
  ctx.beginPath();
  ctx.roundRect(width / 2 - teeW / 2, groundY - teeH / 2, teeW, teeH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(width / 2 - teeW / 2, groundY - teeH / 2, teeW, teeH, 4);
  ctx.stroke();

  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(width / 2 - 10, groundY, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2 + 10, groundY, 3, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '9px "DM Sans", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('TEE', width / 2, groundY + 20);

  // === PREVIOUS LANDINGS ===
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const lp = project(lx, 0, lz, width, height, horizon, focalLength);
    if (!lp || lp.y < horizon) continue;

    const r = Math.max(2, 4 * lp.scale);
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, r * 2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // === PREDICTIVE LANDING ZONE ===
  if (trajectory && trajectory.length > 2 && animationProgress > 0) {
    const finalPoint = trajectory[trajectory.length - 1];
    const landX = finalPoint.x * M_TO_YARDS;
    const landZ = finalPoint.z * M_TO_YARDS;
    const landP = project(landX, 0, landZ, width, height, horizon, focalLength);

    if (landP && landP.y > horizon) {
      const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
      const landR = Math.max(4, 12 * landP.scale);

      ctx.strokeStyle = `rgba(255, 204, 51, ${0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(landP.x, landP.y, landR * 2, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(landP.x, landP.y, landR, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 204, 51, ${0.15 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 204, 51, ${0.6 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (animationProgress < 1) {
        const landDist = units === 'metric'
          ? `${Math.round(landX * YARDS_TO_METRES)}m`
          : `${Math.round(landX)} yds`;
        ctx.font = `${Math.max(9, Math.round(11 * landP.scale))}px "DM Sans", system-ui`;
        ctx.textAlign = 'center';
        const tw = ctx.measureText(landDist).width + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(landP.x - tw / 2, landP.y - landR * 2 - 18, tw, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#ffcc33';
        ctx.fillText(landDist, landP.x, landP.y - landR * 2 - 6);
      }
    }
  }

  // === BALL FLIGHT (3D in sky) ===
  if (trajectory && animationProgress > 0) {
    const pointCount = Math.floor(trajectory.length * animationProgress);

    // Trail
    if (pointCount > 1) {
      // Ground shadow trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < pointCount; i++) {
        const p = trajectory[i];
        const sp = project(p.x * M_TO_YARDS, 0, p.z * M_TO_YARDS, width, height, horizon, focalLength);
        if (!sp) continue;
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();

      // Ball trail (Toptracer gradient red → gold → white)
      for (let i = 1; i < pointCount; i++) {
        const p = trajectory[i];
        const prev = trajectory[i - 1];
        const pp = project(p.x * M_TO_YARDS, p.y * M_TO_YARDS, p.z * M_TO_YARDS, width, height, horizon, focalLength);
        const prevP = project(prev.x * M_TO_YARDS, prev.y * M_TO_YARDS, prev.z * M_TO_YARDS, width, height, horizon, focalLength);
        if (!pp || !prevP) continue;

        const t = i / trajectory.length;
        const r = 255;
        const g = Math.round(80 + t * 175);
        const b = Math.round(t > 0.6 ? (t - 0.6) / 0.4 * 180 : 30);
        const alpha = 0.15 + (i / pointCount) * 0.55;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = Math.max(1.5, 2.5 * pp.scale);
        ctx.moveTo(prevP.x, prevP.y);
        ctx.lineTo(pp.x, pp.y);
        ctx.stroke();
      }
    }

    // Current ball
    if (pointCount > 0 && pointCount <= trajectory.length) {
      const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
      const bp = project(
        current.x * M_TO_YARDS,
        current.y * M_TO_YARDS,
        current.z * M_TO_YARDS,
        width, height, horizon, focalLength,
      );
      if (bp) {
        const ballSize = Math.max(3, 7 * bp.scale);
        const isInSky = bp.y < horizon + 30;

        // Large outer glow (brighter when ball is in sky area)
        const glowR = ballSize * (isInSky ? 6 : 4);
        const glow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, glowR);
        glow.addColorStop(0, `rgba(255, 255, 255, ${isInSky ? 1 : 0.8})`);
        glow.addColorStop(0.15, `rgba(255, 240, 200, ${isInSky ? 0.6 : 0.35})`);
        glow.addColorStop(0.4, `rgba(255, 204, 51, ${isInSky ? 0.2 : 0.1})`);
        glow.addColorStop(1, 'rgba(255, 204, 51, 0)');
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, glowR, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();

        // Ball (white with subtle shading)
        const ballGrad = ctx.createRadialGradient(
          bp.x - ballSize * 0.3, bp.y - ballSize * 0.3, 0,
          bp.x, bp.y, ballSize,
        );
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.7, '#f0f0f0');
        ballGrad.addColorStop(1, '#d0d0d0');
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, ballSize, 0, 2 * Math.PI);
        ctx.fillStyle = ballGrad;
        ctx.fill();

        // Vertical dashed line to ground shadow
        const shadowP = project(current.x * M_TO_YARDS, 0, current.z * M_TO_YARDS, width, height, horizon, focalLength);
        if (shadowP && current.y * M_TO_YARDS > 3) {
          ctx.strokeStyle = 'rgba(255, 204, 51, 0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(bp.x, bp.y);
          ctx.lineTo(shadowP.x, shadowP.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Shadow circle on ground
          const shadowSize = Math.max(2, 4 * shadowP.scale);
          ctx.beginPath();
          ctx.arc(shadowP.x, shadowP.y, shadowSize, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fill();
        }
      }
    }
  }
}

// ==================== MAIN COMPONENT ====================
export default function RangeCanvas({ width, height, trajectory, animationProgress, shotLandings, units, viewType }: RangeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    if (viewType === 'birdseye') {
      drawBirdsEye(ctx, width, height, trajectory, animationProgress, shotLandings, units);
    } else {
      drawGroundView(ctx, width, height, trajectory, animationProgress, shotLandings, units);
    }
  }, [width, height, trajectory, animationProgress, shotLandings, units, viewType]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-xl"
    />
  );
}
