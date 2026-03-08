import { useState, useCallback, useRef, useEffect } from 'react';
import { simulate, type ShotResult } from '../engine/physics';
import { getClub, CLUBS } from '../data/clubs';
import { loadProfile, saveProfile, type UserProfile, type UnitSystem } from '../data/profile';
import RangeCanvas, { type RangeViewType } from '../canvas/RangeCanvas';
import TrajectoryCanvas from '../canvas/TrajectoryCanvas';
import PowerMeter from './PowerMeter';
import ClubSelector from './ClubSelector';
import LaunchMonitor from './LaunchMonitor';
import ShotHistory from './ShotHistory';
import SwingCamera from './SwingCamera';
import SwingPlayback from './SwingPlayback';
import ProfileScreen from './ProfileScreen';

const ANIMATION_DURATION = 2500; // ms

type ViewMode = 'simulator' | 'camera' | 'profile';

interface ShotRecord {
  club: string;
  result: ShotResult;
}

export default function DrivingRange() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
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
  const [rangeViewType, setRangeViewType] = useState<RangeViewType>('ground');

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
  const [canvasWidth, setCanvasWidth] = useState(360);
  useEffect(() => {
    const update = () => {
      setCanvasWidth(Math.min(window.innerWidth - 32, 420));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  // Ground view uses landscape ratio (like real sim), bird's eye uses portrait
  const rangeH = rangeViewType === 'ground'
    ? Math.round(canvasWidth * 0.65)
    : Math.round(canvasWidth * 1.1);
  const dimensions = { w: canvasWidth, h: rangeH };

  const shotLandings = shots.map(s => ({
    x: s.result.trajectory[s.result.trajectory.length - 1]?.x ?? 0,
    z: s.result.trajectory[s.result.trajectory.length - 1]?.z ?? 0,
    club: s.club,
  }));

  const handleRecordingComplete = useCallback((url: string) => {
    setSwingVideoUrl(url);
    setIsRecording(false);
    setViewMode('simulator');

    // Auto-simulate a shot from the recorded swing.
    // Since we can't analyse the video, generate a realistic power value
    // centred around the sweet spot with natural human variance.
    const swingPower = 68 + Math.random() * 22; // 68–90%, clusters near sweet spot
    const club = getClub(selectedClub);
    const result = simulate(club, swingPower);
    setCurrentShot(result);
    setIsAnimating(true);
    setAnimProgress(0);
    animStartRef.current = performance.now();

    const clubName = CLUBS.find(c => c.key === selectedClub)?.name ?? selectedClub;

    const animateShot = (now: number) => {
      const elapsed = now - animStartRef.current;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
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
  }, [selectedClub]);

  const handleProfileSave = useCallback((updated: UserProfile) => {
    setProfile(updated);
    saveProfile(updated);
  }, []);

  const units: UnitSystem = profile.units;

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center px-4 py-6 gap-5 max-w-md mx-auto">
      {/* Header */}
      <header className="text-center flex flex-col items-center gap-1 relative w-full">
        <h1 className="text-gold text-xl font-bold tracking-widest uppercase">ARC</h1>
        <p className="text-[10px] text-dark-text tracking-[0.3em] uppercase">
          {profile.name ? `${profile.name}'s Pocket Golf Sim` : 'Pocket Golf Sim'}
        </p>
      </header>

      {/* View toggle */}
      <div className="flex rounded-lg overflow-hidden border border-dark-border w-full">
        {(['simulator', 'camera', 'profile'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 text-[10px] tracking-widest uppercase transition-colors cursor-pointer ${
              viewMode === mode
                ? 'bg-gold/20 text-gold'
                : 'bg-dark-card text-dark-text'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {viewMode === 'profile' && (
        <ProfileScreen
          profile={profile}
          onSave={handleProfileSave}
          onClose={() => setViewMode('simulator')}
        />
      )}

      {viewMode === 'simulator' && (
        <>
          {/* Club selector */}
          <ClubSelector selected={selectedClub} onSelect={setSelectedClub} />

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
            <div className="flex items-center justify-between w-full">
              <div className="text-[10px] text-dark-text tracking-widest uppercase">
                Range View
              </div>
              <div className="flex rounded-md overflow-hidden border border-dark-border">
                {(['ground', 'birdseye'] as RangeViewType[]).map((vt) => (
                  <button
                    key={vt}
                    onClick={() => setRangeViewType(vt)}
                    className={`px-3 py-1 text-[9px] tracking-wider uppercase transition-colors cursor-pointer ${
                      rangeViewType === vt
                        ? 'bg-gold/20 text-gold'
                        : 'bg-dark-card text-dark-text'
                    }`}
                  >
                    {vt === 'ground' ? 'Ground' : "Bird's Eye"}
                  </button>
                ))}
              </div>
            </div>
            <RangeCanvas
              width={dimensions.w}
              height={dimensions.h}
              trajectory={currentShot?.trajectory ?? null}
              animationProgress={animProgress}
              shotLandings={shotLandings}
              units={units}
              viewType={rangeViewType}
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
              units={units}
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
            <LaunchMonitor shot={currentShot} units={units} />
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
            <ShotHistory shots={shots} units={units} />
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
          leftHanded={profile.leftHanded}
          units={units}
          onToggleHand={() => {
            handleProfileSave({ ...profile, leftHanded: !profile.leftHanded });
          }}
        />
      )}
    </div>
  );
}
