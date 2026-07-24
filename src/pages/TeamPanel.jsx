import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import EventCard from '../components/EventCard';
import RoundTimer from '../components/RoundTimer';
import PasswordInput from '../components/PasswordInput';

const STATUS_RU = { waiting: 'Ожидание', active: 'Активен', finished: 'Завершён', scoring: 'Оценка' };

export default function TeamPanel() {
  const { teamId } = useParams();
  const navigate = useNavigate();

  const [team, setTeam] = useState(null);
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [features, setFeatures] = useState('');
  const [activeEvent, setActiveEvent] = useState(null);
  const [peerTargets, setPeerTargets] = useState([]);
  const [peerScores, setPeerScores] = useState({});
  const [peerSubmitted, setPeerSubmitted] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [shareChange, setShareChange] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('mw_team_id');
    if (savedId !== teamId) {
      setNeedLogin(true);
      return;
    }
    loadAll();
  }, [teamId]);

  async function handleTeamLogin(e) {
    e.preventDefault();
    const { data } = await supabase.rpc('verify_team_login', {
      p_team_id: teamId,
      p_password: loginPassword,
    });
    if (data && data.length > 0) {
      localStorage.setItem('mw_team_id', data[0].id);
      localStorage.setItem('mw_team_name', data[0].name);
      setNeedLogin(false);
      loadAll();
    } else {
      setLoginError('Неверный пароль');
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel('team-panel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds' }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' }, () => loadAll())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_events' }, () => loadEvent())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'share_history' }, () => loadTeam())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadAll() {
    await Promise.all([loadTeam(), loadGame()]);
  }

  async function loadTeam() {
    const { data } = await supabase
      .from('teams')
      .select('*, projects(title, tagline, what_is, key_feature, tasks)')
      .eq('id', teamId)
      .maybeSingle();
    if (data) {
      setTeam(prev => {
        if (prev) setShareChange(data.shares - prev.shares);
        return data;
      });
    }
  }

  async function loadGame() {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!gameData) return;
    setGame(gameData);

    if (gameData.status !== 'active') return;

    const { data: roundData } = await supabase
      .from('rounds')
      .select('*')
      .eq('game_id', gameData.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundData) {
      setRound(roundData);
      await Promise.all([loadSubmission(roundData.id), loadEvent(gameData.id), loadPeerTargets(roundData.id)]);
    }
  }

  async function loadEvent(gameId) {
    const gid = gameId || game?.id;
    if (!gid) return;
    const { data } = await supabase
      .from('market_events')
      .select('*')
      .eq('game_id', gid)
      .order('triggered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveEvent(data || null);
  }

  async function loadSubmission(roundId) {
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('round_id', roundId)
      .eq('team_id', teamId)
      .maybeSingle();
    setSubmission(data || null);
  }

  async function loadPeerTargets(roundId) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, team_id, features, teams(name, color)')
      .eq('round_id', roundId)
      .neq('team_id', teamId);
    setPeerTargets(subs || []);

    const { data: given } = await supabase
      .from('peer_scores')
      .select('submission_id')
      .eq('from_team_id', teamId);
    const submittedMap = {};
    (given || []).forEach(g => { submittedMap[g.submission_id] = true; });
    setPeerSubmitted(submittedMap);
  }

  function handleScreenshotChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!features.trim() || !round) return;
    setLoading(true);
    setMessage('');

    try {
      let screenshotUrl = null;
      if (screenshot) {
        const ext = screenshot.name.split('.').pop();
        const path = `${teamId}/${round.id}_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('screenshots')
          .upload(path, screenshot, { upsert: true });
        if (uploadError) {
          console.error('Screenshot upload failed:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(path);
          screenshotUrl = publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('submissions')
        .insert({ round_id: round.id, team_id: teamId, features: features.trim(), screenshot_url: screenshotUrl })
        .select()
        .single();

      if (error) {
        setMessage('Ошибка: ' + error.message);
      } else {
        setSubmission(data);
        setMessage('Отправлено! Ожидайте конца раунда...');
      }
    } catch (err) {
      console.error('Submit failed:', err);
      setMessage('Ошибка отправки: ' + (err?.message || 'неизвестная ошибка. Попробуйте ещё раз.'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePeerScore(submissionId) {
    const score = peerScores[submissionId];
    if (!score || score < 3 || score > 10) return;

    // Проверяем что ещё не оценивали
    const { data: existing } = await supabase
      .from('peer_scores')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('from_team_id', teamId)
      .maybeSingle();

    if (existing) {
      setPeerSubmitted(prev => ({ ...prev, [submissionId]: true }));
      return;
    }

    await supabase.from('peer_scores').insert({
      submission_id: submissionId,
      from_team_id: teamId,
      score: parseInt(score),
    });

    setPeerSubmitted(prev => ({ ...prev, [submissionId]: true }));
  }

  if (needLogin) {
    return (
      <div style={styles.center}>
        <div style={{ background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px' }}>
          <h2 style={{ color: '#00ff87', fontFamily: 'monospace', margin: '0 0 8px', textAlign: 'center' }}>MarketWars</h2>
          <p style={{ color: '#8888aa', textAlign: 'center', margin: '0 0 24px', fontSize: '14px' }}>Войдите в панель команды</p>
          <form onSubmit={handleTeamLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PasswordInput
              placeholder="Пароль команды"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              style={{ background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#ffffff', padding: '12px 16px', fontSize: '15px', outline: 'none' }}
            />
            {loginError && <p style={{ color: '#ff4757', margin: 0, fontSize: '13px' }}>{loginError}</p>}
            <button type="submit" style={{ background: '#00ff87', color: '#0a0a0f', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
              Войти →
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#8888aa' }}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={{ ...styles.teamName, color: team.color }}>{team.name}</h1>
          {game && (
            <p style={styles.gameStatus}>
              {game.status === 'active' ? 'Игра идёт' : STATUS_RU[game.status] || game.status}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '36px', fontWeight: 700, color: '#ffffff' }}>
            {team.shares}
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
            {shareChange !== null && shareChange !== 0 && (
              <span style={{ color: shareChange > 0 ? '#00ff87' : '#ff4757' }}>
                {shareChange > 0 ? '+' : ''}{shareChange} акций
              </span>
            )}
          </div>
        </div>
      </div>

      {round && (
        <div style={styles.roundBar}>
          <span style={{ color: '#8888aa' }}>Раунд {round.round_number} из {game?.total_rounds}</span>
          <RoundTimer startedAt={round.started_at} durationMinutes={round.duration_minutes} />
          <span style={{ color: '#8888aa', fontSize: '13px' }}>{STATUS_RU[round.status] || round.status}</span>
        </div>
      )}

      {team.projects && (
        <div style={styles.projectCard}>
          <p style={styles.sectionLabel}>Ваш проект</p>
          <p style={{ color: '#00ff87', fontWeight: 700, fontSize: '16px', margin: '0 0 6px' }}>{team.projects.title}</p>
          <p style={{ color: '#cccccc', fontSize: '13px', margin: '0 0 10px' }}>{team.projects.tagline}</p>
          <p style={{ color: '#8888aa', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>Ключевая фишка</p>
          <p style={{ color: '#cccccc', fontSize: '13px', margin: '0 0 10px' }}>{team.projects.key_feature}</p>
          <p style={{ color: '#8888aa', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>Что развивать</p>
          <ul style={{ color: '#cccccc', fontSize: '13px', margin: 0, paddingLeft: '18px' }}>
            {team.projects.tasks.split('\n').map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}

      {activeEvent && (
        <div style={{ marginBottom: '16px' }}>
          <p style={styles.sectionLabel}>Текущее рыночное событие</p>
          <EventCard event={activeEvent} compact />
        </div>
      )}

      {round && round.status !== 'active' && (
        submission ? (
          <div style={{ ...styles.submittedCard, marginBottom: '16px', padding: '12px 16px' }}>
            <p style={{ color: '#00ff87', margin: 0, fontSize: '13px', fontWeight: 600 }}>
              ✓ Заявка этого раунда сохранена — она учтётся в оценке.
            </p>
          </div>
        ) : (
          <div style={{ ...styles.submittedCard, marginBottom: '16px', padding: '12px 16px', background: 'rgba(255,71,87,0.05)', borderColor: 'rgba(255,71,87,0.3)' }}>
            <p style={{ color: '#ff4757', margin: 0, fontSize: '13px', fontWeight: 600 }}>
              ⚠ Вы не сдали заявку в этом раунде — она не попадёт в оценку.
            </p>
          </div>
        )
      )}

      {!game || game.status === 'waiting' ? (
        <div style={styles.waitCard}>
          <p style={{ color: '#8888aa', fontSize: '20px', margin: 0 }}>⏳ Ожидание начала игры...</p>
        </div>
      ) : game.status === 'finished' ? (
        <div style={styles.waitCard}>
          <p style={{ color: '#ffe66d', fontSize: '20px', margin: 0 }}>🏁 Игра завершена!</p>
          <p style={{ color: '#8888aa', marginTop: '8px' }}>Итоговые акции: {team.shares}</p>
        </div>
      ) : round?.status === 'active' ? (
        <div>
          <p style={styles.sectionLabel}>Заявка раунда</p>
          {!submission ? (
            <form onSubmit={handleSubmit} style={styles.form}>
              <textarea
                style={styles.textarea}
                value={features}
                onChange={e => setFeatures(e.target.value)}
                placeholder="Опишите что ваша команда сделала в этом раунде&#10;&#10;Пример: Добавили AI-ассистента, авторизацию, фильтр товаров, тёмную тему"
                rows={6}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: '#8888aa', fontSize: '13px' }}>
                  Скриншот проекта (AI проанализирует дизайн)
                </label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: '#1a1a28', border: '1px dashed #2a2a3a',
                  borderRadius: '8px', padding: '12px 16px', cursor: 'pointer',
                  color: '#8888aa', fontSize: '14px',
                }}>
                  📷 {screenshot ? screenshot.name : 'Выбрать скриншот...'}
                  <input type="file" accept="image/*" onChange={handleScreenshotChange} style={{ display: 'none' }} />
                </label>
                {screenshotPreview && (
                  <img src={screenshotPreview} alt="preview" style={{ borderRadius: '8px', maxHeight: '160px', objectFit: 'cover', border: '1px solid #2a2a3a' }} />
                )}
              </div>
              {message && <p style={{ color: '#ff4757', fontSize: '13px', margin: 0 }}>{message}</p>}
              <button type="submit" style={styles.btn} disabled={loading}>
                {loading ? 'Отправляю...' : 'Отправить заявку →'}
              </button>
            </form>
          ) : (
            <div style={styles.submittedCard}>
              <p style={{ color: '#00ff87', margin: '0 0 8px', fontWeight: 600 }}>✓ Заявка отправлена!</p>
              <p style={{ color: '#8888aa', fontSize: '14px', margin: 0 }}>{submission.features}</p>
              {message && <p style={{ color: '#8888aa', marginTop: '12px', fontSize: '13px' }}>{message}</p>}
            </div>
          )}
        </div>
      ) : round?.status === 'scoring' ? (
        <div>
          <p style={styles.sectionLabel}>Оцените конкурентов (1–10)</p>
          <p style={{ color: '#8888aa', fontSize: '12px', margin: '-4px 0 10px', background: '#1a1a28', borderRadius: '6px', padding: '8px 12px', border: '1px solid #2a2a3a' }}>
            📋 Правила: минимальная оценка — <b style={{ color: '#ffe66d' }}>3</b>, максимальная — <b style={{ color: '#00ff87' }}>10</b>. Оценки ниже 3 не принимаются.
          </p>
          {peerTargets.length === 0 ? (
            <p style={{ color: '#8888aa' }}>Другие команды ещё не сдали заявки.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {peerTargets.map(sub => (
                <div key={sub.id} style={styles.peerCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sub.teams?.color, display: 'inline-block' }} />
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{sub.teams?.name}</span>
                  </div>
                  <p style={{ color: '#8888aa', fontSize: '13px', margin: '0 0 12px' }}>{sub.features}</p>
                  {peerSubmitted[sub.id] ? (
                    <p style={{ color: '#00ff87', fontSize: '13px', margin: 0 }}>✓ Оценка отправлена: {peerScores[sub.id] || '?'}/10</p>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min={3}
                        max={10}
                        style={styles.scoreInput}
                        placeholder="3–10"
                        value={peerScores[sub.id] || ''}
                        onChange={e => {
                          const v = Math.min(10, Math.max(3, parseInt(e.target.value) || 3));
                          setPeerScores(prev => ({ ...prev, [sub.id]: v }));
                        }}
                      />
                      <button style={styles.smallBtn} onClick={() => handlePeerScore(sub.id)}>
                        Отправить оценку
                      </button>
                      {peerScores[sub.id] < 3 && (
                        <span style={{ color: '#ff4757', fontSize: '12px' }}>Минимум 3</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : round?.status === 'finished' ? (
        <div style={styles.waitCard}>
          <p style={{ color: '#8888aa' }}>Раунд завершён. Ожидание следующего раунда...</p>
          {submission && (
            <div style={{ marginTop: '12px' }}>
              {submission.ai_score && (
                <p style={{ color: '#ffffff', fontFamily: 'monospace' }}>
                  AI Оценка: {submission.ai_score}/10
                </p>
              )}
              {submission.ai_reason && (
                <p style={{ color: '#8888aa', fontSize: '13px' }}>{submission.ai_reason}</p>
              )}
              {submission.ai_breakdown && (
                <div style={{ marginTop: '10px', textAlign: 'left', background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', fontFamily: 'monospace', color: '#8888aa' }}>
                    <span>Понимание кейса: <b style={{ color: '#cccccc' }}>{submission.ai_breakdown.understanding}</b></span>
                    <span>Оригинальность: <b style={{ color: '#cccccc' }}>{submission.ai_breakdown.originality}</b></span>
                    <span>Реализуемость: <b style={{ color: '#cccccc' }}>{submission.ai_breakdown.feasibility}</b></span>
                    <span>Монетизация: <b style={{ color: '#cccccc' }}>{submission.ai_breakdown.monetization}</b></span>
                  </div>
                  {submission.ai_breakdown.strongPoint && (
                    <p style={{ color: '#00ff87', fontSize: '12px', margin: '8px 0 0' }}>+ {submission.ai_breakdown.strongPoint}</p>
                  )}
                  {submission.ai_breakdown.weakPoint && (
                    <p style={{ color: '#ff6b6b', fontSize: '12px', margin: '2px 0 0' }}>− {submission.ai_breakdown.weakPoint}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  container: { background: '#0a0a0f', minHeight: '100vh', padding: '24px', maxWidth: '640px', margin: '0 auto' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0f' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '16px',
  },
  teamName: { margin: 0, fontSize: '24px', fontWeight: 700, fontFamily: 'monospace' },
  gameStatus: { color: '#8888aa', margin: '4px 0 0', fontSize: '13px' },
  roundBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  sectionLabel: { color: '#8888aa', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' },
  projectCard: { background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' },
  waitCard: { background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '12px', padding: '32px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  textarea: {
    background: '#1a1a28',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    color: '#ffffff',
    padding: '14px',
    fontSize: '14px',
    resize: 'vertical',
    outline: 'none',
    width: '100%',
    lineHeight: 1.6,
  },
  btn: { background: '#00ff87', color: '#0a0a0f', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' },
  submittedCard: { background: 'rgba(0,255,135,0.05)', border: '1px solid rgba(0,255,135,0.3)', borderRadius: '10px', padding: '16px' },
  peerCard: { background: '#12121a', border: '1px solid #2a2a3a', borderRadius: '10px', padding: '16px' },
  scoreInput: { background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: '6px', color: '#ffffff', padding: '8px 12px', fontSize: '14px', width: '80px', outline: 'none' },
  smallBtn: { background: '#4ecdc4', color: '#0a0a0f', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
};
