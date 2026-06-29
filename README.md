# MarketWars

Real-time hackathon game platform where teams compete on a simulated stock market. Teams build features each round, get scored by AI and peers, and watch their share value rise or fall live on a projector dashboard.

**Stack:** React + Vite + Tailwind CSS + Supabase + Gemini API  
**Deploy:** Vercel

---

## Screens

| Route | Description |
|---|---|
| `/` | Home — links to all screens |
| `/register` | Teams self-register before the game |
| `/team/:teamId` | Each team's working panel during the game |
| `/dashboard` | Big screen for the projector — live chart + leaderboard |
| `/admin` | Admin control panel — manage rounds, scoring, events |

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd marketwars
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, then run this SQL in the SQL editor:

```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'waiting',
  current_round INT DEFAULT 0,
  total_rounds INT DEFAULT 6,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#00FF87',
  shares INT DEFAULT 100,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  round_number INT NOT NULL,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP DEFAULT now(),
  duration_minutes INT DEFAULT 20
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES rounds(id),
  team_id UUID REFERENCES teams(id),
  features TEXT NOT NULL,
  ai_score FLOAT,
  ai_reason TEXT,
  submitted_at TIMESTAMP DEFAULT now(),
  UNIQUE (round_id, team_id)
);

CREATE TABLE peer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id),
  from_team_id UUID REFERENCES teams(id),
  score INT CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (submission_id, from_team_id)
);

CREATE TABLE market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id),
  card_text TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  effect_target TEXT,
  effect_percent INT NOT NULL DEFAULT 0,
  is_random BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP DEFAULT now()
);

CREATE TABLE share_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  round_id UUID REFERENCES rounds(id),
  value INT NOT NULL,
  recorded_at TIMESTAMP DEFAULT now()
);

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

INSERT INTO admins (username, password) VALUES ('admin', 'marketwars2024');
```

Then run this SQL to disable Row Level Security (required for the app to read/write without auth policies):

```sql
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE peer_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE share_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
```

Then enable **Realtime** by running this SQL (do NOT use the Table Editor toggle — use SQL):

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE share_history;
ALTER PUBLICATION supabase_realtime ADD TABLE market_events;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
```

### 3. Get your Supabase URL and anon key

In Supabase → **Settings → API Keys → Legacy anon, service_role API keys**:
- Copy the **anon public** key

To find your **Project URL**: click **Connect** (top right) → Framework tab → copy `SUPABASE_URL` from the `.env` block. It looks like `https://xxxxxxxxxxxx.supabase.co`.

> Note: Use the **Legacy anon** key (starts with `eyJ`), not the new Publishable key (`sb_publishable_...`).

### 4. Get a Gemini API key

Go to [Google AI Studio](https://aistudio.google.com/apikey) and create a free API key (starts with `AIzaSy...`).

### 5. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=AIzaSy...
VITE_ADMIN_PASSWORD=marketwars2024
```

> After creating `.env`, always restart the dev server (`Ctrl+C` then `npm run dev`) so Vite picks up the new variables.

### 6. Run locally

```bash
npm run dev
```

---

## How the game works

1. **Admin creates a game** at `/admin` — status becomes `waiting`
2. **Teams register** at `/register` — pick a name, password, and color
3. **Admin starts the game** — Round 1 begins, 20-minute countdown starts
4. **Teams submit features** at `/team/:id` — describe what your team built
5. **Admin ends the round** — status moves to `scoring`
6. **Teams rate each other** (1–10) — peer scores collected
7. **Admin runs AI scoring** — Gemini evaluates each submission
8. **Admin calculates shares** — preview new values, confirm to save
9. **Admin triggers a market event** — global or feature-specific effect applied
10. **Dashboard updates live** — chart, leaderboard, and activity feed refresh in real time
11. Repeat for up to 6 rounds, then admin finishes the game

---

## Scoring formula

```
combined_score  = (ai_score × 0.7) + (peer_avg × 0.3)
score_multiplier = ((combined_score - 5) / 5) × 0.175 + 1.0
new_shares      = round(current_shares × score_multiplier × event_multiplier)
```

- Score 5 → no change
- Score 10 → +17.5%
- Score 0 → −17.5%
- Minimum shares: **10** (no team is eliminated)

---

## Market events

20 cards total — 10 scheduled (admin picks when to fire), 10 random (drawn from a deck).

| Effect type | What it does |
|---|---|
| `global_rise` | All teams gain shares |
| `global_drop` | All teams lose shares |
| `feature_boost` | Teams whose submission mentions the keyword gain shares |
| `feature_drop` | Teams whose submission mentions the keyword lose shares |
| `none` | Narrative only, no mechanical effect |

---

## Deploy to Vercel

1. Push the repo to GitHub
2. Import it at [vercel.com](https://vercel.com/new)
3. Add the four env vars in Vercel → Project Settings → Environment Variables
4. Deploy — Vercel auto-detects Vite

The included `vercel.json` handles SPA client-side routing automatically.

---

## Admin credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `marketwars2024` |

To change the password, update the `admins` table directly in Supabase.

---

## Project structure

```
src/
├── pages/
│   ├── Register.jsx       # Team self-registration
│   ├── TeamPanel.jsx      # Per-team working screen
│   ├── Dashboard.jsx      # Projector / big screen
│   └── Admin.jsx          # Admin control panel
├── components/
│   ├── StockChart.jsx     # Recharts line chart with per-team colored lines
│   ├── EventCard.jsx      # Animated market event card
│   ├── Leaderboard.jsx    # Team rankings with share change indicators
│   └── RoundTimer.jsx     # Countdown timer (turns red under 2 minutes)
└── lib/
    ├── supabase.js        # Supabase client
    ├── gemini.js          # AI scoring via Gemini 2.0 Flash
    ├── shareCalc.js       # Share value calculation logic
    └── marketEvents.js    # All 20 event card definitions
```
