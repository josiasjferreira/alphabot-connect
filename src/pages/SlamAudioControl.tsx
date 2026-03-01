/**
 * SlamAudioControl.tsx
 * Página de controle integrado SLAM + Áudio do robô.
 * Combina navegação SLAMWARE com feedback sonoro via MQTT.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Navigation, MapPin, Volume2, VolumeX, Wifi, WifiOff,
  Play, Square, Compass, AlertTriangle, Mic, Send,
} from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useSlamAudio } from '@/hooks/useSlamAudio';
import type { NavTarget } from '@/shared-core/types/slam';

const PRESET_TARGETS: NavTarget[] = [
  { x: 0, y: 0, label: 'Base / Docking' },
  { x: 2.5, y: 1.0, label: 'Mesa 1' },
  { x: 5.0, y: 3.0, label: 'Mesa 2' },
  { x: 1.0, y: 4.5, label: 'Recepção' },
  { x: 3.5, y: 2.0, label: 'Cozinha' },
  { x: 6.0, y: 0.5, label: 'Estoque' },
];

const AUDIO_PHRASES = [
  { text: 'Olá! Eu sou o AlphaBot!', emoji: '👋' },
  { text: 'Estou a caminho, aguarde.', emoji: '🚶' },
  { text: 'Chegou sua encomenda!', emoji: '📦' },
  { text: 'Por favor, libere a passagem.', emoji: '🚧' },
  { text: 'Obrigado, tenha um bom dia!', emoji: '😊' },
  { text: 'Preciso de ajuda, por favor.', emoji: '🆘' },
];

const statusColor: Record<string, string> = {
  connected: 'bg-success',
  connecting: 'bg-warning animate-pulse',
  disconnected: 'bg-muted-foreground',
  error: 'bg-destructive',
};

const SlamAudioControl = () => {
  const {
    slamStatus, pose, isNavigating,
    connectSlam, disconnectSlam, navigateTo, cancelNav, announcePosition,
    speak, stopAudio, setVolume, volume, isPlaying, isMqttOnline, lastAnnouncement,
  } = useSlamAudio();

  const [ttsText, setTtsText] = useState('');
  const [customX, setCustomX] = useState('');
  const [customY, setCustomY] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  const handleSpeak = () => {
    if (!ttsText.trim()) return;
    speak(ttsText.trim());
    setTtsText('');
  };

  const handleCustomNav = () => {
    const x = parseFloat(customX);
    const y = parseFloat(customY);
    if (isNaN(x) || isNaN(y)) return;
    navigateTo({ x, y, label: customLabel || undefined });
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="SLAM + Áudio" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connection Status Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusColor[slamStatus]}`} />
            <span className="text-sm font-semibold text-foreground">SLAM: {slamStatus}</span>
            <Badge variant={isMqttOnline ? 'default' : 'destructive'} className="text-[10px]">
              {isMqttOnline ? <><Wifi className="w-3 h-3 mr-1" />MQTT</> : <><WifiOff className="w-3 h-3 mr-1" />Local</>}
            </Badge>
          </div>
          <div className="flex gap-2">
            {slamStatus !== 'connected' ? (
              <Button size="sm" onClick={connectSlam} disabled={slamStatus === 'connecting'}>
                <Play className="w-4 h-4 mr-1" /> Conectar
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={disconnectSlam}>
                <Square className="w-4 h-4 mr-1" /> Desconectar
              </Button>
            )}
          </div>
        </div>

        {/* Pose Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" /> Posição Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">X</p>
                <p className="text-lg font-mono font-bold text-foreground">{pose.x.toFixed(2)}m</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Y</p>
                <p className="text-lg font-mono font-bold text-foreground">{pose.y.toFixed(2)}m</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">θ</p>
                <p className="text-lg font-mono font-bold text-foreground">{(pose.theta * 180 / Math.PI).toFixed(0)}°</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">Qualidade: {pose.quality}%</span>
              <Button size="sm" variant="ghost" onClick={announcePosition}>
                <Volume2 className="w-4 h-4 mr-1" /> Anunciar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Presets */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" /> Navegação
              </CardTitle>
              {isNavigating && (
                <Button size="sm" variant="destructive" onClick={cancelNav}>
                  <Square className="w-3 h-3 mr-1" /> Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {PRESET_TARGETS.map((target) => (
                <motion.div key={target.label} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-auto py-2"
                    disabled={isNavigating || slamStatus !== 'connected'}
                    onClick={() => navigateTo(target)}
                  >
                    <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{target.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Custom coordinate */}
            <div className="flex gap-2">
              <Input placeholder="X" value={customX} onChange={e => setCustomX(e.target.value)} className="w-16 text-xs" />
              <Input placeholder="Y" value={customY} onChange={e => setCustomY(e.target.value)} className="w-16 text-xs" />
              <Input placeholder="Label" value={customLabel} onChange={e => setCustomLabel(e.target.value)} className="flex-1 text-xs" />
              <Button size="sm" onClick={handleCustomNav} disabled={isNavigating || slamStatus !== 'connected'}>
                <Navigation className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audio Control */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary" /> Áudio do Robô
              </CardTitle>
              {isPlaying && (
                <Badge variant="secondary" className="text-[10px] animate-pulse bg-success/20 text-success border-success/30">
                  🔊 Falando
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* TTS Input */}
            <div className="flex gap-2">
              <Input
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                placeholder="O que o robô deve falar..."
                onKeyDown={e => e.key === 'Enter' && handleSpeak()}
                className="flex-1"
              />
              <Button onClick={handleSpeak} disabled={!ttsText.trim()} size="sm">
                <Send className="w-4 h-4" />
              </Button>
              <Button onClick={stopAudio} disabled={!isPlaying} variant="destructive" size="sm">
                <Square className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick phrases */}
            <div className="grid grid-cols-2 gap-2">
              {AUDIO_PHRASES.map(p => (
                <motion.div key={p.text} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => speak(p.text)}>
                    <span className="mr-1">{p.emoji}</span>
                    <span className="truncate">{p.text}</span>
                  </Button>
                </motion.div>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <Slider value={[volume]} onValueChange={v => setVolume(v[0])} min={0} max={100} step={5} className="flex-1" />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-mono w-10 text-right text-foreground">{volume}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Last announcement */}
        {lastAnnouncement && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Último anúncio:</span> {lastAnnouncement}
            </p>
          </div>
        )}

        {/* Footer info */}
        <p className="text-[10px] text-center text-muted-foreground">
          SLAM: {slamStatus === 'connected' ? '192.168.99.2:1445' : 'desconectado'} •
          Áudio: {isMqttOnline ? 'MQTT ws://192.168.99.100:9002' : 'Web Speech (local)'}
        </p>
      </div>
    </div>
  );
};

export default SlamAudioControl;
