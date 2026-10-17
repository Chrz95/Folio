# Verification and requirement resolutions

Verified on 17 October 2026 with Node 24.19.0 and pnpm 11.25.0. No unexecuted container or browser audit is reported as
passing. The full application and the hosted preview have different deployment/persistence boundaries, as below.

## Version 1.14.1 verification

372 tests in forty-three files pass, including all prior import, ledger, reminder and counted-schedule checks.

New regression tests exercise missing SubtleCrypto in self-hosted and demo deletion, including read-only review,
exact consent, stale preferences, concurrent-tab changes and successful deletion with the server confirmation payload.
Workspace restore and Actual merge reject changed source/destination data and complete using the fallback.
Fallback output matches native SHA-256 for padding/block boundaries, empty input, Unicode and the standard million-a
vector. Native hashing failures still reject rather than approving an operation. A UI test explicitly resumes a paused
rule, verifies the help text and enabled Mark paid, and confirms that no payment is automatically recorded.

No real user data is deleted or resumed. All test ledgers are fictional. No schema/dependency or supplied Dockerfile
changes. Browser visual, Raspberry Pi/Docker and real notification delivery checks remain unexecuted.

## Version 1.14 verification

352 tests in forty-one files pass, including all existing delete/overwrite, import, ledger and reminder checks.

The latest published 1.13 source was restored into a separate checkout before editing; the older local checkout and
its unfinished state were retained. The recovered source includes confirmed deletion and overwrite imports. Tests
run with `DATABASE_FILE_PATH=./data/app.sqlite`, using only unique disposable test databases. No user ledger is used.
The new checkout reuses the existing installed dependency tree after confirming identical pinned dependencies; a fresh
installation hit a malformed package-store index. No dependency versions were changed to work around that cache.

New count tests compare browser/server ending calculations for month-end clamping, leap years, later clamped due dates,
weekly DST boundaries and one-time rules. Invalid/fractional/zero/oversized counts, incompatible ending fields,
off-pattern starts, expansion limits and calendar overflow reject. Editor interactions cover finite previews, saved
count payloads, remaining counts on reopen, unchanged anchors, one-time restrictions and clearing an ending.

Real SQLite HTTP tests cover finite creation/reopen, the inclusive last payment, rejection beyond the end, pause/skip/
history retention when changing counts, invalid inputs, explicit ending removal and rollback if a late ending write
fails after a rule edit or creation. Browser tests verify one write for rule plus ending, stored-field cleanup, finite
JSON round-trips and quota-failure preservation. Icon assertions check SVG-only content, names and titles; existing
confirmation/skip/paused interactions continue through the same accessible buttons.

The original supplied Dockerfile is unchanged. No schema/dependency migration is added; counts use existing inclusive
end-date controls. Old recurring write payloads keep their ending when no ending fields are provided. Full production
and isolated demo builds, strict types, lint, formatting, JSDoc and source/component bounds are checked. Browser visual,
real device, Docker/ARM64 and actual notification delivery remain unverified.

## Version 1.13 verification

331 tests in thirty-nine files pass, along with production build/artifact verification, strict types, zero-warning
lint, formatting and named-source documentation checks.

Deletion coverage checks read-only count summaries without private subscription/receipt values, missing/lowercase/
padded confirmation words, the explicit acknowledgment, cancellation, stale financial/notification revisions and
late notification-table rollback. A populated file-backed database is checked for zero rows in all user tables,
integrity and empty reopened state, including repeated deletion. A simulated provider await confirms that a deleted
device cannot recreate attempt history. No real notification provider or user application database is contacted.

Browser interaction tests exercise the complete confirmation dialog, exact `DELETE`, one blank financial snapshot,
no automatic sample restoration, owned preference cleanup, preserved unrelated storage, cross-tab hashing races,
blocked writes and separately
reported preference-cleanup failures. Server-mode client tests verify the actual typed confirmation payload and ensure
failed HTTP deletion does not clear browser data. Settings refresh their controls after a successful reset.

Actual overwrite tests cover validation of balances/relationships, paid-versus-skipped dates, paused schedules,
conflicting edited identities, currency consent, read-only review, lowercase/exact `REPLACE`, invalidation after scope
changes and a fresh source following a successful replacement. Both native-derived and Folio JSON replacements use
the existing transactional workspace endpoint. Real SQLite HTTP coverage replaces colliding Actual identities while
retaining notification preferences/devices and verifies reopened persistence. Existing replacement rollback, source
validation, quota and revision tests remain part of the suite. Test source data is entirely fictional.

The production and private demonstration modes are built independently. Strict types, zero-warning lint, formatting,
JSDoc and source/component bounds remain checked. The supplied Dockerfile is retained byte-for-byte; registry Compose
uses tag 1.13.0 and ports 8081/5001. Schema, migrations and dependencies are unchanged. Browser visual/accessibility
and real-device audits, Docker/ARM64 execution and actual push delivery remain unverified here.

## Version 1.12 verification

313 tests in thirty-seven files pass.

New regressions exercise matching versus stale Actual next-date revisions, malformed/off-pattern/duplicate progress,
tombstoned rows in a native SQLite ZIP, completed finite/one-time schedules, counted endings, exact historical links,
legacy progress upgrades, unchanged financial values, repeat imports and invalid skipped-date graph relationships.
The old normalized payload remains accepted through a default empty skipped-date list. Browser and server planners
share the same validation/merge behavior. SQLite HTTP tests cover read-only review, acknowledgment/revision boundaries,
late progress-insert rollback, reopened persistence and retained unrelated skips. Rendered UI verifies reviewed progress
repairs without financial-history writes; editor tests verify an enabled Due date, unchanged-anchor saves, immediate
weekly/monthly previews, cleared-skip previews, pause/end visibility, recorded/skip filtering and ending validation.

The attached real export was also decoded and imported into a disposable migrated SQLite file, first with legacy
progress omitted and then through the new reviewed upgrade. All 15 schedules, 16 postings and six endings persist;
11 source-advanced dates resolve to ten already recorded occurrences plus one added skip. Twelve pending dates match
Actual's effective next dates; one source next date is already recorded, so its next unconfirmed date advances one
month. Two fully paid ended schedules have no pending dates. Account
balances match, original financial rows/anchors/settings are identical, reopened state is correct and a repeat review
adds zero rows. The temporary database was removed; no application database or notification provider was used.

The supplied export remains private and is never seeded into the preview or fixtures. Public fixtures are fictional.
The native effective-date rule was checked against Actual's upstream AQL `v_schedules` mapping and schedule update code:
`packages/loot-core/src/server/aql/schema/index.ts` and `packages/loot-core/src/server/schedules/app.ts`.

Production/demo builds, formatting, strict frontend/backend/worker types, zero-warning lint, named-source JSDoc and
source/component bounds are checked. The source Dockerfile is compared byte-for-byte with the supplied file. Schema
and dependencies are unchanged. Browser layout/device notification delivery and Docker/ARM64 execution remain unverified.

## Version 1.11 verification

300 tests in thirty-six files pass, along with strict frontend/backend/worker types, zero-warning lint, formatting,
named-source JSDoc and source/component line bounds.

Calendar/recurring tests cover weekly instances, recorded-payment deduplication and original amounts, past/today/future
colors, paused planning, disabled confirmation, reversible skip, inclusive endings, month-end/leap-year expansion,
all entries on a busy date and a foreground date change. Date sorting uses UTC civil-day distances, including DST
boundaries, past/future ties, distant starts, annual next dates, overdue counts and completed rules last. Name/amount
sorting, the default table, optional cards and income/expense labels are covered through rendered UI interactions.
Confirmation writes exactly one ledger payment; display/sort changes never write financial data. Existing schedule,
import, workspace, SQLite and notification tests remain part of the full suite. Fixtures contain fictional data only.

The production and demonstration modes are built separately. The supplied Dockerfile and persistent schema are
unchanged. Registry Compose defaults to 1.11.0 with ports 8081/5001. No new dependency is added. Browser layout audits,
Docker/ARM64 execution and live notification delivery remain unverified; DOM tests do not replace device testing.
The schedule engine's documented 5,000-occurrence cap remains in effect.

## Version 1.10.2 verification

The supplied native ZIP was decoded locally with SQL.js and imported into a new disposable, migrated SQLite database.
The existing 1.10.1 parser already accepts every supplied schedule. All 15 schedules and 16 postings persist exactly,
all six installment end dates and paused controls survive reopen, both account balances reconcile, repeat review/commit
adds no rows and SQLite integrity passes. Adding schedules to a legacy import preserves postings and balances.
The source ZIP checksum is unchanged. Temporary databases are cleaned up; no runtime user database is used.

Thirteen historical payments match exact dates and amounts. Three source-linked payments have off-anchor recorded
dates; these remain unchanged ordinary postings. The new warnings identify them before reminder activation. A legacy
import with all links omitted retains its postings and exposes the 13 otherwise matchable links it intentionally leaves
unchanged. The normalized financial data hash is identical before and after the review improvements.

The compiled production HTTP server was also run on a separate migrated temporary SQLite database. Actual exported
data passed read-only review, atomic 15-schedule/16-posting commit, six paused installment endings, repeat preview/commit,
reopened persistence and graceful shutdown. Its signing keys were disabled and its database had no subscriptions.
No push provider was contacted. The process and temporary database were removed after the check.

284 tests in thirty-four files pass. A fictional mixed-shape native fixture uses alternate condition ordering,
legacy aliases, omitted interval, inactive old ending dates, six distinct installment endings, an auto-post source flag,
approximate/fixed amounts and off-anchor history. No uploaded names, amounts, identifiers or notes are copied.
UI tests distinguish supported/total schedules from selected scope, display end-date/payment counts and legacy warnings,
require acknowledgment and preserve all existing postings while adding schedules. Paused skip preparation validates
membership, preserves recorded history, remains paused until explicitly resumed, suppresses reminders afterward and
supports restoration. Existing malformed/unsupported rule tests and all ledger/workspace/reminder checks remain green.

Strict frontend/backend/worker types, zero-warning lint, named-source JSDoc, formatting, source/component bounds,
production/demo builds and native-worker/WASM/PWA artifacts are checked. The supplied Dockerfile remains unchanged;
Compose defaults to 1.10.2 with ports 8081/5001 and the existing volume layout. No migration or dependency is added.

Private ZIP contents and temporary normalized/database data are excluded from source and deployment packages. Only
fictional fixtures and aggregate verification results are retained in the repository. The published preview keeps its
existing demonstration seed. Browser visuals, Docker/ARM64 runtime and live device delivery remain unverified.

## Version 1.10.1 verification

280 tests in thirty-four files pass. A real native SQLite ZIP contains 15 fictional Greek-labeled schedules using
Actual's editor-created rule format, including ordinary monthly `day` patterns, inactive ending fields, approximate
amounts and an income schedule. All 15 import paused with exact source balances and a duplicate-free repeat import.
The fixture shape was checked against Actual's primary RecurringSchedulePicker and useScheduleEdit source, which save
`endOccurrences: 1` and `endDate` even for `endMode: never`.

Additional cases verify first matching month days, year rollover, counted weekly/monthly/yearly endings including a
single payment, inactive ending/pattern fields, active end-date validation, bounded positive counts, no-effect options
and continued rejection of unsupported rule semantics. Bad fields identify their path instead of a generic message;
bounded diagnostics retain the failed source definitions and explicitly omit oversized rule contents.

File-backed SQLite HTTP coverage verifies read-only review and committed installment settings after reopen. The UI
permits diagnostics before any import or currency consent, downloads parsed rule arrays without financial history, and
identifies the importer version. The native decoder, entire existing ledger/workspace/reminder suite, strict frontend/
backend/worker types, zero-warning lint, named-source JSDoc and component/source limits remain checked.

A separately migrated disposable SQLite database also ran the compiled production server over real HTTP. An older
import without schedules was upgraded using Actual editor defaults and a six-payment ending: read-only review,
unchanged historical postings, atomic addition, paused controls, the exact final date, repeat detection, reopened
persistence and graceful HTTP/SQLite shutdown all passed. Its process and temporary database were cleaned up.

The user's source rule definitions have not been provided. Compatibility with their exact 15 schedules is therefore
not claimed verified. Unsupported intervals, weekend shifts, multi-day/weekday patterns and month-end/leap-day date
policies remain explicit exclusions. Diagnostics give a targeted next step without requesting the entire budget.

The Dockerfile remains an exact copy of the supplied attachment; registry tags are 1.10.1 with host ports 8081/5001.
No schema migration or dependency addition is required. Production and demo frontend/backend builds and offline
native-worker/WASM/PWA artifacts are checked. Browser visuals, Docker/ARM64 execution and live device delivery remain
unverified. Integration checks use isolated temporary SQLite files, not host runtime financial data.

## Version 1.10 verification

250 tests in thirty-three files pass. New native ZIP tests build and close real source SQLite files before decoding
with SQL.js: exact/approximate/range amounts, signed midpoint rounding, approximate date matching, four supported
frequencies, inclusive end dates, optional payees, native aliases, safe category/notes actions and both transfer
orientations. Zero/cross-zero ranges, malformed amounts, missing/self accounts, altered/template actions, duplicate
conditions, wrong schedule links, unsupported daily/custom/pattern recurrences and invalid endings are excluded.

Upgrade tests cover adding newly supported schedules to older imports, unchanged historical postings and account
balances, repeat detection and continued conflict protection for edited amounts. File-backed SQLite HTTP coverage
verifies read-only review, commit, paused controls, reopened persistence and repeat safety. Browser-storage UI coverage
requires acknowledgment, displays recurring estimates before commit and offers the Recurring link afterward.

A separately migrated disposable SQLite database ran the compiled production HTTP server. Real HTTP verified a legacy
import without schedules, a read-only review adding only the new approximate schedule, commit with byte-equivalent
historical posting rows, paused controls, repeat detection, reopened durability and successful graceful HTTP/SQLite
shutdown. No runtime financial database was used. The test process and temporary database were cleaned up.

Computed CSS checks load all production styles in entry-point order under jsdom. Six contexts (Actual/workspace consent,
inline, reconciliation, bulk and editor toggle) resolve to 20×20 checkbox inputs with zero padding, horizontal labels
and retained touch-target rules. Ordinary text inputs retain 12-pixel padding. This is not a browser visual audit.

The public Actual Wrapped demo from https://github.com/actualbudget/wrapped decodes eight
accounts and 359 postings with all balances reconciled. Its supported one-time approximate schedule now imports paused;
two month-end schedules and one accountless schedule remain explicitly excluded. A separate upstream e2e archive
with inconsistent split totals is correctly rejected. No public fixture or external source is bundled with this release.

The supplied Dockerfile is byte-identical to the repository Dockerfile, SHA-256
`4aa4195f08a01411aec6f76af9d33be16143cde2c8f6fb959076139d00f95460`; it is retained unchanged. Registry Compose defaults
to 1.10.0, keeping ports 8081/5001 and the same volume layout. No dependency or database migration is required.
Strict frontend/backend/worker types, lint with zero warnings, named-source JSDoc, formatting, source line/component
limits, production frontend/backend build and native importer/PWA worker/WASM artifact checks pass.

Browser visual and real-device testing, Docker/Buildx/ARM64 execution, Compose runtime and live Web Push delivery remain
unverified in this environment. Source schedule automation stays disabled; all imported schedules require review/resume.

## Version 1.9 verification

224 tests in thirty-two files pass. New real file-backed SQLite HTTP tests validate read-only workspace review,
all financial replacement collections, receipts, reconciliation balances on both transfer legs, stable import links,
paused schedule controls and skipped dates, reopened persistence, retained device subscriptions/preferences/history,
cleared old server snoozes, explicit confirmation, changed source/destination rejection and late-write rollback.
Corrupt identities, account/goal links, statement balances, fingerprints and file payloads reject before writes.
Server review accepts valid receipts above the preview capacity; bodies over 16 MiB return a safe HTTP 413 envelope.
The existing preview recovery tests now exercise the new review/acknowledgment path; fresh-source/destination guards,
quota failure, retry and preservation of unrelated browser settings are checked against actual storage.

Notification tests exercise separate desktop/Apple-provider registrations, current-device-only tests, no financial
content in test payloads, explicit VAPID provider options, public configuration without signing secrets, disconnection
of only one device, persistent cooldown across reopen, concurrent test reservation, disabled/unregistered/SSRF target
rejection, provider errors and expired endpoint cleanup. The provider is injected/mocked: no real push service is called.
The compiled key generator is covered for valid output, owner-only permissions and refusal to overwrite an existing file.

Browser service/UI tests verify no permission prompt on load, synchronous permission initiation from the enable click,
exact application-server bytes, denied/save-failure behavior, stale local flags, actual server registration checks,
HTTPS and iOS Home Screen guidance, capability refresh, current-device tests and honest provider-failure feedback.
Worker readiness has a tested deadline. Foreground notification delivery awaits mobile service-worker display and
retains preference changes made while waiting; rejected display is recorded as failed and successful repeats suppressed.

The full existing Actual Budget import, ledger, reports, statement, scheduling and planning suite remains green.
Lint reports zero warnings; strict frontend/backend/worker types, named-source JSDoc, formatting, 120-character source
lines, 100-line component limits, production frontend/backend build and PWA/native-import worker/WASM checks pass.
No database migration or dependency addition is required. All integration writes use isolated disposable test files;
no host runtime financial data is changed. SQLite remains the persistent self-hosted database.

A separately migrated SQLite database also ran the compiled production HTTP server with newly generated test-only VAPID
keys. Real HTTP verified enabled public configuration, registration status, rejection of an unregistered test without
contacting a provider, read-only workspace preview, receipt round-trip, paused import, retained device registration,
stale-review rejection and reopened persistence. The compiled CLI produced mode-0600 key output and refused overwrite.
SIGTERM exited zero and confirmed HTTP/SQLite closure. The private fixture keys and database were cleaned up afterward.

The added registry Compose file uses versioned ARM64 images, host ports 8081/5001, internal ports 8080/3001, no profiles
or YAML anchors, and the source nginx file as a read-only bind mount. The source template allows a 16 MiB request body.
The signing-key environment file is excluded from Git and Docker build contexts. The private publishing audience is
retained for the hosted preview, which continues to store data only in its browser and does not run background push.

Browser visual/real-device tests, Docker/Buildx/ARM64 execution, Compose runtime, image/non-root inspections, nginx TLS
proxy behavior and actual desktop/Android/iOS Web Push delivery remain unverified. HTTPS deployment, stable server VAPID
keys, same-server access and explicit permission on every device are required for background phone reminders.

## Version 1.8 verification

189 tests in twenty-six files pass. The 31 new tests cover native root/nested ZIP exports containing real isolated
file-backed SQLite sources, exact balance reconciliation, opening balances, split/transfer conversion, source mappings,
stable legacy IDs, corrupt/oversized inputs, explicit schedule exclusions, duplicate keys and changed imported records.
Worker controller tests verify byte transfer, validated replies, cancellation and deadline termination.

File-backed HTTP integration tests cover read-only preview, additive related inserts, existing transaction/receipt
preservation, reopen persistence, repeat imports adding zero, resumed schedule preservation, stale/forged revisions,
missing currency consent, malformed graphs and source balance mismatch. A trigger rejecting a later posting verifies
rollback of earlier account/category/schedule/posting writes. Preview UI tests use actual storage and merge logic,
with parsing tested separately: currency/final consent, complete review download, duplicate review, scope invalidation,
optional allocation/schedule exclusion, stale destination detection, quota-failure recovery and selection cancellation.

The official `actualbudget/wrapped` public demo native ZIP was independently decoded: 8 accounts, 359 postings,
14 new custom categories, 46 monthly allocations and 359 clearing flags. All source balances match the converted
all-recorded ledger. Repeating the identical source adds zero rows. Four complex/approximate schedules are explicitly
excluded. Only public demo and fictional test data are used; none are imported into the host runtime database.

Lint with zero warnings, strict frontend/backend/worker types, formatting, named-source JSDoc, 120-character source lines,
100-line component limits, default production build and PWA artifact checks pass. Artifact verification checks that the
native worker references the emitted WASM and both appear in the service-worker precache. No schema migration is needed.
A separately migrated SQLite test database also served the compiled production API over real HTTP. The public demo
review wrote nothing; commit inserted 359 postings and 8 accounts, preserved a pre-existing posting, and survived reopen.
Repeat review added nothing; a subsequent destination edit invalidated the old revision with HTTP 409. SIGTERM exited
zero and logged that HTTP and SQLite closed. The test database was cleaned up afterward.

The native reader queries only allowlisted physical tables read-only; SQL.js is a transient file decoder, while persistent
self-hosted data continues to use real SQLite through better-sqlite3. The existing browser-local hosted preview exception
continues to be explicitly labelled. Full feature mappings and excluded source semantics are documented in README.

Browser visual/real-device checks, Docker execution and real Web Push delivery remain unverified. jsdom workflow tests
do not establish real browser layout, native ZIP download/upload compatibility, device memory limits or CSP execution.
Docker config/build/start/stop, image/non-root inspections, nginx proxy and volume replacement checks were not rerun here.

## Version 1.7 verification

158 tests in twenty-two files pass. New file-backed SQLite HTTP tests cover read-only bulk review without receipt bytes,
category-only edits preserving financial fields and audit identities, durable reopen persistence, deletion cascades,
preserved accounts/schedules/unselected rows and re-posting a deleted recurring occurrence. Destination-leg statement
locks, edited or removed postings, changed receipt/clearance/import metadata, archived targets, duplicate IDs, malformed
inputs, excessive batch sizes and forged revisions reject without partial changes. Trigger-induced failures on later
category writes and deletions restore earlier writes, supporting file bytes and cascaded import identities.

Preview workflow tests use actual workspace loading and storage, review before commit, explicit permanent-delete
acknowledgment, locked row protection, category changes retaining audit fields and links, deletion metadata cleanup and
recurring-date eligibility. Selection resets on every ledger scope filter; refreshed data hides old reviews. Fresh
storage rejects stale reviews and late locks. Failed storage writes preserve all previous data and allow a newly
reviewed retry. Select-all is bounded to 100 visible editable entries. Canonical server/preview plans match despite
input key or selection order differences. The full existing suite remains green.

Lint, strict frontend/backend/worker types, formatting, named-source JSDoc, component/TypeScript line limits, production
builds and manifest/icon/service-worker artifact checks pass. A separately migrated test database was used to launch
the compiled production server. Real HTTP calls verified read-only review, category commit retaining audit timestamps,
stale-review rejection and deletion; the database was reopened to verify persistence. SIGTERM exited 0 and confirmed
that HTTP and SQLite closed. No schema migration, new dependency or runtime host-data change was needed.

Browser visual/real-device checks, Docker execution and real Web Push delivery remain unverified. UI workflows are
covered in jsdom; actual browser layout and interactions still need real-device verification.

## Version 1.6 verification

137 tests in twenty files pass. New report arithmetic checks cover January/year boundaries, leap-day month ends,
calendar-year comparisons, equal inclusive custom spans across the Athens daylight-saving transition, one-day spans,
invalid/oversized ranges, exact combined scopes, transfer exclusion, signed/zero/negative comparisons and empty chart
intervals. CSV tests cover current and previous-only category rows, exact money differences, scope metadata, quoted
labels and formula protection while preserving trusted signed numbers.

Browser-local workflow tests load the actual preview workspace and verify monthly/yearly/custom totals, future-dated
actual postings, unpaid-schedule exclusion, exact archived-category/account filters, both export actions, chart data,
previous-only categories, restored report URLs with a different global month, unavailable bookmarked scopes and blocked
results/downloads for invalid ranges. The source convention scanner finds no undocumented named functions; component
and TypeScript line limits pass. Lint, frontend/backend/worker strict types, formatting, the default frontend/compiled
backend production build, and manifest/icon/service-worker artifact checks pass. The schema and dependencies are
unchanged, and no runtime financial data is modified by reporting.

Browser visual/real-device checks, Docker execution and real Web Push delivery remain unverified. The reporting UI is
covered by jsdom interaction tests; those tests do not establish real browser layout or download compatibility.

## Version 1.5 verification

116 tests in eighteen files pass. New real SQLite tests cover durable pause/resume, acknowledged payment retries while
paused, inclusive end dates, invalid start/end changes, idempotent skip/restore, paid-date protection, skipped-date
reset only on anchor/frequency changes, cascade behavior and snapshot exports. A fake provider pauses another schedule
during a scan; the remaining queued send is suppressed without contacting a real provider.

Preview workflow tests exercise the actual save/refresh path, pause/resume, skipped-date restoration, calendar cells,
forecast/reminder suppression, inclusive limits, retained paid history, backup validation, legacy preview fields and
preserved audit timestamp/schedule links on edits. Existing forecast, calendar expansion, reminder, receipt, import,
reconciliation, planning and recovery checks continue to pass. Lint, strict types and source conventions are checked.
A consistent backup preceded migration 0004. Exact rows in all seventeen existing financial/metadata tables,
including receipt contents, match the backup; readiness verifies nineteen tables. The compiled server was launched
against a separate fresh database. Real HTTP checks enforced pause/skip state, retained acknowledged payment retries,
validated exported controls through the preview backup validator and confirmed SIGTERM exit 0 with SQLite closed.
Production builds and manifest/icon/service-worker checks pass. The frontend build explicitly clears only its generated
output before the PWA precache scan, preventing older build assets from being carried into the release cache.

Browser visual/real-device tests, Docker execution and real Web Push delivery remain unverified.

## Version 1.4 verification

103 tests in sixteen files pass. New SQLite tests cover upload retries and conflicts, metadata-only lists, persistence
after reopen, allowed signatures, spoofed/invalid payloads and names, file-count/byte quotas, statement locks and
acknowledged retries after locking, transaction deletion cascade and receipt inclusion in online backups. UI tests
exercise actual file selection, upload, download, removal, storage-failure retry and protected downloads. Backup tests
round-trip versioned and legacy exports, receipt bytes, damaged structures, missing/duplicate links, goal and statement
validation, read-only selection/review, cancellation, explicit replacement, stale reviews and quota failures.

A consistent host database backup was taken before migration 0003. Readiness verifies all seventeen tables, and
accounts, actual postings, schedules, caps, monthly overrides, goals and reconciliation row counts match the backup.
Migration 0003 creates a receipt table and index without rebuilding existing tables. No dependencies were added.
The default frontend/compiled-backend production build and manifest/icon/service-worker artifact checks pass.
A separately migrated file was used to launch the compiled server. Real HTTP checks verified upload retry deduplication,
metadata-only listing, exact byte downloads, a consistent JSON snapshot accepted by the preview restore validator,
transaction deletion cascade and graceful SIGTERM exit 0 with SQLite closed.

Browser visual/real-device checks, Docker execution and real Web Push delivery remain unverified.

## Version 1.3 verification

87 tests in thirteen files pass. The budget-copy HTTP tests use isolated file-backed SQLite to verify read-only
review, default preservation, explicit replacement, zero allocations, archived-category skips, source/destination
staleness, strict input validation and rollback after a trigger rejects a later batch write. Browser-local UI tests
exercise review/commit, policy-change invalidation and stale snapshots. The same tests verify exact archived-category
filtering, combined account scope, filtered CSV export, active-category correction on duplication and retained
historical category edits. Lint, strict type checking, named-source JSDoc, 120-character TypeScript lines and the
100-line component cap are checked. The schema and dependency versions are unchanged.

The default frontend/compiled-backend build and manifest/icon/service-worker artifact verification pass. A separately
migrated test file was used to launch the compiled production server: real HTTP calls verified read-only copy review,
successful allocation copying, preserved actual postings and stale-review conflict responses. SIGTERM exited 0 and
logged that HTTP and SQLite were closed. Browser visuals, Docker execution and real push delivery remain unverified.

## Version 1.2 verification

Monthly allocation overrides and positive rollover now feed both Budgets and the Overview. Savings goals include
signed progress journals and archive/restore. Custom names flow through entry, monthly planning and CSV mapping.
Merchant suggestions and duplication retain user choices and never alter the source posting or its audit links.

77 tests in thirteen files pass. New coverage includes an actual populated-v1.1 SQLite upgrade, exact-month/zero
allocations, case-insensitive catalog duplicates, archived historical categories, scheduled posting after archive,
custom/forged import categories, idempotent contributions, signed withdrawals, archived-goal retries, bounded/negative
progress and persistence after reopening. Pure arithmetic checks cover chained/year-boundary rollover, missing/disabled
months, overspending, corrected historical expenses and goal calendar-month pace. Browser-local UI tests exercise
budget editing/navigation, goal create/contribute/withdraw/archive/restore, category availability, duplication and
merchant defaults through real workspace persistence. Failed preview mutations leave stored data unchanged.

The compiled production server also started against a separate freshly migrated file. Real HTTP smoke checks created
an account, custom category, month budget, actual transaction and goal; retried one contribution without duplication;
confirmed goal progress created no extra financial posting; and verified graceful SIGTERM exit 0 with SQLite closed.
The default full-stack production build and manifest/icon/service-worker artifact checks pass.

The host database was backed up before applying additive migration 0002; readiness verifies all sixteen tables.
No previous table or migration is rewritten. The same private Site and preview storage key are retained.
Browser visual/real-device checks, Docker execution and real Web Push delivery remain unverified as described below.

## Version 1.1 verification

The upgrade adds account-aware daily cash-flow forecasts, reviewed bank CSV imports, duplicate/manual-transfer
matching, per-account statement reconciliation and timezone-aware reminder preferences/snoozes/history. The existing
preview URL and owner-only audience are retained. Existing v1 browser workspaces remain readable.

Executed new checks include a populated-v1 migration with original balances/recurring links intact, atomic import
rollback, retry deduplication, two-sided transfer matching, independent clearing, exact statement arithmetic,
reconciliation locks/latest-only undo, invalid timezone/time validation, unpaid-occurrence snoozes, DST transitions,
provider acknowledgment persistence across database reopen, and bounded failed-delivery retries. Forecast and CSV
format edge cases are tested. UI workflow tests exercise sample upload/mapping/review/import, duplicate review,
reconciliation of imported cleared entries, and reminder preference persistence through the actual demo adapter.

Provider delivery tests inject a fake sender; they do not send real notifications. Docker, a real browser, real Web
Push permissions/providers, installation and offline/update lifecycle audits remain unavailable/unverified. No new
claim is made for those checks. The schema upgrade is additive; no previous table is dropped or rebuilt.

## Executed successfully

- Root dependency installation with a committed lockfile and explicitly allowed native dependency builds.
- Native better-sqlite3 load; installed version 13.0.3 reports SQLite 3.53.4.
- Drizzle generation of the initial reviewed schema, explicit migration, readiness check and idempotent development seed.
- Actual connections verified foreign keys ON, WAL, FULL synchronous durability and a 5000ms host busy timeout.
- Strict frontend/backend/worker type checking; both static frontend and compiled backend production builds.
- Oxlint with `--deny-warnings`: zero errors and zero warnings after supported-rule adjustments.
- Prettier formatting; source component size and manually maintained TypeScript line-length inspection.
- 224 deterministic tests in thirty-two files, including file-backed SQLite persistence and frontend interactions.
- Production manifest/icon/service-worker artifact verification.

The test suite covers HTTP validation and errors, security headers, CORS, pagination, accounts, budgets, constraints,
readiness failure independently of liveness, missing/unmigrated storage, CRUD, file reopen persistence, rollback,
bounded writer contention, backup restore into a separate file, idempotent/clamped recurring payments, one-time plans,
transfer arithmetic, editor integer money conversion, failed writes, offline state and user-driven installation.
Tests create isolated real SQLite files, close handles, and remove only test-owned directories. No memory database is used.

## Explicit requirement resolutions

### Hosting versus the requested server stack

Sites runs static assets or Workers, and cannot run this application's long-lived Express/better-sqlite3 process with
persistent local storage. The full source retains Express, Drizzle and SQLite without substituting another production
database. The hosted URL is a separate browser-local preview compiled with `VITE_DEMO_MODE=true`. A visible banner and
Settings explain that data stays on the device. Full-stack builds default to false and never fall back on API failure.
Preview storage is therefore an explicit preview-only exception to the attachment's SQLite-only persistence rule.

The single-user backend binds to loopback by default and has no built-in authentication. Use a private network or a
real authentication proxy with TLS before remote access. This is not a public multi-user financial service.

### Toolchain compatibility

The latest TypeScript 7 native executable failed in this restricted environment because `/proc/self/exe` was unavailable.
TypeScript 5.9.3 was selected and passed actual type checks. Other dependency versions are pinned in the root manifest.
pnpm 11.25.0 is the environment-supported pinned version; later releases exist but were not substituted mid-build.

pnpm 11 ignores dependency-build settings in `package.json`. `pnpm-workspace.yaml` contains only `allowBuilds` for
better-sqlite3 and esbuild. It declares no package globs, package manifests, or multi-package workspace. This is the
configuration-only exception required to install native dependencies with the selected pnpm version.

### Oxlint adjustments

Plugins `typescript`, `react`, `import`, and `jsx-a11y` are enabled. The requested JSX filename extension value is
changed from `.js` to `.tsx` at error severity. `no-magic-numbers` is added with 0, 1 and -1 exemptions and scoped
constant/config/test overrides. Generated migration output and build artifacts are excluded. No console exemption is
needed: application logging uses pino. No requested supported rule has had its severity reduced.

Installed Oxlint 1.88.0 rejected these five requested rule names, so they were removed rather than falsely accepted:

| Unsupported rule                          | Review alternative                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `camelcase`                               | Manual descriptive naming and camelCase/PascalCase review                   |
| `react/destructuring-assignment`          | Destructured functional component props; explicit ErrorBoundary class props |
| `react/forbid-foreign-prop-types`         | TypeScript props; no runtime PropTypes objects                              |
| `react/no-deprecated`                     | Modern functional React APIs; the error boundary uses supported class APIs  |
| `react/no-unused-class-component-methods` | Only required error-boundary class lifecycle/render methods exist           |

Oxlint has no reliable magic-string rule. Fixed domains use TypeScript unions, named route/storage/interval catalogs
and contextual single-use labels. Numeric logic is checked by the actual linter. `inspectConventions.mjs` checks named
source declarations for JSDoc; it does not prove the semantic quality of every anonymous callback or string choice.

Every application component file is within 100 lines after formatting. Source TypeScript/TSX uses a 120-character
limit. Generated migration SQL/metadata and the lockfile retain tool-generated formatting and can contain longer lines.
Infrastructure contains meaningful named settings, but some low-level nginx/Docker literals remain documented rather
than mechanically linted; there is no claim of a universal no-literal proof.

### Docker choices and checks unavailable

Chosen exact image tags: `node:24.19.0-bookworm-slim` for compatible native-driver build/runtime libc, and
`nginxinc/nginx-unprivileged:1.28.2-alpine` for the static frontend. Release image digests have not been resolved or
verified; supply verified digest-pinned overrides before release. No image size is claimed because no image was built.

The Compose application has three services, with embedded SQLite and a persistent named volume. Frontend-only
libraries are dev dependencies; production dependencies contain compiled backend runtime packages. `--wait` applies
only to long-running services after a fresh exclusive migration succeeds, avoiding one-shot wait ambiguity. Compose
2.20+ is required. Runtime UIDs are 1000 for backend/migrate and 101 for nginx. Source inspection covered volume
ownership, named settings, same-origin proxying, non-root execution, read-only filesystems and no-secret build contexts.

The following required root commands were attempted and failed solely because the Docker executable is absent:

- `pnpm docker:config`
- `pnpm docker:build`
- `pnpm docker:up`
- `pnpm docker:down`

Consequently, all of these container-specific checks remain unverified:

1. Compose schema acceptance, image-tag availability, image builds and image sizes.
2. Container-native better-sqlite3 loading in backend and migrate targets.
3. Actual runtime numeric UIDs, permissions on a fresh named volume and bind-mounted directory provisioning.
4. Image contents/history, absence of secrets/dev tools in layers, and vulnerability scans.
5. nginx configuration templating, read-only startup, API proxy/CSP/cache headers and SPA deep links.
6. Migration job success/order, refusal to migrate a running container, health-based startup and `--wait` behavior.
7. SIGTERM timing, exit code and HTTP/SQLite shutdown logs inside the container.
8. Container replacement persistence and normal down/up preservation of WAL/SHM/database files.
9. Runtime readiness/liveness through nginx and actual inaccessible/unmigrated mounted storage behavior.
10. Image digest pinning and release promotion on the intended target architecture.

Equivalent database constraints, durability settings, backup/restore and readiness failures were tested on actual
host file-backed connections. They are not substitutes for executing the listed container checks.

### PWA/browser checks unavailable

The supported browser-control skill was unavailable, so no browser preview server or improvised browser was launched.
The following are not verified: visual layouts at 360/768/1280px, real keyboard/touch navigation, contrast compliance,
real iOS behavior, installation, first offline load, upgrade notification/reload across deployments, and browser cache
inspection. Install/connectivity hooks and the editor were tested in jsdom; service-worker update hooks do not have
complete browser-level integration coverage. No Lighthouse performance/accessibility/best-practices/SEO scores or
PWA installability result is claimed. The required Lighthouse audit against Docker cannot run without Docker/browser QA.

The valid manifest omits narrow/wide screenshots instead of shipping fabricated screenshot assets. It therefore lacks
the requested richer install presentation. SVG/PNG/ICO icon artifacts and the actual production manifest are verified.
Controls use a 44px minimum target, but a full touch-target/accessibility audit remains necessary. Offline API writes are deliberately disabled. API responses use no-store and the worker uses NetworkOnly.

Real Web Push provider delivery, expired-subscription handling on a live provider and notification permissions on real
devices remain unverified. Self-hosted delivery needs server-side VAPID keys and outbound HTTPS. Preview reminders
require the page to remain open; the UI explains this and offers calendar export. Calendar alarms depend on the user's
calendar application and are not a delivery guarantee.

## Final handoff boundary

The source is a functional personal-budget application with automated verification and an independently usable hosted
preview. Public multi-user authentication, remote SQLite hosting, real-device/PWA certification and verified container
release images are outside this completed environment's verified result. The README gives concrete setup and release
steps, including the remaining checks, without presenting them as already executed.
