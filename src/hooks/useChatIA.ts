// src/hooks/useChatIA.ts — Local-first Chat IA hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addChatMessage,
  getAllMessages,
  clearAllMessages,
  searchKnowledge,
  seedKnowledgeIfEmpty,
  type ChatMessage,
} from '@/db/chatDatabase';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { speak } from '@/hooks/useVoiceRecognition';

export function useChatIA() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const { status } = useRobotStore();
  const { send: wsSend } = useWebSocket();
  const initRef = useRef(false);

  // Initialize DB and load history
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      await seedKnowledgeIfEmpty();
      const saved = await getAllMessages();
      if (saved.length === 0) {
        const welcome: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'bot',
          text: t('chat.welcomeMessage'),
          createdAt: Date.now(),
          synced: false,
        };
        await addChatMessage(welcome);
        setMessages([welcome]);
      } else {
        setMessages(saved);
      }
      setDbReady(true);
    })();
  }, [t]);

  const getBotResponse = useCallback(
    async (userText: string): Promise<{ text: string; action?: string }> => {
      const msg = userText.toLowerCase().trim();

      // Pattern-based responses (same as before)
      const patterns: [RegExp, string, string?][] = [
        [/\bken\b/i, t('chat.responses.ken'), undefined],
        [/^(ol[aá]|oi|hey|e a[ií])\b/i, t('chat.responses.hello'), undefined],
        [/como (voc[eê]|est[aá])/i, t('chat.responses.howAreYou'), undefined],
        [/bateria|carga|energia/i, t('chat.responses.battery', { battery: status.battery, status: status.battery > 50 ? t('chat.responses.batteryGood') : t('chat.responses.batteryLow') }), 'status'],
        [/(ir para|v[aá] para|navegu[ei]|mov[ae])/i, t('chat.responses.navigate'), 'navigate'],
        [/(par[ea]|stop|freio)/i, t('chat.responses.stop'), 'emergency'],
        [/status|estado|sistema/i, t('chat.responses.status', { battery: status.battery }), 'status'],
        [/(frente|avante|avan[cç])/i, t('chat.responses.forward'), 'navigate'],
        [/(tr[aá]s|recue|volte)/i, t('chat.responses.backward'), 'navigate'],
        [/(esquerda|left)/i, t('chat.responses.left'), 'navigate'],
        [/(direita|right)/i, t('chat.responses.right'), 'navigate'],
        [/(onde|posi[cç][aã]o|localiza)/i, t('chat.responses.position'), 'status'],
        [/(ajuda|help|comando)/i, t('chat.responses.help'), undefined],
        [/(obrigad|valeu|thank)/i, t('chat.responses.thanks'), undefined],
        [/(foto|câmera|image)/i, t('chat.responses.camera'), undefined],
        [/(mapa|planta)/i, t('chat.responses.map'), undefined],
      ];

      for (const [pattern, response, action] of patterns) {
        if (pattern.test(msg)) return { text: response, action };
      }

      // Search local knowledge base for relevant context
      const knowledgeResults = await searchKnowledge(userText);
      if (knowledgeResults.length > 0) {
        const best = knowledgeResults[0];
        return {
          text: `📚 ${best.title}: ${best.content}`,
        };
      }

      return { text: t('chat.responses.fallback') };
    },
    [t, status.battery]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        text: text.trim(),
        createdAt: Date.now(),
        synced: false,
      };

      await addChatMessage(userMsg);
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      setTimeout(async () => {
        try {
          const { text: botText, action } = await getBotResponse(text);
          const botMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'bot',
            text: botText,
            createdAt: Date.now(),
            synced: false,
          };
          await addChatMessage(botMsg);
          setMessages(prev => [...prev, botMsg]);
          setIsTyping(false);

          if (action) {
            wsSend({
              type: action === 'emergency' ? 'emergency_stop' : (action as any),
              data: { command: text },
              timestamp: Date.now(),
            });
          }
          speak(botText);
        } catch (e) {
          console.error('Chat response error:', e);
          setIsTyping(false);
        }
      }, 600 + Math.random() * 800);
    },
    [getBotResponse, wsSend]
  );

  const clearHistory = useCallback(async () => {
    await clearAllMessages();
    const clearedMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'bot',
      text: t('chat.clearedMessage'),
      createdAt: Date.now(),
      synced: false,
    };
    await addChatMessage(clearedMsg);
    setMessages([clearedMsg]);
  }, [t]);

  return { messages, isTyping, sendMessage, clearHistory, dbReady };
}
