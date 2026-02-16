import { useState } from 'react';
import { motion } from 'framer-motion';
import { OctagonX, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EmergencyButtonProps {
  onEmergency: () => void;
}

const EmergencyButton = ({ onEmergency }: EmergencyButtonProps) => {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);

  const handlePress = () => {
    if (locked) { setLocked(false); return; }
    onEmergency();
    setLocked(true);
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handlePress}
      className={`w-full min-h-[56px] rounded-xl flex items-center justify-center gap-3 font-bold text-base
        ${locked ? 'bg-warning text-warning-foreground' : 'gradient-danger text-destructive-foreground shadow-emergency'}`}
    >
      {locked ? (
        <><ShieldAlert className="w-6 h-6" /> {t('emergency.unlock')}</>
      ) : (
        <><OctagonX className="w-6 h-6" /> {t('emergency.stop')}</>
      )}
    </motion.button>
  );
};

export default EmergencyButton;
