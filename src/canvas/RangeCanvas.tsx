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

// ==================== GROUND-LEVEL VIEW ====================
// Photorealistic driving range scene. Ball flight avoids shadowBlur,
// shadowColor, and createRadialGradient which fail on iPad Safari.

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
  const groundH = groundY - horizon;
  const FL = 60;
  const cx = width / 2;

  const fwdToGndY = (fwd: number) => {
    const s = FL / (fwd + FL);
    return groundY - groundH * (1 - s);
  };
  const scaleAt = (fwd: number) => FL / (fwd + FL);

  // =================== SKY ===================
  // Rich gradient — warm golden light near horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
  skyGrad.addColorStop(0, '#0d47a1');
  skyGrad.addColorStop(0.2, '#1565c0');
  skyGrad.addColorStop(0.45, '#42a5f5');
  skyGrad.addColorStop(0.7, '#90caf9');
  skyGrad.addColorStop(0.88, '#c8e6fa');
  skyGrad.addColorStop(0.96, '#e8dcc8');
  skyGrad.addColorStop(1, '#f5e6c8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizon + 2);

  // Sun glow (concentric circles, no radialGradient)
  const sunX = width * 0.75;
  const sunY = horizon * 0.25;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 40, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 248, 220, 0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 22, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 250, 230, 0.2)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sunX, sunY, 10, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 240, 0.6)';
  ctx.fill();

  // Clouds with depth
  const drawCloud = (cloudX: number, cloudY: number, size: number, alpha: number) => {
    // Shadow layer
    ctx.fillStyle = `rgba(160, 180, 200, ${alpha * 0.3})`;
    for (const [ox, oy, r] of [
      [0, size * 0.15, size * 0.95], [-size * 0.7, size * 0.2, size * 0.55],
      [size * 0.65, size * 0.22, size * 0.5],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(cloudX + ox, cloudY + oy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    // White top layer
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    for (const [ox, oy, r] of [
      [0, 0, size], [-size * 0.8, size * 0.05, size * 0.6],
      [size * 0.7, size * 0.08, size * 0.55], [-size * 0.35, -size * 0.3, size * 0.55],
      [size * 0.4, -size * 0.25, size * 0.5],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(cloudX + ox, cloudY + oy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  };
  drawCloud(width * 0.12, horizon * 0.28, 16, 0.5);
  drawCloud(width * 0.52, horizon * 0.18, 20, 0.45);
  drawCloud(width * 0.85, horizon * 0.38, 13, 0.35);
  drawCloud(width * 0.35, horizon * 0.52, 14, 0.25);

  // =================== MOUNTAINS ===================
  // Far range (hazy blue-purple)
  ctx.fillStyle = '#6b8caa';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 2) {
    const mh = Math.sin(x * 0.006) * 28 + Math.sin(x * 0.018) * 14
      + Math.cos(x * 0.004) * 18 + Math.sin(x * 0.035) * 6 + 32;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // Mid range (green-grey)
  ctx.fillStyle = '#4a7058';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 2) {
    const mh = Math.sin(x * 0.01 + 1) * 18 + Math.sin(x * 0.025) * 10
      + Math.cos(x * 0.006 + 2) * 12 + Math.sin(x * 0.04) * 4 + 20;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon);
  ctx.closePath();
  ctx.fill();

  // Atmospheric haze at horizon
  const hazeGrad = ctx.createLinearGradient(0, horizon - 8, 0, horizon + 4);
  hazeGrad.addColorStop(0, 'rgba(200, 215, 230, 0)');
  hazeGrad.addColorStop(0.5, 'rgba(200, 215, 230, 0.25)');
  hazeGrad.addColorStop(1, 'rgba(200, 215, 230, 0)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, horizon - 8, width, 12);

  // Tree line (varied sizes and shades)
  for (let tx = 0; tx < width; tx += 6) {
    const th = 6 + Math.sin(tx * 0.2) * 3 + Math.cos(tx * 0.13) * 2 + Math.sin(tx * 0.07) * 2;
    // Dark base
    ctx.fillStyle = '#0f3318';
    ctx.beginPath();
    ctx.arc(tx, horizon + 1, th, Math.PI, 0);
    ctx.fill();
    // Lighter canopy highlights
    ctx.fillStyle = '#1a5428';
    ctx.beginPath();
    ctx.arc(tx, horizon - 1, th * 0.7, Math.PI, 0);
    ctx.fill();
  }

  // =================== FAIRWAY ===================
  // Rich green gradient with depth
  const fairwayGrad = ctx.createLinearGradient(0, horizon, 0, height);
  fairwayGrad.addColorStop(0, '#15582a');
  fairwayGrad.addColorStop(0.15, '#1c7035');
  fairwayGrad.addColorStop(0.35, '#238a40');
  fairwayGrad.addColorStop(0.6, '#2da04a');
  fairwayGrad.addColorStop(0.85, '#36b454');
  fairwayGrad.addColorStop(1, '#3ec060');
  ctx.fillStyle = fairwayGrad;
  ctx.fillRect(0, horizon, width, height - horizon);

  // Mowing stripes (alternating light/dark bands)
  for (let d = 8; d < 320; d += 10) {
    const y1 = fwdToGndY(d);
    const y2 = fwdToGndY(d + 5);
    if (y1 < horizon) continue;
    const stripeH = y1 - y2;
    if (stripeH < 0.5) continue;
    ctx.fillStyle = d % 20 < 10 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, y2, width, stripeH);
  }

  // Rough edges (darker strips on sides)
  const roughW = width * 0.08;
  const roughGradL = ctx.createLinearGradient(0, 0, roughW, 0);
  roughGradL.addColorStop(0, 'rgba(10, 50, 20, 0.35)');
  roughGradL.addColorStop(1, 'rgba(10, 50, 20, 0)');
  ctx.fillStyle = roughGradL;
  ctx.fillRect(0, horizon, roughW, height - horizon);
  const roughGradR = ctx.createLinearGradient(width, 0, width - roughW, 0);
  roughGradR.addColorStop(0, 'rgba(10, 50, 20, 0.35)');
  roughGradR.addColorStop(1, 'rgba(10, 50, 20, 0)');
  ctx.fillStyle = roughGradR;
  ctx.fillRect(width - roughW, horizon, roughW, height - horizon);

  // =================== DISTANCE MARKERS ===================
  for (const dist of DISTANCE_MARKERS) {
    const y = fwdToGndY(dist);
    if (y < horizon + 4) continue;
    const s = scaleAt(dist);

    // Subtle distance line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - 90 * s, y);
    ctx.lineTo(cx + 90 * s, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Flag pin
    const fh = Math.max(8, 18 * s);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + s * 0.4})`;
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - fh);
    ctx.stroke();

    // Flag
    const flagW = Math.max(4, 7 * s);
    ctx.fillStyle = dist <= 150 ? '#e53935' : '#fdd835';
    ctx.beginPath();
    ctx.moveTo(cx, y - fh);
    ctx.lineTo(cx + flagW, y - fh + 3);
    ctx.lineTo(cx, y - fh + 6);
    ctx.closePath();
    ctx.fill();

    // Green circle on ground
    const greenR = Math.max(3, 8 * s);
    ctx.beginPath();
    ctx.arc(cx, y, greenR, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 80, 0, 0.2)';
    ctx.fill();

    // Distance label with dark pill background
    const dl = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}m` : `${dist}`;
    const fontSize = Math.max(9, Math.round(12 * s));
    ctx.font = `bold ${fontSize}px "DM Sans", system-ui`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(dl).width + 12;
    const labelX = cx + Math.max(18, 30 * s);
    const labelY = y - 2;

    // Pill background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(labelX - tw / 2, labelY - fontSize / 2 - 3, tw, fontSize + 6, fontSize / 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dl, labelX, labelY + fontSize * 0.35);
  }

  // =================== TEE BOX ===================
  const teeW = 54, teeH = 12;
  // Tee mat
  const teeGrad = ctx.createLinearGradient(cx - teeW / 2, groundY - teeH, cx + teeW / 2, groundY);
  teeGrad.addColorStop(0, '#2d9050');
  teeGrad.addColorStop(0.5, '#35a858');
  teeGrad.addColorStop(1, '#2d9050');
  ctx.fillStyle = teeGrad;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, groundY - teeH, teeW, teeH, 4);
  ctx.fill();
  // Tee mat border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, groundY - teeH, teeW, teeH, 4);
  ctx.stroke();

  // Tee markers
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath();
  ctx.arc(cx - 12, groundY - teeH / 2, 3, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 12, groundY - teeH / 2, 3, 0, 2 * Math.PI);
  ctx.fill();

  // Ball on tee when idle
  if (!trajectory || animationProgress === 0) {
    // Tee peg
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(cx - 0.5, groundY - teeH - 5, 1, 5);
    // Ball
    ctx.beginPath();
    ctx.arc(cx, groundY - teeH - 6, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // =================== PREVIOUS LANDINGS ===================
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const ly = fwdToGndY(lx);
    if (ly < horizon) continue;
    const s = scaleAt(lx);
    const lsx = cx + lz * s * (width / 60);
    const r = Math.max(2, 4 * s);
    // Divot mark
    ctx.beginPath();
    ctx.arc(lsx, ly, r, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lsx, ly, r + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // =================== BALL FLIGHT ===================
  if (!trajectory || trajectory.length < 3 || animationProgress <= 0) return;

  // Height scale: apex reaches ~10% from top of canvas
  let maxH = 0;
  let apexFwd = 0;
  for (let i = 0; i < trajectory.length; i++) {
    const hy = trajectory[i].y * M_TO_YARDS;
    if (hy > maxH) { maxH = hy; apexFwd = trajectory[i].x * M_TO_YARDS; }
  }
  const apexGndY = fwdToGndY(apexFwd);
  const targetY = height * 0.10;
  const hScale = maxH > 0 ? Math.max((apexGndY - targetY) / maxH, 2) : 2;

  const toScreen = (p: TrajectoryPoint) => {
    const fwd = p.x * M_TO_YARDS;
    const h = p.y * M_TO_YARDS;
    const lat = p.z * M_TO_YARDS;
    const s = scaleAt(fwd);
    const sx = cx + lat * s * (width / 60);
    const sy = fwdToGndY(fwd) - h * hScale;
    return { x: sx, y: sy, s };
  };

  const pointCount = Math.floor(trajectory.length * animationProgress);
  if (pointCount < 1) return;

  // Landing zone (pulsing target)
  const finalPt = trajectory[trajectory.length - 1];
  const landFwd = finalPt.x * M_TO_YARDS;
  const landGndY = fwdToGndY(landFwd);
  const landS = scaleAt(landFwd);
  const landSx = cx + finalPt.z * M_TO_YARDS * landS * (width / 60);
  const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
  const landR = Math.max(5, 12 * landS);

  // Outer ring
  ctx.strokeStyle = `rgba(255, 220, 50, ${0.4 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(landSx, landGndY, landR + 4, 0, 2 * Math.PI);
  ctx.stroke();
  // Inner ring
  ctx.strokeStyle = `rgba(255, 220, 50, ${0.6 * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(landSx, landGndY, landR, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 220, 50, ${0.1 * pulse})`;
  ctx.beginPath();
  ctx.arc(landSx, landGndY, landR, 0, 2 * Math.PI);
  ctx.fill();

  // Landing distance label (always visible during animation)
  if (animationProgress < 1) {
    const dl = units === 'metric'
      ? `${Math.round(landFwd * YARDS_TO_METRES)}m`
      : `${Math.round(landFwd)} yds`;
    const lfs = Math.max(10, Math.round(12 * landS));
    ctx.font = `bold ${lfs}px "DM Sans", system-ui`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(dl).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(landSx - tw / 2, landGndY - landR - 24, tw, lfs + 10, lfs / 2);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(dl, landSx, landGndY - landR - 24 + lfs + 2);
  }

  // Trail — outer glow (wider, semi-transparent)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 200, 50, 0.25)';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < pointCount; i++) {
    const sp = toScreen(trajectory[i]);
    if (i === 0) ctx.moveTo(sp.x, sp.y);
    else ctx.lineTo(sp.x, sp.y);
  }
  ctx.stroke();
  ctx.restore();

  // Trail — Toptracer color gradient (red → orange → yellow → white)
  for (let i = 1; i < pointCount; i++) {
    const prev = toScreen(trajectory[i - 1]);
    const cur = toScreen(trajectory[i]);
    const t = i / trajectory.length;
    const r = 255;
    const g = Math.round(60 + t * 195);
    const b = Math.round(t > 0.6 ? (t - 0.6) / 0.4 * 255 : 30);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Landing vertical line
  if (animationProgress >= 1) {
    const lastSp = toScreen(trajectory[trajectory.length - 1]);
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(lastSp.x, lastSp.y);
    ctx.lineTo(landSx, landGndY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Current ball
  const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
  const bp = toScreen(current);
  const ballSize = Math.max(5, 8 * bp.s);

  // Drop line to ground
  const curGndY = fwdToGndY(current.x * M_TO_YARDS);
  if (current.y * M_TO_YARDS > 1) {
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(bp.x, bp.y);
    ctx.lineTo(bp.x, curGndY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(bp.x, curGndY, Math.max(3, 6 * bp.s), Math.max(1.5, 2 * bp.s), 0, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();
  }

  // Ball glow (concentric circles)
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 3.5, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 220, 80, 0.06)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 2.2, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 235, 130, 0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 1.3, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255, 255, 220, 0.25)';
  ctx.fill();

  // Ball
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Ball highlight
  ctx.beginPath();
  ctx.arc(bp.x - ballSize * 0.2, bp.y - ballSize * 0.2, ballSize * 0.4, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  // Distance label while animating
  if (animationProgress < 1) {
    const dist = current.x * M_TO_YARDS;
    const label = units === 'metric'
      ? `${Math.round(dist * YARDS_TO_METRES)}m`
      : `${Math.round(dist)} yds`;
    const fs = 11;
    ctx.font = `bold ${fs}px "DM Sans", system-ui`;
    ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(bp.x + ballSize + 8, bp.y - fs / 2 - 4, tw, fs + 8, fs / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, bp.x + ballSize + 14, bp.y + fs * 0.35);
  }

  // Final carry distance pill (shown when animation complete)
  if (animationProgress >= 1) {
    const carryYds = finalPt.x * M_TO_YARDS;
    const carryLabel = units === 'metric'
      ? `${Math.round(carryYds * YARDS_TO_METRES)}m carry`
      : `${Math.round(carryYds)} yds carry`;
    const cfs = 12;
    ctx.font = `bold ${cfs}px "DM Sans", system-ui`;
    ctx.textAlign = 'center';
    const ctw = ctx.measureText(carryLabel).width + 18;
    const clx = landSx;
    const cly = landGndY - landR - 26;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(clx - ctw / 2, cly - cfs / 2 - 5, ctw, cfs + 10, cfs / 2);
    ctx.fill();
    ctx.fillStyle = '#ffdd44';
    ctx.fillText(carryLabel, clx, cly + cfs * 0.35);
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
