import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import StockChart from '../components/StockChart';
import Leaderboard from '../components/Leaderboard';
import EventCard from '../components/EventCard';
import RoundTimer from '../components/RoundTimer';

export default function Dashboard() {
  const [teams, setTeams] = useState([]);
  const [shareHistory, setShareHistory] = useState([]);
  const [round, setRound] = useState(null);
  const [game, setGame] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [prevShares, setPrevShares] = useState({});
  const feedRef = useRef(null);

  useEffect(() => {
    loadInitialData();

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'share_history' },
        (payload) => {
          setShareHistory(prev => [...prev, payload.new]);
          setTeams(prev => prev.map(t =>
            t.id === payload.new.team_id ? { ...t, shares: payload.new.value } : t
          ));
          addFeedItem(`Акции обновлены`);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_events' },
        (payload) => {
          setActiveEvent(payload.new);
          addFeedItem(`Событие: ${payload.new.card_text.slice(0, 60)}...`);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds' },
        (payload) => {
          setRound(payload.new);
          addFeedItem(`Раунд ${payload.new.round_number}: ${payload.new.status}`);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rounds' },
        (payload) => {
          setRound(payload.new);
          addFeedItem(`Раунд ${payload.new.round_number} начался!`);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' },
        async (payload) => {
          const { data: t } = await supabase.from('teams').select('name').eq('id', payload.new.team_id).single();
          if (t) addFeedItem(`${t.name} сдали заявку`);
        })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [activityFeed]);

  function addFeedItem(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActivityFeed(prev => [...prev.slice(-49), { text, time, id: Date.now() }]);

  }

  async function loadInitialData() {
    const { data: gameData } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!gameData) return;
    setGame(gameData);

    const [{ data: teamsData }, { data: histData }, { data: roundData }, { data: eventData }] = await Promise.all([
      supabase.from('teams').select('*').eq('game_id', gameData.id),
      supabase.from('share_history').select('*, rounds(round_number)').order('recorded_at'),
      supabase.from('rounds').select('*').eq('game_id', gameData.id).order('round_number', { ascending: false }).limit(1).single(),
      supabase.from('market_events').select('*').eq('game_id', gameData.id).order('triggered_at', { ascending: false }).limit(1).single(),
    ]);

    if (teamsData) {
      setTeams(teamsData);
      const prev = {};
      teamsData.forEach(t => { prev[t.id] = t.shares; });
      setPrevShares(prev);
    }

    if (histData) {
      const flat = histData.map(h => ({ ...h, round_number: h.rounds?.round_number }));
      setShareHistory(flat);
    }

    if (roundData) setRound(roundData);
    if (eventData) setActiveEvent(eventData);
  }

  const sorted = [...teams].sort((a, b) => b.shares - a.shares);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>MarketWars</h1>
          {game && (
            <span style={styles.roundBadge}>
              {game.status === 'active' ? `Раунд ${round?.round_number || '?'} из ${game.total_rounds}` : game.status.toUpperCase()}
            </span>
          )}
        </div>
        <div style={styles.headerRight}>
          {round?.status === 'active' && (
            <RoundTimer startedAt={round.started_at} durationMinutes={round.duration_minutes} large />
          )}
          {round?.status === 'scoring' && (
            <span style={{ color: '#ffe66d', fontFamily: 'monospace', fontSize: '24px', fontWeight: 700 }}>
              ОЦЕНКА...
            </span>
          )}
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <p style={styles.panelLabel}>Лента событий</p>
          <div ref={feedRef} style={styles.feed}>
            {activityFeed.length === 0 ? (
              <p style={{ color: '#8888aa', fontSize: '13px', padding: '8px' }}>Ожидание активности...</p>
            ) : (
              activityFeed.map(item => (
                <div key={item.id} style={styles.feedItem}>
                  <span style={styles.feedTime}>{item.time}</span>
                  <span style={{ color: '#cccccc', fontSize: '13px' }}>{item.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.centerPanel}>
          <div style={styles.chartBox}>
            <StockChart teams={teams} shareHistory={shareHistory} />
          </div>

          {activeEvent && (
            <div style={{ marginTop: '16px' }}>
              <p style={styles.panelLabel}>Последнее событие</p>
              <EventCard event={activeEvent} />
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <p style={styles.panelLabel}>Таблица лидеров</p>
          <Leaderboard teams={teams} prevShares={prevShares} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#0a0a0f',
    minHeight: '100vh',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '12px',
    padding: '16px 24px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '20px' },
  title: { margin: 0, color: '#00ff87', fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, letterSpacing: '3px' },
  roundBadge: {
    background: '#1a1a28',
    border: '1px solid #2a2a3a',
    borderRadius: '20px',
    padding: '6px 16px',
    color: '#8888aa',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  headerRight: { display: 'flex', alignItems: 'center' },
  main: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr 240px',
    gap: '16px',
    flex: 1,
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  centerPanel: { display: 'flex', flexDirection: 'column' },
  rightPanel: {},
  panelLabel: { color: '#8888aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' },
  chartBox: {
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '12px',
    height: '380px',
    padding: '16px',
  },
  feed: {
    background: '#12121a',
    border: '1px solid #2a2a3a',
    borderRadius: '10px',
    padding: '12px',
    flex: 1,
    overflowY: 'auto',
    maxHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  feedItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  feedTime: { color: '#8888aa', fontSize: '10px', fontFamily: 'monospace' },
};
