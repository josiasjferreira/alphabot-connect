import { motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { speak } from '@/hooks/useVoiceRecognition';

interface ChatBubbleProps {
  sender: 'user' | 'bot';
  text: string;
  time: string;
  index: number;
}

const ChatBubble = ({ sender, text, time, index }: ChatBubbleProps) => {
  const isUser = sender === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-1'}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-chat-bot text-chat-bot-foreground rounded-bl-md'
            }`}
        >
          {text}
        </div>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {!isUser && (
            <button
              onClick={() => speak(text)}
              className="p-1 rounded text-muted-foreground hover:text-primary active:scale-95"
            >
              <Volume2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatBubble;
