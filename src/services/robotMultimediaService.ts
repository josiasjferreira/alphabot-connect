/**
 * robotMultimediaService.ts
 * Serviço de multimídia para a PLACA ANDROID do robô (192.168.99.10)
 *
 * Este serviço encapsula chamadas para o nó crítico da placa Android,
 * que é o cérebro do robô e controla: TTS, display, animações e sons.
 *
 * FASE ATUAL: Endpoints simulados / placeholders.
 * Quando as APIs reais da placa Android forem mapeadas por engenharia reversa,
 * basta atualizar os endpoints abaixo.
 *
 * Endpoints esperados (baseados na eng. reversa do Delivery_i18n_amy V5.3.8):
 *   POST /api/tts/speak       → { text, lang, speed }
 *   POST /api/display/show    → { type: 'image'|'video', url, duration }
 *   POST /api/animation/play  → { name, loop }
 *   POST /api/audio/play      → { url } ou { preset }
 *   GET  /api/status           → status geral da placa
 *   POST /api/enterPage        → { pageName } (navegar para página no app Android)
 */

import { NETWORK_CONFIG } from '@/config/mqtt';

const ANDROID_BOARD_BASE = `http://${NETWORK_CONFIG.ANDROID_BOARD_IP}`;

// ─── Tipos ───

export type AnimationName = 'wave' | 'welcome' | 'celebrate' | 'love' | 'star' | 'present_product' | 'idle';

export interface TTSRequest {
  text: string;
  lang?: 'pt-BR' | 'en-US' | 'zh-CN';
  speed?: number; // 0.5–2.0
}

export interface DisplayRequest {
  type: 'image' | 'video' | 'html';
  url: string;
  duration?: number; // ms, 0 = indefinido
  fullscreen?: boolean;
}

export interface AudioRequest {
  preset?: 'greeting' | 'alert' | 'success' | 'error' | 'product_highlight';
  url?: string;
  volume?: number; // 0–100
}

export interface MultimediaStatus {
  online: boolean;
  ttsAvailable: boolean;
  displayAvailable: boolean;
  audioAvailable: boolean;
  animationAvailable: boolean;
  ip: string;
  latencyMs: number;
}

// ─── Serviço ───

class RobotMultimediaService {
  private baseUrl: string;
  private _online = false;
  private _lastLatency = -1;

  constructor(baseUrl = ANDROID_BOARD_BASE) {
    this.baseUrl = baseUrl;
  }

  get online() { return this._online; }
  get latencyMs() { return this._lastLatency; }

  // ─── Ping / Status ───

  async checkStatus(): Promise<MultimediaStatus> {
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      // TODO: Confirmar endpoint real da placa Android
      const res = await fetch(`${this.baseUrl}/api/status`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      this._lastLatency = Math.round(performance.now() - start);

      if (res.ok) {
        this._online = true;
        const data = await res.json().catch(() => ({}));
        return {
          online: true,
          ttsAvailable: data.tts !== false,
          displayAvailable: data.display !== false,
          audioAvailable: data.audio !== false,
          animationAvailable: data.animation !== false,
          ip: NETWORK_CONFIG.ANDROID_BOARD_IP,
          latencyMs: this._lastLatency,
        };
      }
    } catch {
      this._lastLatency = Math.round(performance.now() - start);
    }

    this._online = false;
    return {
      online: false,
      ttsAvailable: false,
      displayAvailable: false,
      audioAvailable: false,
      animationAvailable: false,
      ip: NETWORK_CONFIG.ANDROID_BOARD_IP,
      latencyMs: this._lastLatency,
    };
  }

  // ─── TTS (Text-to-Speech) ───

  /** Fazer o robô falar via placa Android */
  async speak(request: TTSRequest): Promise<boolean> {
    // TODO: Implementar quando endpoint real for mapeado
    // Endpoint esperado: POST /api/tts/speak
    console.log(`🔊 [MultimediaService] TTS: "${request.text}" (lang=${request.lang ?? 'pt-BR'})`);
    return this.post('/api/tts/speak', {
      text: request.text,
      lang: request.lang ?? 'pt-BR',
      speed: request.speed ?? 1.0,
    });
  }

  /** Parar fala atual */
  async stopSpeech(): Promise<boolean> {
    // TODO: Implementar quando endpoint real for mapeado
    return this.post('/api/tts/stop', {});
  }

  // ─── Display ───

  /** Exibir conteúdo na tela do robô */
  async showOnDisplay(request: DisplayRequest): Promise<boolean> {
    // TODO: Implementar quando endpoint real for mapeado
    // Endpoint esperado: POST /api/display/show
    console.log(`📺 [MultimediaService] Display: ${request.type} → ${request.url}`);
    return this.post('/api/display/show', request);
  }

  /** Navegar para uma página no app Android do robô */
  async enterPage(pageName: string): Promise<boolean> {
    // TODO: Confirmar endpoint — baseado em eng. reversa do V5.3.8
    console.log(`📱 [MultimediaService] enterPage: ${pageName}`);
    return this.post('/api/enterPage', { pageName });
  }

  // ─── Animações ───

  /** Executar animação/gesto no robô */
  async playAnimation(name: AnimationName, loop = false): Promise<boolean> {
    // TODO: Implementar quando endpoint real for mapeado
    console.log(`🎭 [MultimediaService] Animation: ${name} (loop=${loop})`);
    return this.post('/api/animation/play', { name, loop });
  }

  async stopAnimation(): Promise<boolean> {
    return this.post('/api/animation/stop', {});
  }

  // ─── Áudio ───

  /** Tocar som/efeito no robô */
  async playAudio(request: AudioRequest): Promise<boolean> {
    // TODO: Implementar quando endpoint real for mapeado
    console.log(`🎵 [MultimediaService] Audio: ${request.preset ?? request.url}`);
    return this.post('/api/audio/play', request);
  }

  async setVolume(volume: number): Promise<boolean> {
    return this.post('/api/audio/volume', { volume: Math.max(0, Math.min(100, volume)) });
  }

  // ─── Integração com Produtos Solar Life ───

  /** Apresentar um produto no robô (TTS + animação + display) */
  async presentProduct(productId: string, productName: string, description: string): Promise<void> {
    console.log(`🌞 [MultimediaService] Apresentando produto: ${productName}`);

    // TODO: Orquestrar sequência real quando APIs estiverem disponíveis:
    // 1. Animação de apresentação
    await this.playAnimation('present_product');
    // 2. TTS com nome do produto
    await this.speak({ text: `Conheça o nosso ${productName}. ${description}` });
    // 3. Exibir imagem/vídeo na tela do robô
    // await this.showOnDisplay({ type: 'image', url: `.../${productId}.jpg`, fullscreen: true });
  }

  // ─── HTTP Helper ───

  private async post(path: string, body: unknown): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch (err) {
      console.warn(`⚠️ [MultimediaService] ${path} falhou:`, (err as Error).message);
      return false;
    }
  }
}

/** Singleton global */
export const robotMultimedia = new RobotMultimediaService();
export default RobotMultimediaService;
