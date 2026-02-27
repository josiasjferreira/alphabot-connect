/**
 * AudioControlPanel.tsx
 * Painel de controle de áudio do robô via MQTT
 * Baseado no Guia de Integração v3.0
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Mic, Bell, AlertTriangle, CheckCircle, XCircle, Wifi, WifiOff, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAlphaBotAudio } from '@/hooks/useAlphaBotAudio';
import { playBackgroundTone } from '@/lib/audioEffects';

const QUICK_PHRASES = [
  { text: 'Olá! Bem-vindo!', emoji: '👋' },
  { text: 'Atenção, por favor.', emoji: '⚠️' },
  { text: 'Entrega concluída com sucesso.', emoji: '📦' },
  { text: 'Bateria fraca. Preciso recarregar.', emoji: '🔋' },
  { text: 'Iniciando patrulha.', emoji: '🛡️' },
  { text: 'Obrigado! Até logo.', emoji: '🙏' },
];

const ALERT_BUTTONS: { type: 'success' | 'error' | 'warning'; label: string; emoji: string; icon: typeof CheckCircle }[] = [
  { type: 'success', label: 'Sucesso', emoji: '✅', icon: CheckCircle },
  { type: 'warning', label: 'Aviso', emoji: '⚠️', icon: AlertTriangle },
  { type: 'error', label: 'Erro', emoji: '❌', icon: XCircle },
];

const AudioControlPanel = () => {
  const { speak, beep, alert, setRobotVolume, isConnected, currentVolume } = useAlphaBotAudio();
  const [ttsText, setTtsText] = useState('');

  const handleSpeak = () => {
    if (!ttsText.trim()) return;
    speak(ttsText.trim());
    // Preview local
    playBackgroundTone('happy', 0.1);
    setTtsText('');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Áudio do Robô (MQTT)
          </CardTitle>
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-[10px]">
            {isConnected ? (
              <><Wifi className="w-3 h-3 mr-1" /> MQTT Online</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TTS Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Texto para Fala (TTS)</label>
          <div className="flex gap-2">
            <Input
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Digite o que o robô deve falar..."
              onKeyDown={(e) => e.key === 'Enter' && handleSpeak()}
              className="flex-1"
            />
            <Button onClick={handleSpeak} disabled={!ttsText.trim()} size="sm">
              <Send className="w-4 h-4 mr-1" /> Falar
            </Button>
          </div>
        </div>

        {/* Quick Phrases */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Frases Rápidas</label>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PHRASES.map((phrase) => (
              <motion.div key={phrase.text} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start"
                  onClick={() => {
                    speak(phrase.text);
                    playBackgroundTone('happy', 0.08);
                  }}
                >
                  <span className="mr-1.5">{phrase.emoji}</span>
                  <span className="truncate">{phrase.text}</span>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Alertas Sonoros</label>
          <div className="grid grid-cols-4 gap-2">
            {ALERT_BUTTONS.map((a) => (
              <Button
                key={a.type}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => alert(a.type)}
              >
                <span className="mr-1">{a.emoji}</span> {a.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => beep()}
            >
              <Bell className="w-3 h-3 mr-1" /> Beep
            </Button>
          </div>
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume do Robô</span>
            <span className="text-sm font-mono font-bold text-foreground">{currentVolume}%</span>
          </div>
          <div className="flex items-center gap-3">
            <VolumeX className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[currentVolume]}
              onValueCommit={(val) => setRobotVolume(val[0])}
              onValueChange={(val) => setRobotVolume(val[0])}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <Volume2 className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Info */}
        <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t border-border">
          <p>📡 MQTT: ws://192.168.99.100:9002</p>
          <p>🔊 Tópico TTS: alphabot/audio/tts</p>
          <p>🤖 Destino: Placa Android (.10) → Alto-falante</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AudioControlPanel;
