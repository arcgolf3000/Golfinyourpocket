import type { ShotResult } from '../engine/physics';
import { type UnitSystem, distStr, distUnit } from '../data/profile';

interface ShotHistoryProps {
  shots: Array<{ club: string; result: ShotResult }>;
  units: UnitSystem;
}

export default function ShotHistory({ shots, units }: ShotHistoryProps) {
  const du = distUnit(units);

  if (shots.length === 0) {
    return (
      <div className="text-center text-dark-text text-xs py-4">
        No shots yet. Select a club and swing!
      </div>
    );
  }

  // Running averages
  const avgCarry = Math.round(shots.reduce((s, sh) => s + sh.result.carry, 0) / shots.length);
  const avgTotal = Math.round(shots.reduce((s, sh) => s + sh.result.total, 0) / shots.length);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Averages */}
      <div className="flex justify-between items-center bg-dark-card border border-gold/20 rounded px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-widest text-gold">
          Avg ({shots.length} shots)
        </span>
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-dark-text">
            Carry <span className="text-white font-semibold">{distStr(avgCarry, units)}</span>
          </span>
          <span className="text-dark-text">
            Total <span className="text-gold font-semibold">{distStr(avgTotal, units)}</span>
          </span>
        </div>
      </div>

      {/* Shot rows */}
      <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 scrollbar-thin">
        {[...shots].reverse().map((shot, i) => (
          <div
            key={shots.length - 1 - i}
            className="flex justify-between items-center bg-dark-panel rounded px-3 py-1 text-xs"
          >
            <span className="text-dark-text font-medium w-14">{shot.club}</span>
            <span className="font-mono text-white">{distStr(shot.result.total, units)} {du}</span>
            <span className="font-mono text-dark-text">{distStr(shot.result.carry, units)} carry</span>
            <span className={`font-mono text-[10px] w-12 text-right ${
              shot.result.dir === 'ST' ? 'text-green-500' :
              shot.result.dir === 'L' ? 'text-blue-400' : 'text-red-400'
            }`}>
              {shot.result.offline > 0 ? `${distStr(shot.result.offline, units)} ${shot.result.dir}` : 'ST'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
