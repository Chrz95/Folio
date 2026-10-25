# Folio setup and operations

[← Back to Folio](../README.md)

## Two deliberately separate builds

The full application uses React, TypeScript, Express and file-backed SQLite. All application data goes through the
HTTP API. It never falls back to another database when the server is unavailable.

The published Sites preview uses an explicitly enabled, separate browser-local demonstration adapter because Sites
cannot run a persistent Node/Express process or a local SQLite file. Its banner explains the storage boundary. It
starts with fictional sample records. Changes persist only in the same browser. Settings can export the workspace,
restore samples, or clear financial entries and reset opening balances. Do not use the preview for shared budgeting.
The preview is not the deployment of the Express/SQLite backend.

## Start the full stack

Use Node **24.19.0** and **pnpm 11.25.0**. The single root package manifest owns both applications. The lockfile pins
all dependencies. Native SQLite compilation may need Python 3, make and a C++ compiler when no prebuilt binary exists.

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:check
pnpm dev
```

Open `http://localhost:5173`. Add an account in Settings, then create a transaction. Optional fictional development
records are available through `pnpm db:seed`; these use October 2026 dates. Seeding is idempotent and refuses production.
The server refuses missing or unmigrated storage. Run migrations explicitly before starting it.

`pnpm dev` runs Vite and the backend together using concurrently; closing either process terminates its peer.
`pnpm dev:frontend` runs Vite alone, with `/api` proxied to the backend. `pnpm dev:backend` runs Node's watch mode with
the tsx import hook. Using the import hook avoids the tsx CLI's IPC socket requirement in restricted environments.

## Product behavior

- **Overview:** current total balance, selected-month income, expenses, net savings, cumulative cash flow, spending
  categories, recent postings, upcoming payments and budget progress. All figures derive from ledger data.
- **Transactions:** create, edit and delete actual postings; search names, notes and categories; filter type and
  account; switch reporting month; export the current filtered ledger to spreadsheet-safe CSV.
- **Transfers:** debit the source and credit the destination by the same integer amount. Transfers never count as
  income or spending. Equal source/destination accounts are rejected by validation and database constraints.
- **Calendar:** actual entries and planned occurrences share one month view. Select a date to see its agenda, add an
  entry, or mark a planned payment paid. Unconfirmed dates are orange, overdue dates red and recorded postings green.
  Planned payments do not change balances.
- **Schedules:** one-time, weekly, monthly and yearly rules. A newly entered future one-time payment becomes a planned
  rule with a two-day reminder; edit its schedule to change the lead time. Existing recorded entries cannot be moved
  into the future through the editor; create a planned payment instead. The recurring list also contains one-time plans.
- **Month-end rules:** January 31 becomes February's last day, then March 31. February 29 yearly rules clamp in
  non-leap years. Rules retain their original anchor and do not drift after a short month.
- **Posting:** marking an occurrence paid is idempotent for the same rule/date. Database uniqueness protects against
  duplicate submissions. Deleting a schedule preserves actual postings and removes their link to the deleted rule.
- **Budgets:** exact-month allocation overrides, optional positive rollover and manual savings goals. Original caps
  remain the baseline for unconfigured months. Spending plans and goal progress never reserve account balances.
- **Reports:** monthly/yearly/custom periods, account/category filters, previous-period comparisons and CSV exports.
- **Settings:** accounts, reminders, light/dark/system appearance, installation and workspace export. JSON export is
  a portable data copy with reviewed financial import in both deployment modes. Restore SQLite for complete server recovery.

The schedule expander caps each series at 5,000 occurrences to keep scans bounded. The API paginates postings in
batches of at most 500; the UI loads all batches to calculate account balances and reports. This is a personal-volume
application, not an analytics warehouse. Very large ledgers need server-side aggregates before scaling further.

## Reminders

Reminder lead times are 0, 1, 2, 3 or 7 days. In-app reminders list unpaid items within seven days. Calendar export
creates explicit occurrences for the next twelve months with display alarms, preserving clamped month-end dates.
Import the `.ics` file into a calendar that supports alarms. Re-export after changing a schedule; imported calendars
are independent copies, and calendar applications decide whether to honor alarms.

The self-hosted backend supports Web Push while the page is closed and initializes signing keys automatically.
Serve the PWA over trusted HTTPS, then choose **Enable this device** under Settings → Browser & phone notifications.
Permission is requested only after that button action. This browser's subscription is stored
in SQLite; **Disconnect this device** removes it and unsubscribes. Browser support varies; iOS requires installation for
Web Push. No subscription is created automatically.

The backend must remain running. A bounded scan runs each minute, with the workspace’s selected local timezone and delivery-time boundary. Successful delivery
acknowledgments and bounded retry states persist in SQLite; expired subscriptions are removed. Notification text intentionally omits payees and
amounts. Delivery is best effort and at least once across a crash between sending and acknowledging; a repeated tag
allows browsers to replace a duplicate. It is not a financial deadline guarantee. Provider URLs are allowlisted to
prevent arbitrary outbound subscription targets. Outbound HTTPS access to the browser push provider is required.

The browser preview offers notifications only while open. The UI explains this before enabling them and offers
calendar export as an alternative. Real push delivery was not exercised in the build environment.

## Architecture and responsibilities

```text
frontend/
  src/app/                 Workspace state, routing, public build configuration, error boundary
  src/components/          Shared layout and focused UI primitives
  src/features/            Budget, calendar, overview, transaction, reminder and settings behavior
  src/pages/               Lazy route composition
  src/lib/                 Central HTTP boundary and explicit preview storage adapter
  src/pwa/                 Install, connection and update lifecycle
  src/sw.ts                Custom Workbox worker and push display
  public/                  Original app icon and generated install assets
  nginx/                   Static SPA server and same-origin API proxy
backend/
  src/app/                 Injectable Express application, configuration and middleware
  src/features/budget/     Routes -> controllers -> services -> Drizzle repository
  src/features/reminders/  Subscriptions, persisted delivery ledger and bounded poller
  src/db/                  Connection lifecycle, schema, migrations, seed, check and online backup
  src/lib/                 Structured logging and safe application errors
scripts/                   Build, icon generation, artifact verification and exclusive Docker releases
```

There is exactly one root `package.json`; neither application has its own manifest. `pnpm-workspace.yaml` contains only
pnpm 11's dependency build permissions, with no package globs or workspace packages. It is a configuration file for the
single project. pnpm 11 no longer reads build permissions from the manifest, which required this small adjustment.

The frontend never imports backend runtime code. Contract DTOs are declared in the frontend and validated with Zod at
the API boundary. Controllers parse inputs and translate results into HTTP responses. Services own posting rules.
Repositories own queries and short synchronous transactions. State consists of local form/filter state and one shared
workspace snapshot. Successful mutations reload the snapshot; failures preserve the form and show actionable feedback.

Routes load lazily. React and router runtime code are separate chunks. SVG charts are derived from actual data and
include textual totals. There is no remote font, chart service, image service or telemetry dependency.

### Backend startup and errors

`createApp` is independently importable and never binds a port. `server.ts` loads validated environment settings,
opens an existing database, verifies the required tables, composes Express and then listens. Security headers precede
request IDs, structured request logging, the bounded JSON parser, CORS, versioned routes, not-found and error middleware.

Every API response is `Cache-Control: no-store`. Successful resources use `{ data }`; collections also expose
`meta: { total, limit, offset }`. Validation errors use `{ error: { code, message, details, requestId } }`. Unexpected
errors return a generic safe message; SQLite lock/constraint conflicts become `409 STORAGE_CONFLICT`. Request logs
omit request bodies, query strings and headers; the logger also redacts credential-shaped fields.

SIGTERM/SIGINT stop the reminder timer, stop accepting connections, drain HTTP traffic, close SQLite and set a process
outcome. A ten-second deadline bounds shutdown; Compose allows twenty seconds. Uncaught failures use structured fatal
logging and the same shutdown path. The server runs one instance with one long-lived database connection.

### API contract

All money fields are integer cents. IDs are UUIDs. Dates are validated `YYYY-MM-DD` calendar dates; audit timestamps
are Unix milliseconds. Transaction bodies include `name`, `amount`, `type`, `category`, `accountId`, nullable
`destinationAccountId`, `date` and `notes`. Rule bodies add `frequency` and `reminderDays`.
Planning months are first-of-month dates between 1900 and 9999. Allocations allow zero; contributions require nonzero
signed integers. Goal progress is bounded to 0–100,000,000,000 cents, independently of its target amount.
`GET /planning` is unpaginated metadata for personal-volume use, as are the other small catalog collections.

| Method and path under `/api/v1`                      | Behavior                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /health`                                        | Database-independent liveness                                                                     |
| `GET /ready`                                         | Checks required tables; 503 if storage is unavailable                                             |
| `GET /transactions?limit=200&offset=0`               | Deterministic date/ID order, bounded pagination                                                   |
| `POST /transactions`                                 | Create an actual posting                                                                          |
| `POST /transactions/bulk/preview`                    | Read-only review of `{ ids, action, category? }`; 1–100 unique IDs                                |
| `POST /transactions/bulk/commit`                     | `{ selection, revision }`; atomically apply the unchanged review                                  |
| `PUT, DELETE /transactions/:id`                      | Replace or delete an actual posting                                                               |
| `GET, POST /accounts`                                | List accounts or create one with an opening balance                                               |
| `GET, POST /recurring`                               | List or create one-time/repeating plans                                                           |
| `PUT, DELETE /recurring/:id`                         | Update or remove a schedule                                                                       |
| `POST /recurring/:id/pay`                            | Body `{ date }`; validate and idempotently post occurrence                                        |
| `GET, PUT /budgets`                                  | List limits or upsert `{ category, amount }`                                                      |
| `POST /planning/budget-copy/preview`                 | Review `{ fromMonth, toMonth, mode }` without writes                                              |
| `POST /planning/budget-copy/commit`                  | Add the returned `revision`; atomically apply a current review                                    |
| `GET, POST /transactions/:transactionId/attachments` | List metadata or upload `{ id, name, mimeType, size, content }`                                   |
| `GET, DELETE /attachments/:id`                       | Download encoded bytes or remove an unlocked attachment                                           |
| `POST /imports/actual/preview`                       | Read-only native conversion review; `{ file, currencyConfirmed: true }`                           |
| `POST /imports/actual/commit`                        | Same normalized file and consent plus reviewed SHA-256 `revision`; atomic additions               |
| `POST /workspace/import/preview`                     | Validate a complete JSON financial workspace; review replacement counts without writes            |
| `POST /workspace/import/commit`                      | `{ data, revision, confirmation: "REPLACE" }`; atomic financial replacement with paused schedules |
| `POST /workspace/delete/preview`                     | Read-only counts and revision for all financial/notification data                                 |
| `POST /workspace/delete/commit`                      | `{ revision, confirmation: "DELETE", acknowledged: true }`; atomic complete user-data deletion    |
| `GET /workspace/export`                              | Read one consistent financial snapshot including receipt bytes                                    |
| `GET /schedules`                                     | Read pause/end-date settings and skipped occurrences                                              |
| `PUT /schedules/settings`                            | Save `{ recurringId, isPaused, endDate }`                                                         |
| `PUT /schedules/occurrences`                         | Save `{ recurringId, date, isSkipped }` for a valid date                                          |
| `GET /planning`                                      | Monthly overrides, custom categories, goals and contributions                                     |
| `PUT /planning/monthly-budgets`                      | Upsert `{ month, category, amount, rollover }` for one month                                      |
| `POST /planning/categories`                          | Create an immutable custom name                                                                   |
| `PUT /planning/categories/:id`                       | Body `{ isArchived }`; archive or restore a custom category                                       |
| `POST /planning/goals`                               | Create `{ name, targetAmount, targetDate, isArchived }`                                           |
| `PUT /planning/goals/:id`                            | Edit or archive a goal without losing progress                                                    |
| `POST /planning/goals/:id/contributions`             | `{ id, amount, date, notes }`; signed cents, idempotent UUID                                      |
| `POST /imports/preview`, `/imports/commit`           | Review or atomically commit a capped statement batch                                              |
| `GET /reconciliation`                                | Read clearing flags, statement history and import identities                                      |
| `PUT /reconciliation/clearance`                      | Clear or unclear one account leg                                                                  |
| `POST /reconciliation`                               | Verify an exact statement balance and protect its entries                                         |
| `DELETE /reconciliation/:id`                         | Undo only the account's latest completed statement                                                |
| `GET /notifications/state`                           | Preferences, snoozes and safe provider delivery history                                           |
| `PUT /notifications/preferences`                     | Validate/save timezone, local time, cadence and overdue window                                    |
| `POST /notifications/snooze`                         | Snooze a valid unpaid occurrence for 60 or 1440 minutes                                           |
| `POST /notifications/subscriptions/status`           | Check whether this device endpoint is registered; returns no keys                                 |
| `POST /notifications/test`                           | Test only the registered current device; persistent 30-second cooldown                            |
| `GET /notifications/config`                          | Public VAPID key, capability state and registered-device count                                    |
| `POST, DELETE /notifications/subscriptions`          | Explicit browser subscription opt-in/out                                                          |

The client uses a public typed base URL, cancellation, bounded request timeouts, no-store fetches and normalized
network errors. It does not cache server financial data in browser storage. A network error never selects demo mode.

## Configuration

Copy `.env.example`. Backend variables are parsed only in `backend/src/app/config/environment.ts`. Database CLIs
reuse the database parser without requiring HTTP settings. Paths resolve against the current repository root; run
commands there. Production requires an absolute local SQLite path. Empty paths, URLs and `:memory:` are rejected.

| Variable                                                 | Purpose/default                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`                                               | development/test/production; seed forbidden in production              |
| `PORT`, `HOST`                                           | API 3001, bound to 127.0.0.1 during host development                   |
| `CORS_ALLOWED_ORIGINS`                                   | Comma-separated exact browser origins; development localhost:5173      |
| `LOG_LEVEL`, `API_PREFIX`                                | Structured log severity; versioned `/api/v1`                           |
| `DATABASE_FILE_PATH`                                     | `./data/app.sqlite`; container `/app/data/app.sqlite`                  |
| `DATABASE_BUSY_TIMEOUT_IN_MILLISECONDS`                  | 5000; integer bounded from 0 to 30000                                  |
| `TEST_DATABASE_DIRECTORY`                                | `./.test-data`; isolated disposable test-owned subdirectories          |
| `VITE_API_BASE_URL`                                      | Public build-time API prefix; relative `/api/v1` in Docker             |
| `VITE_DEMO_MODE`                                         | false for full stack; true only for explicitly labelled preview builds |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional overrides; signing keys initialize automatically              |
| `FRONTEND_PORT`, `PUBLIC_ORIGIN`                         | Container frontend 8080 and matching CORS origin                       |

The application is single-user and intended for a trusted local machine or an authenticated private network. It has
no built-in login. Compose publishes only to loopback. Before allowing remote visitors, protect the frontend and API
with a real authentication proxy/VPN and TLS. CORS is not authentication. Do not expose the API directly to the internet.
No financial data is encrypted by SQLite itself; use platform disk encryption and least-privilege storage access.

## SQLite operations

Drizzle ORM 0.45.4 uses better-sqlite3 13.0.3. The installed driver reported SQLite **3.53.4**. Each connection enables
foreign keys, WAL, `synchronous=FULL` and a bounded busy timeout. The migrator may create a directory with mode 0700;
files receive mode 0600. Ordinary startup requires an existing writable file and verifies application schema.

Use `pnpm db:generate` after a schema change. Review SQL and metadata, test a populated upgrade, and commit both. The
initial migration includes checks, foreign keys, unique occurrence constraints and the date/ID index. Migrations are
forward only and never run from server startup. Do not blindly accept generated table rebuilds that disable constraints;
review dependency behavior and verify foreign-key integrity before releasing a migration.

SQLite has one writer. Keep transactions short and synchronous; never await network requests inside them. Lock
conflicts return a safe retryable response; non-idempotent writes are not retried automatically. Monitor disk space,
WAL size, lock conflicts and request latency. Long reads can defer checkpoints. Default SQLite autocheckpoint behavior
is retained; use maintenance windows for explicit checkpoints if monitoring shows a need. Keep WAL/SHM sidecars in the
same writable local directory. Do not use a network filesystem or multiple replicas with independent database files.

### Backup and restore

```bash
pnpm db:backup /absolute/separate/path/folio-backup.sqlite
```

The command uses SQLite's online backup API, producing a consistent database while the application may be running.
Never copy only the live main file and ignore its WAL. Keep backups outside the serving tree, encrypted where needed;
apply an operator-defined daily retention policy and test restoration regularly. The integration suite restores an
online backup into a separate file and verifies the ledger.

For release/restore: stop the sole backend, create a consistent backup, restore into a separate path and verify it,
run reviewed migrations exclusively, then start the backend and check readiness. Replace the production data only
while all connections are closed. Preserve a known-good rollback backup; schema rollback is a restore operation.

## Docker workflow

Requires BuildKit, Docker Engine and Compose **2.20+**. Docker was unavailable in the build environment, so the supplied
container configuration has not been executed. See [VALIDATION.md](../VALIDATION.md) for every unverified check.

```bash
pnpm docker:config
pnpm docker:build
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

The `app` profile defines `migrate`, `backend`, and `frontend`; no database server exists. A plain Compose invocation
without the profile starts none of these services. `sqlite-data` persists across normal shutdown. Never add volume
removal to the normal stop script. Existing bind mounts must be provisioned for UID/GID 1000 with a writable directory.

The one Dockerfile contains `base`, `dependencies`, `production-dependencies`, `backend-build`, `frontend-build`,
`backend`, `migrate`, and `frontend` stages. Dependencies are installed from the root lockfile with Corepack-provided
pnpm, build cache mounts and explicit allowlisted native builds. Debian slim keeps native build/runtime libc compatible.
Toolchains stay in build stages. Runtime dependencies contain only what compiled Express needs; React, Vite, router,
icons, testing and PWA tooling are dev dependencies because frontend assets are bundled before deployment.

The backend/migrator use `node:24.19.0-bookworm-slim`; nginx uses
`nginxinc/nginx-unprivileged:1.28.2-alpine`. Tags are exact. Release builds must override `NODE_IMAGE`/`NGINX_IMAGE` with
verified digest-pinned references; digests could not be resolved/verified here. Backend and migrator use numeric UID/GID
1000; nginx uses 101. Images run non-root with read-only roots, dropped capabilities, no new privileges and temporary
writable directories. No real data, secrets, local environment or host node_modules enter the build context.

`pnpm docker:up` stops the backend, runs a fresh one-shot migrator, then recreates/waits for backend health and starts
nginx. `pnpm docker:migrate` refuses while the backend is running. Compose declarations also express migration-success
and backend-health ordering for ordinary profile use. `--wait` is used only for long-running services; the one-shot job
has already completed. Updating this single-instance deployment causes downtime. Do not deploy two writers in a
rolling update. `pnpm docker:down` preserves the named volume.

nginx serves the static frontend, proxies `/api/v1/` to the private backend, forwards host/protocol/request identifiers,
uses bounded proxy timeouts, gzip and hashed-asset caching. HTML, manifest and service worker use no-cache; APIs use
no-store. Navigation-only fallback excludes extension paths. The CSP permits only local scripts/assets, local workers
and the manifest; dynamic CSS colors require inline style permission. TLS terminates at an upstream proxy.

Build each release once, label/tag with the source commit and version, then promote identical images. Inject runtime
configuration through the deployment environment. Use a single local persistent disk; retain liveness/readiness,
graceful termination and exclusive stop/migrate/start ordering in any orchestrator. CI should scan images with Docker
Scout or Trivy and fail on high-severity findings. No scanner is installed as an application dependency.

Troubleshooting: change `FRONTEND_PORT` and `PUBLIC_ORIGIN` together on a port conflict. Inspect backend logs/readiness
for an unhealthy container. Check volume UID, free disk space and WAL directory access before changing permissions.
Never make the directory world-writable. For native-driver failures, rebuild for the target Node ABI/architecture and
libc rather than copying host modules. An old volume may need a reviewed migration; deleting it is destructive.

## Progressive Web App

Vite PWA uses Workbox **injectManifest** because push display and explicit API exclusion require custom worker logic.
A single source SVG generates 192/512 PNGs, a dedicated maskable icon, the Apple touch icon and ICO. Generate with
`pnpm pwa:icons`. Manifest identity and lifecycle constants are centralized in `pwa.constants.ts`; the HTML metadata
matches those values. Rich-install screenshots are omitted because real browser screenshots were unavailable.

The service worker precaches only the app shell and static assets, cleans outdated precaches, denies API/file paths
from SPA navigation fallback and uses NetworkOnly for APIs. Runtime image caching is limited to same-origin icons,
with bounded entries/age and a no-store/private/Vary rejection policy. Non-GET requests and financial API responses
are never cached. Full-stack offline writes are disabled; the shell shows a connection notice and the API client
reports an actionable network error. No queued financial writes exist.

Financial data is not persisted offline in the full-stack browser. The preview deliberately stores its entire sample
workspace, bank import fingerprints, clearing flags and statement history under one namespaced localStorage key.
Reminder preferences, snoozes and a local delivery ledger use a separate namespaced key. Appearance, install-dismissal time and reminder opt-in use separate
keys; a persistent preview delivery ledger prevents duplicate notifications across reloads. Settings offers a visible clear-preview-data action.
The application has no logout because it has no built-in authentication, and Cache Storage never contains budget data.

Registration waits until window load and is disabled in development. Updates are prompt-style: the user saves the
open form, then chooses Update now. A waiting worker receives SKIP_WAITING and reloads through Workbox's lifecycle.
A first-cache confirmation announces offline readiness. Installation uses a captured browser event only after an
explicit action; dismissal expires after seven days. Installed mode hides the install control; iOS gets dismissible
Add to Home Screen instructions. Unsupported APIs degrade to in-app messages and calendar export.

Rollback an app-shell regression by deploying a known-good build. If a bad worker prevents recovery, publish a minimal
worker at the same `/sw.js` scope that clears only Folio caches and unregisters itself, and serve it with no-cache.
Restore the normal worker after affected clients recover. Never force-reload an active financial form without notice.

Layout starts at 320px, with 600/1000/1280px enhancements and safe-area-aware bottom navigation. Reduced motion, system
color scheme, manual themes, contrast preferences, keyboard focus and labelled native fields are supported. Visual
checks at 360/768/1280px, install/offline/update checks and Lighthouse on Docker remain unverified.
Performance budgets: LCP <=2.5s, TBT <=200ms, CLS <=0.1 and initial JavaScript <=200 KiB gzip. Bundle sizes are emitted
by the actual production build; runtime performance numbers require a real browser audit and are not claimed here.

## Commands and checks

| Command                                                              | Purpose                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install`                                                       | Install the entire pinned dependency graph                                  |
| `pnpm dev`, `dev:frontend`, `dev:backend`                            | Host development, together or separately                                    |
| `pnpm db:generate`, `db:migrate`, `db:seed`, `db:check`, `db:backup` | Explicit database lifecycle                                                 |
| `pnpm build`                                                         | Compile frontend and backend; copy static assets to root dist for packaging |
| `pnpm build:frontend`, `build:backend`                               | Independent application artifacts                                           |
| `pnpm build:demo`                                                    | Explicit browser-local preview; never used by Docker                        |
| `pnpm start`                                                         | Only compiled backend; no migrations and no static Node server              |
| `pnpm preview`                                                       | Inspect the static frontend build; no API server is started                 |
| `pnpm pwa:icons`, `verify:build`                                     | Generate install icons; check real manifest/build artifacts                 |
| `pnpm lint`                                                          | Oxlint with warnings treated as failures                                    |
| `pnpm typecheck`                                                     | Strict frontend, backend and separate WebWorker type checking               |
| `pnpm test`, `test:run`                                              | Watch tests or deterministic one-shot suite                                 |
| `pnpm format`, `format:check`                                        | Prettier write or verification                                              |
| `pnpm docker:*`                                                      | Container configuration, build, migration, lifecycle and logs               |

Database integration tests create unique files below the dedicated test directory, apply committed migrations and
close connections before cleaning only owned directories. They refuse the application database path and path escapes.
Tests cover constraints, CRUD, envelopes, validation, CORS, readiness failure, rollback, lock contention, recurrence,
reopen persistence and online-backup restoration. UI tests exercise financial calculations, form writes, future
one-time plans, invalid transfers, failed saves, connectivity and install behavior. Real Web Push requires external
providers and is not used in deterministic tests.

### Dependency purposes

Runtime: Express routes HTTP; Zod validates input; Helmet hardens headers; CORS enforces an origin allowlist; pino and
pino-http provide redacted structured logs; dotenv loads the central configuration; Drizzle provides typed queries;
better-sqlite3 owns the native persistent connection; web-push signs and delivers opt-in notifications.

Build/UI: React and React DOM render components; React Router handles lazy pages; lucide-react supplies local SVG
icons; TypeScript checks contracts; Vite and its React plugin compile assets; tsx runs typed CLI/host code;
concurrently manages the two development processes. Drizzle Kit generates schema changes. Oxlint and Prettier enforce
quality. Vite PWA, Workbox modules and the asset generator support offline/install/update/push behavior; sharp provides
native image support used by asset generation. Vitest, Testing Library, jsdom and Supertest exercise app behavior.
Type declaration packages describe those libraries. No secondary database, authentication provider or queue is added.

## Contribution conventions

Keep components under 100 total lines including imports, types and documentation. Split rendering responsibilities
or extract a hook when approaching the limit. Props and multiline JSX attributes go one per line; never spread JSX
props. Prettier uses 120 columns. Keep meaningful numeric values in named constants; fixed string domains use unions
or const objects, while routes, storage keys, intervals and shared labels have dedicated constant catalogs.

Use strict types without any. Prefer descriptive verbs for functions, descriptive data names, PascalCase components,
camelCase helpers and unit-bearing constant names. Document functions and individual component props with typed
JSDoc. Trivial inline callbacks do not require separate blocks. Keep errors actionable and never swallow failed writes.
Local visual state belongs in a component; cross-page data belongs in the workspace; persistence belongs behind the
API client. Extract shared primitives only when multiple callers actually benefit.

```ts
/** Format the original anchor without timezone drift.
 * @param {string} calendarDate - Local ISO date.
 * @returns {string} Display label. */
```

The supplied Oxlint rules remain at their requested severities where supported. Enabled plugins are TypeScript,
React, import and accessibility. The permitted JSX extension fix uses `.tsx`. no-magic-numbers is enabled, with scoped
constant/config/test overrides. Five requested rules are unavailable in installed Oxlint; their exact names and manual
alternatives are listed in [VALIDATION.md](../VALIDATION.md). No console override is needed because the application uses pino.

### Add a feature

1. Define the HTTP contract, fixed value domains and validation schemas.
2. Add/review a Drizzle migration if storage changes. Test a fresh file and any populated upgrade path.
3. Add repository queries, service rules, thin controllers and routes inside the backend feature.
4. Add frontend DTOs/service calls, a focused hook and components. Compose them in a lazy page.
5. Test observable behavior, invalid input, failure states, keyboard operation and mobile layout.
6. Update README/API docs and run lint, formatting, types, tests, build and relevant container checks.

### Add a component

1. Start beside the owning feature, with a narrow typed props interface.
2. Document each prop and return value. Use semantic controls and visible focus states.
3. Extract logic into a hook if it competes with the rendering responsibility or the 100-line limit.
4. Reuse it within the feature first; move it to shared components only for a real second responsibility.
5. Test interactions and error handling where meaningful, then inspect at phone/tablet/desktop widths.

Use small, focused Git commits and review migrations explicitly. A pull request must explain the user-visible trigger,
resulting behavior, validation and remaining limitations. Before review, check functionality, meaningful tests, zero
lint warnings, strict types, formatting/line length, component size, JSDoc, naming/constants, no secrets, accessible
forms, responsive layouts, error/loading/empty states, docs and applicable Docker/PWA behavior.

## Verification boundary

Read [VALIDATION.md](../VALIDATION.md) for executed commands and exact gaps. This is a functional self-hosted personal-budget codebase
plus an isolated hosted preview. It has not been certified for public multi-user production hosting, browser-level
accessibility, real-device installation, background push delivery or container runtime behavior.

## Raspberry Pi images and registry deployment

`compose.registry.yaml` uses your `192.168.1.11:5000` registry, ARM64 images, host ports **8081** (frontend) and **5001**
(backend), with internal ports 8080/3001 unchanged. It uses a real nginx config file from `frontend/nginx/nginx.conf`,
no inline Compose configs, anchors or profiles. Keep that file beside the deployment in the supplied directory layout.
Use the same Compose project name (`-p`/`COMPOSE_PROJECT_NAME`) as your existing installation to retain its SQLite volume;
changing directory/project names creates a different default volume. Host ports stay bound to loopback for the existing
SSH tunnel or reverse proxy. The registry port 5000 is independent of the backend port.

From the source root, using your previously configured Buildx builder:

```bash
for target in frontend backend migrate; do
  docker buildx build --platform linux/arm64 --target "$target" \
    --build-arg VERSION=1.15.1 \
    -t "192.168.1.11:5000/folio-${target}:1.15.1" \
    -t "192.168.1.11:5000/folio-${target}:latest" --push .
done
```

On the Pi, normal backend startup creates persistent notification signing keys automatically. No separate key
container, manual VAPID values or `push.env` is needed. Existing explicit keys remain supported.

For an existing installation, stop the old writer and take a consistent SQLite backup before upgrading. Do not remove
volumes. Run the new registry Compose from the source directory, using the same project identity as before:

```bash
# If the old deployment uses docker-compose.custom.yaml:
docker compose -f docker-compose.custom.yaml down

# Set this to the real reachable HTTPS origin after configuring your reverse proxy.
export PUBLIC_ORIGIN=https://your-folio-host.example

docker compose -f compose.registry.yaml pull
docker compose -f compose.registry.yaml up -d
docker compose -f compose.registry.yaml ps
```

If you already use an environment file containing explicit keys, keep its `--env-file` option during the upgrade.
The default deployment needs no such file.
`FOLIO_REGISTRY`, `IMAGE_TAG`, `FRONTEND_PORT`, `BACKEND_PORT` and `PUBLIC_ORIGIN` can be overridden in the deployment
environment. For a plain-HTTP image registry, configure the Pi Docker daemon's insecure registries separately from
BuildKit. Docker builds, ARM64 execution and real-device push delivery are not claimed verified in this environment.

