import type { ShotResult } from '../engine/physics';

interface LaunchMonitorProps {
  shot: ShotResult | null;
}

interface DataField {
  label: string;
  value: string;
  unit: string;
}

export default function LaunchMonitor({ shot }: LaunchMonitorProps) {
  const fields: DataField[] = shot
    ? [
        { label: 'Ball Speed', value: shot.ballSpeed.toFixed(1), unit: 'mph' },
        { label: 'Club Speed', value: shot.clubSpeed.toFixed(1), unit: 'mph' },
        { label: 'Launch Angle', value: shot.launchAngle.toFixed(1), unit: '°' },
        { label: 'Spin Rate', value: shot.spinRate.toLocaleString(), unit: 'rpm' },
        { label: 'Carry', value: String(shot.carry), unit: 'yds' },
        { label: 'Total', value: String(shot.total), unit: 'yds' },
        { label: 'Apex', value: String(shot.apex), unit: 'yds' },
        { label: 'Hang Time', value: shot.hangTime.toFixed(2), unit: 's' },
        { label: 'Smash Factor', value: shot.smash.toFixed(2), unit: '' },
        { label: 'Offline', value: `${shot.offline} ${shot.dir}`, unit: 'yds' },
      ]
    : [
        { label: 'Ball Speed', value: '—', unit: 'mph' },
        { label: 'Club Speed', value: '—', unit: 'mph' },
        { label: 'Launch Angle', value: '—', unit: '°' },
        { label: 'Spin Rate', value: '—', unit: 'rpm' },
        { label: 'Carry', value: '—', unit: 'yds' },
        { label: 'Total', value: '—', unit: 'yds' },
        { label: 'Apex', value: '—', unit: 'yds' },
        { label: 'Hang Time', value: '—', unit: 's' },
        { label: 'Smash Factor', value: '—', unit: '' },
        { label: 'Offline', value: '—', unit: 'yds' },
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
