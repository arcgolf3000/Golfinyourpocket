import type { ShotResult } from '../engine/physics';
import { type UnitSystem, distStr, distUnit, speedStr, speedUnit } from '../data/profile';

interface LaunchMonitorProps {
  shot: ShotResult | null;
  units: UnitSystem;
}

interface DataField {
  label: string;
  value: string;
  unit: string;
}

export default function LaunchMonitor({ shot, units }: LaunchMonitorProps) {
  const du = distUnit(units);
  const su = speedUnit(units);

  const fields: DataField[] = shot
    ? [
        { label: 'Ball Speed', value: speedStr(shot.ballSpeed, units), unit: su },
        { label: 'Club Speed', value: speedStr(shot.clubSpeed, units), unit: su },
        { label: 'Launch Angle', value: shot.launchAngle.toFixed(1), unit: '°' },
        { label: 'Spin Rate', value: shot.spinRate.toLocaleString(), unit: 'rpm' },
        { label: 'Carry', value: distStr(shot.carry, units), unit: du },
        { label: 'Total', value: distStr(shot.total, units), unit: du },
        { label: 'Apex', value: distStr(shot.apex, units), unit: du },
        { label: 'Hang Time', value: shot.hangTime.toFixed(2), unit: 's' },
        { label: 'Smash Factor', value: shot.smash.toFixed(2), unit: '' },
        { label: 'Offline', value: `${distStr(shot.offline, units)} ${shot.dir}`, unit: du },
      ]
    : [
        { label: 'Ball Speed', value: '—', unit: su },
        { label: 'Club Speed', value: '—', unit: su },
        { label: 'Launch Angle', value: '—', unit: '°' },
        { label: 'Spin Rate', value: '—', unit: 'rpm' },
        { label: 'Carry', value: '—', unit: du },
        { label: 'Total', value: '—', unit: du },
        { label: 'Apex', value: '—', unit: du },
        { label: 'Hang Time', value: '—', unit: 's' },
        { label: 'Smash Factor', value: '—', unit: '' },
        { label: 'Offline', value: '—', unit: du },
      ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {fields.map((field) => (
        <div
          key={field.label}
          className="bg-dark-card border border-dark-border rounded px-2.5 py-1.5 flex flex-col"
        >
          <span className="text-[9px] uppercase tracking-widest text-dark-text">
            {field.label}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-white font-mono">
              {field.value}
            </span>
            {field.unit && (
              <span className="text-[9px] text-dark-text">{field.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
