import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const SR_KEY = process.env.SPORTRADAR_KEY;
const BDL_KEY = process.env.BALLDONTLIE_KEY;

const SR_LEVEL = "trial"; // use "production" if that's your key type
const SEASON = 2026;
const DELAY_MS = 3000;    // pause between calls

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch with automatic retries when rate-limited (429)
async function getJson(url, headers, tries = 5) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.ok) return res.json();

    if (res.status === 429 && attempt < tries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter > 0 ? retryAfter * 1000 : attempt * 5000;
      console.log(`Rate limited. Waiting ${wait / 1000}s (attempt ${attempt}/${tries})...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}

// Skip downloads we already have, and don't let one failure stop the rest
async function download(name, fetcher) {
  const file = `raw/${name}.json`;
  if (existsSync(file)) {
    console.log("Already have", name, "- skipping");
    return;
  }
  try {
    const data = await fetcher();
    await writeFile(file, JSON.stringify(data, null, 2));
    console.log("Saved", name);
  } catch (err) {
    console.error("FAILED", name, "->", err.message);
  }
  await sleep(DELAY_MS);
}

await mkdir("raw", { recursive: true });

// ---------- Sportradar ----------
const SR = `https://api.sportradar.com/wnba/${SR_LEVEL}/v8/en`;
const srHeaders = { "x-api-key": SR_KEY };

await download("sr-hierarchy", () =>
  getJson(`${SR}/league/hierarchy.json`, srHeaders)
);
await download(`sr-schedule-${SEASON}-REG`, () =>
    getJson(`${SR}/games/${SEASON}/REG/schedule.json`, srHeaders)
);

await download(`sr-schedule-${SEASON}-PST`, () =>
  getJson(`${SR}/games/${SEASON}/PST/schedule.json`, srHeaders)
);
// ---------- BALLDONTLIE ----------
const bdlHeaders = { Authorization: BDL_KEY }; // no "Bearer"

async function getAllPages(url) {
  const all = [];
  let cursor;
  do {
    const u = new URL(url);
    u.searchParams.set("per_page", "100");
    if (cursor) u.searchParams.set("cursor", cursor);
    const page = await getJson(u.toString(), bdlHeaders);
    all.push(...page.data);
    cursor = page.meta?.next_cursor;
    await sleep(DELAY_MS);
  } while (cursor);
  return all;
}

await download("bdl-teams", () =>
  getAllPages("https://api.balldontlie.io/wnba/v1/teams")
);
await download("bdl-games", () =>
  getAllPages("https://api.balldontlie.io/wnba/v1/games")
);

console.log("Done.");