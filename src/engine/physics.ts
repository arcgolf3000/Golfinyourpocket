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

export function simulate(club: ClubData, powerPercent: number): ShotResult {
  // Power scaling (non-linear — sweet spot at 78%)
  const sweetSpot = 0.78;
  const powerFactor = powerPercent / 100;
  const sweetSpotBonus = 1 - Math.abs(powerFactor - sweetSpot) * 0.15;
  const effectivePower = powerFactor * sweetSpotBonus;

  // Club speed with variance
  const clubSpeedMph = club.speed * effectivePower * (0.97 + Math.random() * 0.06);
  // Ball speed from smash factor with slight variance
  const smashVariance = club.smash * (0.98 + Math.random() * 0.04);
  const ballSpeedMph = clubSpeedMph * smashVariance;
  const ballSpeedMs = ballSpeedMph * MPH_TO_MS;

  // Launch angle with variance
  const launchDeg = club.launch * (0.95 + Math.random() * 0.10);
  const launchRad = (launchDeg * Math.PI) / 180;

  // Spin rate with variance
  const spinRate = club.spin * (0.92 + Math.random() * 0.16);
  const spinRadPerSec = (spinRate * 2 * Math.PI) / 60;

  // Lateral angle variance (offline dispersion)
  const offlineAngleDeg = (Math.random() - 0.5) * 6 * (1 - effectivePower * 0.3);
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
