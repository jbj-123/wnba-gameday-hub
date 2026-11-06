import Database from "better-sqlite3";
import { readFileSync, existsSync } from "node:fs";

const SEASON = 2026;
const FILES = [
  { file: `raw/sr-schedule-${SEASON}-REG.json`, type: "REG" },
  { file: `raw/sr-schedule-${SEASON}-PST.json`, type: "PST" },
];

const db = new Database("wnba.db");

// Separate table, so BALLDONTLIE's teams and games tables are untouched
db.exec(`
  DROP TABLE IF EXISTS sr_games;
  CREATE TABLE sr_games (
    id TEXT PRIMARY KEY,
    season INTEGER,
    season_type TEXT,
    status TEXT,
    scheduled TEXT,
    home_name TEXT,
    home_alias TEXT,
    away_name TEXT,
    away_alias TEXT,
    home_points INTEGER,
    away_points INTEGER,
    venue_name TEXT,
    venue_city TEXT,
    venue_state TEXT,
    broadcasts TEXT,
    cc_cup INTEGER
  );
  CREATE INDEX idx_sr_games_scheduled ON sr_games(scheduled);
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO sr_games
  (id, season, season_type, status, scheduled, home_name, home_alias,
   away_name, away_alias, home_points, away_points,
   venue_name, venue_city, venue_state, broadcasts, cc_cup)
  VALUES
  (@id, @season, @season_type, @status, @scheduled, @home_name, @home_alias,
   @away_name, @away_alias, @home_points, @away_points,
   @venue_name, @venue_city, @venue_state, @broadcasts, @cc_cup)
`);

db.transaction(() => {
  for (const { file, type } of FILES) {
    if (!existsSync(file)) {
      console.log(`Skipping ${type}: ${file} not found`);
      continue;
    }
    const data = JSON.parse(readFileSync(file, "utf8"));
    const games = data.games ?? [];

    for (const g of games) {
      insert.run({
        id: g.id,
        season: data.season?.year ?? SEASON,
        season_type: type,
        status: g.status,
        scheduled: g.scheduled,
        home_name: g.home?.name ?? null,
        home_alias: g.home?.alias ?? null,
        away_name: g.away?.name ?? null,
        away_alias: g.away?.alias ?? null,
        home_points: g.home_points ?? null,
        away_points: g.away_points ?? null,
        venue_name: g.venue?.name ?? null,
        venue_city: g.venue?.city ?? null,
        venue_state: g.venue?.state ?? null,
        broadcasts: JSON.stringify(g.broadcasts ?? []),
        cc_cup: g.cc_cup ? 1 : 0,
      });
    }
    console.log(`Loaded ${games.length} ${type} games`);
  }
})();

const total = db.prepare("SELECT COUNT(*) AS n FROM sr_games").get().n;
console.log(`sr_games now holds ${total} games`);