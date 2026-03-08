import { useRef, useEffect, useState, useCallback } from 'react';

interface SwingCameraProps {
  onClose: () => void;
  isRecording: boolean;
  onRecordingComplete: (videoUrl: string) => void;
  onStartRecording: () => void;
}

export default function SwingCamera({
  onClose,
  isRecording,
  onRecordingComplete,
  onStartRecording,
}: SwingCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

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
              ? 'Camera access denied. Allow camera in browser settings.'
              : 'Could not access camera.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Draw setup guide overlay
  const drawGuide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (isRecording) return; // Don't draw guides while recording

    // Ground line
    const groundY = h * 0.78;
    ctx.strokeStyle = 'rgba(255, 204, 51, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ball position marker
    const ballX = w * 0.45;
    const ballY = groundY;
    const ballR = 6;

    // Circle for ball placement
    ctx.strokeStyle = 'rgba(255, 204, 51, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR + 8, 0, Math.PI * 2);
    ctx.stroke();

    // Small filled circle
    ctx.fillStyle = 'rgba(255, 204, 51, 0.5)';
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();

    // "BALL" label
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 204, 51, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('BALL', ballX, ballY + 26);

    // Golfer stance zone (to the right of ball for right-handed)
    const stanceX = w * 0.58;
    const stanceW = w * 0.18;
    const stanceTop = h * 0.2;

    // Stance outline (simplified golfer silhouette zone)
    ctx.strokeStyle = 'rgba(255, 204, 51, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(stanceX - stanceW / 2, stanceTop, stanceW, groundY - stanceTop);
    ctx.setLineDash([]);

    // "GOLFER" label
    ctx.fillStyle = 'rgba(255, 204, 51, 0.5)';
    ctx.font = '10px "DM Sans", sans-serif';
    ctx.fillText('GOLFER', stanceX, stanceTop - 8);

    // Feet markers
    const footY = groundY - 4;
    ctx.fillStyle = 'rgba(255, 204, 51, 0.4)';
    ctx.fillRect(stanceX - 14, footY, 8, 4);
    ctx.fillRect(stanceX + 6, footY, 8, 4);

    // Camera position hint (arrow pointing to indicate perpendicular view)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Camera: side view', 12, h - 12);

    // Target direction arrow (left side)
    const arrowY = groundY - 30;
    ctx.strokeStyle = 'rgba(255, 204, 51, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ballX, arrowY);
    ctx.lineTo(w * 0.1, arrowY);
    ctx.stroke();
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(w * 0.1, arrowY);
    ctx.lineTo(w * 0.1 + 8, arrowY - 4);
    ctx.moveTo(w * 0.1, arrowY);
    ctx.lineTo(w * 0.1 + 8, arrowY + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 204, 51, 0.5)';
    ctx.font = '9px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET', w * 0.04, arrowY - 8);
  }, [isRecording]);

  // Render loop
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      drawGuide();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [drawGuide]);

  // Handle recording
  useEffect(() => {
    if (!isRecording || !streamRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      onRecordingComplete(url);
    };

    recorder.start();

    // Auto-stop after 8 seconds
    const timer = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 8000);

    // Track recording time
    const startTime = Date.now();
    const interval = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 200);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      setRecordingTime(0);
      if (recorder.state === 'recording') recorder.stop();
    };
  }, [isRecording, onRecordingComplete]);

  // Countdown before recording
  const handleRecord = useCallback(() => {
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        setCountdown(null);
        clearInterval(interval);
        onStartRecording();
      }
    }, 1000);
  }, [onStartRecording]);

  // Canvas sizing
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

      {/* Guide overlay canvas */}
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0 w-full h-full"
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-3 z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-gold text-sm font-bold tracking-widest uppercase">
          {isRecording ? 'Recording' : 'Setup'}
        </div>
        {!isRecording && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-lg cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-14 right-4 z-10 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-medium">{recordingTime}s</span>
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-8xl font-bold text-gold drop-shadow-lg">{countdown}</div>
        </div>
      )}

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
              className="px-4 py-2 bg-gold/20 text-gold rounded-lg text-sm cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {cameraReady && !isRecording && countdown === null && (
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-10">
          <div className="text-white/60 text-xs text-center px-8">
            Position phone sideways with ball and golfer in frame
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={onClose}
              className="px-5 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl text-sm cursor-pointer"
            >
              Simulator
            </button>
            <button
              onClick={handleRecord}
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-red-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
