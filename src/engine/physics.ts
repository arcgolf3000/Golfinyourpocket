import { type ClubData } from '../data/clubs';

// Physics constants
const GRAVITY = 9.81;           // m/s²
const BALL_MASS = 0.04593;      // kg
const BALL_RADIUS = 0.02135;    // m
const AIR_DENSITY = 1.225;      // kg/m³
const DRAG_COEFF = 0.24;
const MAGNUS_COEFF = 0.000008;
const DT = 0.008;               // simulation timestep (seconds)

// Cross-sectional area of ball
const BALL_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS;

// Conversion factors
const MPH_TO_MS = 0.44704;
const M_TO_YARDS = 1.09361;

export interface TrajectoryPoint {
  x: number;  // forward distance (metres)
  y: number;  // height (metres)
  z: number;  // lateral offset (metres)
}

export interface ShotResult {
  carry: number;        // carry distance in yards
  total: number;        // total distance including roll (yards)
  offline: number;      // left/right deviation in yards
  apex: number;         // max height in yards
  ballSpeed: number;    // ball speed (mph)
  clubSpeed: number;    // club head speed (mph)
  launchAngle: number;  // launch angle (degrees)
  spinRate: number;     // backspin (rpm)
  smash: number;        // smash factor
  hangTime: number;     // time in air (seconds)
  trajectory: TrajectoryPoint[];
  dir: 'L' | 'R' | 'ST';
}

// offlineBias: -1 (pull/draw) to +1 (push/fade), 0 = straight
export function simulate(club: ClubData, powerPercent: number, offlineBias: number = 0): ShotResult {
  // Contact quality — Gaussian peak at sweet spot (78%).
  // The power meter represents timing / strike purity, not raw power.
  // Perfect timing (78%) = full club-head speed. Mishits lose speed & accuracy.
  const sweetSpot = 0.78;
  const powerFactor = powerPercent / 100;
  const distFromSweet = Math.abs(powerFactor - sweetSpot);
  // contactQuality: 1.0 at sweet spot, ~0.78 at 100%, ~0.67 at 50%, ~0.31 at 0%
  const contactQuality = 0.3 + 0.7 * Math.exp(-distFromSweet * distFromSweet * 8);

  // Club speed: base speed × contact quality × small human variance (±3%)
  const clubSpeedMph = club.speed * contactQuality * (0.97 + Math.random() * 0.06);
  // Ball speed: club speed × smash factor × small variance (±2%)
  const smashVariance = club.smash * (0.98 + Math.random() * 0.04);
  const ballSpeedMph = clubSpeedMph * smashVariance;
  const ballSpeedMs = ballSpeedMph * MPH_TO_MS;

  // Launch angle — mishits add loft variance (pure strike is consistent)
  const loftJitter = 1 + (1 - contactQuality) * (Math.random() - 0.5) * 0.3;
  const launchDeg = club.launch * (0.97 + Math.random() * 0.06) * loftJitter;
  const launchRad = (launchDeg * Math.PI) / 180;

  // Spin rate — mishits add spin variance
  const spinJitter = 1 + (1 - contactQuality) * (Math.random() - 0.3) * 0.4;
  const spinRate = club.spin * (0.94 + Math.random() * 0.12) * spinJitter;
  const spinRadPerSec = (spinRate * 2 * Math.PI) / 60;

  // Lateral dispersion — worse contact = more offline, bias shifts centre
  const offlineMultiplier = 1 + (1 - contactQuality) * 2.5;
  const biasAngle = offlineBias * 3; // ±3° for full bias
  const offlineAngleDeg = biasAngle + (Math.random() - 0.5) * 4 * offlineMultiplier;
  const offlineAngleRad = (offlineAngleDeg * Math.PI) / 180;

  // Initial velocity components
  let vx = ballSpeedMs * Math.cos(launchRad) * Math.cos(offlineAngleRad);
  let vy = ballSpeedMs * Math.sin(launchRad);
  let vz = ballSpeedMs * Math.cos(launchRad) * Math.sin(offlineAngleRad);

  // Position
  let x = 0, y = 0, z = 0;
  let maxHeight = 0;
  let time = 0;
  let currentSpin = spinRadPerSec;

  const trajectory: TrajectoryPoint[] = [{ x: 0, y: 0, z: 0 }];

  // Simulation loop
  while (y >= 0 || time < 0.1) {
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed === 0) break;

    // Drag force (opposes motion) — spin increases effective drag
    const spinDragFactor = 1 + (currentSpin / 1000) * 0.15;
    const dragForceMag = 0.5 * AIR_DENSITY * DRAG_COEFF * spinDragFactor * BALL_AREA * speed * speed;
    const dragAx = -(dragForceMag * vx) / (BALL_MASS * speed);
    const dragAy = -(dragForceMag * vy) / (BALL_MASS * speed);
    const dragAz = -(dragForceMag * vz) / (BALL_MASS * speed);

    // Magnus force (backspin creates lift)
    const magnusLift = MAGNUS_COEFF * currentSpin * speed;
    const magnusAy = magnusLift / BALL_MASS;

    // Total acceleration
    const ax = dragAx;
    const ay = dragAy - GRAVITY + magnusAy;
    const az = dragAz;

    // Update velocity
    vx += ax * DT;
    vy += ay * DT;
    vz += az * DT;

    // Update position
    x += vx * DT;
    y += vy * DT;
    z += vz * DT;

    // Spin decay (spin reduces over time)
    currentSpin *= 0.9997;

    time += DT;
    if (y > maxHeight) maxHeight = y;

    // Sample trajectory at intervals
    if (trajectory.length < 500) {
      trajectory.push({ x, y: Math.max(0, y), z });
    }

    // Safety: prevent infinite loops
    if (time > 15) break;
  }

  // Convert results
  const carryYards = Math.round(x * M_TO_YARDS);
  const rollYards = Math.round(carryYards * club.rollPercent);
  const totalYards = carryYards + rollYards;
  const offlineYards = Math.round(Math.abs(z) * M_TO_YARDS * 10) / 10;
  const apexYards = Math.round(maxHeight * M_TO_YARDS);
  const dir: 'L' | 'R' | 'ST' = z < -0.5 ? 'L' : z > 0.5 ? 'R' : 'ST';

  return {
    carry: carryYards,
    total: totalYards,
    offline: offlineYards,
    apex: apexYards,
    ballSpeed: Math.round(ballSpeedMph * 10) / 10,
    clubSpeed: Math.round(clubSpeedMph * 10) / 10,
    launchAngle: Math.round(launchDeg * 10) / 10,
    spinRate: Math.round(spinRate),
    smash: Math.round(smashVariance * 100) / 100,
    hangTime: Math.round(time * 100) / 100,
    trajectory,
    dir,
  };
}
