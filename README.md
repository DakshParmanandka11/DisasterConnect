# DisasterConnect

A web-based disaster reporting and community verification platform. Citizens report incidents with geotagged photos/video; only users within a **10 km radius** can vote; reports that cross **>40% upvotes** (with a minimum quorum) are auto-flagged and nearby **NGOs are notified** automatically.

Built as a working full-stack MVP for a hackathon demo — not just a spec.

## Stack

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`), JWT auth, Multer for media uploads
- **Frontend:** React (Vite) + React Router + Leaflet/OpenStreetMap for maps
- No external API keys required — OpenStreetMap tiles are free, no signup.

## Project structure

```
disasterconnect/
  backend/
    server.js          # Express app entry point
    db/index.js         # SQLite schema + seeded system config (radius, threshold, quorum)
    routes/auth.js       # register/login/me
    routes/reports.js    # create/list/detail/vote/status — core verification logic lives here
    routes/ngo.js         # NGO notification dashboard
    util/geo.js            # haversine distance calculation
    util/auth.js            # JWT sign/verify middleware
    uploads/                  # uploaded photo/video files (served statically)
  frontend/
    src/pages/            Feed, Login, Register, NewReport, ReportDetail, NGODashboard
    src/components/        Navbar, SignalMeter (vote-threshold gauge), ReportRow, MapPicker
    src/context/AuthContext.jsx
    src/hooks/useGeolocation.js
```

## Running it locally

**1. Backend** (port 4000):
```bash
cd backend
npm install
node server.js
```
> If `npm install` fails on `better-sqlite3` with a `node-gyp` / `403` error, it's a transient prebuilt-binary fetch issue — just run `npm install` again.

**2. Frontend** (port 5173, proxies `/api` and `/uploads` to the backend):
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. That's it — no `.env`, no API keys, no external DB setup.

### Production-style single-server run
`backend/server.js` also serves the built frontend (`frontend/dist`) directly, so for a single-process demo:
```bash
cd frontend && npm run build
cd ../backend && node server.js
```
Then everything (API + UI) is on `http://localhost:4000`.

## Demo script (suggested order)

1. **Register an NGO account** — role "NGO / Relief Org", set org name + service radius, click "Use my current location" (or click the map) to set its service area.
2. **Register a citizen account** in a second browser/incognito window.
3. As the citizen, click **Report Incident** — fill in title/category/severity, optionally attach a photo, and submit (location is auto-captured via browser geolocation).
4. Open the report detail page. Note the **Signal Meter** — it shows the live upvote % against the 40% threshold line, and the vote quorum.
5. Register a few more citizen accounts (or open more incognito tabs) *within 10 km* of the incident, and vote. Try voting from a location >10 km away to see the eligibility rejection.
6. Once quorum (10 votes) is met and upvotes exceed 40%, the report **auto-flags** and a banner confirms nearby NGOs were notified.
7. Switch to the NGO account → **NGO Dashboard** — the flagged report appears with an "Acknowledge" and "Mark Under Review" / "Mark Resolved" workflow.

## Core verification logic (the part judges will probe)

All in `backend/routes/reports.js`:
- **Voting eligibility** is computed **server-side** via haversine distance between the voter's submitted current location and the report's geotag — never trusted from the client. Configurable via `system_config.voting_radius_km` (default 10).
- **Auto-flagging** requires *both* `upvote% > 40` *and* a minimum vote quorum (default 10) — this prevents 1 upvote out of 1 vote from falsely triggering escalation. See `system_config.min_vote_quorum` / `verification_threshold_pct`.
- **NGO matching** on flag: any NGO whose service area is within `ngo_notify_radius_km` (default 25 km) of the incident gets a `notifications` row and appears on their dashboard.

These four numbers live in the `system_config` SQLite table, not hardcoded — easy to show/tune live during Q&A.

## Known limitations (be upfront about these if asked)

- Map tiles require internet access (OpenStreetMap CDN) — fine for a live demo with wifi.
- No malware/EXIF scanning on uploaded media (noted as a to-do, not needed for MVP demo).
- No native mobile app — responsive web only.
- SQLite is fine for a hackathon demo; swap for Postgres+PostGIS for real scale (schema is already close to that shape).

## What makes this stand out (not just CRUD)

- **Live Crisis Map** (`/map`) — every active report plotted, color-coded by status, updating in real time via WebSocket as votes/flags happen anywhere in the system. This is the single best thing to have on screen when judges walk up.
- **Real-time everywhere** — Socket.IO pushes `report:new` / `report:updated` / `report:flagged` events to every connected client. Open the feed in one tab and the NGO dashboard in another; vote in a third and watch both update with no refresh.
- **Smart duplicate/incident clustering** — when a new report comes in matching an existing active report's category, within ~0.5 km and a few hours, it's automatically linked into the same "cluster." The UI shows "N separate reports describe this same incident" with links — a real crowd-reporting problem (Waze does this for hazards) solved without touching the core vote-threshold math, so it's easy to explain to judges.
- **One-click demo mode** — every pending report has a "⚡ Demo: Simulate Local Votes" button. It instantly creates realistic synthetic nearby voters and casts votes (skewed ~78% up), so you can show the full auto-flag → NGO-notify pipeline live on stage in 2 seconds instead of manually registering 10 accounts. Clearly labeled as a demo aid, not hidden.

## Updated demo script

1. Open **two browser windows side by side**: one on `/map` (or the NGO dashboard, logged in as the NGO), one on a report detail page.
2. On the report detail page, click **⚡ Demo: Simulate Local Votes**.
3. Watch the *other* window update live — the map pin flips color and pulses, or the NGO dashboard gets a new flagged incident — with zero refresh. This "it just works, live, across two screens" moment is the strongest thing you can show.
4. Then walk through the real flow once (register → report → vote manually → see rejection when voting from far away) to prove the simulate button isn't hiding fake mechanics — it's exercising the exact same code path.
5. Submit a second report near an existing one in the same category to show the duplicate-clustering notice.
