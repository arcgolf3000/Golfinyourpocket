import { useState, useEffect, useRef, useCallback } from 'react';

interface PowerMeterProps {
  onSwing: (power: number) => void;
  disabled: boolean;
}

type MeterState = 'ready' | 'filling' | 'locked';

const SWEET_SPOT = 78;
const FILL_SPEED = 1.2; // percent per frame (~60fps)

export default function PowerMeter({ onSwing, disabled }: PowerMeterProps) {
  const [state, setState] = useState<MeterState>('ready');
  const [power, setPower] = useState(0);
  const animRef = useRef<number>(0);
  const powerRef = useRef(0);

  const startFill = useCallback(() => {
    if (disabled) return;
    if (state === 'locked') {
      // Reset after locked
      setState('ready');
      setPower(0);
      powerRef.current = 0;
      return;
    }
    if (state === 'ready') {
      setState('filling');
      powerRef.current = 0;
    } else if (state === 'filling') {
      setState('locked');
      cancelAnimationFrame(animRef.current);
      onSwing(powerRef.current);
    }
  }, [state, disabled, onSwing]);

  useEffect(() => {
    if (state !== 'filling') return;

    let direction = 1;
    const animate = () => {
      powerRef.current += FILL_SPEED * direction;
      if (powerRef.current >= 100) {
        powerRef.current = 100;
        direction = -1;
      }
      if (powerRef.current <= 0) {
        powerRef.current = 0;
        direction = 1;
      }
      setPower(powerRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [state]);

  const getColor = (p: number) => {
    const dist = Math.abs(p - SWEET_SPOT);
    if (dist < 5) return '#22c55e';  // green - sweet spot
    if (dist < 15) return '#ffcc33'; // gold - good
    return '#ef4444';                // red - off
  };

  const label = state === 'ready' ? 'TAP TO SWING' : state === 'filling' ? 'TAP TO SET' : `${Math.round(power)}%`;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={startFill}
        disabled={disabled}
        className="w-full py-3 px-6 rounded-lg font-semibold text-sm tracking-wider transition-all
          disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none active:scale-95"
        style={{
          backgroundColor: state === 'locked' ? getColor(power) : state === 'filling' ? '#1e2a38' : '#ffcc33',
          color: state === 'filling' ? '#ffcc33' : '#070b10',
          border: state === 'filling' ? '2px solid #ffcc33' : '2px solid transparent',
        }}
      >
        {label}
      </button>

      {/* Power bar */}
      <div className="w-full h-5 bg-dark-card rounded-full overflow-hidden relative border border-dark-border">
        {/* Sweet spot indicator */}
        <div
          className="absolute top-0 h-full w-1 z-10"
          style={{
            left: `${SWEET_SPOT}%`,
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
          }}
        />

        {/* Fill bar */}
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${power}%`,
            backgroundColor: getColor(power),
            boxShadow: `0 0 8px ${getColor(power)}40`,
          }}
        />
      </div>

      <div className="flex justify-between w-full text-[10px] text-dark-text">
        <span>0%</span>
        <span className="text-green-500">Sweet Spot {SWEET_SPOT}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
