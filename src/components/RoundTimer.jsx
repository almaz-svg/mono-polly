import { useEffect, useState } from 'react';

export default function RoundTimer({ startedAt, durationMinutes = 20, large = false }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!startedAt) return;

    const tick = () => {
      const start = new Date(startedAt).getTime();
      const end = start + durationMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes]);

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120;

  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontWeight: 700,
        fontSize: large ? '48px' : '20px',
        color: isUrgent ? '#ff4757' : '#00ff87',
        letterSpacing: large ? '4px' : '1px',
        transition: 'color 0.3s',
      }}
    >
      {formatted}
    </span>
  );
}
