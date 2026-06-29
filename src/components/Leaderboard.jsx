export default function Leaderboard({ teams, prevShares = {} }) {
  const sorted = [...teams].sort((a, b) => b.shares - a.shares);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {sorted.map((team, i) => {
        const prev = prevShares[team.id] ?? team.shares;
        const change = team.shares - prev;
        const isUp = change > 0;
        const isDown = change < 0;

        return (
          <div
            key={team.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#12121a',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              padding: '12px 16px',
            }}
          >
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: i === 0 ? '#ffe66d' : i === 1 ? '#8888aa' : i === 2 ? '#fb923c' : '#8888aa',
              minWidth: '20px',
            }}>
              #{i + 1}
            </span>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: team.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#ffffff', fontWeight: 500, flex: 1, fontSize: '14px' }}>
              {team.name}
            </span>
            <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px' }}>
              {team.shares}
            </span>
            {change !== 0 && (
              <span style={{
                color: isUp ? '#00ff87' : '#ff4757',
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 600,
                minWidth: '45px',
                textAlign: 'right',
              }}>
                {isUp ? '+' : ''}{change}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
