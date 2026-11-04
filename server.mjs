import express from "express";
import Database from "better-sqlite3";
import path from "node:path";

const PORT = process.env.PORT || 3000;

// Read-only: the server can never change your data
const db = new Database(path.join(import.meta.dirname, "wnba.db"), {
  readonly: true,
  fileMustExist: true,
});

// "Today" for the app. If APP_DATE is set in .env, pretend it's that date (demo mode).
function getNow() {
  if (process.env.APP_DATE) {
    const d = new Date(process.env.APP_DATE);
    if (!Number.isNaN(d.getTime())) return { date: d, demo: true };
  }
  return { date: new Date(), demo: false };
}

const GAME_SELECT = `
  SELECT g.id, g.date, g.season, g.postseason, g.status_state,
         h.id AS home_id, h.full_name AS home_name, h.abbreviation AS home_abbr,
         g.home_score,
         v.id AS visitor_id, v.full_name AS visitor_name, v.abbreviation AS visitor_abbr,
         g.visitor_score
  FROM games g
  JOIN teams h ON h.id = g.home_team_id
  JOIN teams v ON v.id = g.visitor_team_id
`;

// Returns the team if :id is a number and belongs to a current WNBA team
function findTeam(idParam) {
  if (!/^\d+$/.test(idParam)) return null;
  return (
    db
      .prepare(
        `SELECT id, city, name, full_name, abbreviation, conference
         FROM teams WHERE id = ? AND is_wnba = 1`
      )
      .get(Number(idParam)) ?? null
  );
}

const app = express();

// Quick check that the server is up, and whether demo mode is on
app.get("/api/health", (req, res) => {
  const { date, demo } = getNow();
  res.json({ ok: true, demoMode: demo, today: date.toISOString() });
});

// All 15 current teams (for the team selector)
app.get("/api/teams", (req, res) => {
  const teams = db
    .prepare(
      `SELECT id, city, name, full_name, abbreviation, conference
       FROM teams WHERE is_wnba = 1 ORDER BY full_name`
    )
    .all();
  res.json(teams);
});

// The team's next game, or game: null with a message if none exists
app.get("/api/teams/:id/next-game", (req, res) => {
  const team = findTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const { date, demo } = getNow();
  // In demo mode, "future" games already have final scores, so allow them
  const statuses = demo ? "('scheduled', 'final')" : "('scheduled')";

  const row = db
    .prepare(
      `${GAME_SELECT}
       WHERE (g.home_team_id = @id OR g.visitor_team_id = @id)
         AND g.date > @now
         AND g.status_state IN ${statuses}
       ORDER BY g.date ASC
       LIMIT 1`
    )
    .get({ id: team.id, now: date.toISOString() });

  if (!row) {
    return res.json({
      team,
      game: null,
      message:
        "No upcoming games are scheduled yet. Check back when the next season's schedule is released.",
    });
  }

  // Never show scores for a game that hasn't happened (matters in demo mode)
  res.json({ team, game: { ...row, home_score: null, visitor_score: null } });
});

// The team's most recent finished games (default 5, max 50)
app.get("/api/teams/:id/results", (req, res) => {
  const team = findTeam(req.params.id);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 50);
  const { date } = getNow();

  const results = db
    .prepare(
      `${GAME_SELECT}
       WHERE (g.home_team_id = @id OR g.visitor_team_id = @id)
         AND g.status_state = 'final'
         AND g.date <= @now
       ORDER BY g.date DESC
       LIMIT @limit`
    )
    .all({ id: team.id, now: date.toISOString(), limit });

  res.json({ team, results });
});

// Unknown /api routes get a JSON 404
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Later, your HTML/CSS/JS front end will go in a "public" folder
app.use(express.static(path.join(import.meta.dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});