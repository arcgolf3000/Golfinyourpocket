import { useRef, useEffect, useCallback, useState } from 'react';
import { type TrajectoryPoint } from '../engine/physics';

interface ARCameraProps {
  trajectory: TrajectoryPoint[] | null;
  animationProgress: number;
  onClose: () => void;
}

// Project 3D world coordinates to 2D screen
// Camera is at ground level looking forward down the range
function projectPoint(
  x: number,  // forward distance (metres)
  y: number,  // height (metres)
  z: number,  // lateral offset (metres)
  canvasW: number,
  canvasH: number,
): { sx: number; sy: number; scale: number } | null {
  // Virtual camera parameters
  const focalLength = canvasH * 0.8;
  const cameraHeight = 1.2; // camera held at ~1.2m
  const minDepth = 0.5;

  if (x < minDepth) return null;

  // Perspective projection
  const sx = canvasW / 2 + (z * focalLength) / x;
  const sy = canvasH - ((y - cameraHeight) * focalLength) / x - canvasH * 0.05;
  const scale = Math.max(0.15, focalLength / (x * 3));

  return { sx, sy, scale };
}

export default function ARCamera({ trajectory, animationProgress, onClose }: ARCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start camera
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Camera access denied. Please allow camera in your browser settings.'
              : 'Could not access camera.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Draw trajectory overlay
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!trajectory || trajectory.length < 2 || animationProgress <= 0) return;

    const pointCount = Math.floor(trajectory.length * animationProgress);
    if (pointCount < 2) return;

    // Draw trajectory trail
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    let lastProjected: { sx: number; sy: number } | null = null;

    for (let i = 0; i < pointCount; i++) {
      const pt = trajectory[i];
      const projected = projectPoint(pt.x, pt.y, pt.z, w, h);
      if (!projected) continue;

      if (lastProjected) {
        const alpha = 0.15 + (i / pointCount) * 0.6;
        ctx.strokeStyle = `rgba(255, 204, 51, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(lastProjected.sx, lastProjected.sy);
        ctx.lineTo(projected.sx, projected.sy);
        ctx.stroke();
      }
      lastProjected = projected;
    }

    // Draw ball at current position
    const currentPt = trajectory[pointCount - 1];
    const ballProj = projectPoint(currentPt.x, currentPt.y, currentPt.z, w, h);
    if (ballProj) {
      const ballRadius = Math.max(3, 12 * ballProj.scale);

      // Glow
      ctx.shadowColor = '#ffcc33';
      ctx.shadowBlur = ballRadius * 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballProj.sx, ballProj.sy, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ball outline
      ctx.strokeStyle = '#ffcc33';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ballProj.sx, ballProj.sy, ballRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw distance markers on the ground
    const distances = [50, 100, 150, 200, 250]; // yards
    const yardToMetre = 0.9144;
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';

    for (const d of distances) {
      const groundPt = projectPoint(d * yardToMetre, 0, 0, w, h);
      if (groundPt && groundPt.sy > 0 && groundPt.sy < h) {
        ctx.fillStyle = 'rgba(255, 204, 51, 0.5)';
        // Horizontal line
        const leftPt = projectPoint(d * yardToMetre, 0, -20, w, h);
        const rightPt = projectPoint(d * yardToMetre, 0, 20, w, h);
        if (leftPt && rightPt) {
          ctx.strokeStyle = 'rgba(255, 204, 51, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(leftPt.sx, leftPt.sy);
          ctx.lineTo(rightPt.sx, rightPt.sy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 204, 51, 0.6)';
        ctx.fillText(`${d} yd`, groundPt.sx, groundPt.sy + 16);
      }
    }
  }, [trajectory, animationProgress]);

  // Animation loop for overlay
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      drawOverlay();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [drawOverlay]);

  // Match canvas to window size
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Trajectory overlay canvas */}
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0 w-full h-full"
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <div className="text-gold text-sm font-bold tracking-widest uppercase">
          AR View
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-lg"
        >
          ✕
        </button>
      </div>

      {/* Status messages */}
      {!cameraReady && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white/70 text-sm">Starting camera...</div>
        </div>
      )}
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-red-400 text-sm mb-4">{cameraError}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gold/20 text-gold rounded-lg text-sm"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Shot info overlay */}
      {trajectory && animationProgress >= 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl px-5 py-3 text-center">
            <div className="text-gold text-xs tracking-widest uppercase mb-1">Shot Complete</div>
            <div className="text-white text-sm">Tap swing to hit another</div>
          </div>
        </div>
      )}
    </div>
  );
}
