import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Camera, CameraOff, Video, Circle, Download,
  Maximize2, Minimize2, Settings2, Wifi, WifiOff, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRobotStore } from '@/store/useRobotStore';
import { useMQTT } from '@/hooks/useMQTT';
import { SDK_TOPICS } from '@/shared-core/types/csjbot-sdk';
import { NETWORK, PORTS } from '@/shared-core/constants';
import { VideoStreamService, type VideoFrame } from '@/services/videoStreamService';

type CamStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const CameraStream = () => {
  const navigate = useNavigate();
  const { publish, isConnected: mqttConnected } = useMQTT();
  const { connectionStatus } = useRobotStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const serviceRef = useRef<VideoStreamService | null>(null);

  const [camStatus, setCamStatus] = useState<CamStatus>('disconnected');
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [resolution, setResolution] = useState('1920x1080');
  const [targetFps, setTargetFps] = useState(30);
  const [recording, setRecording] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fpsCounter = useRef({ count: 0, lastTime: Date.now() });
  const containerRef = useRef<HTMLDivElement>(null);

  // Render frame on canvas
  const renderFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    fpsCounter.current.count++;
    const now = Date.now();
    if (now - fpsCounter.current.lastTime >= 1000) {
      setFps(fpsCounter.current.count);
      fpsCounter.current = { count: 0, lastTime: now };
    }
    setFrameCount(c => c + 1);

    const url = URL.createObjectURL(frame.data);
    const img = imgRef.current || new Image();
    imgRef.current = img;
    img.onload = () => {
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      ctx.drawImage(img, 0, 0);
      drawHUD(ctx, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const drawHUD = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Corner brackets
    ctx.strokeStyle = 'rgba(0, 200, 120, 0.7)';
    ctx.lineWidth = 2;
    const bk = 20;
    [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * bk);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * bk, y);
      ctx.stroke();
    });

    // Crosshair
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx + 30, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy + 30); ctx.stroke();
    ctx.setLineDash([]);

    // Status bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, h - 24, w, 24);
    ctx.fillStyle = 'rgba(0, 200, 120, 0.9)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`CAM01 · LIVE · ${new Date().toLocaleTimeString()}`, 8, h - 8);

    // REC indicator
    ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
    ctx.beginPath(); ctx.arc(w - 60, h - 13, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('REC', w - 52, h - 8);
  };

  // Simulation fallback
  const simRef = useRef<number>(0);
  const simFrameRef = useRef(0);
  useEffect(() => {
    if (camStatus !== 'disconnected' && camStatus !== 'error') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 640;
    canvas.height = 480;

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      simFrameRef.current++;
      const f = simFrameRef.current;

      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Scan line
      const scanY = (f * 2) % h;
      const g = ctx.createLinearGradient(0, scanY - 15, 0, scanY + 15);
      g.addColorStop(0, 'rgba(0,200,120,0)');
      g.addColorStop(0.5, 'rgba(0,200,120,0.2)');
      g.addColorStop(1, 'rgba(0,200,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, scanY - 15, w, 30);

      // Center text
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AGUARDANDO CONEXÃO DA CÂMERA', w / 2, h / 2 - 10);
      ctx.font = '11px monospace';
      ctx.fillText(`robot/camera/start → ${NETWORK.ANDROID_BOARD_IP}:${PORTS.ANDROID_WS}`, w / 2, h / 2 + 12);
      ctx.textAlign = 'left';

      // Corners
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.5)';
      ctx.lineWidth = 2;
      const bk = 20;
      [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * bk); ctx.lineTo(x, y); ctx.lineTo(x + dx * bk, y); ctx.stroke();
      });

      // Status
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, h - 24, w, 24);
      ctx.fillStyle = 'rgba(255,200,50,0.8)';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`CAM01 · STANDBY · ${new Date().toLocaleTimeString()}`, 8, h - 8);

      // Noise
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }

      simRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(simRef.current);
  }, [camStatus]);

  // Connect / Disconnect
  const connectCamera = useCallback(() => {
    if (window.location.protocol === 'https:') {
      console.warn('[Camera] Mixed content blocked on HTTPS preview');
      setCamStatus('error');
      return;
    }

    setCamStatus('connecting');

    // Send MQTT start command
    if (mqttConnected) {
      publish(SDK_TOPICS.CAMERA_START, JSON.stringify({
        resolution,
        fps: targetFps,
      }));
    }

    // Connect WebSocket video stream
    const svc = new VideoStreamService(NETWORK.ANDROID_BOARD_IP, PORTS.ANDROID_WS);
    serviceRef.current = svc;

    svc.onFrame(renderFrame);
    svc.onConnect(() => setCamStatus('connected'));
    svc.onDisconnect(() => setCamStatus('disconnected'));

    svc.connect().catch(() => {
      setCamStatus('error');
    });
  }, [mqttConnected, publish, renderFrame, resolution, targetFps]);

  const disconnectCamera = useCallback(() => {
    if (mqttConnected) {
      publish(SDK_TOPICS.CAMERA_STOP, JSON.stringify({}));
    }
    serviceRef.current?.disconnect();
    serviceRef.current = null;
    setCamStatus('disconnected');
    setFps(0);
    setFrameCount(0);
  }, [mqttConnected, publish]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      serviceRef.current?.disconnect();
    };
  }, []);

  // Screenshot
  const takeScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `camera-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  const statusColor = {
    disconnected: 'bg-muted-foreground',
    connecting: 'bg-warning animate-pulse',
    connected: 'bg-success animate-pulse',
    error: 'bg-destructive',
  }[camStatus];

  const statusLabel = {
    disconnected: 'Desconectado',
    connecting: 'Conectando...',
    connected: `Conectado · ${fps} FPS`,
    error: 'Erro de conexão',
  }[camStatus];

  return (
    <div className="min-h-screen bg-background safe-bottom" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              Câmera do Robô
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Streaming MJPEG via WebSocket · SDK v2.4.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-[11px] font-mono text-muted-foreground">{statusLabel}</span>
        </div>
      </div>

      {/* Canvas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative bg-black"
      >
        <canvas
          ref={canvasRef}
          className="w-full aspect-video"
          style={{ imageRendering: 'auto' }}
        />

        {/* Overlay controls */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button onClick={takeScreenshot} className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Frame counter */}
        {camStatus === 'connected' && (
          <div className="absolute top-3 left-3 text-[10px] font-mono text-white/70 bg-black/50 px-2 py-1 rounded">
            Frames: {frameCount}
          </div>
        )}
      </motion.div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        {/* Connection buttons */}
        <div className="flex gap-3">
          {camStatus === 'disconnected' || camStatus === 'error' ? (
            <Button onClick={connectCamera} className="flex-1 gap-2">
              <Wifi className="w-4 h-4" />
              Conectar Câmera
            </Button>
          ) : (
            <Button onClick={disconnectCamera} variant="destructive" className="flex-1 gap-2">
              <WifiOff className="w-4 h-4" />
              Desconectar
            </Button>
          )}
          {camStatus === 'error' && (
            <Button onClick={connectCamera} variant="outline" size="icon">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Status', value: camStatus === 'connected' ? 'LIVE' : 'OFF', color: camStatus === 'connected' ? 'text-success' : 'text-muted-foreground' },
            { label: 'FPS', value: `${fps}`, color: fps > 20 ? 'text-success' : fps > 0 ? 'text-warning' : 'text-muted-foreground' },
            { label: 'Frames', value: `${frameCount}`, color: 'text-foreground' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Settings panel */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Configurações da Câmera
        </button>

        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-card rounded-xl border border-border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Resolução</label>
              <select
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="text-xs bg-muted rounded-lg px-2 py-1 text-foreground border-none outline-none"
              >
                <option value="1920x1080">1920×1080</option>
                <option value="1280x720">1280×720</option>
                <option value="640x480">640×480</option>
                <option value="320x240">320×240</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">FPS alvo</label>
              <select
                value={targetFps}
                onChange={e => setTargetFps(Number(e.target.value))}
                className="text-xs bg-muted rounded-lg px-2 py-1 text-foreground border-none outline-none"
              >
                <option value={30}>30 FPS</option>
                <option value={15}>15 FPS</option>
                <option value={10}>10 FPS</option>
                <option value={5}>5 FPS</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Endpoint</label>
              <span className="text-[11px] font-mono text-muted-foreground">
                ws://{NETWORK.ANDROID_BOARD_IP}:{PORTS.ANDROID_WS}/video
              </span>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">MQTT Start</label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {SDK_TOPICS.CAMERA_START}
              </span>
            </div>
          </motion.div>
        )}

        {/* MQTT info */}
        <div className="bg-muted/30 rounded-xl p-3 space-y-1">
          <p className="text-[11px] font-semibold text-foreground">Fluxo de Comunicação</p>
          <p className="text-[10px] text-muted-foreground">
            1. MQTT → <code className="bg-muted px-1 rounded">{SDK_TOPICS.CAMERA_START}</code> com resolução/fps
          </p>
          <p className="text-[10px] text-muted-foreground">
            2. WebSocket → <code className="bg-muted px-1 rounded">ws://{NETWORK.ANDROID_BOARD_IP}:{PORTS.ANDROID_WS}/video</code>
          </p>
          <p className="text-[10px] text-muted-foreground">
            3. Frames MJPEG renderizados no canvas em tempo real
          </p>
          <p className="text-[10px] text-muted-foreground">
            4. MQTT → <code className="bg-muted px-1 rounded">{SDK_TOPICS.CAMERA_STOP}</code> para encerrar
          </p>
        </div>
      </div>
    </div>
  );
};

export default CameraStream;
