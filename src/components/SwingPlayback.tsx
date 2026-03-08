import { useRef, useState } from 'react';

interface SwingPlaybackProps {
  videoUrl: string;
  onClose: () => void;
}

export default function SwingPlayback({ videoUrl, onClose }: SwingPlaybackProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const toggleSpeed = () => {
    const rates = [1, 0.5, 0.25];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  return (
    <div className="w-full rounded-xl overflow-hidden bg-dark-card border border-dark-border">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[10px] text-dark-text tracking-widest uppercase">Swing Replay</div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSpeed}
            className="px-2 py-0.5 rounded bg-gold/10 text-gold text-[10px] cursor-pointer"
          >
            {playbackRate === 1 ? '1x' : playbackRate === 0.5 ? '0.5x' : '0.25x'}
          </button>
          <button
            onClick={onClose}
            className="text-dark-text hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        loop
        autoPlay
        className="w-full"
      />
    </div>
  );
}
