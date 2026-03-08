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
  const horizon = height * 0.35;
  const groundY = height - 16;
  const focalLength = 60;

  // --- Projection helpers ---
  // Ground projection (no height component)
  const projectG = (fwd: number, lat: number): { x: number; y: number; scale: number } | null => {
    const depth = fwd + focalLength;
    if (depth <= 0) return null;
    const scale = focalLength / depth;
    const gndY = groundY - (groundY - horizon) * (1 - scale);
    return { x: width / 2 + lat * scale * 3.5, y: gndY, scale };
  };

  // Ball projection with dynamic height scaling
  // Compute maxApex from trajectory so the apex always reaches ~15% from top
  let heightScale = 1;
  if (trajectory && trajectory.length > 2) {
    const maxH = Math.max(...trajectory.map(p => p.y)) * M_TO_YARDS;
    // Find where the apex point lands on the ground (to get its gndY)
    const apexPt = trajectory.reduce((m, p) => p.y > m.y ? p : m, trajectory[0]);
    const apexFwd = apexPt.x * M_TO_YARDS;
    const apexGnd = projectG(apexFwd, 0);
    if (apexGnd && maxH > 0) {
      // We want the apex to reach screen y = height * 0.08 (near top, in sky)
      const targetScreenY = height * 0.08;
      const availablePx = apexGnd.y - targetScreenY;
      heightScale = availablePx / maxH;
    }
  }
  // Ensure minimum scale so even tiny shots show a visible arc
  heightScale = Math.max(heightScale, 2);

  const projectH = (fwd: number, h: number, lat: number): { x: number; y: number; scale: number } | null => {
    const gp = projectG(fwd, lat);
    if (!gp) return null;
    return { x: gp.x, y: gp.y - h * heightScale, scale: gp.scale };
  };

  // === SKY — bright blue like real outdoor range ===
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
  skyGrad.addColorStop(0, '#1a6bc4');
  skyGrad.addColorStop(0.25, '#2b80d4');
  skyGrad.addColorStop(0.5, '#4a9ae0');
  skyGrad.addColorStop(0.75, '#6db8ec');
  skyGrad.addColorStop(0.9, '#8ecdf2');
  skyGrad.addColorStop(1, '#b0dff8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizon);

  // === CLOUDS ===
  const drawCloud = (cx: number, cy: number, size: number, alpha: number) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    const blobs: [number, number, number][] = [
      [0, 0, size],
      [-size * 0.8, size * 0.1, size * 0.6],
      [size * 0.7, size * 0.12, size * 0.55],
      [-size * 0.35, -size * 0.35, size * 0.55],
      [size * 0.4, -size * 0.3, size * 0.5],
      [-size * 1.2, size * 0.2, size * 0.4],
      [size * 1.1, size * 0.15, size * 0.35],
    ];
    for (const [ox, oy, r] of blobs) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  };
  drawCloud(width * 0.15, horizon * 0.3, 14, 0.35);
  drawCloud(width * 0.55, horizon * 0.2, 18, 0.3);
  drawCloud(width * 0.82, horizon * 0.4, 12, 0.25);
  drawCloud(width * 0.35, horizon * 0.55, 16, 0.2);
  drawCloud(width * 0.7, horizon * 0.65, 13, 0.15);

  // === MOUNTAINS ===
  // Far mountain range (bluish/hazy)
  ctx.fillStyle = '#5a8aaa';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 3) {
    const mh = Math.sin(x * 0.008) * 22 + Math.sin(x * 0.02) * 12 + Math.cos(x * 0.005) * 15 + 28;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // Near mountain range (darker, greener)
  ctx.fillStyle = '#3d6a4a';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 3) {
    const mh = Math.sin(x * 0.012 + 1) * 14 + Math.sin(x * 0.03) * 8 + Math.cos(x * 0.007 + 2) * 10 + 16;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // === TREE LINE at horizon ===
  ctx.fillStyle = '#1a4a28';
  for (let tx = 0; tx < width; tx += 10) {
    const th = 5 + Math.sin(tx * 0.25) * 3 + Math.cos(tx * 0.15) * 2 + Math.sin(tx * 0.08) * 2;
    ctx.beginPath();
    ctx.arc(tx, horizon, th, Math.PI, 0);
    ctx.fill();
  }
  // Tree highlights
  ctx.fillStyle = '#246633';
  for (let tx = 4; tx < width; tx += 16) {
    const th = 2.5 + Math.sin(tx * 0.35) * 1.5;
    ctx.beginPath();
    ctx.arc(tx, horizon - 2, th, Math.PI, 0);
    ctx.fill();
  }

  // === FAIRWAY — bright vivid green ===
  const fairwayGrad = ctx.createLinearGradient(0, horizon, 0, height);
  fairwayGrad.addColorStop(0, '#1a6630');
  fairwayGrad.addColorStop(0.15, '#208838');
  fairwayGrad.addColorStop(0.4, '#28a045');
  fairwayGrad.addColorStop(0.7, '#30b050');
  fairwayGrad.addColorStop(1, '#38c058');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Mowing stripes
  for (let d = 10; d < 320; d += 12) {
    const p = projectG(d, 0);
    if (!p || p.y < horizon) continue;
    const stripe = projectG(d + 6, 0);
    if (!stripe) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, p.y, width, stripe.y - p.y);
  }

  // === DISTANCE MARKERS & FLAGS ===
  for (const dist of DISTANCE_MARKERS) {
    const p = projectG(dist, 0);
    if (!p || p.y < horizon + 3) continue;

    // Distance line
    const pLeft = projectG(dist, -50);
    const pRight = projectG(dist, 50);
    if (pLeft && pRight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Target green
    const greenR = Math.max(3, 14 * p.scale);
    const greenGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, greenR);
    greenGrad.addColorStop(0, 'rgba(34, 200, 34, 0.5)');
    greenGrad.addColorStop(0.6, 'rgba(34, 160, 34, 0.25)');
    greenGrad.addColorStop(1, 'rgba(34, 139, 34, 0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, greenR, 0, 2 * Math.PI);
    ctx.fillStyle = greenGrad;
    ctx.fill();

    // Flag pin
    const flagHeight = Math.max(5, 16 * p.scale);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + p.scale * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - flagHeight);
    ctx.stroke();

    ctx.fillStyle = dist <= 150 ? '#ee4444' : '#eecc33';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - flagHeight);
    ctx.lineTo(p.x + Math.max(3, 5 * p.scale), p.y - flagHeight + 2.5);
    ctx.lineTo(p.x, p.y - flagHeight + 5);
    ctx.closePath();
    ctx.fill();

    // Distance label
    const distLabel = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + p.scale * 0.35})`;
    ctx.font = `bold ${Math.max(8, Math.round(11 * p.scale))}px "DM Sans", system-ui`;
    ctx.textAlign = 'right';
    const labelP = projectG(dist, 25);
    if (labelP && labelP.x < width - 5) {
      ctx.fillText(distLabel, labelP.x, labelP.y - 2);
    }
  }

  // === TEE AREA (bottom of screen) ===
  const teeW = 50, teeH = 10;
  const teeGrad = ctx.createLinearGradient(
    width / 2 - teeW / 2, groundY - teeH,
    width / 2 + teeW / 2, groundY,
  );
  teeGrad.addColorStop(0, '#35a855');
  teeGrad.addColorStop(1, '#2a9048');
  ctx.fillStyle = teeGrad;
  ctx.beginPath();
  ctx.roundRect(width / 2 - teeW / 2, groundY - teeH, teeW, teeH, 3);
  ctx.fill();

  // Tee markers
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(width / 2 - 10, groundY - teeH / 2, 2.5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width / 2 + 10, groundY - teeH / 2, 2.5, 0, 2 * Math.PI);
  ctx.fill();

  // Ball on tee (when no shot in progress)
  if (!trajectory || animationProgress === 0) {
    ctx.beginPath();
    ctx.arc(width / 2, groundY - teeH - 4, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // === PREVIOUS LANDINGS ===
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const lp = projectG(lx, lz);
    if (!lp || lp.y < horizon) continue;

    const r = Math.max(2, 4 * lp.scale);
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
  }

  // === PREDICTIVE LANDING ZONE ===
  if (trajectory && trajectory.length > 2 && animationProgress > 0) {
    const finalPoint = trajectory[trajectory.length - 1];
    const landX = finalPoint.x * M_TO_YARDS;
    const landZ = finalPoint.z * M_TO_YARDS;
    const landP = projectG(landX, landZ);

    if (landP && landP.y > horizon) {
      const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
      const landR = Math.max(4, 10 * landP.scale);

      // Target circle on ground
      ctx.strokeStyle = `rgba(255, 220, 50, ${0.5 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(landP.x, landP.y, landR, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 220, 50, ${0.12 * pulse})`;
      ctx.beginPath();
      ctx.arc(landP.x, landP.y, landR, 0, 2 * Math.PI);
      ctx.fill();

      // Landing distance label
      if (animationProgress < 1) {
        const landDist = units === 'metric'
          ? `${Math.round(landX * YARDS_TO_METRES)}m`
          : `${Math.round(landX)} yds`;
        ctx.font = `bold ${Math.max(9, Math.round(11 * landP.scale))}px "DM Sans", system-ui`;
        ctx.textAlign = 'center';
        const tw = ctx.measureText(landDist).width + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(landP.x - tw / 2, landP.y - landR - 20, tw, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#ffdd44';
        ctx.fillText(landDist, landP.x, landP.y - landR - 8);
      }
    }
  }

  // === BALL FLIGHT — bright visible trail ===
  if (trajectory && animationProgress > 0) {
    const pointCount = Math.floor(trajectory.length * animationProgress);

    if (pointCount > 1) {
      // Outer glow trail (wider, softer)
      ctx.shadowColor = 'rgba(255, 255, 100, 0.5)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < pointCount; i++) {
        const p = trajectory[i];
        const pp = projectH(p.x * M_TO_YARDS, p.y * M_TO_YARDS, p.z * M_TO_YARDS);
        if (!pp) continue;
        if (i === 0) ctx.moveTo(pp.x, pp.y);
        else ctx.lineTo(pp.x, pp.y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 120, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner bright trail
      ctx.beginPath();
      for (let i = 0; i < pointCount; i++) {
        const p = trajectory[i];
        const pp = projectH(p.x * M_TO_YARDS, p.y * M_TO_YARDS, p.z * M_TO_YARDS);
        if (!pp) continue;
        if (i === 0) ctx.moveTo(pp.x, pp.y);
        else ctx.lineTo(pp.x, pp.y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 200, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Vertical yellow line at landing point
      if (animationProgress >= 1) {
        const finalP = trajectory[trajectory.length - 1];
        const landScreen = projectG(finalP.x * M_TO_YARDS, finalP.z * M_TO_YARDS);
        const ballTop = projectH(finalP.x * M_TO_YARDS, 8, finalP.z * M_TO_YARDS);
        if (landScreen && ballTop) {
          ctx.strokeStyle = 'rgba(255, 255, 120, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(landScreen.x, landScreen.y);
          ctx.lineTo(ballTop.x, ballTop.y);
          ctx.stroke();
        }
      }
    }

    // Current ball
    if (pointCount > 0 && pointCount <= trajectory.length) {
      const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
      const bp = projectH(current.x * M_TO_YARDS, current.y * M_TO_YARDS, current.z * M_TO_YARDS);
      if (bp) {
        const ballSize = Math.max(4, 7 * bp.scale);

        // Vertical line from ball down to ground
        const shadowP = projectG(current.x * M_TO_YARDS, current.z * M_TO_YARDS);
        if (shadowP && current.y * M_TO_YARDS > 1) {
          ctx.strokeStyle = 'rgba(255, 255, 120, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bp.x, bp.y);
          ctx.lineTo(shadowP.x, shadowP.y);
          ctx.stroke();

          // Ground shadow
          const sr = Math.max(2, 3 * shadowP.scale);
          ctx.beginPath();
          ctx.arc(shadowP.x, shadowP.y, sr, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fill();
        }

        // Ball glow
        const glow = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, ballSize * 4);
        glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
        glow.addColorStop(0.2, 'rgba(255, 255, 150, 0.5)');
        glow.addColorStop(0.5, 'rgba(255, 255, 100, 0.15)');
        glow.addColorStop(1, 'rgba(255, 255, 100, 0)');
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, ballSize * 4, 0, 2 * Math.PI);
        ctx.fillStyle = glow;
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, ballSize, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
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
