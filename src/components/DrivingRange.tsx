import { useState, useCallback, useRef, useEffect } from 'react';
import { simulate, type ShotResult } from '../engine/physics';
import { getClub, CLUBS } from '../data/clubs';
import RangeCanvas from '../canvas/RangeCanvas';
import TrajectoryCanvas from '../canvas/TrajectoryCanvas';
import PowerMeter from './PowerMeter';
import ClubSelector from './ClubSelector';
import LaunchMonitor from './LaunchMonitor';
import ShotHistory from './ShotHistory';
import SwingCamera from './SwingCamera';
import SwingPlayback from './SwingPlayback';

const ANIMATION_DURATION = 2500; // ms

type ViewMode = 'simulator' | 'camera';

interface ShotRecord {
  club: string;
  result: ShotResult;
}

export default function DrivingRange() {
  const [selectedClub, setSelectedClub] = useState('driver');
  const [currentShot, setCurrentShot] = useState<ShotResult | null>(null);
  const [shots, setShots] = useState<ShotRecord[]>(() => {
    try {
      const stored = localStorage.getItem('arc-shot-history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [animProgress, setAnimProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animStartRef = useRef(0);
  const animFrameRef = useRef(0);
  const [viewMode, setViewMode] = useState<ViewMode>('simulator');
  const [isRecording, setIsRecording] = useState(false);
  const [swingVideoUrl, setSwingVideoUrl] = useState<string | null>(null);
  const [leftHanded, setLeftHanded] = useState(() => {
    return localStorage.getItem('arc-left-handed') === 'true';
  });

  // Persist shots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('arc-shot-history', JSON.stringify(shots));
    } catch { /* ignore quota errors */ }
  }, [shots]);

  const handleSwing = useCallback((power: number) => {
    const club = getClub(selectedClub);
    const result = simulate(club, power);
    setCurrentShot(result);
    setIsAnimating(true);
    setAnimProgress(0);
    animStartRef.current = performance.now();

    const clubName = CLUBS.find(c => c.key === selectedClub)?.name ?? selectedClub;

    const animateShot = (now: number) => {
      const elapsed = now - animStartRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      // Ease out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(eased);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateShot);
      } else {
        setIsAnimating(false);
        setShots(prev => [...prev, { club: clubName, result }]);
      }
    };

    animFrameRef.current = requestAnimationFrame(animateShot);

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [selectedClub]);

  const clearHistory = useCallback(() => {
    setShots([]);
    setCurrentShot(null);
    setAnimProgress(0);
    localStorage.removeItem('arc-shot-history');
  }, []);

  // Compute canvas dimensions responsively
  const [dimensions, setDimensions] = useState({ w: 360, h: 400 });
  useEffect(() => {
    const update = () => {
      const w = Math.min(window.innerWidth - 32, 420);
      setDimensions({ w, h: Math.round(w * 1.1) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const shotLandings = shots.map(s => ({
    x: s.result.trajectory[s.result.trajectory.length - 1]?.x ?? 0,
    z: s.result.trajectory[s.result.trajectory.length - 1]?.z ?? 0,
    club: s.club,
  }));

  const handleRecordingComplete = useCallback((url: string) => {
    setSwingVideoUrl(url);
    setIsRecording(false);
    setViewMode('simulator');
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center px-4 py-6 gap-5 max-w-md mx-auto">
      {/* Header */}
      <header className="text-center flex flex-col items-center gap-1 relative w-full">
        <h1 className="text-gold text-xl font-bold tracking-widest uppercase">ARC</h1>
        <p className="text-[10px] text-dark-text tracking-[0.3em] uppercase">Pocket Golf Sim</p>
      </header>

      {/* View toggle */}
      <div className="flex rounded-lg overflow-hidden border border-dark-border w-full">
        <button
          onClick={() => setViewMode('simulator')}
          className={`flex-1 py-2 text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
            viewMode === 'simulator'
              ? 'bg-gold/20 text-gold'
              : 'bg-dark-card text-dark-text'
          }`}
        >
          Simulator
        </button>
        <button
          onClick={() => setViewMode('camera')}
          className={`flex-1 py-2 text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
            viewMode === 'camera'
              ? 'bg-gold/20 text-gold'
              : 'bg-dark-card text-dark-text'
          }`}
        >
          Camera
        </button>
      </div>

      {/* Club selector (always visible) */}
      <ClubSelector selected={selectedClub} onSelect={setSelectedClub} />

      {viewMode === 'simulator' && (
        <>
          {/* Swing replay (if recorded) */}
          {swingVideoUrl && (
            <SwingPlayback
              videoUrl={swingVideoUrl}
              onClose={() => {
                URL.revokeObjectURL(swingVideoUrl);
                setSwingVideoUrl(null);
              }}
            />
          )}

          {/* Range view */}
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-[10px] text-dark-text tracking-widest uppercase text-center">
              Range View
            </div>
            <RangeCanvas
              width={dimensions.w}
              height={dimensions.h}
              trajectory={currentShot?.trajectory ?? null}
              animationProgress={animProgress}
              shotLandings={shotLandings}
            />
          </div>

          {/* Trajectory view */}
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-[10px] text-dark-text tracking-widest uppercase text-center">
              Trajectory
            </div>
            <TrajectoryCanvas
              width={dimensions.w}
              height={Math.round(dimensions.w * 0.45)}
              trajectory={currentShot?.trajectory ?? null}
              animationProgress={animProgress}
              apex={currentShot?.apex ?? 0}
            />
          </div>

          {/* Power meter */}
          <div className="w-full">
            <PowerMeter onSwing={handleSwing} disabled={isAnimating} />
          </div>

          {/* Launch monitor */}
          <div className="w-full flex flex-col gap-2">
            <div className="text-[10px] text-dark-text tracking-widest uppercase text-center">
              Launch Monitor
            </div>
            <LaunchMonitor shot={currentShot} />
          </div>

          {/* Shot history */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-dark-text tracking-widest uppercase">
                Shot History
              </div>
              {shots.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[10px] text-dark-text hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <ShotHistory shots={shots} />
          </div>
        </>
      )}

      {/* Footer */}
      <footer className="text-[9px] text-dark-text/50 text-center py-4">
        ARC Pocket Golf SIM v0.1 — Driving Range MVP
      </footer>

      {/* Camera overlay */}
      {viewMode === 'camera' && (
        <SwingCamera
          onClose={() => setViewMode('simulator')}
          isRecording={isRecording}
          onRecordingComplete={handleRecordingComplete}
          onStartRecording={() => setIsRecording(true)}
          leftHanded={leftHanded}
          onToggleHand={() => {
            setLeftHanded(prev => {
              const next = !prev;
              localStorage.setItem('arc-left-handed', String(next));
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
