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
// Premium driving range scene. No shadowBlur / radialGradient (iPad Safari).

function drawGroundView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  trajectory: TrajectoryPoint[] | null,
  animationProgress: number,
  shotLandings: Array<{ x: number; z: number; club: string }>,
  units: UnitSystem,
) {
  // --- LAYOUT ---
  const horizon = height * 0.32;
  const groundY = height - 12;
  const groundH = groundY - horizon;
  // Higher focal length = less compression, markers spread out more
  const FL = 120;
  const cx = width / 2;

  const fwdToGndY = (fwd: number) => {
    const s = FL / (fwd + FL);
    return groundY - groundH * (1 - s);
  };
  const scaleAt = (fwd: number) => FL / (fwd + FL);

  // ====================== SKY ======================
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon + 4);
  skyGrad.addColorStop(0, '#0a1628');
  skyGrad.addColorStop(0.15, '#0f2844');
  skyGrad.addColorStop(0.35, '#1a4a78');
  skyGrad.addColorStop(0.55, '#2d6da0');
  skyGrad.addColorStop(0.72, '#5a9ec8');
  skyGrad.addColorStop(0.85, '#8ec4e0');
  skyGrad.addColorStop(0.93, '#bdd8e8');
  skyGrad.addColorStop(1, '#d0ddd0');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizon + 4);

  // Atmospheric glow near horizon (warm)
  const horizonGlow = ctx.createLinearGradient(0, horizon - 20, 0, horizon + 4);
  horizonGlow.addColorStop(0, 'rgba(220, 210, 180, 0)');
  horizonGlow.addColorStop(0.6, 'rgba(220, 210, 180, 0.08)');
  horizonGlow.addColorStop(1, 'rgba(200, 200, 180, 0.12)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, horizon - 20, width, 24);

  // Clouds — soft, layered, volumetric look
  const drawCloud = (baseX: number, baseY: number, scale: number, opacity: number) => {
    const puffs: [number, number, number][] = [
      [0, 0, 1], [-0.9, 0.1, 0.65], [0.85, 0.08, 0.6],
      [-0.4, -0.35, 0.5], [0.45, -0.3, 0.55], [0.15, 0.2, 0.7],
    ];
    // Underside shadow
    ctx.fillStyle = `rgba(100, 120, 140, ${opacity * 0.15})`;
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(baseX + px * scale, baseY + py * scale + scale * 0.2, pr * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bright tops
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(baseX + px * scale, baseY + py * scale, pr * scale * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  drawCloud(width * 0.18, horizon * 0.22, 18, 0.35);
  drawCloud(width * 0.58, horizon * 0.15, 22, 0.28);
  drawCloud(width * 0.82, horizon * 0.35, 14, 0.22);

  // ====================== MOUNTAINS ======================
  // Layer 1 — far (blue-grey, misty)
  const mtGrad1 = ctx.createLinearGradient(0, horizon - 55, 0, horizon);
  mtGrad1.addColorStop(0, '#6888a4');
  mtGrad1.addColorStop(1, '#8aa4b8');
  ctx.fillStyle = mtGrad1;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 1) {
    const mh = Math.sin(x * 0.005 + 0.3) * 30 + Math.sin(x * 0.013) * 15
      + Math.cos(x * 0.003 + 1) * 20 + Math.sin(x * 0.028) * 8 + 38;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon); ctx.closePath(); ctx.fill();

  // Snow caps on far mountains
  ctx.fillStyle = 'rgba(230, 235, 240, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 1) {
    const mh = Math.sin(x * 0.005 + 0.3) * 30 + Math.sin(x * 0.013) * 15
      + Math.cos(x * 0.003 + 1) * 20 + Math.sin(x * 0.028) * 8 + 38;
    const snowLine = mh > 50 ? mh - 6 : mh + 100; // only on peaks
    ctx.lineTo(x, horizon - snowLine);
  }
  ctx.lineTo(width, horizon); ctx.closePath(); ctx.fill();

  // Layer 2 — mid (forest green)
  const mtGrad2 = ctx.createLinearGradient(0, horizon - 30, 0, horizon);
  mtGrad2.addColorStop(0, '#2e5a3e');
  mtGrad2.addColorStop(1, '#3a6a4c');
  ctx.fillStyle = mtGrad2;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 1) {
    const mh = Math.sin(x * 0.009 + 2) * 18 + Math.sin(x * 0.022 + 1) * 10
      + Math.cos(x * 0.005 + 3) * 12 + Math.sin(x * 0.038) * 5 + 22;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon); ctx.closePath(); ctx.fill();

  // Layer 3 — near foothills (dark green)
  ctx.fillStyle = '#1e4830';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 1) {
    const mh = Math.sin(x * 0.015 + 4) * 8 + Math.cos(x * 0.008 + 1) * 6
      + Math.sin(x * 0.04) * 3 + 10;
    ctx.lineTo(x, horizon - mh);
  }
  ctx.lineTo(width, horizon); ctx.closePath(); ctx.fill();

  // Tree line — individual trees with variation
  for (let tx = -2; tx < width + 2; tx += 4) {
    const seed = Math.sin(tx * 0.37) * 0.5 + 0.5;
    const th = 4 + seed * 5;
    const treeY = horizon + 1;
    // Dark pine
    ctx.fillStyle = `rgb(${12 + seed * 15}, ${35 + seed * 20}, ${18 + seed * 12})`;
    ctx.beginPath();
    ctx.moveTo(tx, treeY);
    ctx.lineTo(tx - th * 0.4, treeY);
    ctx.lineTo(tx, treeY - th);
    ctx.lineTo(tx + th * 0.4, treeY);
    ctx.closePath();
    ctx.fill();
  }

  // ====================== FAIRWAY ======================
  // Base gradient — dark at distance, vivid near camera
  const fwGrad = ctx.createLinearGradient(0, horizon, 0, height);
  fwGrad.addColorStop(0, '#14462a');
  fwGrad.addColorStop(0.08, '#1a5832');
  fwGrad.addColorStop(0.25, '#1f6e3a');
  fwGrad.addColorStop(0.5, '#268840');
  fwGrad.addColorStop(0.75, '#2ea048');
  fwGrad.addColorStop(1, '#36b050');
  ctx.fillStyle = fwGrad;
  ctx.fillRect(0, horizon, width, height - horizon);

  // V-cut mowing stripes (perspective converging to center)
  for (let d = 5; d < 340; d += 8) {
    const y1 = fwdToGndY(d);
    const y2 = fwdToGndY(d + 4);
    if (y1 < horizon || y2 < horizon) continue;
    const stripeH = y1 - y2;
    if (stripeH < 0.3) continue;
    const isLight = Math.floor(d / 8) % 2 === 0;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.03)';
    ctx.fillRect(0, y2, width, stripeH);
  }

  // Center line — subtle guide stripe
  const clGrad = ctx.createLinearGradient(0, horizon, 0, groundY);
  clGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  clGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)');
  clGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
  ctx.fillStyle = clGrad;
  ctx.fillRect(cx - 1, horizon, 2, groundY - horizon);

  // Rough / fringe on edges
  const roughW = width * 0.12;
  const rGradL = ctx.createLinearGradient(0, 0, roughW, 0);
  rGradL.addColorStop(0, 'rgba(8, 30, 12, 0.5)');
  rGradL.addColorStop(0.5, 'rgba(8, 30, 12, 0.2)');
  rGradL.addColorStop(1, 'rgba(8, 30, 12, 0)');
  ctx.fillStyle = rGradL;
  ctx.fillRect(0, horizon, roughW, height - horizon);
  const rGradR = ctx.createLinearGradient(width, 0, width - roughW, 0);
  rGradR.addColorStop(0, 'rgba(8, 30, 12, 0.5)');
  rGradR.addColorStop(0.5, 'rgba(8, 30, 12, 0.2)');
  rGradR.addColorStop(1, 'rgba(8, 30, 12, 0)');
  ctx.fillStyle = rGradR;
  ctx.fillRect(width - roughW, horizon, roughW, height - horizon);

  // Bottom vignette (dark near camera, adds depth)
  const vigGrad = ctx.createLinearGradient(0, groundY - 40, 0, groundY);
  vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, groundY - 40, width, 40);

  // ====================== DISTANCE MARKERS ======================
  // Only render markers that have enough vertical separation (no overlap)
  const markerPositions: { dist: number; y: number; s: number }[] = [];
  for (const dist of DISTANCE_MARKERS) {
    const y = fwdToGndY(dist);
    if (y < horizon + 8 || y > groundY - 30) continue;
    markerPositions.push({ dist, y, s: scaleAt(dist) });
  }

  // Filter out overlapping labels (need ≥14px gap)
  const visibleMarkers: typeof markerPositions = [];
  for (const m of markerPositions) {
    const tooClose = visibleMarkers.some(v => Math.abs(v.y - m.y) < 14);
    if (!tooClose) visibleMarkers.push(m);
  }

  for (const { dist, y, s } of visibleMarkers) {
    // Horizontal distance line
    const halfW = Math.max(30, 100 * s);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - halfW, y);
    ctx.lineTo(cx + halfW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target green (ellipse)
    const gw = Math.max(6, 14 * s);
    const gh = Math.max(2, 4 * s);
    ctx.beginPath();
    ctx.ellipse(cx, y, gw, gh, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20, 100, 40, 0.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Flag pin
    const fh = Math.max(10, 22 * s);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + s * 0.4})`;
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - fh);
    ctx.stroke();

    // Flag
    const flagW = Math.max(5, 8 * s);
    const flagH = Math.max(4, 6 * s);
    ctx.fillStyle = dist <= 150 ? '#e53935' : '#fdd835';
    ctx.beginPath();
    ctx.moveTo(cx + 1, y - fh);
    ctx.lineTo(cx + 1 + flagW, y - fh + flagH * 0.4);
    ctx.lineTo(cx + 1, y - fh + flagH);
    ctx.closePath();
    ctx.fill();

    // ---- Distance label (right side, pill badge) ----
    const dl = units === 'metric' ? `${Math.round(dist * YARDS_TO_METRES)}` : `${dist}`;
    const unit = units === 'metric' ? 'm' : 'y';
    const fontSize = Math.max(10, Math.round(13 * s));
    ctx.font = `700 ${fontSize}px "DM Sans", system-ui`;
    const numW = ctx.measureText(dl).width;
    ctx.font = `500 ${fontSize - 2}px "DM Sans", system-ui`;
    const unitW = ctx.measureText(unit).width;
    const pillW = numW + unitW + 14;
    const pillH = fontSize + 8;
    const pillX = width - 8 - pillW; // right-aligned
    const pillY = y - pillH / 2;

    // Pill background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    // Accent bar on left of pill
    ctx.fillStyle = dist <= 150 ? 'rgba(229, 57, 53, 0.8)' : 'rgba(253, 216, 53, 0.7)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, 3, pillH, 1.5);
    ctx.fill();

    // Number
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${fontSize}px "DM Sans", system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText(dl, pillX + 8, pillY + pillH - (pillH - fontSize) / 2 - 1);
    // Unit
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `500 ${fontSize - 2}px "DM Sans", system-ui`;
    ctx.fillText(unit, pillX + 8 + numW + 2, pillY + pillH - (pillH - fontSize) / 2 - 1);

    // Connecting line from pill to flag
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cx + halfW, y);
    ctx.lineTo(pillX, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ====================== TEE BOX ======================
  const teeW = 56, teeH = 14;
  const teeTop = groundY - teeH;
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 1, teeW / 2 + 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mat
  const matGrad = ctx.createLinearGradient(cx, teeTop, cx, groundY);
  matGrad.addColorStop(0, '#2a9852');
  matGrad.addColorStop(0.5, '#34b060');
  matGrad.addColorStop(1, '#2a9050');
  ctx.fillStyle = matGrad;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeTop, teeW, teeH, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - teeW / 2, teeTop, teeW, teeH, 5);
  ctx.stroke();

  // Tee markers
  for (const ox of [-14, 14]) {
    ctx.fillStyle = '#f0c830';
    ctx.beginPath();
    ctx.arc(cx + ox, teeTop + teeH / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx + ox - 0.5, teeTop + teeH / 2 - 0.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball on tee when idle
  if (!trajectory || animationProgress === 0) {
    // Tee peg
    ctx.fillStyle = 'rgba(220, 200, 160, 0.6)';
    ctx.fillRect(cx - 0.75, teeTop - 6, 1.5, 6);
    // Ball
    ctx.beginPath();
    ctx.arc(cx, teeTop - 7.5, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f8f8f8';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 1, teeTop - 9, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  // ====================== PREVIOUS LANDINGS ======================
  for (const landing of shotLandings) {
    const lx = landing.x * M_TO_YARDS;
    const lz = landing.z * M_TO_YARDS;
    const ly = fwdToGndY(lx);
    if (ly < horizon || ly > groundY) continue;
    const s = scaleAt(lx);
    const lsx = cx + lz * s * (width / 60);
    const r = Math.max(2, 4 * s);
    ctx.beginPath();
    ctx.arc(lsx, ly, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(lsx, ly, r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ====================== BALL FLIGHT ======================
  if (!trajectory || trajectory.length < 3 || animationProgress <= 0) return;

  let maxH = 0, apexFwd = 0;
  for (const pt of trajectory) {
    const hy = pt.y * M_TO_YARDS;
    if (hy > maxH) { maxH = hy; apexFwd = pt.x * M_TO_YARDS; }
  }
  const apexGndY = fwdToGndY(apexFwd);
  const targetY = height * 0.08;
  const hScale = maxH > 0 ? Math.max((apexGndY - targetY) / maxH, 2) : 2;

  const toScreen = (p: TrajectoryPoint) => {
    const fwd = p.x * M_TO_YARDS;
    const h = p.y * M_TO_YARDS;
    const lat = p.z * M_TO_YARDS;
    const s = scaleAt(fwd);
    return { x: cx + lat * s * (width / 60), y: fwdToGndY(fwd) - h * hScale, s };
  };

  const pointCount = Math.floor(trajectory.length * animationProgress);
  if (pointCount < 1) return;

  // Landing zone
  const finalPt = trajectory[trajectory.length - 1];
  const landFwd = finalPt.x * M_TO_YARDS;
  const landGndY2 = fwdToGndY(landFwd);
  const landS = scaleAt(landFwd);
  const landSx = cx + finalPt.z * M_TO_YARDS * landS * (width / 60);
  const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
  const landR = Math.max(5, 14 * landS);

  // Target rings
  ctx.strokeStyle = `rgba(255, 220, 50, ${0.25 * pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(landSx, landGndY2, landR + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 220, 50, ${0.5 * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(landSx, landGndY2, landR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 220, 50, ${0.08 * pulse})`;
  ctx.beginPath();
  ctx.arc(landSx, landGndY2, landR, 0, Math.PI * 2);
  ctx.fill();

  // Trail — outer glow
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 180, 40, 0.18)';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < pointCount; i++) {
    const sp = toScreen(trajectory[i]);
    if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
  }
  ctx.stroke();
  ctx.restore();

  // Trail — Toptracer gradient (red → orange → yellow → white-hot)
  for (let i = 1; i < pointCount; i++) {
    const prev = toScreen(trajectory[i - 1]);
    const cur = toScreen(trajectory[i]);
    const t = i / trajectory.length;

    // Color ramp: deep red → orange → gold → white-ish
    const r = 255;
    const g = Math.round(40 + t * 200);
    const b = Math.round(t > 0.5 ? (t - 0.5) * 2 * 220 : 20);

    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Drop line at landing
  if (animationProgress >= 1) {
    const lastSp = toScreen(trajectory[trajectory.length - 1]);
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(lastSp.x, lastSp.y);
    ctx.lineTo(landSx, landGndY2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Current ball position
  const current = trajectory[Math.min(pointCount - 1, trajectory.length - 1)];
  const bp = toScreen(current);
  const ballSize = Math.max(4, 7 * bp.s);

  // Drop line to ground (while in air)
  const curGndY = fwdToGndY(current.x * M_TO_YARDS);
  if (current.y * M_TO_YARDS > 1) {
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(bp.x, bp.y);
    ctx.lineTo(bp.x, curGndY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ground shadow (ellipse)
    ctx.beginPath();
    ctx.ellipse(bp.x, curGndY, Math.max(3, 6 * bp.s), Math.max(1, 2 * bp.s), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fill();
  }

  // Ball glow layers
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 200, 60, 0.05)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 230, 120, 0.1)';
  ctx.fill();

  // Ball body
  ctx.beginPath();
  ctx.arc(bp.x, bp.y, ballSize, 0, Math.PI * 2);
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();
  // Ball highlight
  ctx.beginPath();
  ctx.arc(bp.x - ballSize * 0.2, bp.y - ballSize * 0.25, ballSize * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  // Distance label next to ball (during animation)
  if (animationProgress < 1 && animationProgress > 0.02) {
    const dist = current.x * M_TO_YARDS;
    const label = units === 'metric'
      ? `${Math.round(dist * YARDS_TO_METRES)}m`
      : `${Math.round(dist)} yds`;
    const fs = 11;
    ctx.font = `600 ${fs}px "DM Sans", system-ui`;
    ctx.textAlign = 'left';
    const tw = ctx.measureText(label).width + 10;
    const lx = bp.x + ballSize + 8;
    const ly = bp.y - fs / 2 - 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw, fs + 6, (fs + 6) / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, lx + 5, ly + fs + 1);
  }

  // Final carry label (after animation)
  if (animationProgress >= 1) {
    const carryYds = finalPt.x * M_TO_YARDS;
    const carryNum = units === 'metric'
      ? `${Math.round(carryYds * YARDS_TO_METRES)}`
      : `${Math.round(carryYds)}`;
    const carryUnit = units === 'metric' ? 'm' : ' yds';
    const cfs = 13;
    ctx.font = `700 ${cfs}px "DM Sans", system-ui`;
    const nw = ctx.measureText(carryNum).width;
    ctx.font = `500 ${cfs - 2}px "DM Sans", system-ui`;
    const uw = ctx.measureText(carryUnit + ' carry').width;
    const pw = nw + uw + 16;
    const ph = cfs + 10;
    const plx = landSx - pw / 2;
    const ply = landGndY2 - landR - ph - 8;

    // Pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(plx, ply, pw, ph, ph / 2);
    ctx.fill();
    // Gold accent
    ctx.fillStyle = 'rgba(255, 210, 50, 0.8)';
    ctx.beginPath();
    ctx.roundRect(plx + 3, ply + ph / 2 - 3, 3, 6, 1.5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${cfs}px "DM Sans", system-ui`;
    ctx.textAlign = 'left';
    ctx.fillText(carryNum, plx + 10, ply + ph - (ph - cfs) / 2 - 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = `500 ${cfs - 2}px "DM Sans", system-ui`;
    ctx.fillText(carryUnit + ' carry', plx + 10 + nw + 2, ply + ph - (ph - cfs) / 2 - 1);
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
