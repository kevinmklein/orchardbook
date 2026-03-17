# The Orchard Book — Handover Prompt

Copy everything below this line into a new Claude conversation, then attach the three project files.

---

## Context

You are continuing development of **The Orchard Book**, a family orchard management web app for a ~20-tree fruit orchard in **northwest Washington state** (Everett area, Zone 8a/8b). The family is **Kevin, Stacey, Sara, and Sophia**. The app is a single-file HTML Progressive Web App deployed to **Netlify**, with a serverless function proxy for the Rachio irrigation API.

The three files to attach are:
- `index.html` — the full app (2,625 lines)
- `netlify/functions/rachio.js` — Rachio read-only API proxy (102 lines)
- `netlify.toml` — Netlify build config (15 lines)

These are deployed as a zip to Netlify via drag-and-drop at app.netlify.com/drop. The zip must be built from **inside** the deploy folder (flat structure, no wrapper directory) or Netlify won't find the functions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Single HTML file — Playfair Display + Jost fonts, vanilla JS, CSS variables |
| Database | Firebase Firestore (`orchardbook` project) |
| Hosting | Netlify (free tier) |
| Irrigation API | Rachio v1 REST API via Netlify serverless function proxy |
| Auth | No passwords — in-app family profile selector (4 users) |

---

## Firebase Configuration

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDMr6LTZYM4Jhp50DV4wCyOeEY1bcDJjIY",
  authDomain: "orchardbook.firebaseapp.com",
  projectId: "orchardbook",
  storageBucket: "orchardbook.firebasestorage.app",
  messagingSenderId: "28893214980",
  appId: "1:28893214980:web:18d56949d73ecce09ab851"
};
```

Firebase client-side keys are intentionally public (secured by Firestore rules). Netlify's secrets scanner is configured to ignore the `AIzaSy...` key via `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` in `netlify.toml`.

Firebase SDK version: `11.4.0`

---

## Rachio Configuration

- **API key**: stored as Netlify environment variable `RACHIO_API_KEY` — never in the HTML
- **Controller name**: `Forest House Gardens` (exact match required)
- **Orchard zones** (exact Rachio zone names):
  - `Orchard North` → trees 17–24
  - `Orchard West` → trees 3, 4, 7, 8, 11, 12, 15, 16
  - `Orchard East` → trees 1, 2, 5, 6, 9, 10, 13, 14
- Proxy function lives at `/.netlify/functions/rachio`
- All Rachio calls are **read-only GET** — no write/control endpoints are permitted
- Fetch flow: `GET /person/info` → get person ID → `GET /person/{id}` → get devices + zones → `GET /schedulerule/device/{id}` per device

---

## Firestore Collections & Schema

### `/trees/{treeId}`
```
id, name (short), fullName, species, varietal, yearPlanted, rootstock,
gridPosition (1–24), pollinators (array of treeIds or ['self']),
health ('healthy'|'watch'|'concern'), currentStage (phenological stage string),
notes, lastLogged (display date string), addedBy, createdAt, updatedAt
```

### `/observations/{obsId}`
```
treeId, type ('growth'|'fruit'|'pest'|'disease'|'work'|'general'),
loggedBy (user id), health, notes, loggedDate (ISO string for sorting),
displayDate (human-readable e.g. "Mar 15, 2026"), createdAt (Firestore timestamp)
```

### `/tasks/{taskId}`
```
id, title, description, urgency ('urgent'|'soon'|'upcoming'),
due (display string), trees (display string), estMin, done (boolean),
completedBy (user name), category ('spray'|'prune'|'fertilize'|'thin'|'monitor'|'harvest'|'other'),
createdAt
```

### `/users/{userId}`
Not yet used — users are hardcoded in the app as `DB.users`. Future: migrate to Firestore.

---

## App Architecture

### Data layer (`const DB`)
All Firestore access is centralized in the `DB` object. Methods:
- `getTrees()` — Firestore or empty array
- `getTree(id)` — single tree by Firestore doc ID
- `getTasks()` — Firestore, seeds `defaultTasks` array if collection is empty/invalid
- `getObservations(treeId?)` — all or filtered by tree, sorted newest first
- `saveObservation(obs)` — addDoc to Firestore
- `updateTask(id, data)` — setDoc merge
- `addTree(tree)` — addDoc, returns tree with Firestore ID
- `updateTree(id, data)` — setDoc merge
- `updateObservation(id, data)` — setDoc merge
- `deleteObservation(id)` — deleteDoc

`DB.trees`, `DB.tasks`, `DB.observations` are local caches updated on each fetch.

### Firebase initialization race condition fix
Firebase module script fires `firebase-ready` deferred via `DOMContentLoaded + setTimeout(0)` to ensure the main `<script>` block has parsed before the event fires. The single `firebase-ready` listener refreshes all data panels AND kicks off the Rachio fetch 1200ms later.

### Irrigation module (`const RACHIO`)
Separate config object with `CONTROLLER_NAME`, `ZONE_MAP`, and helper methods:
- `orchardDevices(data)` — filters to Forest House Gardens controller only
- `orchardZones(data)` — filters to ZONE_MAP-named zones only
- `fetchAll(force)` — two-step Rachio fetch, 2-minute cache
- `call(endpoint, params)` — proxied fetch via Netlify function

### Screens
Six screens, shown/hidden via `showScreen(name, triggerEl)`:
1. `dashboard` — metric cards, weather, activity feed, tasks widget, health snapshot, irrigation widget
2. `map` — 4×6 orchard grid (24 positions), species icons, health dots, tree detail panel
3. `tasks` — seasonal task list with filter tabs, progress ring, key dates
4. `log` — 3-step observation form: tree picker (map-style grid), obs type, guided fields
5. `registry` — sortable tree table with Modify button (edit modal)
6. `irrigation` — controller health bar, zone cards, schedule table, run history

### Visual design system
- **Fonts**: Playfair Display (headings/display) + Jost weight 300/400/500 (body)
- **Species icons on map**: 🍎 Apple, 🍐 Pear, 🍑 Peach, 🍒 Cherry, 🟣 Plum — background color by species (sage/khaki/peach/rose/lavender), health shown as a small dot (top-right), NOT as the card background color
- `speciesInfo(species)` → `{ icon, cls, label }` — drives map, log picker, and snapshot grid
- `healthDotClass(health)` → CSS class for the status dot

---

## Family Users (hardcoded in `DB.users`)
```javascript
{ id:'stacey', name:'Stacey', initials:'S',  color:'#639922' }
{ id:'kevin',  name:'Kevin',  initials:'K',  color:'#BA7517' }
{ id:'sara',   name:'Sara',   initials:'Sa', color:'#1D9E75' }
{ id:'sophia', name:'Sophia', initials:'So', color:'#7F77DD' }
```
Edit/Delete observation is restricted to the user who logged it (`o.loggedBy === state.currentUser.id`).

---

## Known Remaining Items / Phase 2 Features

### Weather
`buildWeather()` uses hardcoded mock data (7 days). Replace with a real API call to Open-Meteo (free, no key required): `https://api.open-meteo.com/v1/forecast?latitude=47.98&longitude=-122.20&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=7`

### Dashboard alert bar
Currently hardcoded static text. Should be dynamically generated based on: urgent tasks in Firestore, current date vs. NW Washington phenological calendar, and weather forecast (rain → fire blight risk).

### Phase 2 features not yet built (per original scope)
- AI-assisted diagnosis (symptom checker with Claude API)
- Educational content library / pruning guides
- Photo attachments on observations (Firebase Storage)
- Yield tracking / harvest log
- Spray log with PHI tracking
- Kids' mode / simplified interface
- Push notifications / email digest reminders
- Open-Meteo weather API integration (replace mock)
- Annual orchard report (auto-generated PDF)

### Mobile nav
Currently shows: Home, Map, Tasks, Log, Water. The Trees/Registry screen is only accessible via the desktop sidebar. Consider adding Registry to mobile nav or making it accessible via the Map screen's detail panel.

---

## Deployment Checklist

To deploy a new version:
1. Edit `index.html` (and `netlify/functions/rachio.js` if needed)
2. Build the zip from **inside** the deploy folder: `cd netlify-deploy && zip -r ../deploy.zip . --exclude "*.DS_Store"`
3. Verify zip contents have no wrapper folder — paths must start with `index.html`, `netlify/`, `netlify.toml`
4. Drag zip to app.netlify.com/drop
5. After deploy, confirm Netlify env var `RACHIO_API_KEY` is set (it persists across deploys on the same site)
6. If Netlify secrets scanner blocks the build, `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` in `netlify.toml` should handle it

---

## Key Bugs Fixed in This Session (don't re-introduce)

1. **`firebase-ready` race condition** — the Firebase module script fires before the main script parses. Fixed by deferring the event dispatch via `DOMContentLoaded + setTimeout(0)`.
2. **Duplicate `showScreen` function** — defining it twice causes JS hoisting to silently replace the real implementation with the wrapper, breaking all navigation. Never declare `showScreen` twice; put all logic in the single declaration.
3. **Rachio two-step fetch** — `GET /person/info` returns only `{id}`, not devices. Must call `GET /person/{id}` second to get devices and zones.
4. **Netlify zip wrapper folder** — zipping from the parent directory creates `netlify-deploy/index.html` paths; must zip from inside the folder.
5. **Tasks seeding guard** — `getTasks()` must validate docs have a `title` field before using them, to ignore corrupt/partial Firestore documents from earlier test writes.
6. **`toggleTask` double-fetch** — was calling `getTasks()` again on each checkbox click; now uses `DB.tasks` cache directly.
