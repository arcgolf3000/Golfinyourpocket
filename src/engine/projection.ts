import type { TrajectoryPoint } from './physics';

const M_TO_YARDS = 1.09361;

export interface ProjectionResult {
  x: number;
  y: number;
  scale: number;
}

export interface ProjectionConfig {
  width: number;
  height: number;
  horizon: number;
  groundY: number;
  focalLength: number;
}

/**
 * Create a ground-level perspective projection config from canvas dimensions.
 */
export function createProjectionConfig(width: number, height: number): ProjectionConfig {
  return {
    width,
    height,
    horizon: height * 0.35,
    groundY: height - 16,
    focalLength: 60,
  };
}

/**
 * Project a ground point (no height) into screen coordinates using perspective.
 * fwd = forward distance in yards, lat = lateral offset in yards.
 * Returns null if the point is behind the camera.
 */
export function projectGround(
  config: ProjectionConfig,
  fwd: number,
  lat: number,
): ProjectionResult | null {
  const { width, horizon, groundY, focalLength } = config;
  const depth = fwd + focalLength;
  if (depth <= 0) return null;
  const scale = focalLength / depth;
  const gndY = groundY - (groundY - horizon) * (1 - scale);
  const lateralPxPerYard = width / 60;
  return { x: width / 2 + lat * scale * lateralPxPerYard, y: gndY, scale };
}

/**
 * Compute screen coordinates for a ball in flight using direct screen-space
 * mapping. This produces a clear, always-visible arc overlaid on the
 * perspective scene.
 *
 * Instead of subtracting height from a perspective ground point (which can
 * produce tiny/invisible arcs), this maps the trajectory directly:
 *   - Screen X: center + lateral offset (perspective-scaled)
 *   - Screen Y: computed from both forward distance and height so the ball
 *     visibly arcs from the tee up into the sky and back down to the landing
 *
 * Returns null only if the trajectory is empty.
 */
export function computeBallScreenPos(
  config: ProjectionConfig,
  trajectory: TrajectoryPoint[],
  point: TrajectoryPoint,
): ProjectionResult | null {
  if (!trajectory || trajectory.length < 2) return null;

  const { width, height, horizon, groundY, focalLength } = config;

  // Convert point to yards
  const fwd = point.x * M_TO_YARDS;
  const h = point.y * M_TO_YARDS;
  const lat = point.z * M_TO_YARDS;

  // Find trajectory bounds (in yards)
  const maxFwd = trajectory[trajectory.length - 1].x * M_TO_YARDS;
  let maxH = 0;
  for (let i = 0; i < trajectory.length; i++) {
    const hy = trajectory[i].y * M_TO_YARDS;
    if (hy > maxH) maxH = hy;
  }
  if (maxFwd <= 0) return null;

  // --- Screen X: lateral offset with perspective ---
  const depth = fwd + focalLength;
  const scale = depth > 0 ? focalLength / depth : 1;
  const lateralPxPerYard = width / 60;
  const screenX = width / 2 + lat * scale * lateralPxPerYard;

  // --- Screen Y: combine forward progress and height ---
  // Ground Y for this forward distance (perspective mapping)
  const gndY = groundY - (groundY - horizon) * (1 - scale);

  // Height offset: scale so apex reaches well into the sky
  // Target: apex should reach ~10% from top of canvas
  const targetApexY = height * 0.10;
  // Find the ground Y at the apex's forward position
  const apexPt = trajectory.reduce((m, p) => (p.y > m.y ? p : m), trajectory[0]);
  const apexFwd = apexPt.x * M_TO_YARDS;
  const apexDepth = apexFwd + focalLength;
  const apexScale = apexDepth > 0 ? focalLength / apexDepth : 1;
  const apexGndY = groundY - (groundY - horizon) * (1 - apexScale);
  // Pixels available from apex ground to target
  const availPx = apexGndY - targetApexY;
  const heightPxPerYard = maxH > 0 ? Math.max(availPx / maxH, 2) : 2;

  const screenY = gndY - h * heightPxPerYard;

  return { x: screenX, y: screenY, scale };
}
