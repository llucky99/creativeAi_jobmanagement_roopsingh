# Service & Job Management API

Backend for a Service & Job Management System: users register/login (JWT), Admins create and assign jobs, Workers add used parts, upload images and complete jobs, and Admins generate invoices (parts + service + cleaning + 10% GST).

**Stack:** Node.js 18+, Express 4, MySQL 8, JWT, Joi, Multer, bcryptjs.

---

## 1. Quick start

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env          # then edit DB_PASSWORD, JWT_SECRET, ...

# 3. create database + tables  (uses database/schema.sql)
npm run db:init
#   or manually:  mysql -u root -p < database/schema.sql

# 4. create the first Admin
npm run seed:admin            # uses ADMIN_EMAIL / ADMIN_PASSWORD from .env

# 5. run
npm run dev                   # nodemon   |   npm start for plain node
```

API runs on `http://localhost:3000` - health check: `GET /health`.

### Run with Docker (API + MySQL)
```bash
docker compose up --build
docker compose exec api node scripts/seedAdmin.js     # create the admin
```
MySQL is exposed on host port `3307`; schema is loaded automatically from `database/schema.sql`.

### Scripts
| Command | Purpose |
|---|---|
| `npm run dev` / `npm start` | Run API (watch mode / normal) |
| `npm run db:init` | Create DB + tables from `database/schema.sql` |
| `npm run seed:admin` | Create or reset the admin user |
| `npm test` | Unit tests (invoice maths, status transitions) - no DB needed |
| `npm run test:e2e` | 12-step end-to-end API test (needs MySQL + seeded admin) |
| `npm run postman` | Regenerate the Postman collection |

---

## 2. Environment variables (`.env.example`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `BASE_URL` | Public URL used for image URLs (empty = auto-detect) | - |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL connection | `localhost` `3306` `root` - `service_job_management` |
| `JWT_SECRET` | **Required.** Secret for signing tokens | - |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` |
| `ADMIN_REGISTRATION_KEY` | Needed in `adminKey` to register with role `Admin` (empty = disabled) | - |
| `ADMIN_NAME` `ADMIN_EMAIL` `ADMIN_PASSWORD` | Used by `seed:admin` | `admin@example.com` / `Admin@12345` |
| `UPLOAD_DIR` | Folder for uploaded files | `uploads` |
| `MAX_FILE_SIZE_MB` | Max size per image | `5` |
| `GST_PERCENT` | GST on invoice subtotal | `10` |

---

## 3. API overview

All responses use one format:
```json
{ "success": true,  "message": "Job created successfully", "data": {} }
{ "success": false, "message": "Validation failed", "errors": [{ "field": "email", "message": "email must be a valid email" }] }
```
List endpoints add `"pagination": { page, limit, total, totalPages, hasNextPage, hasPrevPage }`.
Protected routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register (`role`: Worker default; Admin needs `adminKey`) |
| POST | `/auth/login` | Public | Login, returns token |
| GET | `/auth/me` | Any | Logged-in profile |
| GET | `/users/workers` | Admin | List active workers (for assignment) |
| POST | `/jobs` | Admin | Create job (optional `assignedWorkerId`) |
| GET | `/jobs` | Admin / Worker | List (Worker sees only own). `page, limit, status, priority, search, sortOrder=asc\|desc` |
| GET | `/jobs/completed` | Admin | Completed jobs (`hasInvoice` flag, `invoiced=true\|false` filter) |
| GET | `/jobs/:jobId` | Admin / assigned Worker | Details incl. parts, images (URLs), invoice summary |
| PUT | `/jobs/:jobId` | Admin | Update job fields |
| DELETE | `/jobs/:jobId` | Admin | Delete job (blocked if invoiced) |
| POST | `/jobs/:jobId/assign` | Admin | Assign / reassign `{ "workerId": 2 }` |
| PATCH | `/jobs/:jobId/status` | assigned Worker (Admin: cancel only) | `{ "status": "In Progress" }` |
| GET | `/jobs/:jobId/parts` | Admin / assigned Worker | List parts + `partsTotal` |
| POST | `/jobs/:jobId/parts` | assigned Worker | `{ partName, unitPrice, quantity }` -> `totalPrice` auto |
| PUT | `/jobs/:jobId/parts/:partId` | assigned Worker | Update part |
| DELETE | `/jobs/:jobId/parts/:partId` | assigned Worker | Remove part |
| POST | `/jobs/:jobId/images` | Admin / assigned Worker | multipart, field **`images`**, multiple files |
| GET | `/jobs/:jobId/images` | Admin / assigned Worker | List images |
| DELETE | `/jobs/:jobId/images/:imageId` | Admin / assigned Worker | Delete one image |
| POST | `/invoices` | Admin | `{ jobId, serviceCost, cleaningCost }` |
| GET | `/invoices`, `/invoices/:invoiceId` | Admin | List / details |

### Invoice example
`POST /invoices` with `{ "jobId": 1, "serviceCost": 2000, "cleaningCost": 500 }` and parts Brake Pad 500 x 2:

| Charge | Amount |
|---|---|
| Parts Total | 1000 |
| Service Cost | 2000 |
| Cleaning Cost | 500 |
| Subtotal | 3500 |
| GST (10%) | 350 |
| **Final Total** | **3850** |

The response contains `charges`, a `breakdown` list, the `parts` used, and `finalPayableAmount`. All money maths runs in integer paise (no floating-point drift).

### Postman
Import `postman/Service-Job-Management.postman_collection.json`. Run the folders in order (1 -> 7); tokens and IDs are stored in collection variables automatically. For the image request pick files in *Body > form-data*. Login Admin uses `admin@example.com / Admin@12345` (run `npm run seed:admin` first).

---

## 4. Business rules (and where they live)

| Rule | Implementation |
|---|---|
| Only Admin creates / updates / deletes jobs, assigns workers | `authorize(ADMIN)` in `routes/job.routes.js` |
| Worker sees only assigned jobs | `listJobs` filters by `assigned_worker_id`; `getJob` returns 403 otherwise |
| Only the assigned Worker updates status | `updateJobStatus` ownership check (Admin may only **cancel**) |
| Valid status flow | `Pending -> Assigned -> In Progress -> Completed`, `Cancelled` from any open state (`constants/index.js`) |
| Completed can't go back to Pending | explicit 400 + transition table (Completed / Cancelled are final) |
| Cancelled jobs can't be assigned | `assignJob` -> 400 |
| Assign moves `Pending -> Assigned` | automatic; reassign keeps current status |
| Worker adds/edits parts only on own job, only while job is Assigned / In Progress | `ensureWorkerOwnsOpenJob` |
| Max 5 images per job, type + size validated | Multer limits + magic-byte check + row-locked count inside a transaction |
| Invoice only for Completed jobs, once per job | status check + `UNIQUE(job_id)` + row lock (race-safe) |
| GST fixed at 10% | `GST_PERCENT` env (default 10) |

HTTP codes: `200/201` success, `400` validation / invalid state / invalid ID, `401` unauthenticated or bad login, `403` forbidden, `404` not found, `409` conflict (duplicate email, duplicate invoice), `500` unexpected.

---

## 5. Project structure

```
src/
  config/        env.js, db.js (pool + transactions)
  constants/     roles, statuses, transition table
  controllers/   auth, user, job, part, image, invoice
  middleware/    auth (JWT + roles), validate (Joi), validateId, upload (Multer), errorHandler, notFound
  models/        user, job, part, image, invoice  (all SQL lives here, parameterised)
  routes/        auth, user, job, invoice
  utils/         ApiError, asyncHandler, response, money, invoiceCalculator, helpers
  validations/   Joi schemas
  app.js / server.js
database/schema.sql          5 tables with FKs, indexes, CHECK constraints
scripts/                     initDb, seedAdmin, generatePostman
tests/                       unit tests + e2e/api.e2e.js
postman/                     Postman collection
.github/workflows/ci.yml     CI/CD pipeline
Dockerfile, docker-compose.yml
```

### Database relationships
`users 1-N jobs` (as creator and as assigned worker) · `jobs 1-N job_parts` · `jobs 1-N job_images` · `jobs 1-1 invoices` (UNIQUE `job_id`). Parts and images cascade when a job is deleted; jobs with an invoice cannot be deleted (`RESTRICT`).

### Security notes
bcrypt password hashing, JWT auth with DB lookup on every request (deactivated users are cut off), Helmet, CORS, rate limiting on auth routes, parameterised SQL only, LIKE wildcards escaped in search, uploaded files renamed to random names and verified by content, not just extension.

---

## 6. CI/CD pipeline

Defined in `.github/workflows/ci.yml` (GitHub Actions). Triggers: push to `main`, tags `v*`, and pull requests to `main`.

1. **`test` job** (matrix: Node 18 and 20) - spins up a **MySQL 8 service container**, then: `npm ci` -> syntax check of every JS file -> unit tests (`npm test`) -> creates the schema from `database/schema.sql` (`npm run db:init`) -> seeds an admin -> runs the **end-to-end API tests** (`npm run test:e2e`: auth, roles, job flow, parts, images, status rules, invoices, pagination) -> `npm audit` (informational).
2. **`docker` job** (needs `test`) - builds the Docker image with Buildx and layer caching. On pushes to `main` / tags it also **pushes to GitHub Container Registry** (`ghcr.io/<owner>/<repo>`, tagged by branch, semver and commit SHA). On pull requests it only builds (no push).
3. **`deploy` job** (needs `docker`, `main` only) - connects to your server over SSH and runs `docker compose pull api && docker compose up -d api`. It is **skipped automatically** unless the repository secret `DEPLOY_HOST` exists. Secrets used: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`.

Notes for production deployment: on the server use a compose file whose `api` service uses `image: ghcr.io/<owner>/<repo>:main` instead of `build: .`, keep real secrets in a server-side `.env` (never in git), and put MySQL data on a persistent volume. A failing test blocks the image build and the deploy, so only tested code ships.

---

## 7. Assumptions

* Admin self-registration is protected by `ADMIN_REGISTRATION_KEY` so nobody can make themselves Admin; the recommended way is `npm run seed:admin`.
* Status updates belong to the assigned Worker as required; the only Admin exception is **cancelling** a job (otherwise nobody could cancel an unassigned job).
* Completed / Cancelled jobs are read-only (no edit, no parts changes). Image upload/delete remains allowed for Admin and the assigned Worker.
* Invoice amounts are a snapshot at generation time; they do not change if parts are edited later (parts are locked after completion anyway).
