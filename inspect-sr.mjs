import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));

console.log("Top-level keys:", Object.keys(data));
console.log("Season info:", JSON.stringify(data.season ?? null));

const games = data.games ?? [];
console.log("Games:", games.length);

const statuses = {};
for (const g of games) statuses[g.status] = (statuses[g.status] ?? 0) + 1;
console.log("Status counts:", statuses);

const dates = games.map((g) => g.scheduled).filter(Boolean).sort();
console.log("Date range:", dates[0], "->", dates.at(-1));

console.log("First game:");
console.log(JSON.stringify(games[0], null, 2));