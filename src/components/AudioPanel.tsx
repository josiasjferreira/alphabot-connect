/**
 * AudioPanel.tsx
 * Painel de controle de áudio do robô (MQTT + Web Speech fallback)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Mic, Square, Wifi, WifiOff, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useAudioMQTT } from '@/hooks/useAudioMQTT';

const QUICK_PHRASES = [
  { text: 'Olá! Bem-vindo à Solar Life!', emoji: '👋' },
  { text: 'Posso ajudar com algo?', emoji: '🤖' },
  { text: 'Conheça nossos painéis solares!', emoji: '☀️' },
  { text: 'Economize energia com a gente.', emoji: '💡' },
  { text: 'Obrigado pela visita!', emoji: '🙏' },
  { text: 'Aguarde um momento, por favor.', emoji: '⏳' },
];

const AudioPanel = () => {
  const { speak, stop, setVolume, volume, isPlaying, isMqttOnline } = useAudioMQTT();
  const [ttsText, setTtsText] = useState('');

  const handleSpeak = () => {
    if (!ttsText.trim()) return;
    speak(ttsText.trim());
    setTtsText('');
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Áudio do Robô
          </CardTitle>
          <div className="flex items-center gap-2">
            {isPlaying && (
              <Badge variant="secondary" className="text-[10px] animate-pulse bg-success/20 text-success border-success/30">
                🔊 Falando
              </Badge>
            )}
            <Badge variant={isMqttOnline ? 'default' : 'destructive'} className="text-[10px]">
              {isMqttOnline ? (
                <><Wifi className="w-3 h-3 mr-1" /> MQTT</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" /> Local</>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* TTS Input */}
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
          <Button
            onClick={stop}
            disabled={!isPlaying}
            variant="destructive"
            size="sm"
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Phrases */}
        <div className="grid grid-cols-2 gap-2">
          {QUICK_PHRASES.map((phrase) => (
            <motion.div key={phrase.text} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs justify-start"
                onClick={() => speak(phrase.text)}
              >
                <span className="mr-1.5">{phrase.emoji}</span>
                <span className="truncate">{phrase.text}</span>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Volume</span>
            <span className="text-sm font-mono font-bold text-foreground">{volume}%</span>
          </div>
          <div className="flex items-center gap-3">
            <VolumeX className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={(val) => setVolume(val[0])}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <Volume2 className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        {/* Info footer */}
        <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
          {isMqttOnline
            ? '📡 MQTT ws://192.168.99.100:9002 • alphabot/cmd/audio/*'
            : '🗣️ Fallback: Web Speech API (navegador local)'}
        </p>
      </CardContent>
    </Card>
  );
};

export default AudioPanel;
