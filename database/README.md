# Dorara — Database Layer (MongoDB + Mongoose)

Production-ready data layer for **Dorara**, the AI-powered global life-decision
platform. This package contains **only the database layer** — connection,
Mongoose models, indexes, validators, and seed data. There are no routes,
controllers, or frontend code here, so it can be dropped straight into an
Express.js backend.

The schema is derived directly from the completed **Travel** module frontend
(landing, auth, dashboard, questionnaire, and results pages) plus the
authentication specification. It is intentionally **modular**: future verticals
(Education, Healthcare, Jobs, Business) reuse the same auth core and only add a
new `Questionnaire` document and, if needed, new module collections.

---

## Folder structure

```
database/
├── index.js                     # Public entry point (connectDB + models)
├── README.md
├── config/
│   ├── env.js                   # Centralized env config (URI, bcrypt, TTLs, lockout)
│   └── db.js                    # Cached Mongoose connection manager
├── models/
│   ├── index.js                 # Model registry / barrel export
│   ├── plugins/
│   │   └── baseSchema.js        # timestamps + isActive + soft-delete + toJSON
│   ├── user.model.js
│   ├── userProfile.model.js
│   ├── session.model.js
│   ├── refreshToken.model.js
│   ├── emailVerificationToken.model.js
│   ├── passwordResetToken.model.js
│   ├── questionnaire.model.js
│   ├── destination.model.js
│   ├── travelRequirement.model.js
│   ├── destinationRecommendation.model.js
│   ├── savedTrip.model.js
│   └── searchHistory.model.js
├── seed/
│   ├── index.js                 # Idempotent seed runner (supports --fresh)
│   └── data/
│       ├── users.seed.js
│       ├── destinations.seed.js
│       └── questionnaire.seed.js
└── docs/
    ├── ER_DIAGRAM.md            # Mermaid ER + flow diagrams
    └── sample-data.json         # Example document for every collection
```

---

## Getting started

1. **Set the connection string** (defaults to a local MongoDB):

   ```bash
   export MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>/dorara"
   export DB_NAME="dorara"
   ```

2. **Seed the database** (safe to re-run; `--fresh` wipes seeded collections):

   ```bash
   node database/seed          # upsert seed data
   node database/seed --fresh  # reset then seed
   ```

3. **Use it from Express:**

   ```js
   const { connectDB, models } = require('./database')

   await connectDB()

   const user = await models.User.findOne({ email }).select('+password')
   const ok = await user.comparePassword(plainPassword)
   ```

Demo credentials created by the seed: `demo@dorara.ai` / `dorara123`
(admin: `admin@dorara.ai` / `admin12345`).

### Environment variables

| Variable                       | Default                          | Purpose                                   |
| ------------------------------ | -------------------------------- | ----------------------------------------- |
| `MONGODB_URI`                  | `mongodb://127.0.0.1:27017/dorara` | Connection string                        |
| `DB_NAME`                      | `dorara`                         | Logical database name                     |
| `BCRYPT_SALT_ROUNDS`           | `12`                             | Password hashing work factor              |
| `MAX_LOGIN_ATTEMPTS`           | `5`                              | Failed logins before lockout              |
| `ACCOUNT_LOCK_MINUTES`         | `15`                             | Lock duration                             |
| `REFRESH_TOKEN_TTL_DAYS`       | `30`                             | Refresh token lifetime (TTL index)        |
| `SESSION_TTL_DAYS`             | `30`                             | Session lifetime (TTL index)              |
| `EMAIL_VERIFICATION_TTL_HOURS` | `24`                             | Email verification token lifetime         |
| `PASSWORD_RESET_TTL_MINUTES`   | `60`                             | Password reset token lifetime             |

---

## Shared conventions (every collection)

Applied via `models/plugins/baseSchema.js`:

- **`createdAt` / `updatedAt`** — automatic Mongoose timestamps.
- **`isActive`** — enable/disable flag.
- **`isDeleted` / `deletedAt`** — soft delete. Records are never hard-deleted;
  `doc.softDelete()` / `doc.restore()` toggle them, and normal queries hide
  deleted docs automatically (opt back in with `.setOptions({ withDeleted: true })`
  or `Model.find().onlyDeleted()`).
- **Query helper `.notDeleted()`** for explicit filtering.
- **`toJSON` / `toObject` transform** — exposes `id` instead of `_id` and drops
  `__v`, so API responses are clean.

---

## Collections

### Authentication core

| Collection                    | Purpose |
| ----------------------------- | ------- |
| **users**                     | Identity + bcrypt-hashed credentials. Holds verification flags, `role` (RBAC), `status`, login analytics (`lastLogin`, `loginCount`), and brute-force fields (`failedLoginAttempts`, `accountLockedUntil`). `password` is `select:false`. Methods: `comparePassword`, `registerFailedLogin`, `registerSuccessfulLogin`. |
| **user_profiles**             | 1:1 extension of a user — `bio`, `nationality`, structured `travelPreferences`, `budgetPreference`, `favouriteDestinations` (refs), `notificationPreferences`, `privacySettings`, and UI `theme`. Keeps the hot auth collection lean. |
| **sessions**                  | One per device/browser. Powers **Remember Me**, **Logout**, and **Logout all devices**. TTL index on `expiresAt`. |
| **refresh_tokens**            | JWT refresh with **rotation** + reuse detection. Stores only the SHA-256 `tokenHash`; tracks a `family` lineage and `replacedByTokenHash`. TTL index. |
| **email_verification_tokens** | Single-use, hashed, short-lived tokens for **Email Verification** / resend. TTL index. |
| **password_reset_tokens**     | Single-use, hashed tokens for **Forgot / Reset Password**. TTL index. |

### Travel module

| Collection                     | Purpose |
| ------------------------------ | ------- |
| **questionnaires**             | Data-driven definition of the multi-step consult form (`vertical`, `version`, `steps`). This is the modularity hinge — new verticals are new documents, no code changes. Mirrors the frontend `Questionnaire` type exactly. |
| **destinations**               | The catalog the engine ranks over — `slug`, `name`, `country`, `tags`, `weather`, `avgTempC`, `safetyIndex`, `costFactor`, embedded `visa` info. Transcribed from the frontend seed. |
| **travel_requirements**        | A submitted questionnaire (the normalized `Answers`). Pivot of the decision chain. Stores both the raw `answers` map and extracted/queryable fields (`budget`, `dates`, `party`, `interestType`, `safetyImportance`, …). |
| **destination_recommendations**| The engine output for a requirement — a 1:1 mirror of the frontend `Recommendation` object: ranked `recommendedDestinations`, `costEstimate`, `visaSummary`, `prosCons`, `alternatives`, `actionPlan`, `dataSources`, `confidenceScore`. |
| **saved_trips**                | Bookmarks from the results page / dashboard "saved places". References the destination + source recommendation and keeps a render-safe `snapshot`. |
| **search_history**            | Activity log powering the dashboard "Recent activity" and profile "Search History". |

The core relationship chain is:

```
User → Travel Requirement → Destination Recommendation → (Saved Trip / Search History)
             ↑ Questionnaire defines it        ↑ Destination catalog ranked into it
```

See [`docs/ER_DIAGRAM.md`](./docs/ER_DIAGRAM.md) for full Mermaid diagrams and
[`docs/sample-data.json`](./docs/sample-data.json) for example documents.

---

## Indexes

Designed for fast search, filtering, sorting, pagination, and aggregation.

- **users** — unique `email`, sparse-unique `username`; compound `role+status`;
  `createdAt` (desc); **text index** on `firstName/lastName/email/username`.
- **user_profiles** — unique `user`; `nationality`.
- **sessions** — unique `sessionToken`; **TTL** on `expiresAt`; `user+revokedAt`.
- **refresh_tokens** — unique `tokenHash`; `family`; **TTL** on `expiresAt`;
  `user+revokedAt`.
- **email_verification_tokens / password_reset_tokens** — unique `tokenHash`;
  **TTL** on `expiresAt`.
- **questionnaires** — unique `vertical+version`; `isPublished`.
- **destinations** — unique `slug`; `tags`, `weather`, `safetyIndex` (desc),
  `costFactor`, `popularity` (desc); **text index** on `name/country/city/reason`.
- **travel_requirements** — `user+createdAt` (desc); `vertical+status`.
- **destination_recommendations** — `user+createdAt` (desc); `confidenceScore` (desc).
- **saved_trips** — partial-unique `user+destination` (no duplicate saves);
  `user+createdAt` (desc).
- **search_history** — `user+createdAt` (desc); `vertical+createdAt` (desc).

> In production set `autoIndex: false` (already wired to `NODE_ENV`) and build
> indexes during a deploy/migration step rather than at runtime.

---

## Security

- **Passwords are never stored in plain text** — bcrypt hashing runs in a
  `pre('save')` hook; the field is `select:false`.
- **Tokens are stored hashed** (SHA-256) — refresh, email-verification, and
  password-reset collections keep only hashes, so a DB leak can't be replayed.
- **Refresh token rotation** with `family` lineage enables reuse detection.
- **Account lockout** after configurable failed attempts.
- **Schema validation** (required fields, enums, regex, min/max) protects
  integrity; `strictQuery` is enabled.
- **Soft deletes** preserve auditability.

---

## Extending to new modules

To add e.g. an **Education** vertical:

1. Insert a new `Questionnaire` document with `vertical: "education"`.
2. Reuse `TravelRequirement`'s pattern by adding an analogous
   `EducationRequirement` + `SchoolRecommendation` model (or generalize the
   requirement/recommendation models with a `vertical` discriminator).
3. The entire auth core (`users`, `sessions`, tokens, profiles) is reused as-is.
