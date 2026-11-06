import Database from "better-sqlite3";

const SEASON = 2026;
const MIN = 60 * 1000;
const WINDOW = 36 * 60 * MIN; // match games within 1.5 days

const db = new Database("wnba.db", { readonly: true });
const norm = (s) => (s ?? "").trim().toLowerCase();
const mapStatus = (s) => (s === "closed" ? "final" : s);
const ms = (d) => new Date(d).getTime();

const bdl = db
  .prepare(
    `SELECT g.id, g.date, g.postseason, g.status_state, g.home_score, g.visitor_score,
            h.full_name AS home, v.full_name AS visitor
     FROM games g
     JOIN teams h ON h.id = g.home_team_id
     JOIN teams v ON v.id = g.visitor_team_id
     WHERE g.season = ?`
  )
  .all(SEASON);

const sr = db.prepare("SELECT * FROM sr_games WHERE season = ?").all(SEASON);

if (sr.length === 0) {
  console.log("No Sportradar games found. Run: npm run load-sr");
  process.exit(1);
}

const hasPlayoffs = sr.some((g) => g.season_type === "PST");

// ---- Team names ----
const bdlNames = new Set(
  db.prepare("SELECT full_name FROM teams WHERE is_wnba = 1").all().map((t) => norm(t.full_name))
);
const srNames = new Set(sr.flatMap((g) => [g.home_name, g.away_name]).map(norm));
const srUnmatched = [...srNames].filter((n) => !bdlNames.has(n));
const bdlUnmatched = [...bdlNames].filter((n) => !srNames.has(n));

// ---- Index BALLDONTLIE games by home|visitor ----
const byPair = new Map();
for (const g of bdl) {
  const key = `${norm(g.home)}|${norm(g.visitor)}`;
  if (!byPair.has(key)) byPair.set(key, []);
  byPair.get(key).push(g);
}

const matched = new Set();
let agree = 0;
let exactTime = 0;
const diffs = [];
const srOnly = [];
const flipped = [];

function closest(list, t) {
  return (list ?? [])
    .filter((g) => !matched.has(g.id) && Math.abs(ms(g.date) - t) <= WINDOW)
    .sort((a, b) => Math.abs(ms(a.date) - t) - Math.abs(ms(b.date) - t))[0];
}

for (const s of sr) {
  const t = ms(s.scheduled);
  const home = norm(s.home_name);
  const away = norm(s.away_name);

  let found = closest(byPair.get(`${home}|${away}`), t);
  let isFlipped = false;
  if (!found) {
    found = closest(byPair.get(`${away}|${home}`), t);
    isFlipped = Boolean(found);
  }

  const label = `${s.scheduled.slice(0, 10)} ${s.away_name} @ ${s.home_name}`;

  if (!found) {
    srOnly.push(`${label} (${s.status})`);
    continue;
  }
  matched.add(found.id);
  if (isFlipped) flipped.push(label);
  if (Math.abs(ms(found.date) - t) <= 5 * MIN) exactTime++;

  // Line BALLDONTLIE's scores up with Sportradar's home/away order
  const bHome = isFlipped ? found.visitor_score : found.home_score;
  const bAway = isFlipped ? found.home_score : found.visitor_score;

  const statusOk = mapStatus(s.status) === found.status_state;
  const scoresOk =
    (s.home_points ?? null) === (bHome ?? null) &&
    (s.away_points ?? null) === (bAway ?? null);

  if (statusOk && scoresOk) agree++;
  else {
    diffs.push(
      `${label}\n     Sportradar: ${s.status} ${s.away_points}-${s.home_points} (away-home)` +
        `\n     BALLDONTLIE: ${found.status_state} ${bAway}-${bHome} (away-home)`
    );
  }
}

const bdlLeft = bdl.filter((g) => !matched.has(g.id));
const bdlLeftRegular = bdlLeft.filter((g) => !g.postseason);
const bdlLeftPost = bdlLeft.filter((g) => g.postseason);
const midnight = bdl.filter((g) => g.date.endsWith("T00:00:00.000Z")).length;
const bdlRegular = bdl.filter((g) => !g.postseason).length;

// ---- Report ----
console.log(`\n=== ${SEASON} comparison ===`);
console.log(`Sportradar games:     ${sr.length}${hasPlayoffs ? " (includes playoffs)" : " (regular season only)"}`);
console.log(`BALLDONTLIE games:    ${bdl.length} (${bdlRegular} regular, ${bdl.length - bdlRegular} postseason)`);
console.log(`Matched:              ${matched.size}`);
console.log(`  Fully agree (status and scores): ${agree}`);
console.log(`  Disagree:                        ${diffs.length}`);
console.log(`  Start time within 5 min:         ${exactTime} of ${matched.size}`);
console.log(`  Home/away swapped:               ${flipped.length}`);
console.log(`Only in Sportradar:   ${srOnly.length}`);
console.log(`Only in BALLDONTLIE:  ${bdlLeftRegular.length} regular season`);
console.log(
  `                      ${bdlLeftPost.length} postseason` +
    (hasPlayoffs ? "" : " (expected: playoff file not loaded)")
);
console.log(`BALLDONTLIE timestamps at exactly midnight UTC: ${midnight} of ${bdl.length}`);

if (srUnmatched.length || bdlUnmatched.length) {
  console.log("\nTEAM NAMES THAT DON'T LINE UP:");
  console.log("  Sportradar only:   ", srUnmatched.join(", ") || "none");
  console.log("  BALLDONTLIE only:  ", bdlUnmatched.join(", ") || "none");
}

const show = (title, list) => {
  if (!list.length) return;
  console.log(`\n${title} (first 10 of ${list.length}):`);
  list.slice(0, 10).forEach((x) => console.log("  -", x));
};
show("DISAGREEMENTS", diffs);
show("ONLY IN SPORTRADAR", srOnly);
show("HOME/AWAY SWAPPED", flipped);
show(
  "ONLY IN BALLDONTLIE (regular season)",
  bdlLeftRegular.map((g) => `${g.date.slice(0, 10)} ${g.visitor} @ ${g.home} (${g.status_state})`)
);