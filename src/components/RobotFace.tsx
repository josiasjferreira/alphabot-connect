import { motion } from 'framer-motion';

interface RobotFaceProps {
  expression: 'neutral' | 'happy' | 'love' | 'excited' | 'wink' | 'surprised';
}

const expressions = {
  neutral: {
    leftEye: { scaleY: 1, scaleX: 1 },
    rightEye: { scaleY: 1, scaleX: 1 },
    mouth: 'M 30 70 Q 50 75 70 70',
    blush: false,
  },
  happy: {
    leftEye: { scaleY: 0.4, scaleX: 1.1 },
    rightEye: { scaleY: 0.4, scaleX: 1.1 },
    mouth: 'M 25 65 Q 50 90 75 65',
    blush: true,
  },
  love: {
    leftEye: { scaleY: 1, scaleX: 1 },
    rightEye: { scaleY: 1, scaleX: 1 },
    mouth: 'M 30 65 Q 50 85 70 65',
    blush: true,
    hearts: true,
  },
  excited: {
    leftEye: { scaleY: 1.2, scaleX: 1.2 },
    rightEye: { scaleY: 1.2, scaleX: 1.2 },
    mouth: 'M 25 60 Q 50 95 75 60',
    blush: true,
  },
  wink: {
    leftEye: { scaleY: 1, scaleX: 1 },
    rightEye: { scaleY: 0.1, scaleX: 1.2 },
    mouth: 'M 30 65 Q 50 85 70 65',
    blush: false,
  },
  surprised: {
    leftEye: { scaleY: 1.4, scaleX: 1.4 },
    rightEye: { scaleY: 1.4, scaleX: 1.4 },
    mouth: 'M 40 65 Q 50 80 60 65',
    blush: false,
  },
};

const animationToExpression: Record<string, RobotFaceProps['expression']> = {
  wave: 'wink',
  welcome: 'happy',
  love: 'love',
  celebrate: 'excited',
  star: 'surprised',
  custom: 'happy',
};

export const getExpressionForAnimation = (animId: string): RobotFaceProps['expression'] => {
  return animationToExpression[animId] || 'neutral';
};

const RobotFace = ({ expression }: RobotFaceProps) => {
  const expr = expressions[expression];

  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="w-28 h-28"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      {/* Head */}
      <motion.rect
        x="10" y="10" width="80" height="75" rx="20"
        className="fill-card stroke-primary"
        strokeWidth="2.5"
        animate={{ y: [10, 8, 10] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Antenna */}
      <motion.line x1="50" y1="10" x2="50" y2="2" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
      <motion.circle
        cx="50" cy="2" r="3"
        className="fill-primary"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />

      {/* Left Eye */}
      <motion.ellipse
        cx="35" cy="40" rx="8" ry="9"
        className="fill-primary"
        animate={expr.leftEye}
        transition={{ type: 'spring', stiffness: 300 }}
      />
      {/* Left Eye highlight */}
      <circle cx="32" cy="37" r="2.5" className="fill-primary-foreground" opacity="0.8" />

      {/* Right Eye */}
      <motion.ellipse
        cx="65" cy="40" rx="8" ry="9"
        className="fill-primary"
        animate={expr.rightEye}
        transition={{ type: 'spring', stiffness: 300 }}
      />
      {/* Right Eye highlight */}
      <circle cx="62" cy="37" r="2.5" className="fill-primary-foreground" opacity="0.8" />

      {/* Blush */}
      {expr.blush && (
        <>
          <motion.ellipse
            cx="22" cy="55" rx="7" ry="4"
            className="fill-destructive" opacity="0.2"
            initial={{ opacity: 0 }} animate={{ opacity: 0.25 }}
          />
          <motion.ellipse
            cx="78" cy="55" rx="7" ry="4"
            className="fill-destructive" opacity="0.2"
            initial={{ opacity: 0 }} animate={{ opacity: 0.25 }}
          />
        </>
      )}

      {/* Mouth */}
      <motion.path
        d={expr.mouth}
        fill="none"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* Hearts for love */}
      {(expr as any).hearts && (
        <>
          <motion.text
            x="85" y="25" fontSize="10"
            animate={{ y: [25, 15, 25], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >❤️</motion.text>
          <motion.text
            x="5" y="20" fontSize="8"
            animate={{ y: [20, 12, 20], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
          >💕</motion.text>
        </>
      )}
    </motion.svg>
  );
};

export default RobotFace;
