import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const PRESET_COLORS = [
  '#00ff87', '#ff6b6b', '#4ecdc4', '#ffe66d',
  '#a78bfa', '#fb923c', '#38bdf8', '#f472b6',
];

export default function Register() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const navigate = useNavigate();

  const takenColors = new Set(teams.map(t => t.color));
  const selectedColor = takenColors.has(color)
    ? PRESET_COLORS.find(c => !takenColors.has(c)) || color
    : color;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!gameData) return;
    setGameStatus(gameData.status);

    const { data: teamData } = await supabase
      .from('teams')
      .select('id, name, color')
      .eq('game_id', gameData.id)
      .order('created_at');
    if (teamData) setTeams(teamData);
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      setError('Введите название команды и пароль.');
      return;
    }

    setLoading(true);
    setError('');

    const { data: game } = await supabase
      .from('games')
      .select('id, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!game) {
      setError('Активная игра не найдена. Попросите администратора создать игру.');
      setLoading(false);
      return;
    }

    if (game.status !== 'waiting') {
      setError('Игра уже началась. Регистрация закрыта.');
      setLoading(false);
      return;
    }

    const { data: existingColors } = await supabase
      .from('teams')
      .select('color')
      .eq('game_id', game.id)
      .eq('color', selectedColor);
    if (existingColors?.length > 0) {
      setError('Этот цвет уже занят другой командой. Выберите другой.');
      setLoading(false);
      await loadData();
      return;
    }

    const { data, error: insertError } = await supabase
      .from('teams')
      .insert({ name: name.trim(), password, color: selectedColor, game_id: game.id })
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes('teams_game_color_unique')) {
        setError('Этот цвет уже занят другой командой. Выберите другой.');
        await loadData();
      } else if (insertError.message.includes('unique')) {
        setError('Название команды уже занято.');
      } else {
        setError(insertError.message);
      }
      setLoading(false);
      return;
    }

    localStorage.setItem('mw_team_id', data.id);
    localStorage.setItem('mw_team_name', data.name);
    navigate(`/team/${data.id}`);
  }

  if (gameStatus !== 'waiting') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>MarketWars</h1>
          <div style={{ ...styles.errorBox, textAlign: 'center', padding: '24px' }}>
            <p style={{ fontSize: '20px', margin: 0 }}>🔒 Игра идёт</p>
            <p style={{ color: '#8888aa', marginTop: '8px' }}>Регистрация закрыта.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>MarketWars</h1>
        <p style={styles.subtitle}>Зарегистрируйте команду для участия в игре</p>

        <form onSubmit={handleRegister} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Название команды</label>
            <input
              style={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Команда Альфа"
              maxLength={30}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Пароль (для входа в панель команды)</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Придумайте пароль команды"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Цвет команды</label>
            <div style={styles.colorGrid}>
              {PRESET_COLORS.map(c => {
                const taken = takenColors.has(c) && c !== selectedColor;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={taken}
                    title={taken ? 'Цвет уже занят' : undefined}
                    onClick={() => !taken && setColor(c)}
                    style={{
                      ...styles.colorBtn,
                      background: c,
                      opacity: taken ? 0.25 : 1,
                      cursor: taken ? 'not-allowed' : 'pointer',
                      outline: selectedColor === c ? `3px solid white` : '3px solid transparent',
                      transform: selectedColor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Создаю...' : 'Создать команду →'}
          </button>
        </form>

        {teams.length > 0 && (
          <div style={styles.teamsList}>
            <p style={styles.teamsTitle}>Зарегистрированные команды ({teams.length})</p>
            <div style={styles.teamsGrid}>
              {teams.map(t => (
                <div key={t.id} style={styles.teamChip}>
                  <span style={{ ...styles.dot, background: t.color }} />
                  {t.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
  },
  title: {
    color: '#00ff87',
    fontFamily: 'monospace',
    fontSize: '36px',
    fontWeight: 700,
    margin: '0 0 8px',
    textAlign: 'center',
    letterSpacing: '2px',
  },
  subtitle: {
    color: '#8888aa',
    textAlign: 'center',
    margin: '0 0 32px',
    fontSize: '14px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8888aa', fontSize: '13px', fontWeight: 500 },
  input: {
    background: '#1a1a28',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '12px 16px',
    fontSize: '15px',
    outline: 'none',
    width: '100%',
  },
  colorGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  colorBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.15s, outline 0.15s',
  },
  errorBox: {
    background: 'rgba(255,71,87,0.1)',
    border: '1px solid rgba(255,71,87,0.4)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#ff4757',
    fontSize: '14px',
  },
  btn: {
    background: '#00ff87',
    color: '#0a0a0f',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  teamsList: { marginTop: '32px', borderTop: '1px solid #2a2a3a', paddingTop: '24px' },
  teamsTitle: { color: '#8888aa', fontSize: '13px', margin: '0 0 12px' },
  teamsGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  teamChip: {
    background: '#1a1a28',
    border: '1px solid #2a2a3a',
    borderRadius: '20px',
    padding: '6px 14px',
    color: '#ffffff',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
};
