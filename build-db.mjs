import Database from "better-sqlite3";
import { readFileSync } from "node:fs";

const db = new Database("wnba.db");

// Rebuild from scratch each run, so it's safe to re-run
db.exec(`
  DROP TABLE IF EXISTS games;
  DROP TABLE IF EXISTS teams;

    CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    city TEXT,
    name TEXT,
    full_name TEXT,
    abbreviation TEXT,
    conference TEXT,
    is_wnba INTEGER DEFAULT 0
  );

  CREATE TABLE games (
    id INTEGER PRIMARY KEY,
    date TEXT,
    season INTEGER,
    postseason INTEGER,
    status TEXT,
    status_state TEXT,
    home_team_id INTEGER,
    visitor_team_id INTEGER,
    home_score INTEGER,
    visitor_score INTEGER
  );

  CREATE INDEX idx_games_date ON games(date);
  CREATE INDEX idx_games_home ON games(home_team_id);
  CREATE INDEX idx_games_visitor ON games(visitor_team_id);
`);

const teams = JSON.parse(readFileSync("raw/bdl-teams.json", "utf8"));
const games = JSON.parse(readFileSync("raw/bdl-games.json", "utf8"));

const insertTeam = db.prepare(
  `INSERT OR IGNORE INTO teams (id, city, name, full_name, abbreviation, conference)
   VALUES (?, ?, ?, ?, ?, ?)`
);
const insertGame = db.prepare(
  `INSERT OR REPLACE INTO games
   (id, date, season, postseason, status, status_state,
    home_team_id, visitor_team_id, home_score, visitor_score)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const addTeam = (t) =>
  insertTeam.run(t.id, t.city, t.name, t.full_name, t.abbreviation, t.conference);

db.transaction(() => {
  teams.forEach(addTeam);
  for (const g of games) {
    // Some teams may appear in games but not in the teams list
    addTeam(g.home_team);
    addTeam(g.visitor_team);

    insertGame.run(
      g.id,
      g.date,
      g.season,
      g.postseason ? 1 : 0, // SQLite can't store true/false directly
      g.status,
      g.status_state,
      g.home_team.id,
      g.visitor_team.id,
      g.home_score ?? null,
      g.away_score ?? null
    );
  }
})();
// ---------- Fix incomplete team data ----------
const WNBA_ABBRS = [
  "ATL", "CHI", "CON", "DAL", "GS", "IND", "LV", "LA",
  "MIN", "NY", "PHX", "SEA", "WSH", "POR", "TOR",
];

// BALLDONTLIE is missing these fields for the 2026 expansion teams
const FIXES = {
  POR: { city: "Portland", full_name: "Portland Fire", conference: "Western Conference" },
  TOR: { city: "Toronto", full_name: "Toronto Tempo", conference: "Eastern Conference" },
};

db.transaction(() => {
  const mark = db.prepare("UPDATE teams SET is_wnba = 1 WHERE abbreviation = ?");
  const fix = db.prepare(
    "UPDATE teams SET city = ?, full_name = ?, conference = ? WHERE abbreviation = ?"
  );
  for (const abbr of WNBA_ABBRS) mark.run(abbr);
  for (const [abbr, f] of Object.entries(FIXES)) {
    fix.run(f.city, f.full_name, f.conference, abbr);
  }
})();
const nTeams = db.prepare("SELECT COUNT(*) AS n FROM teams").get().n;
const nGames = db.prepare("SELECT COUNT(*) AS n FROM games").get().n;
console.log(`Loaded ${nTeams} teams and ${nGames} games into wnba.db`);