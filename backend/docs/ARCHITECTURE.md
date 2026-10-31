# Dorara Backend Architecture

Complete technical documentation for the production-ready Dorara backend.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
│              (React components, Zustand store)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + Cookies
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Express.js Backend API                     │
│  (Node.js, Express, MongoDB, JWT auth, rate limiting)       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │            Middleware Stack                        │    │
│  │  ├─ Helmet (security headers)                      │    │
│  │  ├─ CORS (credentialed)                            │    │
│  │  ├─ Body parser + Cookies                          │    │
│  │  ├─ Mongo sanitization (NoSQL injection)           │    │
│  │  ├─ Rate limiting (global + per-endpoint)          │    │
│  │  ├─ Morgan (request logging)                       │    │
│  │  ├─ JWT authentication                            │    │
│  │  └─ Error handler (centralized)                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Route Modules                          │  │
│  │                                                    │  │
│  │  • /api/v1/auth       (credential flow + sessions)│  │
│  │  • /api/v1/users      (profile & preferences)     │  │
│  │  • /api/v1/travel     (questionnaire + engine)    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Service Layer (Business Logic)              │  │
│  │                                                    │  │
│  │  • auth.service       (login, register, JWT)       │  │
│  │  • token.service      (session + token rotation)   │  │
│  │  • user.service       (profile updates)            │  │
│  │  • travel.service     (questionnaire handling)     │  │
│  │  • recommendation.service (AI engine + scoring)    │  │
│  │  • storage.service    (cloud/local file uploads)   │  │
│  │  • email.service      (SMTP + templates)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└──────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐        ┌──────────┐      ┌──────────┐
    │ MongoDB │        │ Cloudinary│     │ SMTP     │
    │ Database│        │ (optional) │    │ (email)  │
    └────────┘        └──────────┘      └──────────┘
```

---

## Folder Structure

```
backend/
├── app.js                          # Express app factory (no port)
├── server.js                       # Entry point + server startup
├── package.json                    # Dependencies
├── .env.example                    # Config template
│
├── config/
│   ├── env.js                      # Centralized env vars
│   └── database.js                 # MongoDB connection bridge
│
├── constants/
│   └── index.js                    # App constants (error codes, etc.)
│
├── controllers/                    # HTTP request handlers
│   ├── auth.controller.js
│   ├── user.controller.js
│   └── travel.controller.js
│
├── routes/                         # Express route definitions
│   ├── index.js                    # Route aggregator
│   ├── auth.routes.js
│   ├── user.routes.js
│   └── travel.routes.js
│
├── middlewares/                    # Express middleware
│   ├── auth.middleware.js          # JWT + session extraction
│   ├── error.middleware.js         # Centralized error handler
│   ├── rateLimit.middleware.js     # Rate limiting
│   ├── validate.middleware.js      # Request validation runner
│   └── upload.middleware.js        # Multer file upload
│
├── services/                       # Business logic
│   ├── auth.service.js
│   ├── token.service.js
│   ├── user.service.js
│   ├── travel.service.js
│   ├── recommendation.service.js   # AI + scoring engine
│   ├── email.service.js
│   ├── storage.service.js
│   └── ai.service.js               # AI provider abstraction
│
├── validators/                     # Request validation rules
│   ├── auth.validator.js
│   ├── user.validator.js
│   └── travel.validator.js
│
├── serializers/                    # Response serialization
│   └── user.serializer.js
│
├── utils/                          # Utility functions
│   ├── ApiError.js                 # Custom error class
│   ├── ApiResponse.js              # Uniform response envelope
│   ├── asyncHandler.js             # Async error wrapper
│   ├── jwt.js                      # JWT utilities
│   ├── cookies.js                  # Cookie helpers
│   ├── logger.js                   # Structured logging
│   ├── cache.js                    # Caching (future)
│   ├── httpClient.js               # External API calls
│   ├── query.js                    # Query building
│   └── request.js                  # Request context extraction
│
├── helpers/
│   └── emailTemplates.js           # Email HTML templates
│
├── docs/
│   ├── swagger.js                  # Swagger/OpenAPI definition
│   ├── postman-collection.json     # Postman API tests
│   └── ARCHITECTURE.md             # This file
│
├── logs/                           # Runtime logs
│   ├── access.log
│   └── error.log
│
├── uploads/                        # Local file storage (dev)
│
├── README.md                       # Getting started
└── tests/                          # Test files (future)
```

---

## Authentication Flow

### Sign Up → Verify Email → Login

```
1. User submits (name, email, password) to POST /auth/register
   ├─ Password hashed (bcrypt 12 rounds)
   ├─ User document created (status: unverified)
   ├─ Verification email sent (link + token)
   └─ Response: { user, emailVerificationSent: true }

2. User receives email with verification link
   → Clicks link → GET /auth/verify-email?token=xxx

3. Backend verifies token
   ├─ Token must not be expired (<24h)
   ├─ Token must match stored hash (SHA-256)
   └─ User status set to "active"

4. User submits (email, password) to POST /auth/login
   ├─ Find user by email (select password from DB)
   ├─ Compare plaintext password vs bcrypt hash
   ├─ Create Session document (device + IP info)
   ├─ Create JWT access token (15m) + refresh token (30d)
   ├─ Set httpOnly cookies (optional for mobile: return tokens in JSON)
   └─ Response: { user, accessToken, ... }
```

### Authenticated Requests

```
1. Client sends request with Authorization header (or cookie)
   GET /api/v1/users/me
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

2. Express middleware (auth.middleware.js) intercepts
   ├─ Extract token from header or cookie
   ├─ Verify JWT signature + expiry
   ├─ Extract payload (userId, sessionId)
   ├─ Attach to req: req.userId, req.sessionId
   └─ Pass to controller

3. Controller receives authenticated request
   const user = await userService.getUser(req.userId)
```

### Refresh Token Rotation

```
1. Access token expires (15m)
2. Client calls POST /auth/refresh (token in cookie or body)
3. Backend validates refresh token
   ├─ Check signature + expiry (30d)
   ├─ Check rotation lineage (detect token reuse attacks)
   ├─ Issue NEW access token + refresh token
   ├─ Set cookies / return in JSON
   └─ Revoke old refresh token
4. Client uses new access token for subsequent requests
```

### Logout

```
POST /auth/logout (authenticated)
├─ Set session.isActive = false
├─ Revoke all refresh tokens for user (if /logout-all)
├─ Clear httpOnly cookies
└─ Response: { message: "Signed out" }
```

---

## Travel Module Data Flow

### User submits questionnaire → Recommendations generated

```
1. Frontend sends answers to POST /api/v1/travel/requirements
   {
     "vertical": "travel",
     "answers": {
       "interest_type": ["Nature & outdoors", "Adventure"],
       "budget": { "min": 1000, "max": 5000, "currency": "USD" },
       "dates": { "start": "2024-06-01", "end": "2024-06-15", "durationDays": 14 },
       "party": "Solo",
       "weather": ["Cool & mild"],
       "safety_importance": 4,
       "visa_requirements": "I have a passport"
     }
   }

2. Travel controller validates answers + creates TravelRequirement doc
   ├─ Store in MongoDB: travelRequirements collection
   ├─ Create SearchHistory entry (activity log)
   └─ Fire async recommendation generation

3. recommendation.service runs in background
   ├─ Load user profile + all Destination docs
   ├─ Score each destination against answers
   │  ├─ Interest tags match: +9 points per match
   │  ├─ Weather preference match: +8 points
   │  ├─ Safety index importance alignment
   │  ├─ Budget compatibility
   │  └─ Total score: 40–99 range
   ├─ Select top 3 destinations
   ├─ Build cost estimate (flights + accommodation + daily)
   ├─ Aggregate visa info for each destination
   ├─ Generate pros/cons narrative
   ├─ Create action plan (5 steps)
   └─ Save DestinationRecommendation doc to MongoDB

4. Client polls GET /api/v1/travel/recommendations/:requirementId
   ├─ If still processing: return partial or 202 Accepted
   ├─ If complete: return full recommendation object
   └─ Frontend renders UI with destinations + costs + action plan

5. User bookmarks destination: POST /api/v1/travel/saved-trips
   ├─ Create SavedTrip doc (user + destination reference)
   ├─ Log to SearchHistory (action: bookmark)
   └─ Return saved trip metadata

6. Dashboard shows recent activity
   GET /api/v1/travel/search-history
   ├─ Returns paginated activity log
   ├─ Populated from SearchHistory collection
   └─ Powers dashboard "Recent activity" section
```

---

## API Response Format

### Success Response (200 / 201)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "user": { ... },
    "accessToken": "..."
  }
}
```

### Error Response (4xx / 5xx)
```json
{
  "success": false,
  "message": "Descriptive error message",
  "code": "VALIDATION_ERROR",
  "data": {
    "field": "email",
    "reason": "Already in use"
  }
}
```

---

## Security

### Password Hashing
- Algorithm: bcrypt
- Salt rounds: 12 (configurable, takes ~100ms per hash)
- Stored: Never in plain text; hashed in pre-save hook

### JWT Tokens
- Access token lifetime: 15 minutes (short-lived, can't do damage if leaked)
- Refresh token lifetime: 30 days (longer-lived; rotated on use)
- Signing key: `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` (environment variables)
- Stored on client: httpOnly cookies (immune to XSS) or memory (XSS vulnerable but works for mobile)

### Refresh Token Rotation
- Each refresh generates a NEW refresh token
- Old token is marked revoked
- Detects token replay attacks (if attacker uses old token, session is terminated)

### Secure Headers
- Helmet: CSP, X-Frame-Options, X-Content-Type-Options, etc.
- CORS: Credentialed requests; origins restricted to whitelist
- HTTPS: Enforced in production (COOKIE_SECURE=true)

### Rate Limiting
- Global: 300 requests/15min per IP
- Auth endpoints: 20 requests/15min per IP
- Account lockout: 5 failed logins → 15min lockout

### Input Validation
- Every field validated via express-validator before use
- Queries sanitized against NoSQL injection
- File uploads checked for type + size

---

## Database Models

See `../../database/README.md` for complete schema details.

**Core models**:
- **User** — Identity + bcrypt password
- **UserProfile** — Extended profile (bio, preferences, avatar)
- **Session** — Device/browser sessions (for multi-device logout)
- **RefreshToken** — JWT refresh tokens (for rotation detection)
- **TravelRequirement** — Submitted questionnaire answers
- **DestinationRecommendation** — Generated recommendations
- **SavedTrip** — Bookmarked destinations
- **SearchHistory** — Activity log
- **Destination** — Catalog of travel destinations

---

## Caching Strategy

- **Destinations**: 10min cache (REST API calls to external data)
- **Exchange rates**: 1hr cache (expensive API)
- **Weather**: 30min cache (frequently changing)
- **User profile**: Not cached (real-time)

Future: Implement Redis for distributed caching.

---

## Error Handling

### Centralized Error Handler
All errors flow through `middlewares/error.middleware.js`:
```javascript
// Thrown anywhere in the app
throw ApiError.badRequest('Invalid email', { code: 'INVALID_EMAIL' })

// Returns JSON with appropriate HTTP status
{
  "success": false,
  "message": "Invalid email",
  "code": "INVALID_EMAIL",
  "data": {}
}
```

### Async Error Wrapper
Controllers wrap async functions to catch promise rejections:
```javascript
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId)
  // Errors are caught automatically; no try-catch needed
})
```

---

## Deployment

### Environment-Specific Config
```javascript
// app.js detects NODE_ENV and applies config
if (env.isProd) {
  // Stricter rate limits
  // HTTPS enforced
  // Secure cookies
  // JSON logging
  // No debug info in responses
}
```

### Vercel (Recommended)
- Serverless Express function
- Automatic scaling
- CDN for static assets
- Environment variables in dashboard

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

### Traditional VPS
- Use systemd or PM2 for process management
- nginx as reverse proxy + load balancer
- MongoDB Atlas or self-hosted instance

---

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
- Use Postman collection (`docs/postman-collection.json`)
- Or test endpoints manually with curl

### Load Testing
```bash
# k6 load test
k6 run loadtest.js
```

---

## Monitoring & Observability

### Structured Logging
```javascript
logger.info('Event occurred', {
  userId,
  action: 'login',
  ip: req.ip,
  timestamp: new Date().toISOString(),
})
```

### Log Files
- `logs/access.log` — All HTTP requests (Morgan format)
- `logs/error.log` — Errors and warnings

### Metrics (Future)
- Request latency / percentiles
- Database query performance
- API endpoint popularity
- Error rates by type

---

## Extending the Backend

### Adding a New Module

1. **Create routes** (`routes/newmodule.routes.js`)
   ```javascript
   const router = require('express').Router()
   router.get('/items', controller.listItems)
   module.exports = router
   ```

2. **Create controller** (`controllers/newmodule.controller.js`)
   ```javascript
   const getItems = asyncHandler(async (req, res) => { ... })
   module.exports = { getItems, ... }
   ```

3. **Create service** (`services/newmodule.service.js`)
   ```javascript
   async function listItems(userId) { ... }
   module.exports = { listItems, ... }
   ```

4. **Create validator** (`validators/newmodule.validator.js`)
   ```javascript
   const rules = [
     body('field').notEmpty(),
     ...
   ]
   module.exports = { rules }
   ```

5. **Wire up** (`routes/index.js`)
   ```javascript
   router.use('/newmodule', require('./newmodule.routes'))
   ```

---

## Performance Optimization

- **Pagination**: Always use `page` + `limit` for large result sets
- **Indexes**: MongoDB indexes auto-created (disable in prod with `autoIndex: false`)
- **Compression**: gzip enabled for all responses
- **Lean queries**: Use `.lean()` for read-only MongoDB queries (faster, lower memory)
- **Select fields**: Only fetch needed fields from database

---

## Common Troubleshooting

### Database Connection Fails
- Check `MONGODB_URI` is valid and accessible
- Verify network access (IP whitelist for MongoDB Atlas)
- Check connection string format: `mongodb+srv://...` (cloud) or `mongodb://...` (local)

### Email Not Sending
- Verify SMTP credentials + port
- Check firewall allows outbound SMTP
- Test with `npm run send-test-email` (future)

### Auth Token Invalid
- Check JWT secret is same across server restarts
- Verify token hasn't expired (check `exp` claim)
- Ensure `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` are set

### Rate Limited
- Check `X-RateLimit-*` headers in response
- Wait before retrying
- Increase limits if needed (but be cautious)

---

## Next Steps

1. **Add Redis caching** for improved performance at scale
2. **Implement GraphQL** as alternative to REST
3. **Add WebSocket** for real-time recommendations
4. **Integrate AI** (OpenAI, Gemini, Anthropic) for smarter ranking
5. **Add payments** (Stripe) for premium features
6. **Multi-language support** (i18n)
7. **Admin dashboard** for managing destinations + users

---

## Resources

- [Express.js Docs](https://expressjs.com/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [JWT.io](https://jwt.io/)
- [Helmet.js](https://helmetjs.github.io/)
- [Express Validator](https://express-validator.github.io/docs/)
- [Swagger / OpenAPI](https://swagger.io/)

---

Generated: 2024
Maintained by: Dorara Team
