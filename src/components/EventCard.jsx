import { useEffect, useState } from 'react';

export default function EventCard({ event, compact = false }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(false);
      setTimeout(() => setVisible(true), 50);
    }
  }, [event?.id]);

  if (!event) return null;

  const isNegative = event.effect_type === 'global_drop' || event.effect_type === 'feature_drop';
  const isPositive = event.effect_type === 'global_rise' || event.effect_type === 'feature_boost';
  const isNeutral = event.effect_type === 'none';

  const borderColor = isNegative ? '#ff4757' : isPositive ? '#00ff87' : '#4ecdc4';
  const bgColor = isNegative ? 'rgba(255,71,87,0.1)' : isPositive ? 'rgba(0,255,135,0.1)' : 'rgba(78,205,196,0.1)';
  const icon = isNegative ? '📉' : isPositive ? '📈' : '📊';

  const effectLabel = () => {
    if (isNeutral) return 'Нет рыночного эффекта';
    const sign = isPositive ? '+' : '';
    const scope = event.effect_target ? `Команды с "${event.effect_target}"` : 'Все команды';
    return `${scope}: ${sign}${event.effect_percent}%`;
  };

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        background: bgColor,
        borderRadius: compact ? '8px' : '12px',
        padding: compact ? '12px 16px' : '20px 24px',
        transition: 'all 0.4s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: compact ? '20px' : '28px' }}>{icon}</span>
        <div>
          <p style={{
            color: '#ffffff',
            margin: 0,
            fontSize: compact ? '13px' : '15px',
            lineHeight: '1.5',
            fontWeight: 500,
          }}>
            {event.card_text}
          </p>
          <p style={{
            color: borderColor,
            margin: '6px 0 0',
            fontSize: compact ? '11px' : '13px',
            fontFamily: 'monospace',
            fontWeight: 600,
          }}>
            {effectLabel()}
          </p>
        </div>
      </div>
    </div>
  );
}
