# WNBA GameDay Hub

## Setup (first time on a computer)
1. `npm install`
2. Create a `.env` file with:
   BALLDONTLIE_KEY=...
   SPORTRADAR_KEY=...
3. `npm run fetch`      (downloads raw data into raw/, slow because of rate limits)
4. `npm run build-db`   (builds wnba.db from raw/)
5. `npm run check`      (confirms everything is in place)

## Refreshing data
Delete raw/bdl-games.json, then run `npm run fetch` and `npm run build-db`.

## Notes
- The 2026 season is over, so there are no upcoming games until the 2027 schedule is published.
- Team list = teams with is_wnba = 1 (see WNBA_ABBRS in build-db.mjs).
- .env, raw/, and *.db are NOT in Git.