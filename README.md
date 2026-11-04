# WNBA GameDay Hub

A responsive website designed to give basketball fans one convenient place to explore WNBA team schedules, upcoming matchups, recent game results, and team information.

Users will be able to select a team and view its information through an interactive dashboard.

## Project Goals
- Display WNBA team information.
- Show upcoming games and the next scheduled matchup.
- Display recent game results and final scores.
- Provide a responsive experience on desktop and mobile devices.

## Technology Stack
- HTML
- CSS
- JavaScript
- BALLDONTLIE or Sportradar WNBA API (API selection pending)
- Node.js/Express if needed for secure API access
- Git and GitHub

## Planned Features
- WNBA team selection
- Team dashboard
- Upcoming game schedule
- Next-game matchup display
- Recent game results
- Responsive design
- Loading and error states

## Project Scope
The initial version will focus on team schedules, upcoming matchups, and recent results. Advanced player statistics, live play-by-play, user accounts, and other expanded features are outside the initial project scope.

## Development Status
Project planning and proposal stage. Development will begin after mentor approval.

## Data Setup (first time on a computer)
1. `npm install`
2. Create a `.env` file with your API keys:
   ```
   BALLDONTLIE_KEY=...
   SPORTRADAR_KEY=...
   ```
3. `npm run fetch` (downloads raw data into `raw/`, slow because of rate limits)
4. `npm run build-db` (builds `wnba.db` from `raw/`)
5. `npm run check` (confirms everything is in place)

## Refreshing Data
Delete `raw/bdl-games.json`, then run `npm run fetch` and `npm run build-db`.

## Notes
- The 2026 season is over, so there are no upcoming games until the 2027 schedule is published.
- Team list = teams with `is_wnba = 1` (see `WNBA_ABBRS` in `build-db.mjs`).
- `.env`, `raw/`, and `*.db` are NOT in Git.