# Folio 1.10

- **Compact checkboxes:** native 20-pixel controls no longer inherit text input padding, minimum field heights or
  full-width label rules. Consent and toggle labels retain 44-pixel touch targets; import rows stay horizontal.
- **Actual recurring imports:** exact/approximate/range amounts, approximate date matching, optional payees, account/payee
  aliases, two-account transfer schedules and safe plain category/notes actions. Reviewed estimates disclose source
  values; imported schedules stay paused. Unsupported recurrence/action semantics remain explicit exclusions.
- **Review and upgrade:** each new schedule appears before acknowledgment; completion links to Recurring. Newly supported
  schedules can be added to older imports without changing historical postings. Other edited identities still conflict.
- **Dockerfile:** the supplied file is retained byte-for-byte as Dockerfile; registry Compose defaults to 1.10.0 with
  host ports 8081/5001. No database migration or dependency change.

250 tests pass in thirty-three files. Strict types, zero-warning lint and named-source documentation checks pass.
Browser visuals, Docker/Buildx/ARM64 execution and live push remain unverified. See VALIDATION for build checks.

# Folio 1.9

- **Workspace JSON import:** Settings now supports the self-hosted SQLite application as well as the preview. Review
  every financial collection, download a recovery export and acknowledge a full replacement. Complete graph/file
  validation and a current SHA-256 revision precede the single atomic replacement; late failures roll back all writes.
- **Paused migration:** imported schedules retain end/skip history but start paused. Device subscriptions, notification
  preferences/history and appearance remain intact; old server financial snoozes are cleared. No schema migration.
- **Browser and phone setup:** actual permission and registration status, per-device enrollment/disconnect, user-gesture
  permission timing, actionable HTTPS/iOS Home Screen guidance, copied app address and a current-device test button.
- **Honest delivery feedback:** generic private payloads, provider acceptance rather than claimed display, persistent
  cooldown, expired subscription cleanup and asynchronous foreground mobile display handling.
- **Pi deployment:** versioned registry Compose with host ports 8081/5001 and a file-backed nginx configuration; private
  VAPID-file generator refuses overwrites. Existing Actual Budget import remains available.

224 tests pass in thirty-two files. Production builds, strict types, zero-warning lint and PWA artifacts pass.
Provider delivery is simulated; real devices, Docker/ARM64 execution and HTTPS deployment remain unverified.
See README for import limits, phone requirements, deployment commands and verification limitations.

# Folio 1.8

- **Actual Budget migration:** read a native ZIP locally, confirm EUR, choose scope, review exact additions and all-recorded
  account balances, download the complete review, then acknowledge an additive import.
- **Financial history:** accounts/openings, flat categories, signed postings, split children, paired transfers, clearing
  flags and nonnegative monthly expense allocations. Existing Folio data remains intact.
- **Supported schedules:** simple fixed rules import paused; unsupported schedules and compatibility limits are explicit.
- **Safe repeat imports:** stable source identities prevent duplicates; edited identities and stale reviews block writes.
  SQLite commits are atomic; preview quota failures preserve prior storage. No schema migration is required.
- **Offline decoder:** bounded ZIP/SQLite decoding in a disposable worker; bundled WASM is included in the PWA precache.

189 tests pass in twenty-six files. Lint, strict types, formatting, production builds and PWA worker/WASM checks pass.
Compiled real HTTP checks verify public-demo import, durable reopen, unchanged existing data, repeat detection,
stale-review rejection and graceful shutdown.

See README for mappings, excluded semantics, currency and size limits. See VALIDATION for executed checks and remaining
browser, Docker and live push verification limits.

# Folio 1.7

- **Bulk ledger actions:** select up to 100 visible editable transactions, review exact rows, then recategorize or delete.
  Scope changes clear hidden selection. Reconciled entries are identified and protected on either account leg.
- **Atomic commits:** a current review is required; changed/missing rows, new locks, archived targets and stale metadata
  block the whole batch. SQLite failures roll back all writes and cascades; preview failures preserve stored data.
- **Explicit deletion review:** receipt/import counts, recurring-payment implications, both transfer legs and an
  acknowledgment precede permanent deletion. Category changes retain financial fields, original audit identities and
  supporting links. No new migration or dependency is required.

158 tests pass in twenty-two files. New coverage includes real SQLite rollback and cascades, late locks/stale metadata,
preview review/acknowledgment, failed-write recovery and bounded selection. Production builds, lint, strict types,
formatting and PWA checks pass; compiled real HTTP checks verify the new endpoints and graceful shutdown. Browser,
Docker and live push verification limits remain documented in VALIDATION.

# Folio 1.6

- **Flexible reports:** calendar month, calendar year or inclusive custom dates; exact account/category filters remain
  in report links, including archived historical categories.
- **Consistent comparisons:** previous calendar periods or equal-length custom spans, exact signed changes, and
  percentages only for positive baselines. Summary cards, day/month cash-flow bars, category rows and exports share
  the same scope; previous-only spending categories remain visible.
- **CSV downloads:** a scoped summary/category comparison report plus matching actual income/expense postings.
  Spreadsheet formula protection applies to untrusted labels. Invalid ranges block results and exports.
- **Compatibility:** no new migration or dependency; unavailable bookmarked accounts remain visibly unavailable.

137 tests pass in twenty files, including calendar boundaries, custom civil-day comparisons, exact filters, chart
reconciliation, safe report CSV, restored bookmarks and invalid-range export blocking. Production builds, types, lint,
formatting and PWA artifact checks pass. See VALIDATION for remaining browser, Docker and live push verification limits.

# Folio 1.5

- **Recurring controls:** pause/resume schedules, set inclusive end dates, and skip/restore individual dates. Calendar,
  forecasts, upcoming lists, exports and reminders honor the controls while recorded payments remain intact.
- **Consistent posting:** eligibility is checked atomically with posting; acknowledged retries retain the original
  payment. Reminder scans recheck current control state before each provider send.
- **Backup compatibility:** exports include controls and skips. Legacy backups default to empty collections; changing
  the start/frequency clears skipped exceptions, and deleting a rule cascades its metadata.
- **Build packaging:** clear generated frontend output before the offline precache scan.
- **Preview persistence fixes:** editing actual payments preserves their original audit timestamp and schedule link.
  Manual accounts/schedules stay free of transaction-only fields, and known legacy fields normalize during restore.

116 tests pass, including file-backed controls, paid retries, end dates, skip/restore, worker rechecks, cross-view UI
behavior, backup links and preview audit regressions. See VALIDATION for build evidence and remaining browser, Docker
and live push verification limits. Upgrade self-hosted installations with the reviewed additive migration 0004.

# Folio 1.4

- **Receipts and documents:** attach PNG, JPEG or PDF files to saved transactions; download or remove them. Uploads
  validate byte size, media signature and filename, enforce quotas, and retain retry IDs. Reconciled entries protect
  attachments; deleting a transaction removes its files. SQLite backups include the file bytes.
- **Portable exports:** versioned JSON financial snapshots now include receipts. The server exports a consistent
  SQLite snapshot without notification subscriptions or credentials.
- **Preview recovery:** review and restore a current or legacy JSON export in the device-local preview. Structural and
  relationship checks run before replacement; stale reviews and failed writes preserve current storage. Complete
  server recovery continues through SQLite backups.
- **Safe upgrade:** additive migration 0003 retains the existing financial tables and preview storage key.

103 tests pass, with real file-backed receipt persistence, quotas, statement locks, backup bytes, retry behavior,
preview upload/download/removal, read-only restore review, invalid backups and failed-storage coverage. See VALIDATION
for build checks and the remaining browser, Docker and live push verification limits.

# Folio 1.3

- **Copy a month's budget:** review allocations and rollover settings, fill missing categories or explicitly replace
  matching categories, and preserve destination-only budgets. Archived categories are skipped. The operation does not
  copy spending or carried balances; stale reviews are rejected and SQLite failures roll back the whole batch.
- **Category filtering:** exact category matching combines with account, type and text filters. Archived historical
  categories remain searchable. Account/category scopes stay in the URL; totals and CSV export follow the selection.
- **Archived entry clarity:** retained names show an archived label. Duplicating an archived entry explains how to
  choose an active category before saving, while historical editing can preserve its original category.
- **Compatibility:** no new schema migration or dependencies. Existing databases, preview storage and private audience
  are retained.

87 tests pass, with additional real SQLite rollback/stale-review coverage and browser-local workflow tests. Build,
format, type and lint checks are documented in VALIDATION. Browser visual, Docker and live push checks remain unverified.

# Folio 1.2

- **Monthly budgets:** exact-month limits, explicit zero allocations and optional positive rollover. Allocation, carry
  and actual spending appear separately; the overview uses the same calculation.
- **Savings goals:** targets and dates, signed progress updates, history, monthly pace, editing and reversible archive.
  Retry IDs prevent duplicate progress. Goals track bookkeeping without moving or reserving account funds.
- **Custom categories:** create and archive/restore names in Settings; use them in transactions, budgets and mapped CSV
  imports while preserving historical names and already-created schedules.
- **Faster entry:** recent merchant suggestions respect explicit category/account choices. Duplicate an actual
  transaction into a new entry dated today without changing the original or copying its audit links.
- **Safe upgrade:** additive migration 0002 and backward-compatible preview metadata. Existing v1.1 data is retained.

77 tests pass, including populated-v1.1 upgrade, rollover/year boundaries, goal retry/withdrawal rules, category
validation, and real preview workflows. Type checks, lint and formatting pass. See VALIDATION for build checks and
remaining browser, Docker and live push verification limits. The hosted preview continues to save on this device only.

# Folio 1.1

Folio now helps you look ahead and compare its records against your bank statement.

- **Cash-flow forecasts:** 30/60/90-day account projections, low-balance warnings, optional overdue payments,
  contributing-event details and CSV export. Find them on Overview or the Transactions workflow buttons.
- **Bank CSV import:** local upload, explicit mapping/date/decimal/sign controls, validation, duplicate detection,
  reviewed manual/transfer matches and atomic commits. Imports mark the selected account's rows cleared.
- **Reconciliation:** compare cleared movements against an exact statement balance. Completed statements protect
  their entries; undo the latest statement to correct them. Transfer sides clear independently.
- **Reminder center:** IANA timezone and local delivery time, individual reminders or one daily digest, configurable
  overdue follow-ups, 1-hour/24-hour snoozes and the latest delivery attempts. Open it from the bell or Settings.
- **Compatibility:** an additive SQLite migration preserves v1 balances and schedule links. Existing browser preview
  data remains readable. The development backend command has been corrected.

The private hosted preview still stores its data on the device and delivers notifications only while open.
Background delivery requires the separately hosted Express/SQLite application, VAPID configuration and an opted-in
browser. Provider acknowledgment is not proof that a person has seen a reminder. No real notifications are sent by tests.

Run the setup/upgrade steps in README and read VALIDATION for exact checks and remaining Docker/browser/PWA limits.
