import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, Volume2, VolumeX, Download, Circle, Square, Maximize, Minimize, Wifi, WifiOff, Play, Hand, AlertTriangle, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useRobotStore } from '@/store/useRobotStore';
import { VideoStreamService } from '@/services/videoStreamService';
import { AudioService, type RobotSoundType } from '@/services/audioService';
import { playBackgroundTone, deliverySounds } from '@/lib/audioEffects';

const SOUND_BUTTONS: { type: RobotSoundType; label: string; emoji: string }[] = [
  { type: 'greeting', label: 'Saudação', emoji: '👋' },
  { type: 'alert', label: 'Alerta', emoji: '🔔' },
  { type: 'success', label: 'Sucesso', emoji: '✅' },
  { type: 'navigation', label: 'Navegação', emoji: '🧭' },
  { type: 'delivery', label: 'Entrega', emoji: '📦' },
  { type: 'error', label: 'Erro', emoji: '❌' },
];

const Media = () => {
  const { t } = useTranslation();
  const { ip, port } = useRobotStore();

  // Video
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoServiceRef = useRef<VideoStreamService | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [videoConnected, setVideoConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fpsCounter = useRef({ count: 0, lastTime: Date.now() });
  const recordedFrames = useRef<Blob[]>([]);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Audio
  const audioServiceRef = useRef<AudioService | null>(null);
  const [volume, setVolume] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState<string | null>(null);

  // Init services
  useEffect(() => {
    const vs = new VideoStreamService(ip, parseInt(port) || 8080);
    const as2 = new AudioService(ip, 80);
    videoServiceRef.current = vs;
    audioServiceRef.current = as2;

    vs.onConnect(() => setVideoConnected(true));
    vs.onDisconnect(() => setVideoConnected(false));
    vs.onFrame((frame) => {
      // Render MJPEG frame to canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // FPS tracking
      fpsCounter.current.count++;
      const now = Date.now();
      if (now - fpsCounter.current.lastTime >= 1000) {
        setFps(fpsCounter.current.count);
        fpsCounter.current = { count: 0, lastTime: now };
      }

      const url = URL.createObjectURL(frame.data);
      const img = imgRef.current || new Image();
      imgRef.current = img;
      img.onload = () => {
        if (!canvas) return;
        canvas.width = img.naturalWidth || 640;
        canvas.height = img.naturalHeight || 480;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
      };
      img.src = url;

      // If recording, save frame blob
      if (isRecording) {
        recordedFrames.current.push(frame.data);
      }
    });

    as2.onPlay(() => setIsPlaying(true));
    as2.onStop(() => { setIsPlaying(false); setCurrentSound(null); });

    // Try connecting
    vs.connect().catch(() => {
      console.log('[Media] Video connection failed, simulation mode');
    });

    return () => {
      vs.disconnect();
    };
  }, [ip, port]);

  // Simulation fallback
  const frameRef = useRef(0);
  useEffect(() => {
    if (videoConnected) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 640;
    canvas.height = 480;

    let animId: number;
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      frameRef.current++;
      const f = frameRef.current;

      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Scan line
      const scanY = (f * 2) % h;
      const grad = ctx.createLinearGradient(0, scanY - 15, 0, scanY + 15);
      grad.addColorStop(0, 'rgba(255, 107, 53, 0)');
      grad.addColorStop(0.5, 'rgba(255, 107, 53, 0.2)');
      grad.addColorStop(1, 'rgba(255, 107, 53, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 15, w, 30);

      // Crosshair
      const cx = w / 2, cy = h / 2;
      ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
      ctx.beginPath(); ctx.moveTo(cx - 25, cy); ctx.lineTo(cx - 8, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 25, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 25); ctx.lineTo(cx, cy - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 25); ctx.stroke();

      // Corner brackets
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.6)';
      ctx.lineWidth = 2;
      const bk = 20;
      [[6, 6, 1, 1], [w - 6, 6, -1, 1], [6, h - 6, 1, -1], [w - 6, h - 6, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * bk); ctx.lineTo(x, y); ctx.lineTo(x + dx * bk, y); ctx.stroke();
      });

      // Text overlays
      ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
      ctx.font = '12px monospace';
      ctx.fillText(`CAM01 ${new Date().toLocaleTimeString()}`, 10, h - 12);
      ctx.fillText('SIMULAÇÃO', w - 100, 18);

      // Noise
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }

      // REC indicator if recording
      if (isRecording && f % 60 < 40) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
        ctx.beginPath(); ctx.arc(20, 20, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('REC', 30, 25);
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [videoConnected, isRecording]);

  // Screenshot
  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `robot-screenshot-${Date.now()}.png`;
    link.click();
    playBackgroundTone('happy', 0.1);
  }, []);

  // Recording
  const startRecording = useCallback(() => {
    recordedFrames.current = [];
    setIsRecording(true);
    setRecordingTime(0);
    recordingInterval.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
    playBackgroundTone('deliveryStart', 0.1);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }

    // If we have real frames, save as webm blob
    if (recordedFrames.current.length > 0) {
      const blob = new Blob(recordedFrames.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `robot-video-${Date.now()}.webm`;
      link.click();
      URL.revokeObjectURL(url);
    }

    // For simulation, capture canvas as snapshot
    const canvas = canvasRef.current;
    if (canvas && recordedFrames.current.length === 0) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `robot-recording-snapshot-${Date.now()}.png`;
      link.click();
    }

    playBackgroundTone('celebrate', 0.1);
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(f => !f);
  }, [isFullscreen]);

  // Audio
  const handlePlaySound = async (type: RobotSoundType) => {
    setCurrentSound(type);
    const service = audioServiceRef.current;
    if (service) {
      const ok = await service.playRobotAudio(type);
      if (!ok) {
        // Fallback to local tone
        const toneMap: Record<string, string> = {
          greeting: 'happy', alert: 'alert', error: 'alert',
          success: 'celebrate', navigation: 'warm', delivery: 'deliveryStart',
        };
        playBackgroundTone(toneMap[type] as any, volume / 100);
        setTimeout(() => { setIsPlaying(false); setCurrentSound(null); }, 1500);
      }
    }
  };

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    audioServiceRef.current?.setVolume(v);
  };

  const handleStop = () => {
    audioServiceRef.current?.stop();
    setIsPlaying(false);
    setCurrentSound(null);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title="Mídia do Robô" showBack />

      <div className="p-4 space-y-4">
        {/* Video Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Stream de Vídeo
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={videoConnected ? 'default' : 'secondary'} className="text-[10px]">
                  {videoConnected ? (
                    <><Wifi className="w-3 h-3 mr-1" /> LIVE {fps}fps</>
                  ) : (
                    <><WifiOff className="w-3 h-3 mr-1" /> SIMULAÇÃO</>
                  )}
                </Badge>
                {isRecording && (
                  <Badge variant="destructive" className="text-[10px] animate-pulse">
                    <Circle className="w-2 h-2 mr-1 fill-current" /> REC {formatTime(recordingTime)}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div ref={containerRef} className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
              {!videoConnected && (
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className="text-[9px] bg-background/60 backdrop-blur-sm">
                    <AlertTriangle className="w-3 h-3 mr-1 text-warning" />
                    Câmera não conectada — modo simulação
                  </Badge>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={handleScreenshot} className="text-xs">
                <Download className="w-4 h-4 mr-1" /> Screenshot
              </Button>
              {!isRecording ? (
                <Button variant="outline" size="sm" onClick={startRecording} className="text-xs">
                  <Video className="w-4 h-4 mr-1" /> Gravar
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={stopRecording} className="text-xs">
                  <Square className="w-3 h-3 mr-1 fill-current" /> Parar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={toggleFullscreen} className="text-xs">
                {isFullscreen ? <Minimize className="w-4 h-4 mr-1" /> : <Maximize className="w-4 h-4 mr-1" />}
                {isFullscreen ? 'Sair' : 'Tela cheia'}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  videoServiceRef.current?.resetReconnect();
                  videoServiceRef.current?.disconnect();
                  videoServiceRef.current?.connect().catch(() => {});
                }}
                className="text-xs"
              >
                <Wifi className="w-4 h-4 mr-1" /> Reconectar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audio Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              Controle de Áudio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Volume Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Volume</span>
                <span className="text-sm font-mono font-bold text-foreground">{volume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  min={0} max={100} step={1}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Sound Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {SOUND_BUTTONS.map((s) => (
                <motion.div key={s.type} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant={currentSound === s.type ? 'default' : 'outline'}
                    size="sm"
                    className="w-full text-xs"
                    disabled={isPlaying && currentSound !== s.type}
                    onClick={() => handlePlaySound(s.type)}
                  >
                    <span className="mr-1">{s.emoji}</span> {s.label}
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Playing indicator */}
            {isPlaying && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-foreground">
                    Reproduzindo: <strong>{currentSound}</strong>
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleStop}>
                  <Square className="w-3 h-3 mr-1" /> Parar
                </Button>
              </motion.div>
            )}

            {/* Connection info */}
            <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t border-border">
              <p>📡 Vídeo: ws://{ip}:{port}/video</p>
              <p>🔊 Áudio: http://{ip}:80/api/audio/[tipo]</p>
              <p>🤖 Robô: CT300-H330-1029-01</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Media;
