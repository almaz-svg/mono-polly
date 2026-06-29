import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#00ff87', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#fb923c', '#38bdf8', '#f472b6'];

export default function StockChart({ teams, shareHistory }) {
  const rounds = [...new Set(shareHistory.map(h => h.round_number))].sort((a, b) => a - b);

  const chartData = rounds.map(round => {
    const point = { round: `R${round}` };
    teams.forEach(team => {
      const entry = shareHistory.find(h => h.team_id === team.id && h.round_number === round);
      if (entry) point[team.name] = entry.value;
    });
    return point;
  });

  if (chartData.length === 0 && teams.length > 0) {
    const initial = { round: 'Start' };
    teams.forEach(team => { initial[team.name] = 100; });
    chartData.push(initial);
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="round" stroke="#8888aa" tick={{ fill: '#8888aa' }} />
        <YAxis stroke="#8888aa" tick={{ fill: '#8888aa' }} />
        <Tooltip
          contentStyle={{ background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '8px' }}
          labelStyle={{ color: '#ffffff' }}
          itemStyle={{ color: '#8888aa' }}
        />
        <Legend wrapperStyle={{ color: '#8888aa' }} />
        {teams.map((team, i) => (
          <Line
            key={team.id}
            type="monotone"
            dataKey={team.name}
            stroke={team.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ fill: team.color || COLORS[i % COLORS.length], r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
