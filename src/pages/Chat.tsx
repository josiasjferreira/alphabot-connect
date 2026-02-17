import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Trash2, RefreshCw, Wifi, WifiOff, Cloud, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import ChatBubble from '@/components/ChatBubble';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useChatIA } from '@/hooks/useChatIA';
import { useSyncStatus } from '@/hooks/useSyncStatus';

const Chat = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { messages, isTyping, sendMessage, clearHistory, dbReady } = useChatIA();
  const { isOnline, syncState, isSyncing, doSync, formatLastSync, lastResult } = useSyncStatus();
  const [showSyncInfo, setShowSyncInfo] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (transcript && !isListening) { setInput(transcript); resetTranscript(); }
  }, [transcript, isListening, resetTranscript]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); setInput(''); };

  const handleSync = async () => {
    // Use simulation since real endpoint isn't connected yet
    const result = await doSync(true);
    if (result.success) {
      setShowSyncInfo(true);
      setTimeout(() => setShowSyncInfo(false), 4000);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const syncStateConfig = {
    'offline': { icon: WifiOff, label: t('chatSync.offline'), color: 'text-amber-400', bg: 'bg-amber-500/10' },
    'online-synced': { icon: Cloud, label: t('chatSync.synced'), color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    'online-pending': { icon: Database, label: t('chatSync.pending'), color: 'text-blue-400', bg: 'bg-blue-500/10' },
  };

  const currentSync = syncStateConfig[syncState];
  const SyncIcon = currentSync.icon;

  return (
    <div className="h-screen bg-background flex flex-col">
      <StatusHeader title={t('chat.title')} />

      {/* Sync Status Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${currentSync.bg} ${currentSync.color}`}>
            <SyncIcon className="w-3 h-3" />
            {currentSync.label}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {t('chatSync.lastSync')}: {formatLastSync()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('chatSync.syncing') : t('chatSync.syncNow')}
          </button>
          <button onClick={clearHistory} className="text-xs text-muted-foreground flex items-center gap-1 active:text-destructive">
            <Trash2 className="w-3 h-3" /> {t('chat.clear')}
          </button>
        </div>
      </div>

      {/* Sync Result Toast */}
      {showSyncInfo && lastResult?.success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mx-4 mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400"
        >
          ✅ {t('chatSync.syncSuccess', { knowledge: lastResult.newKnowledge, messages: lastResult.uploadedMessages })}
        </motion.div>
      )}

      {/* DB Loading */}
      {!dbReady && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Database className="w-4 h-4 animate-pulse" />
            {t('chatSync.loadingDb')}
          </div>
        </div>
      )}

      {/* Messages */}
      {dbReady && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
          {messages.map((msg, i) => (
            <ChatBubble key={msg.id} sender={msg.role === 'user' ? 'user' : 'bot'} text={msg.text} time={formatTime(msg.createdAt)} index={i} />
          ))}
          {isTyping && (
            <div className="flex justify-start mb-3">
              <div className="bg-chat-bot text-chat-bot-foreground px-4 py-3 rounded-2xl rounded-bl-md">
                <motion.div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-2 h-2 bg-muted-foreground rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} />
                  ))}
                </motion.div>
              </div>
            </div>
          )}
        </div>
      )}

      {isListening && interimTranscript && (
        <div className="px-4 py-2 bg-primary/5 text-sm text-muted-foreground italic border-t border-border">🎤 {interimTranscript}</div>
      )}

      <form onSubmit={handleSubmit} className="px-4 py-3 bg-card border-t border-border safe-bottom">
        <div className="flex items-center gap-2">
          <button type="button" onClick={isListening ? stopListening : startListening}
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold transition-colors ${isListening ? 'gradient-danger text-destructive-foreground animate-recording' : 'bg-secondary text-secondary-foreground'}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chat.inputPlaceholder')}
            className="flex-1 h-12 px-4 rounded-xl bg-background border border-border text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim()}
            className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 shadow-button disabled:shadow-none">
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
