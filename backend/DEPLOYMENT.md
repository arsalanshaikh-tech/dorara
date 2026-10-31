# Deploying Dorara (Vercel + Render + MongoDB Atlas, all free tiers)

The app works with **only the required variables**. Every optional key switches one section from labelled
demo data to live data.

## 1. MongoDB Atlas (M0)
1. Create a free **M0** cluster, a database user (read/write on database `dorara`), and copy the
   `mongodb+srv://` connection string. Put the database name in the path:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/dorara?retryWrites=true&w=majority`
2. **Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).** Render's free tier has no
   fixed outbound IP, so an allow-list of specific addresses is not possible there. Protect the database with a
   strong user password instead.
3. Put the string in Render as `MONGODB_URI`. In production the server refuses to start without it.

## 2. Render (API)
Use `render.yaml` (Blueprint) or create a Web Service manually:
`Root directory: backend` · `Build: npm install` · `Start: npm start` · `Health check path: /health`.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV=production` | yes | production behaviour (fail-fast config, secure cookies) |
| `MONGODB_URI` | yes | Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | long random strings (`openssl rand -hex 48`), different from each other |
| `CLIENT_URL` | yes | your Vercel URL, e.g. `https://dorara.vercel.app` |
| `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true` | yes (with the Vercel proxy) | first-party cookies |
| `CORS_ORIGINS` | no | extra allowed origins (comma-separated) for direct API access |
| `AI_GATEWAY_API_KEY`, `AI_MODEL` | no | AI itineraries (otherwise a template itinerary is used) |
| `SERPAPI_API_KEY` | no | live flights + stays (otherwise labelled demo data) |
| `SERPAPI_MONTHLY_LIMIT`, `SERPAPI_DAILY_LIMIT`, `SERPAPI_HOURLY_LIMIT`, `SERPAPI_QUOTA_STOP_RATIO` | no | quota guard (defaults 250 / 8 / 40 / 0.8) |
| `LIVE_SEARCH_GUEST_DAILY`, `LIVE_SEARCH_USER_DAILY` | no | live searches per caller per day (defaults 3 / 10) |
| `PEXELS_API_KEY` | no | destination hero images with attribution |
| `SMTP_*`, `EMAIL_FROM` | no | emails (sign-in does not require a verified email) |

**Free-tier sleep.** Render's free web services spin down when idle and take a while to wake. The idle timeout
and wake-up time were *not verified* for this project — check Render's current pricing page. The frontend
pre-warms the API on the results page and shows "Waking up the server…" while a request is slow. To keep the
service warm you can point a free uptime pinger (for example UptimeRobot or cron-job.org) at
`https://<your-api>.onrender.com/health` every ~10–14 minutes; check Render's current free-hours allowance first,
because an always-on service uses the monthly free instance hours.

## 3. Vercel (frontend)
| Variable | Required | Purpose |
|---|---|---|
| `BACKEND_URL` | yes | `https://<your-api>.onrender.com` (server-side only; used by the `/api/v1/*` rewrite) |
| `NEXT_PUBLIC_USE_MOCKS` | no | **leave unset in production** (development-only demo plan) |

`NEXT_PUBLIC_*` values are compiled in at build time: **redeploy after changing them.** Vercel rewrites to an
external URL time out after 120 s, which is why AI/provider calls are capped around 25–30 s.

## 4. Post-deploy checklist (in order)
1. `GET https://<api>/health` → `status: "ok"`, `db: "connected"`, `providers` shows only what you configured.
2. `GET https://<site>/api/health` → the same JSON (proves the Vercel rewrite works).
3. Open the site, sign up, sign in, refresh the page: still signed in. DevTools → Application → Cookies: the
   session cookies belong to **your Vercel domain**, `HttpOnly`, `Secure`, `SameSite=Lax`.
4. Questionnaire: the **Departure city** step appears and suggests airports.
5. Results → **Plan My Trip**: a plan renders. With no keys, every stay/flight shows **Demo Data** and the notice
   lists why. With `SERPAPI_API_KEY` and exact future dates + a matched departure airport, items show
   **Live search result**.
6. Signed in: the plan says "Saved to your account"; **My trips** lists it; open, rename, favorite, delete work.
7. What if? changes budget → status updates; changes duration → days and totals update.
8. Render logs show request IDs and **no** keys; `GET https://<api>/api/v1/trip-planner/plans` without cookies → 401.
9. Direct call from another origin → 403 (not 500).

## 5. Run locally
```
# backend
cd backend && cp .env.example .env   # fill MONGODB_URI (local or Atlas) + JWT secrets
npm install && npm run dev            # http://localhost:5000
# frontend (new terminal, repo root)
cp .env.example .env.local            # set BACKEND_URL=http://localhost:5000
pnpm install && pnpm dev
```
Tests: `cd backend && npm test` (unit) · `npm run test:integration` (boots the app on an in-memory MongoDB).
Airports: `node scripts/build-airports.js` replaces the shipped 118-airport seed with the full OurAirports list.
