import { useRef, useState, useCallback, useEffect } from 'react';

interface JoystickProps {
  size?: number;
  onMove: (angle: number, distance: number) => void;
  onRelease: () => void;
}

const Joystick = ({ size = 200, onMove, onRelease }: JoystickProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const maxDist = size / 2 - 30;

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    if (dist > 0) {
      dx = (dx / dist) * clampedDist;
      dy = (dy / dist) * clampedDist;
    }
    setKnobPos({ x: dx, y: dy });
    const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
    const normalizedDist = (clampedDist / maxDist) * 100;
    onMove(angle < 0 ? angle + 360 : angle, normalizedDist);

    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(5);
  }, [maxDist, onMove]);

  const handleEnd = useCallback(() => {
    setKnobPos({ x: 0, y: 0 });
    setIsDragging(false);
    onRelease();
  }, [onRelease]);

  useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onUp = () => handleEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchend', onUp);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    handleMove(clientX, clientY);
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-full bg-muted border-2 border-border touch-action-none select-none"
      style={{ width: size, height: size }}
      onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
    >
      {/* Cross lines */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-px bg-border" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-full w-px bg-border" />
      </div>
      {/* Direction labels */}
      <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-semibold">▲</span>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-semibold">▼</span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">◀</span>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">▶</span>
      {/* Knob */}
      <div
        className={`absolute rounded-full transition-shadow ${isDragging ? 'gradient-primary shadow-button scale-110' : 'bg-primary/80'}`}
        style={{
          width: 56,
          height: 56,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary-foreground/50" />
        </div>
      </div>
    </div>
  );
};

export default Joystick;
