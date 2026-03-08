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
 * Project a ground point (no height) into screen coordinates.
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
  // Use consistent perspective scaling for lateral offset.
  // The lateral pixel-per-yard rate at the tee (fwd=0, scale=1) is set so
  // that ±30 yards fills roughly half the canvas width, giving a natural
  // field of view.  The same `scale` that shrinks forward distances also
  // shrinks lateral distances — that is the core of perspective projection.
  const lateralPxPerYard = width / 60;
  return { x: width / 2 + lat * scale * lateralPxPerYard, y: gndY, scale };
}

/**
 * Compute the dynamic height scale so the trajectory apex reaches a
 * target screen-Y position (near the top of the canvas).
 *
 * Returns a multiplier: screen-pixels per yard of height.
 */
export function computeHeightScale(
  config: ProjectionConfig,
  trajectory: TrajectoryPoint[],
): number {
  if (!trajectory || trajectory.length < 3) return 2;

  const maxH = Math.max(...trajectory.map(p => p.y)) * M_TO_YARDS;
  if (maxH <= 0) return 2;

  // Find the apex point (highest y)
  const apexPt = trajectory.reduce((m, p) => (p.y > m.y ? p : m), trajectory[0]);
  const apexFwd = apexPt.x * M_TO_YARDS;
  const apexGnd = projectGround(config, apexFwd, 0);

  if (!apexGnd) return 2;

  // Target: apex reaches ~8% from top of canvas (in the sky area)
  const targetScreenY = config.height * 0.08;
  const availablePx = apexGnd.y - targetScreenY;

  if (availablePx <= 0) return 2;

  const scale = availablePx / maxH;
  // Minimum scale so even tiny shots show a visible arc
  return Math.max(scale, 2);
}

/**
 * Project a ball position (with height) into screen coordinates.
 * fwd/h/lat are all in yards.
 */
export function projectBall(
  config: ProjectionConfig,
  heightScale: number,
  fwd: number,
  h: number,
  lat: number,
): ProjectionResult | null {
  const gp = projectGround(config, fwd, lat);
  if (!gp) return null;
  return { x: gp.x, y: gp.y - h * heightScale, scale: gp.scale };
}
