import Database from "better-sqlite3";
import { existsSync } from "node:fs";

const problems = [];

for (const f of [".env", "raw/bdl-teams.json", "raw/bdl-games.json", "wnba.db"]) {
  if (!existsSync(f)) problems.push(`Missing file: ${f}`);
}

if (problems.length === 0) {
  const db = new Database("wnba.db", { readonly: true });
  const teams = db.prepare("SELECT COUNT(*) AS n FROM teams WHERE is_wnba = 1").get().n;
  const games = db.prepare("SELECT COUNT(*) AS n FROM games").get().n;
  const latest = db
    .prepare("SELECT MAX(date) AS d FROM games WHERE status_state = 'final'")
    .get().d;

  console.log(`WNBA teams: ${teams} (expect 15)`);
  console.log(`Games: ${games}`);
  console.log(`Latest finished game: ${latest}`);
  if (teams !== 15) problems.push("WNBA team count is not 15");
}

if (problems.length) {
  console.log("\nPROBLEMS:");
  problems.forEach((p) => console.log(" -", p));
} else {
  console.log("\nAll good.");
}