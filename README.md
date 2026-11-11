# Church Hub — GitHub Pages + Firebase

A shareable church management site: teams, events, worship plans, small
groups, and volunteering. The pages are static (GitHub Pages); the shared
data lives in Firebase Firestore (free Spark plan), so everyone who opens
the site sees and edits the same lists.

## What's inside

- `index.html` — the whole app (tabs: This Week, People, Teams, Events,
  Worship, Groups, Volunteer)
- `css/styles.css` — styling
- `js/app.js` — Firebase config + all the app logic

## Deploy on GitHub Pages

1. On GitHub, create a new **public** repository (e.g. `church-hub`).
2. Upload all the files from this folder (keep the `css/` and `js/`
   folders as they are).
3. Go to **Settings → Pages → Build and deployment → Source** and choose
   **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. The site goes live at `https://<your-username>.github.io/church-hub/`.

## Firebase setup (already done)

- Project: `church-hub` (ID: `church-hub-5fdf1`), free Spark plan, no billing.
- Firestore database in `northamerica-northeast1` (Montreal).
- The `apiKey` in `js/app.js` is a public client key by design — it only
  identifies the project in the browser and does not grant access to the
  Google account.

## Important: database rules expire Dec 11, 2026

The Firestore rules are currently in **test mode**: anyone with the site
link can read and write everything, and the rules stop working on
**December 11, 2026**. Before that date, set tighter rules in the
Firebase console (Firestore → Rules) — for example, read/write only for
signed-in users, or read-only for visitors. Until then, only share the
site link with people you trust with the data.
