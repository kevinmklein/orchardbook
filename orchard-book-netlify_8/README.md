# The Orchard Book — Netlify Deployment

## Files in this folder
```
index.html                      ← The full app
netlify.toml                    ← Netlify build config
netlify/functions/rachio.js     ← Rachio read-only API proxy
```

## Deploy steps

### 1. Deploy to Netlify
Drag this entire folder to https://app.netlify.com/drop
(Or connect a GitHub repo via Netlify's dashboard)

### 2. Set the Rachio API key as an environment variable
In the Netlify dashboard for your site:
  Site configuration → Environment variables → Add variable

  Key:   RACHIO_API_KEY
  Value: your-rachio-api-key-here

IMPORTANT: Never put your API key in index.html.
The key lives only in Netlify's encrypted environment variables.
The proxy function reads it server-side — it never reaches the browser.

### 3. Trigger a redeploy
After setting the env var, go to Deploys → Trigger deploy → Deploy site.
The function will now authenticate correctly.

### 4. Set Firebase environment
Your Firebase config is already embedded in index.html (it's a client-side
config, not a secret — Firebase security is handled by Firestore rules).

## Rachio zone mapping
Open index.html and find the RACHIO.ZONE_MAP object (~line 1900).
Edit the keys to match your exact Rachio zone names:

  ZONE_MAP: {
    'Front Yard':  'Orchard rows 1–2 (trees 1–8)',
    'Back Orchard': 'Orchard rows 3–6 (trees 9–24)',
    ...
  }

Zone names must match exactly what appears in the Rachio app.

## Rate limits
Rachio allows 1,700 API calls/day. The proxy fetches all data in
2–3 calls per load (person/info + schedulerule/device per controller).
The dashboard auto-fetches once on load, then caches for 2 minutes.
Manual refresh via the ↻ button on the Irrigation screen.
