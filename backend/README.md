# Dorara Backend

Production-ready Express.js + MongoDB REST API for the Dorara travel recommendation platform.

## Quick Start

### Prerequisites
- Node.js 18+ (LTS)
- MongoDB 5.0+ (local or cloud)
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp ../.env.example .env
```

Key variables:
- `MONGODB_URI` — MongoDB connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — JWT signing keys (generate with `openssl rand -base64 32`)
- `SMTP_*` — Email settings (optional for dev)
- `CLOUDINARY_*` — Image hosting (optional; local uploads work fine in dev)

### Run

**Development** (with auto-reload):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

The API will be available at `http://localhost:5000/api/v1` by default.

---

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Health Check
```
GET /health
```

### API Documentation
- **Swagger UI**: http://localhost:5000/docs
- **OpenAPI JSON**: http://localhost:5000/docs.json

---

## Module Structure

### Authentication (`/auth`)
- `POST /auth/register` — Create account + send verification email
- `POST /auth/login` — Sign in + set httpOnly cookies
- `POST /auth/refresh` — Rotate refresh token
- `POST /auth/logout` — Revoke current session
- `POST /auth/logout-all` — Revoke all sessions
- `POST /auth/verify-email` — Verify email address
- `POST /auth/forgot-password` — Request password reset
- `POST /auth/reset-password` — Reset password with token
- `POST /auth/change-password` — Change password (authenticated)
- `GET /auth/sessions` — List active sessions
- `DELETE /auth/sessions/:id` — Revoke specific session

### User Profile (`/users`)
- `GET /users/me` — Fetch profile
- `PATCH /users/me` — Update profile (name, bio, location, etc.)
- `POST /users/me/avatar` — Upload avatar
- `DELETE /users/me/avatar` — Remove avatar
- `GET /users/me/preferences` — Fetch preferences
- `PATCH /users/me/preferences` — Update preferences
- `DELETE /users/me` — Delete account (requires password)

### Travel Module (`/travel`)

#### Travel Requirements (Questionnaire Submissions)
- `POST /travel/requirements` — Submit questionnaire
- `GET /travel/requirements` — List requirements
- `GET /travel/requirements/:id` — Fetch requirement
- `PATCH /travel/requirements/:id` — Update requirement
- `DELETE /travel/requirements/:id` — Delete requirement

#### Recommendations (AI-Powered)
- `GET /travel/recommendations/:requirementId` — Get recommendations for a requirement

#### Destination Search
- `GET /travel/destinations` — Search destinations with filters
  - Query params: `query`, `tags[]`, `weather[]`, `safetyMin`, `costMax`, `page`, `limit`
- `GET /travel/destinations/:slug` — Fetch single destination

#### Saved Trips (Bookmarks)
- `POST /travel/saved-trips` — Bookmark a destination
- `GET /travel/saved-trips` — List bookmarked trips
- `DELETE /travel/saved-trips/:id` — Remove bookmark

#### Search History
- `GET /travel/search-history` — List activity log
- `DELETE /travel/search-history` — Clear history

---

## Authentication

### Cookie-Based (Recommended for Web)
Access and refresh tokens are set as `httpOnly` cookies automatically on login:
```javascript
// Cookies are sent automatically with credentials: true
fetch('http://localhost:5000/api/v1/users/me', {
  credentials: 'include',
})
```

### Bearer Token (for Mobile / Headless)
Include the access token in the Authorization header:
```javascript
fetch('http://localhost:5000/api/v1/users/me', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
```

### Refresh Flow
When the access token expires (15m default), refresh it:
```javascript
POST /api/v1/auth/refresh
// Returns new accessToken (+ sets new cookies if using cookies)
```

---

## Error Handling

All errors return a consistent JSON envelope:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "data": {}
}
```

### Common Status Codes
- `200` — Success
- `201` — Created
- `400` — Bad request (validation failed)
- `401` — Unauthorized (no/invalid token)
- `403` — Forbidden (insufficient permissions)
- `404` — Not found
- `409` — Conflict (e.g. email already exists)
- `429` — Rate limited
- `500` — Server error

---

## Rate Limiting

- **Global**: 300 requests/15min per IP
- **Auth endpoints** (login, register, forgot-password): 20 requests/15min
- Configurable via `RATE_LIMIT_*` env vars

---

## File Uploads

### Avatar Upload
```bash
curl -X POST http://localhost:5000/api/v1/users/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@avatar.jpg"
```

**Storage**:
- If `CLOUDINARY_URL` is set → uploaded to Cloudinary (cloud)
- Otherwise → stored locally in `/uploads` directory

**Max file size**: 8MB (configurable via `MAX_UPLOAD_MB`)

---

## Email Setup (Optional)

To enable email (verification, password reset, welcome):

1. Set SMTP credentials in `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=Dorara <noreply@dorara.ai>
   ```

2. Emails are sent automatically on:
   - User registration (verification)
   - Forgot password (reset link)
   - Account changes (optional notifications)

---

## AI Recommendation Engine

Generates destination recommendations based on user answers.

### Configuration
Set `AI_PROVIDER` to choose the ranking strategy:
- `local` (default) — Local heuristic scoring (no API calls)
- `openai` — Uses GPT-4 + OpenAI API
- `gemini` — Uses Google Gemini + Google API
- `anthropic` — Uses Claude + Anthropic API

### How It Works
1. User submits questionnaire answers
2. Backend ranks all destinations against answers
3. Scores are based on:
   - Interest tag matching
   - Weather preference alignment
   - Safety importance vs destination safety index
   - Budget alignment
4. Top 3 destinations are selected
5. Costs, visa requirements, and action plans are aggregated
6. Recommendations are stored in MongoDB

---

## Database Schema

See `../database/README.md` for complete schema documentation.

**Key models**:
- **User** — Identity + auth credentials
- **UserProfile** — Extended profile (bio, preferences, avatar)
- **Session** — Active device/browser sessions
- **TravelRequirement** — Submitted questionnaire answers
- **DestinationRecommendation** — Generated recommendations
- **SavedTrip** — Bookmarked destinations
- **SearchHistory** — Activity log
- **Destination** — Catalog of destinations

---

## Testing

### Run Tests
```bash
npm test
```

### Postman Collection
- Download: `/docs/postman-collection.json`
- Import into Postman and test all endpoints

### Manual Testing
- Use curl, Postman, Insomnia, or any HTTP client
- Or visit `http://localhost:5000/docs` for interactive Swagger UI

---

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel Settings
3. Deploy automatically on push

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t dorara-backend .
docker run -p 5000:5000 --env-file .env dorara-backend
```

### Traditional VPS (Ubuntu)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repo-url>
cd dorara/backend
npm install
npm start
```

Use `systemd` or `pm2` for process management:
```bash
npm install -g pm2
pm2 start server.js --name "dorara-api"
pm2 save
pm2 startup
```

---

## Performance Tips

1. **Caching**: Search results + destinations are cached (10min default)
2. **Pagination**: Always use `page` + `limit` for large result sets
3. **Indexes**: MongoDB indexes are auto-created on startup (disable in prod with `autoIndex: false`)
4. **Compression**: gzip is enabled automatically
5. **Rate Limiting**: Prevents abuse; tune via env vars

---

## Monitoring & Logs

Logs are written to:
- **Console**: Real-time in development
- **File**: `logs/` directory in production (`LOG_DIR` env var)
- **Log Level**: Controlled by `LOG_LEVEL` env var (debug/info/warn/error)

---

## Support & Issues

For issues or questions:
1. Check API docs at `/docs`
2. Review database schema: `../database/README.md`
3. Check error logs: `logs/` directory
4. Open an issue on GitHub

## Trip Planner API

`/api/v1/trip-planner` — see `DEPLOYMENT.md` for setup and `tests/` for behaviour. Responses use the standard
`{ success, data, meta }` envelope and errors `{ success: false, error: { code, message } }`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /generate` | optional (stricter limit for guests) | `{ input: { destination, answers } }` → `TripPlan`; auto-saved when signed in |
| `POST /adjust` | optional | `{ input, adjustments: { budget?, durationDays? }, planId? }` → recalculated `TripPlan` |
| `GET /airports?q=` | public | departure-city autocomplete (bundled airport list) |
| `GET /plans`, `GET /plans/:id` | login | saved plans (owner only; 404 otherwise) |
| `PATCH /plans/:id`, `DELETE /plans/:id` | login | rename/favorite; soft delete |

Each section (itinerary, flights, stays) fails independently: the plan is still returned with
`meta.sectionStatus` and `meta.warnings`. Items are `dataSource: "live"` only when a provider response contained a
real price; everything else is `"demo"`.

## Third-party data and terms

The Trip Planner can use two optional external data sources. Read this before any
monetization or public launch — this project currently runs them on free plans as a
portfolio/demo.

- **SerpApi (flights + stays, optional).** Live flight and hotel results come from SerpApi's Google
  Flights / Google Hotels engines. The Free plan allows 250 searches/month (50/hour); the app
  stops live calls at 80% of `SERPAPI_MONTHLY_LIMIT` and serves labelled demo data afterwards.
  Per SerpApi's terms at the time of writing, its U.S. Legal Shield does **not** cover the Free,
  Starter and Developer plans, and the terms prohibit reselling or exploiting the Service. Review
  the current terms and your plan before commercial use.
- **Vercel Hobby.** Vercel's Hobby plan is intended for personal, non-commercial use. Move to a paid
  plan before monetizing.
- **Render free tier.** Free web services sleep after a period of inactivity and take time to wake.
  The exact idle timeout and wake-up time were **not verified** here — check Render's current pricing
  and docs. The frontend pre-warms the API and shows a "waking up the server" message.
- **Open-Meteo / Frankfurter / Pexels.** Weather and exchange rates use free, key-less public APIs;
  Pexels (optional, hero images only) requires attribution. Check each service's terms for your use.
- **AI Gateway models.** Which models are free-tier eligible changes over time — confirm in your AI
  Gateway dashboard before relying on one.

Live prices come only from provider responses and are labelled `live`; everything else is labelled
`demo` or "estimate". Nothing in the app is a booking or a guaranteed price.

---

## License

MIT. See root `LICENSE` file.
