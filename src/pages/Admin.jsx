import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { scoreSubmission } from '../lib/gemini';
import { calculateNewShares } from '../lib/shareCalc';
import { SCHEDULED_EVENTS, RANDOM_EVENTS } from '../lib/marketEvents';
import EventCard from '../components/EventCard';
import RoundTimer from '../components/RoundTimer';

const STATUS_RU = { waiting: 'Ожидание', active: 'Активна', finished: 'Завершена', scoring: 'Оценка' };

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [usedEvents, setUsedEvents] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState([]);
  const [sharePreview, setSharePreview] = useState([]);
  const [shareConfirming, setShareConfirming] = useState(false);
  const [randomEventPreview, setRandomEventPreview] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (authed) {
      loadAll();
      const channel = supabase
        .channel('admin-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, loadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, loadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, loadAll)
        .subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [authed]);

  function log(text) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setActivityLog(prev => [...prev.slice(-99), { text, time, id: Date.now() }]);
  }

  async function loadAll() {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (gameData) {
      setGame(gameData);

      const [{ data: teamsData }, { data: roundData }, { data: eventData }, { data: usedData }] = await Promise.all([
        supabase.from('teams').select('*').eq('game_id', gameData.id).order('shares', { ascending: false }),
        supabase.from('rounds').select('*').eq('game_id', gameData.id).order('round_number', { ascending: false }).limit(1).single(),
        supabase.from('market_events').select('*').eq('game_id', gameData.id).order('triggered_at', { ascending: false }).limit(1).single(),
        supabase.from('market_events').select('card_text').eq('game_id', gameData.id),
      ]);

      if (teamsData) setTeams(teamsData);
      if (roundData) {
        setRound(roundData);
        const { data: subData } = await supabase
          .from('submissions')
          .select('*, teams(name, color)')
          .eq('round_id', roundData.id);
        setSubmissions(subData || []);
      }
      if (eventData) setActiveEvent(eventData);
      setUsedEvents((usedData || []).map(e => e.card_text));
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const envPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'marketwars2024';
    if (loginInput === envPassword) {
      setAuthed(true);
      return;
    }
    const { data } = await supabase
      .from('admins')
      .select('id')
      .eq('username', 'admin')
      .eq('password', loginInput)
      .single();
    if (data) {
      setAuthed(true);
    } else {
      setLoginError('Неверный пароль');
    }
  }

  async function createGame() {
    const { data, error } = await supabase.from('games').insert({}).select().single();
    if (error) return setMsg('Ошибка: ' + error.message);
    setGame(data);
    log('Игра создана');
    setMsg('Игра создана!');
  }

  async function startGame() {
    if (!game) return;
    await supabase.from('games').update({ status: 'active' }).eq('id', game.id);
    const { data: r } = await supabase
      .from('rounds')
      .insert({ game_id: game.id, round_number: 1 })
      .select()
      .single();
    setRound(r);
    log('Игра началась — Раунд 1');
    setMsg('Игра началась!');
    await loadAll();
  }

  async function startNextRound() {
    if (!game || !round) return;
    await supabase.from('rounds').update({ status: 'finished' }).eq('id', round.id);
    const { data: r } = await supabase
      .from('rounds')
      .insert({ game_id: game.id, round_number: round.round_number + 1 })
      .select()
      .single();
    setRound(r);
    log(`Раунд ${round.round_number + 1} начался`);
    setMsg(`Раунд ${round.round_number + 1} начался!`);
    await loadAll();
  }

  async function endRound() {
    if (!round) return;
    await supabase.from('rounds').update({ status: 'scoring' }).eq('id', round.id);
    log(`Раунд ${round.round_number} — фаза оценки`);
    setMsg('Раунд завершён, началась оценка.');
    await loadAll();
  }

  async function finishGame() {
    if (!game) return;
    await supabase.from('games').update({ status: 'finished' }).eq('id', game.id);
    if (round) await supabase.from('rounds').update({ status: 'finished' }).eq('id', round.id);
    log('Игра завершена');
    setMsg('Игра завершена!');
    await loadAll();
  }

  async function runAiScoring() {
    if (!submissions.length) return setMsg('Нет заявок для оценки.');
    setAiLoading(true);
    log('Запуск AI-оценки...');

    // Получаем peer-оценки для всех заявок параллельно
    const peerDataArr = await Promise.all(
      submissions.map(sub =>
        supabase.from('peer_scores').select('score').eq('submission_id', sub.id)
      )
    );
    const peerAvgs = {};
    submissions.forEach((sub, i) => {
      const scores = (peerDataArr[i].data || []).map(p => p.score);
      peerAvgs[sub.id] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
    });

    // Запускаем AI-оценку параллельно для всех команд
    const scored = await Promise.all(
      submissions.map(sub =>
        scoreSubmission(sub.features, peerAvgs[sub.id], activeEvent?.card_text || 'Нет активного события')
      )
    );

    // Сохраняем результаты параллельно
    await Promise.all(
      submissions.map((sub, i) =>
        supabase.from('submissions')
          .update({ ai_score: scored[i].score, ai_reason: scored[i].reason })
          .eq('id', sub.id)
      )
    );

    const results = submissions.map((sub, i) => {
      log(`Оценка ${sub.teams?.name}: ${scored[i].score}/10`);
      return { ...sub, ai_score: scored[i].score, ai_reason: scored[i].reason, peer_avg: peerAvgs[sub.id] };
    });

    setAiResults(results);
    setAiLoading(false);
    setMsg('AI-оценка завершена!');
    await loadAll();
  }

  async function previewShareCalc() {
    const updatedSubs = aiResults.length > 0 ? aiResults : submissions;
    if (!updatedSubs.length) return setMsg('Сначала запустите AI-оценку.');

    const preview = teams.map(team => {
      const sub = updatedSubs.find(s => s.team_id === team.id);
      if (!sub) return { ...team, newShares: team.shares, change: 0 };
      const peerScore = sub.peer_avg || 5;
      const aiScore = sub.ai_score || 5;
      const newShares = calculateNewShares(team.shares, aiScore, peerScore, activeEvent, sub.features);
      return { ...team, newShares, change: newShares - team.shares };
    });
    setSharePreview(preview);
    setMsg('Предварительный расчёт акций готов.');
  }

  async function confirmShares() {
    if (!sharePreview.length || !round || shareConfirming) return;
    setShareConfirming(true);

    // Проверяем не сохраняли ли уже акции для этого раунда
    const { data: existing } = await supabase
      .from('share_history')
      .select('id')
      .eq('round_id', round.id)
      .limit(1);
    if (existing?.length > 0) {
      setMsg('Акции для этого раунда уже сохранены!');
      setShareConfirming(false);
      return;
    }

    await Promise.all(
      sharePreview.map(item =>
        supabase.from('teams').update({ shares: item.newShares }).eq('id', item.id)
      )
    );
    await Promise.all(
      sharePreview.map(item =>
        supabase.from('share_history').insert({
          team_id: item.id,
          round_id: round.id,
          value: item.newShares,
        })
      )
    );

    log('Акции обновлены и сохранены в историю');
    setSharePreview([]);
    setAiResults([]);
    setShareConfirming(false);
    setMsg('Акции подтверждены и сохранены!');
    await loadAll();
  }

  async function triggerScheduledEvent(ev) {
    if (!game) return;
    const { error } = await supabase.from('market_events').insert({
      game_id: game.id,
      card_text: ev.card_text,
      effect_type: ev.effect_type,
      effect_target: ev.effect_target,
      effect_percent: ev.effect_percent,
      is_random: false,
    });
    if (!error) {
      log(`Событие активировано: ${ev.card_text.slice(0, 50)}...`);
      setMsg('Событие активировано!');
      await loadAll();
    }
  }

  function pickRandomEvent() {
    const available = RANDOM_EVENTS.filter(e => !usedEvents.includes(e.card_text));
    if (!available.length) return setMsg('Все случайные события уже использованы.');
    const picked = available[Math.floor(Math.random() * available.length)];
    setRandomEventPreview(picked);
  }

  async function confirmRandomEvent() {
    if (!randomEventPreview || !game) return;
    await supabase.from('market_events').insert({
      game_id: game.id,
      card_text: randomEventPreview.card_text,
      effect_type: randomEventPreview.effect_type,
      effect_target: randomEventPreview.effect_target,
      effect_percent: randomEventPreview.effect_percent,
      is_random: true,
    });
    log(`Случайное событие: ${randomEventPreview.card_text.slice(0, 50)}...`);
    setRandomEventPreview(null);
    setMsg('Случайное событие активировано!');
    await loadAll();
  }

  if (!authed) {
    return (
      <div style={styles.center}>
        <div style={styles.loginCard}>
          <h2 style={{ color: '#00ff87', margin: '0 0 24px', fontFamily: 'monospace' }}>Вход для администратора</h2>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              style={styles.input}
              placeholder="Пароль администратора"
              value={loginInput}
              onChange={e => setLoginInput(e.target.value)}
            />
            {loginError && <p style={{ color: '#ff4757', margin: 0, fontSize: '14px' }}>{loginError}</p>}
            <button type="submit" style={styles.btn}>Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <h1 style={styles.title}>MarketWars — Админ</h1>
        {msg && (
          <div style={styles.msgBox}>
            {msg}
            <button onClick={() => setMsg('')} style={styles.closeBtn}>×</button>
          </div>
        )}
      </div>

      <div style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Управление игрой</h3>
          {!game ? (
            <button style={styles.btn} onClick={createGame}>Создать новую игру</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={styles.statusRow}>
                <span style={styles.label}>Статус:</span>
                <span style={{ color: game.status === 'active' ? '#00ff87' : '#8888aa', fontFamily: 'monospace' }}>
                  {STATUS_RU[game.status] || game.status}
                </span>
              </div>
              {round && (
                <div style={styles.statusRow}>
                  <span style={styles.label}>Раунд:</span>
                  <span style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                    {round.round_number} / {game.total_rounds} ({STATUS_RU[round.status] || round.status})
                  </span>
                </div>
              )}
              {round?.status === 'active' && (
                <div style={styles.statusRow}>
                  <span style={styles.label}>Таймер:</span>
                  <RoundTimer startedAt={round.started_at} durationMinutes={round.duration_minutes} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {game.status === 'waiting' && (
                  <button style={styles.btn} onClick={startGame}>▶ Начать игру</button>
                )}
                {game.status === 'active' && round?.status === 'active' && (
                  <button style={{ ...styles.btn, background: '#ffe66d', color: '#0a0a0f' }} onClick={endRound}>
                    ⏸ Завершить раунд / Начать оценку
                  </button>
                )}
                {game.status === 'active' && (round?.status === 'scoring' || round?.status === 'finished') && round.round_number < game.total_rounds && (
                  <button style={styles.btn} onClick={startNextRound}>⏭ Следующий раунд</button>
                )}
                {game.status === 'active' && (
                  <button style={{ ...styles.btn, background: '#ff4757' }} onClick={finishGame}>
                    🏁 Завершить игру
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Команды ({teams.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Команда', 'Акции', 'AI Оценка', 'Сдано', 'Цвет'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => {
                  const sub = submissions.find(s => s.team_id === t.id);
                  return (
                    <tr key={t.id}>
                      <td style={styles.td}>{t.name}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', color: '#00ff87' }}>{t.shares}</td>
                      <td style={styles.td}>{sub?.ai_score ? `${sub.ai_score}/10` : '—'}</td>
                      <td style={styles.td}>{sub ? '✓' : '—'}</td>
                      <td style={styles.td}>
                        <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: t.color }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>AI-оценка</h3>
          <button
            style={{ ...styles.btn, background: '#4ecdc4', opacity: aiLoading ? 0.6 : 1 }}
            onClick={runAiScoring}
            disabled={aiLoading}
          >
            {aiLoading ? '⏳ Оцениваю...' : '🤖 Запустить AI-оценку'}
          </button>
          {aiResults.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {aiResults.map(r => (
                <div key={r.id} style={styles.resultCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{r.teams?.name}</span>
                    <span style={{ color: '#00ff87', fontFamily: 'monospace' }}>{r.ai_score}/10</span>
                  </div>
                  <p style={{ color: '#8888aa', fontSize: '12px', margin: '4px 0 0' }}>{r.ai_reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Расчёт акций</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button style={{ ...styles.btn, background: '#a78bfa' }} onClick={previewShareCalc}>
              📊 Предпросмотр акций
            </button>
            {sharePreview.length > 0 && (
              <button
                style={{ ...styles.btn, opacity: shareConfirming ? 0.6 : 1 }}
                onClick={confirmShares}
                disabled={shareConfirming}
              >
                {shareConfirming ? 'Сохраняю...' : '✓ Подтвердить и сохранить'}
              </button>
            )}
          </div>
          {sharePreview.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sharePreview.map(item => (
                <div key={item.id} style={{ ...styles.resultCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                    <span style={{ color: '#ffffff' }}>{item.name}</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', textAlign: 'right' }}>
                    <span style={{ color: '#8888aa' }}>{item.shares}</span>
                    <span style={{ color: '#8888aa', margin: '0 6px' }}>→</span>
                    <span style={{ color: '#ffffff', fontWeight: 700 }}>{item.newShares}</span>
                    <span style={{ color: item.change >= 0 ? '#00ff87' : '#ff4757', marginLeft: '6px', fontSize: '12px' }}>
                      {item.change >= 0 ? '+' : ''}{item.change}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Рыночные события — Плановые</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SCHEDULED_EVENTS.map((ev, i) => {
              const used = usedEvents.includes(ev.card_text);
              return (
                <div key={i} style={{ ...styles.resultCard, opacity: used ? 0.4 : 1 }}>
                  <p style={{ color: '#cccccc', fontSize: '13px', margin: '0 0 8px' }}>{ev.card_text}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#8888aa', fontSize: '11px', fontFamily: 'monospace' }}>
                      {ev.effect_type} {ev.effect_target ? `(${ev.effect_target})` : ''} {ev.effect_percent !== 0 ? `${ev.effect_percent > 0 ? '+' : ''}${ev.effect_percent}%` : ''}
                    </span>
                    {!used && (
                      <button style={{ ...styles.smallBtn, background: '#ff6b6b' }} onClick={() => triggerScheduledEvent(ev)}>
                        Активировать
                      </button>
                    )}
                    {used && <span style={{ color: '#8888aa', fontSize: '11px' }}>Использовано</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Рыночные события — Случайные</h3>
          <button style={{ ...styles.btn, background: '#fb923c', marginBottom: '12px' }} onClick={pickRandomEvent}>
            🎲 Случайное событие
          </button>
          {randomEventPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <EventCard event={randomEventPreview} compact />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={styles.btn} onClick={confirmRandomEvent}>✓ Подтвердить</button>
                <button style={{ ...styles.btn, background: '#1a1a28', color: '#8888aa' }} onClick={() => setRandomEventPreview(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
            {RANDOM_EVENTS.map((ev, i) => {
              const used = usedEvents.includes(ev.card_text);
              return (
                <div key={i} style={{ ...styles.resultCard, opacity: used ? 0.4 : 1, padding: '10px 12px' }}>
                  <p style={{ color: '#cccccc', fontSize: '12px', margin: 0 }}>{ev.card_text.slice(0, 80)}...</p>
                  {used && <span style={{ color: '#8888aa', fontSize: '10px' }}>Использовано</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...styles.section, gridColumn: '1 / -1' }}>
          <h3 style={styles.sectionTitle}>Журнал действий</h3>
          <div style={{ ...styles.feed, maxHeight: '180px' }}>
            {activityLog.length === 0 ? (
              <p style={{ color: '#8888aa', fontSize: '13px' }}>Нет активности.</p>
            ) : (
              [...activityLog].reverse().map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                  <span style={{ color: '#8888aa', fontFamily: 'monospace', flexShrink: 0 }}>{item.time}</span>
                  <span style={{ color: '#cccccc' }}>{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0f' },
  loginCard: { background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '40px', width: '320px' },
  container: { background: '#0a0a0f', minHeight: '100vh', padding: '20px' },
  topBar: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
  title: { color: '#00ff87', fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '2px' },
  msgBox: {
    background: 'rgba(0,255,135,0.1)',
    border: '1px solid rgba(0,255,135,0.3)',
    borderRadius: '8px',
    padding: '8px 14px',
    color: '#00ff87',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  closeBtn: { background: 'none', border: 'none', color: '#00ff87', cursor: 'pointer', fontSize: '18px', padding: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' },
  section: { background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '20px' },
  sectionTitle: { color: '#ffffff', margin: '0 0 16px', fontSize: '15px', fontWeight: 600 },
  btn: {
    background: '#00ff87',
    color: '#0a0a0f',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  smallBtn: {
    background: '#4ecdc4',
    color: '#0a0a0f',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  input: {
    background: '#1a1a28',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { color: '#8888aa', padding: '8px', textAlign: 'left', borderBottom: '1px solid #2a2a3a', fontWeight: 500 },
  td: { color: '#cccccc', padding: '10px 8px', borderBottom: '1px solid #1a1a28' },
  resultCard: { background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: '8px', padding: '12px' },
  statusRow: { display: 'flex', gap: '10px', alignItems: 'center', fontSize: '14px' },
  label: { color: '#8888aa', minWidth: '70px' },
  feed: {
    background: '#0a0a0f',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
};
