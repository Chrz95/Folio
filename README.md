# Folio

A calm, manual budget manager for everyday finances. Track income, expenses and transfers; plan bills and
paydays; set monthly category limits; review actual spending; and see posted and upcoming payments on a calendar.
Amounts are euros, represented internally as integer cents. There are no bank connections or third-party analytics.

## Version 1.14: icon actions and custom repetition counts

Edit, Mark paid and Skip this occurrence now use pencil, check and skip icons. Accessible names, hover titles,
keyboard operation, saving/paused disable rules and the existing payment/skip behavior remain available. Recurring
Table and Cards use the same actions; Calendar and other occurrence lists share the icon controls. Touch devices
retain 44-pixel targets.

In **Add/Edit recurring transaction**, choose **Ends → After a number of repetitions** and enter a whole count.
The count starts with the **Due date** shown, including that date. The original recurrence anchor remains intact when
the due date/frequency is unchanged, so a January 31 rule whose next due date is February 28 still returns to March 31.
Paid or skipped dates inside the counted span count toward its length; they are not added again to extend the ending.
The live Scheduled dates preview updates immediately and displays the inclusive final payment date.

New schedules can have up to 5,000 repetitions; an older rule's start position plus count must fit within the existing
5,000-date expansion limit. A one-time rule permits only one occurrence. **Never** clears an ending, and **On a date**
sets an explicit inclusive end. When reopening a finite rule, a matching ending is shown as the remaining scheduled
date count from the displayed due date; an off-pattern ending stays in On a date mode. Recorded history is unchanged.

Schedule fields and their ending save together in a single SQLite transaction or browser storage write. Failures
preserve both, including existing skips and pause controls. Imported schedules remain paused when their count changes.
Counts are stored as the inclusive schedule ending, so existing JSON exports/imports, calendars, forecasts and reminders
retain the finite boundary without a schema migration or new dependency. Updating date/frequency retains the existing
policy of clearing prior skips; changing only the count leaves skips intact.

Recurring POST/PUT payloads now optionally accept `repetitions` and `countFrom` (default: the schedule anchor), or an
`endDate` string/null. These ending choices are mutually exclusive. The server validates membership, integer limits,
calendar range and inclusive endings; omission of all ending fields preserves existing API behavior. Returned/stored
recurring rows do not include these temporary mutation fields; `/schedules` remains the persisted control boundary.

Rebuild/push frontend, backend and migrate images as **1.14.0**, then pull/up with the existing Compose project/volume.
The supplied Dockerfile and host ports 8081/5001 are unchanged. The delete-all and overwrite-import features remain
included from 1.13. Browser visuals and Docker/ARM64 execution remain unverified here.

## Version 1.13: confirmed deletion and overwrite imports

Open **Settings → Your data belongs to you → Delete all app data**. Opening the dialog only prepares a count review.
Check the irreversible-deletion acknowledgment and enter **DELETE** exactly, then choose **Delete all data permanently**.
Lowercase or padded words are rejected. Cancel makes no changes. A changed workspace or notification state requires a
new review and confirmation. Export a recovery copy first if you want to retain your financial data.

Deletion removes every account, transaction, recurring rule, budget, goal, receipt, reconciliation and import link,
plus notification subscriptions, reminder preferences, snoozes, attempts and delivery/test history. It leaves a blank
workspace, with no sample accounts restored. This browser's Folio appearance, notification state and install-prompt
preferences are cleared, while unrelated browser storage is untouched. Browser-level notification permission and
installation remain controlled by the browser. Server configuration/VAPID environment files and database migrations
are retained. Other devices' local browser preferences are not remotely cleared.

The server validates exact typed consent and acknowledgment, checks a revision including financial and notification
state, then deletes all user rows in one SQLite transaction. Any failure rolls back. Preview deletion validates the
same consent, rejects changed browser data and writes one blank financial snapshot before preference cleanup. A blocked
primary write keeps the previous data; optional cleanup/reload failures are reported separately from durable deletion.

**Actual Budget import → Import behavior** defaults to **Add to current data**. Choose **Overwrite current financial
workspace** to replace existing data, including edited/conflicting imported records. Check the selected scope and
compatibility exclusions, confirm EUR, then choose **Review overwrite**. The review shows every financial collection's
before/after count. Check the replacement acknowledgment, type **REPLACE** exactly and choose **Replace workspace**.
Anything absent from the selected Actual scope is removed, including old goals, receipts and reconciliation history;
unsupported schedules are not recreated. All imported schedules remain paused. Changing source, scope, mode or workspace
invalidates the applicable review/consent. Source controls lock while a replacement is being prepared or committed.

**Settings → Import workspace data** accepts Folio JSON exports and overwrites the financial workspace through the same
review and typed **REPLACE** confirmation. Both overwrite paths retain device registrations, notification preferences,
delivery history and appearance; server financial snoozes are cleared. Existing full-file/relationship validation,
revision checks, SQLite rollback and browser quota handling remain enforced. An invalid source never clears the target.

Rebuild/push the frontend, backend and migrate targets as **1.13.0**, then pull/up using the same Compose project and
SQLite volume. The supplied Dockerfile, ports 8081/5001, schema and dependencies are unchanged. No migration is needed.

## Version 1.12: Actual next due dates and editable schedule preview

Actual stores its original recurrence anchor separately from `schedules_next_date`. The importer now reads the current
next date, using local progress only when its revision matches the base revision. Earlier dates become reversible
skips unless a matching recorded payment already covers them. The original anchor and inclusive installment ending
remain intact; no date advancement creates a new payment or rewrites history. Completed finite schedules remain ended.
Missing progress tables retain the rule-based behavior. Invalid/off-pattern progress is an explicit schedule exclusion.

To repair an earlier import, open **Transactions → Import Actual Budget**, select the same ZIP, enable schedules and
review with **Actual importer 1.12.0**. The review lists advanced dates it will keep skipped, even when no new schedule is
needed. Download the review, acknowledge it and add the reviewed data. An unchanged repeat import adds no rows. Edited
imported identities still conflict; existing pause controls and recorded history remain untouched. You may restore an
imported skip in Recurring → Schedule controls. Re-importing that progress can add it again after another review.

**Recurring → Edit** now shows an enabled **Due date**, initialized to the earliest unconfirmed occurrence, and a live
**Scheduled dates** list of the next six unconfirmed dates, including overdue dates. Date/frequency changes update the
preview immediately. Paid and skipped dates are omitted; pause and inclusive ending controls remain visible. Saving an
unchanged due date preserves the original anchor. Changing the due date or frequency starts the new recurrence pattern
there and clears prior skips, matching the existing schedule-update policy. Recorded payments, pause and ending controls
remain unchanged. A due date after the ending is rejected; adjust the ending under Schedule controls first.

Both application images must be rebuilt for **1.12.0** because the normalized import contract now includes skipped dates.
Registry Compose defaults to 1.12.0, keeps ports 8081/5001 and uses the same SQLite volume. The supplied Dockerfile,
dependencies and persistent schema are unchanged; no database migration is needed.

## Version 1.11: calendar confirmation colors and recurring table

Calendar shows every recurring instance in the displayed month grid: **orange** for unconfirmed dates today or later,
**red** for overdue unconfirmed dates and **green** for recorded transactions. Confirming an occurrence shows its actual
posting once, preserving its recorded amount. Confirmed means recorded, independently of bank clearance. Desktop cells
show every event; phones show every status dot, with names and controls in the selected-day agenda. Status labels and
a legend accompany the colors. Open pages refresh their date when returning to the foreground and every minute.

Paused schedules remain visible for planning, with confirmation disabled until resumed. Skipped dates stay hidden and
inclusive ending dates remain respected. This display does not enable reminders, auto-post payments or change balances.

Recurring opens in **Table** view by default, one row per rule. Its default sort uses the unconfirmed occurrence closest
to today's local date, including past dates; equally close overdue dates come first. An overdue count remains visible
when the closest instance is in the future. Rules without unconfirmed dates sort last. Click Name, Amount or Closest
unconfirmed to change direction/order, or choose Cards. Expense labels are red and income labels green in both views.
Edit, confirmation, skip, pause/resume and ending controls remain available.

Rebuild/push **1.11.0** images and pull/up using the same Compose project and SQLite volume. Registry Compose defaults
to 1.11.0 with ports 8081/5001. The supplied Dockerfile, schema and dependencies are unchanged. The Actual decoder has
not changed; its separate **Actual importer 1.10.2** label remains correct.

## Version 1.10.2: source-aware import review

The import page now separates source compatibility from selected scope: supported/total schedules, selected schedules,
schedules with final payment dates and exact historical matches. Turning schedules off no longer looks like a decoder
failure. The page shows **Actual importer 1.10.2** so an old image or cached frontend is easy to identify.

Off-date source-linked payments keep their original recorded dates and amounts. Compatibility notes now count and
identify payments kept as ordinary postings. These do not mark a planned date paid in Folio. When adding schedules to an
older import, the review also counts existing unlinked postings that remain unchanged. Resolve those past planned dates
before enabling reminders; re-import never rewrites financial history to make a schedule appear paid.

In **Recurring → Schedule controls → Planned date to skip**, enter the original planned date already covered by a
recorded payment, then choose **Skip planned date**. This works while the schedule is paused. It suppresses that planned
date in calendar/forecast/reminder planning, preserves the recorded payment, validates occurrence membership and is
reversible with Restore. Review the skip list and then resume the schedule. No duplicate transaction is needed.

A supplied native export was verified locally through real file-backed SQLite import, reopen and repeat import.
All 15 schedules and 16 postings persist, all six installment end dates survive, both account balances reconcile and
re-import adds zero rows. The existing 1.10.1 parser already accepts all its schedules. The new review makes three
source-linked off-date payments explicit. Published code/tests use fictional data; the private export is never seeded
into the hosted preview or included in source/deployment packages.

Build/push the **1.10.2** frontend, backend and migrate images, then pull/up using the same Compose project and SQLite
volume. The supplied Dockerfile, ports 8081/5001, persistent schema and dependencies are unchanged.

## Version 1.10.1: Actual editor schedule compatibility

Actual's recurrence editor writes inactive `endDate`/`endOccurrences` fields even on schedules that never end, and
stores ordinary monthly dates as a single `day` pattern. The importer previously rejected these standard fields and
replaced the error with a generic message. It now reads these defaults, imports single monthly day patterns from 1–28,
normalizes the first matching date on or after the source start, and converts counted endings to exact inclusive end
dates. Weekly/yearly rules ignore inactive monthly patterns as Actual does. Estimates still require review and every
imported schedule starts paused. No financial history is rewritten.

Reload the updated app and choose the original ZIP again. The upload panel must show **Actual importer 1.10.2**.
If any schedule is still excluded, its reason now identifies the precise condition, action or date field. Expand the
exclusion list and choose **Download schedule diagnostics**: this local JSON contains only failed schedule definitions
(names, amounts, dates, rule fields and source identifiers), not transaction history, account balances or credentials.
Review it before sharing. You can obtain it before currency consent or import; oversized rules are explicitly omitted.

This patch preserves the supplied Dockerfile and existing database schema. Build/push frontend, backend and migrate
images tagged **1.10.2**, then pull/up using the same Compose project and SQLite volume. Both frontend and backend must
be updated because the review payload now permits optional schedule diagnostics. Ports stay 8081/5001.

## Version 1.10: compact checkboxes and recurring Actual imports

Checkboxes now use compact 20-pixel native controls. Text-field padding, full-width sizing and 44-pixel field height
no longer stretch them; their clickable labels retain a minimum 44-pixel height. Import consent rows, reconciliation,
selection and schedule toggles use the same sizing.

**Transactions → Import Actual Budget** now accepts exact, approximate and range amounts, exact or approximate date
matching, optional payees, native account/payee aliases, and safe plain category/notes actions. Approximate amounts
become fixed estimates; a range becomes its rounded midpoint using Actual's signed rounding. The review displays the
new recurring transactions, their dates, accounts, amounts and explanatory notes before acknowledgment. All start
**paused**. Open **Recurring** after import to edit amounts and resume schedules. Imported transfer schedules preserve
the direction between two imported accounts. This does not execute source rules or enable source auto-posting.

You can re-import an unchanged Actual export to add newly supported schedules to a previous migration. Existing
postings and their original schedule links stay intact, including older unlinked history; all other changed financial
fields still cause a conflict. Review past dates before resuming: previously unlinked payments can appear unpaid.
Unsupported recurrence semantics remain explicitly listed with reasons; see the compatibility table below.

The supplied `Dockerfile(1)` is used as `Dockerfile`, byte-for-byte. It already matched the previous Dockerfile.
Registry Compose now defaults to image tag **1.10.2**, retaining host ports **8081/5001** and the existing SQLite volume.
Rebuild and push frontend, backend and migrate targets before pulling this version on the Pi. No database migration
or new dependency is required. Docker/ARM64 execution and browser visual checks remain unverified here.

## Version 1.9: workspace import and browser/phone notifications

**Settings → Your data belongs to you → Import workspace data** accepts a Folio JSON export, including legacy raw
exports and the versioned `folio-workspace` envelope. The complete file is validated before a read-only review shows
before/after counts for every financial collection. Export the current workspace for recovery, check the explicit
replacement acknowledgment, then choose **Replace workspace**. This is a full financial replacement, not a merge.
Actual Budget native ZIP import remains available separately under Transactions → Import Actual Budget.

The server validates names, exact cents, dates, identities, account/category/schedule links, paid/skipped occurrences,
goal progress, both transfer clearance legs, statement balances, bank import fingerprints and attachment bytes.
Commit rechecks a SHA-256 revision against all current financial rows and the effective source, then replaces financial
rows in one SQLite transaction. Changed source/destination data and failed late writes cannot produce a partial import.
The preview uses the same review policy and one atomic browser storage write. No migration is needed.

All imported schedules are **paused**, retaining their end dates and skipped dates; review and resume them deliberately
in Recurring. Device subscriptions, reminder preferences, notification delivery history and appearance remain intact.
The server clears snoozes tied to the replaced schedules. The preview retains its separately stored notification state.
Limits: server 16 MiB normalized JSON / 8 MiB total receipts; preview 8 MiB JSON / 2 MiB total receipts; each receipt
512 KiB, five per transaction; 10,000 rows per collection. Oversized exports require a smaller JSON or a complete SQLite
recovery. A workspace JSON imports financial data, not server configuration or notification signing keys.

**Settings → Browser & phone notifications** now reports actual permission, this device's registration and the server's
subscription count. Enable each device independently. Permission is requested only from the explicit enable action,
before awaiting network work so the iOS user gesture is preserved. A stale browser flag does not indicate registration.
Use **Send test notification** on each device; provider acceptance is distinguished from actual OS display. Tests target
only the current previously registered device, use generic content, and have a persistent 30-second cooldown. Expired
subscriptions are removed. Disconnecting a device leaves all other subscribed devices in place.

Desktop and Android browsers with Web Push use an active service worker. On iPhone/iPad with iOS 16.4+, open the same
HTTPS app address, choose Share → Add to Home Screen, open that app, then enable notifications. The setup panel explains
HTTPS, denied permissions, missing server keys and installation requirements and can copy a reachable HTTPS app origin.
Both devices must use the same self-hosted server to share the budget; the hosted preview has separate browser-local
workspaces and foreground-only reminders. Foreground display uses service-worker notifications on mobile and records
success only after display resolves. Scheduled server Web Push continues when the page is closed, while the server runs.
OS permissions, Focus, connectivity and battery policies can suppress display; provider acknowledgment never means read.

Generate VAPID keys **once**, retain them across restarts, and set the server contact URI. The generator writes a new
owner-only file and refuses to overwrite an existing key file; it does not print the private key:

```bash
pnpm push:keys ./push.env mailto:you@example.com
```

Load the three values into the backend deployment environment. The frontend receives only the public key. The server
needs outbound HTTPS to the browser push providers. HTTPS must terminate at your existing reverse proxy, which forwards
to Folio's frontend; setting `PUBLIC_ORIGIN` alone does not configure TLS. The phone must trust the certificate and reach
that HTTPS address. An ordinary `http://192.168.x.x` address cannot enable phone Web Push. Keep the existing private
access/authentication arrangement; the application remains single-user.

### Raspberry Pi registry deployment

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
    --build-arg VERSION=1.14.0 \
    -t "192.168.1.11:5000/folio-${target}:1.14.0" \
    -t "192.168.1.11:5000/folio-${target}:latest" --push .
done
```

On the Pi, if keys have not already been configured, generate a new private file using the compiled backend image
(no host pnpm installation required). Replace the contact address first and preserve existing configured keys:

```bash
docker run --rm --entrypoint node --user "$(id -u):$(id -g)" \
  --volume "$PWD:/keys" \
  192.168.1.11:5000/folio-backend:1.14.0 \
  backend/dist/features/reminders/generatePushKeys.js /keys/push.env mailto:you@example.com
```

For an existing installation, stop the old writer and take a consistent SQLite backup before upgrading. Do not remove
volumes. Run the new registry Compose from the source directory, using the same project identity as before:

```bash
# If the old deployment uses docker-compose.custom.yaml:
docker compose -f docker-compose.custom.yaml down

# Set this to the real reachable HTTPS origin after configuring your reverse proxy.
export PUBLIC_ORIGIN=https://your-folio-host.example

docker compose --env-file push.env -f compose.registry.yaml pull
docker compose --env-file push.env -f compose.registry.yaml up -d
docker compose --env-file push.env -f compose.registry.yaml ps
```

If VAPID keys are already supplied by another environment file, use that file instead of generating `push.env`.
`FOLIO_REGISTRY`, `IMAGE_TAG`, `FRONTEND_PORT`, `BACKEND_PORT` and `PUBLIC_ORIGIN` can be overridden in the deployment
environment. For a plain-HTTP image registry, configure the Pi Docker daemon's insecure registries separately from
BuildKit. Docker builds, ARM64 execution and real-device push delivery are not claimed verified in this environment.

## Version 1.8: import Actual Budget

Open **Transactions → Import Actual Budget**, or `/import/actual`. In Actual, use **Settings → Export data** and select
its native ZIP containing `db.sqlite` and `metadata.json`. No Actual server address, password or API credential is needed.
Confirm that the source uses **EUR with two decimal places**; Folio does not detect or convert currencies. Review the
source/current/resulting all-recorded account balances, counts, exclusions and complete downloadable JSON before
acknowledging **Add reviewed data**. Choose whether to include monthly allocations and supported paused schedules.
Back up Folio before migration; there is no batch undo or two-way synchronization.

The native archive is decoded locally in a disposable Web Worker. Only validated normalized records go to the self-hosted
API; raw ZIP/SQLite bytes, account connection metadata and source credentials are never uploaded. The hosted preview
continues to save only in this browser, as its existing banner explains. The full Express application persists imports
in SQLite. Both adapters use the same additive plan, conflict checks and balance reconciliation. A failed commit leaves
the previous destination intact; a destination edit after review requires a new review. Existing transactions, receipts,
statements, goals and reminder preferences are preserved. No migration is needed for existing v1.7 databases.

| Actual data                            | Folio representation                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Accounts and starting-balance postings | Names prefixed `Actual ·`; starting amounts folded into opening balances                                     |
| Closed or off-budget accounts          | Ordinary manual accounts; source closed/off-budget behavior is not retained                                  |
| Payees, signed amounts, dates, notes   | Posting labels, positive income/expense amounts, civil dates and notes                                       |
| Split postings                         | Separate child postings with parent/child notes; grouping is not retained                                    |
| Reciprocal internal transfers          | One transfer with independent cleared flags on both account legs                                             |
| Categories                             | Flat catalog; hidden custom categories archived; built-in names reused                                       |
| Long or duplicate category names       | Stable suffixes within 40 characters; original names in review mappings                                      |
| Reconciled or cleared entries          | Cleared flags; no invented reconciliation statements or locks                                                |
| Nonnegative expense allocations        | Monthly overrides, including explicit zero; rollover disabled                                                |
| Simple schedules                       | Exact amounts or reviewed approximate/range estimates; one-time, weekly, monthly day 1–28 or ordinary yearly |

Imported schedules are **paused**; safe plain category and notes actions carry over, otherwise category is `Other`.
They send no reminders while paused and never auto-post. Review them in Recurring before resuming; reminder lead time
defaults to zero. Exact account conditions are required; payees are optional. Internal transfer schedules require two
available distinct accounts. Exact and approximate date conditions share the source date anchor, but Actual's matching
tolerance is not recreated. Exact and approximate amounts use the source value; same-sign nonzero ranges use the signed
rounded midpoint. Estimates and range endpoints remain in the schedule notes and complete review download.

Supported rules use interval one, no patterns or a single monthly day from 1–28, and no weekend shifting.
They may repeat indefinitely, end on an inclusive date or stop after up to 5,000 payments. Daily/custom intervals, month-end/leap-day rules, missing accounts, zero/cross-zero amount
ranges, extra conditions and complex/template/formula actions are excluded with reasons. Plain set actions must leave
the scheduled account, payee and amount unchanged. This preserves the source semantics rather than inventing dates.
Historical schedule links are retained only for matching exact dates, amounts, types and account legs. Other history
remains as ordinary postings. Adding a newly supported schedule never retroactively rewrites older imported postings.
Audit timestamps use zero to indicate an unknown original creation time rather than inventing one.

Groups, bank connections, tags, rules, reports, attachments, goal formulas and carryover are not migrated. Negative,
income and obsolete-category allocations and zero-value postings are counted as exclusions. Existing archived built-in
category semantics cannot be represented. Unsupported or damaged financial fields, inconsistent splits/transfers and
balance discrepancies block the whole import. Names over 100 characters and notes over 1,000 characters block rather than
being silently truncated (category catalog names are adapted as described above).

Stable UUIDv5 identities use Actual's cloud file ID when available, otherwise its local budget ID, plus record type and
original ID. The same unchanged export with the same scope adds nothing on repeat. Edited previously imported records,
changed openings or allocation conflicts block rather than overwrite; clearing and pause choices made after import are
preserved. Keep the same budget identity when importing later exports. Existing unlinked history can remain unlinked
while adding schedules; omitting previously imported links or changing existing schedule definitions still conflicts. A reset/cloned source budget
with a different identity is a different import; overlapping CSV/manual imports are not automatically matched.

Limits: 25 MiB ZIP, 64 MiB expanded SQLite, 64 KiB metadata, one budget pair, 200 archive entries, 500 accounts,
10,000 live rows per source table, 8 MiB normalized API payload and a 30-second decoder deadline. No exported SQL or
views are executed; only allowlisted physical tables are queried read-only. The decoder/WASM are bundled and precached.
Nginx allows same-origin WebAssembly through `wasm-unsafe-eval` and accepts the bounded import body.

Pinned development/build additions: `sql.js` 1.15.0 reads only the transient user-selected source snapshot; it is not a persistence database.
`fflate` 0.8.3 decodes bounded ZIP streams; `uuid` 14.0.3 creates stable namespaced import IDs; `@types/sql.js` 1.4.11 provides
types. Source format and real export compatibility are checked against the official Actual schema and public demo ZIP.
See [Actual backup documentation](https://actualbudget.org/docs/backup-restore/backup/),
[API export reference](https://actualbudget.org/docs/api/reference/) and [public demo source](https://github.com/actualbudget/wrapped).

## Version 1.7: reviewed bulk transactions

Open **Transactions**, choose the month and filters, then select individual rows or the first 100 editable entries in
that view. Changing text, type, account, category or month clears selection and any old review, so hidden rows never
remain selected. Entries reconciled on either account leg are visibly protected and cannot be selected. Single-entry
editing remains available; batch processing disables the current view's row controls while it works.

Choose **Change category** and an active catalog value, or **Delete transactions**, then **Review selected transactions**.
Review is read-only and lists exact names, dates, accounts, transfer destinations, types, categories and amounts.
Categorization changes only the category; amounts, notes, dates, audit timestamps, recurring links and supporting
metadata stay intact. It does not rewrite a recurring rule's future category. Archived names remain in history but
cannot be chosen as a new batch target.

Deletion requires a separate acknowledgment and final permanent-delete button. The review identifies affected receipts,
import identities and recorded recurring payments. Deleting a transfer removes both account legs. Receipts, clearance
flags and import links cascade with their owning posting, so imported entries may be imported again. Deleting a recorded
recurring payment makes its date unpaid again; calendar/upcoming views and reminders may show it subject to schedule
controls and existing delivery history. Account opening balances, schedules and unselected actual rows are preserved.

The server rechecks every selected posting, its metadata and reconciliation lock within the same SQLite transaction as
all writes. Missing, edited, newly locked or otherwise stale selections reject the entire batch; storage failures roll
back all changes and cascades. An archived target also blocks commit. The preview re-reads current local data and writes
one replacement snapshot, preserving storage if the write fails. Refreshing the workspace invalidates a displayed
review. If a server response is lost, refresh the ledger before reviewing a new batch; no background retry is attempted.
There is no bulk undo operation. This release adds no database migration or dependency.

## Version 1.6: flexible reports

Open **Reports** to select a calendar month, calendar year or custom inclusive date range. Filter by account and exact
category, including archived categories with recorded history. The same filters apply to both comparison periods,
summary cards, cash-flow bars, category rows and downloads. Transfers, opening balances and unpaid schedules are
excluded; this is recorded cash flow, not the current account balance. Future-dated actual postings count on their
recorded dates. Categories with spending only in the previous period remain visible with a current amount of zero.

Monthly reports compare the full previous calendar month; yearly reports compare the full previous calendar year.
Custom reports compare the immediately preceding equal number of calendar days. UTC civil-date arithmetic preserves
leap days and avoids daylight-saving shifts. Calendar comparisons use whole periods even when the selected period is
still in progress. Signed money differences are always shown; relative percentages appear only with a positive
previous value. Custom ranges are limited to 3,660 days, with real dates required between 1901 and 9998.

Changing a report selection records its date and scope defaults in the URL so the resulting link can be bookmarked.
Unavailable bookmarked accounts/categories stay visible with an empty result instead of silently widening the scope.
**Export report CSV** includes both date ranges, account/category scope, totals and category comparisons, including
previous-only categories. **Export transactions CSV** contains the selected period's matching income/expense postings.
User-provided text is quoted and protected against spreadsheet formula execution. Cash-flow bars show days for ranges
up to 31 days, and months for longer ranges, with exact amounts and zero-activity intervals in a scrollable table.

This release requires no database migration or new dependency. Existing SQLite and browser-local data are retained.

## Version 1.5: recurring-payment controls

Open **Recurring → Schedule controls** to pause a rule or set its last allowed payment date. The end date is inclusive
and cannot precede the original start. Clear it to remove the limit. Pausing suppresses unpaid dates without changing
the rule's anchor or deleting recorded payments. Resuming makes unpaid dates eligible again, including overdue dates;
reminder follow-ups still respect the configured overdue window. The normalized expense rate excludes paused/ended
rules and remains a run-rate estimate; individual skipped dates are reflected in forecasts instead.

Choose **Skip this occurrence** on a recurring card or a calendar agenda item to suppress one unpaid date. The next
date retains the original weekly/monthly/yearly rhythm. Restore skipped dates under Schedule controls; pause/end-date
rules continue to apply after restoration. Paid dates cannot be skipped. Calendar views, forecasts, upcoming lists,
calendar exports and both reminder adapters use the same effective schedule policy. Previously imported calendar
files remain independent copies: re-export/import when a rule or control changes.

The server checks posting eligibility inside the same SQLite transaction that returns or creates the occurrence's
single recorded payment. An acknowledged payment retry still returns its original posting after pause/end changes.
Reminder scans recheck current settings before each provider call, so a pause/skip/payment during an earlier send can
suppress later queued jobs. A notification already handed to the provider cannot be recalled. Restoring a date does
not reset existing notification acknowledgments or snooze windows.

Changing a rule's start date or frequency clears its skipped-date exceptions; changing its name, amount, category or
notes preserves them. An end date must be adjusted before moving the start beyond it. Deleting the rule removes its
controls and skips while retaining actual history. Financial exports and preview backup restore include both new
collections, with referential/date validation. Earlier backups default to empty controls and exception lists.

This release also fixes preview edits to retain actual postings' audit timestamps and recurring links. New manual
accounts and schedules no longer acquire transaction-only audit fields, and backup restore normalizes those known
legacy preview fields so existing exports remain usable.

For a self-hosted upgrade, stop the backend, take a consistent SQLite backup, run `pnpm db:migrate` and `pnpm db:check`,
then restart. Additive migration `0004_redundant_santa_claus.sql` adds two metadata tables without rewriting financial
history. No dependency was added.

## Version 1.4: supporting documents and preview recovery

Open a saved actual transaction to attach **PNG, JPEG or PDF receipts** alongside its notes. Each file is limited to
512 KiB, with at most five per transaction. SQLite workspaces allow 8 MiB of total file bytes; the device-local preview
allows 2 MiB and remains subject to browser storage availability. File bytes, canonical base64, declared size, media
signature and portable filename are validated before writes. Upload UUIDs make acknowledged retries safe. Files save
immediately when attached, can be downloaded, and are removed when the owning transaction is deleted. Downloads use
opaque attachments rather than embedding documents in the application. Type/signature checks are not a malware scan.

Reconciled entries retain downloadable receipts but cannot add or remove them until their statement locks are undone.
Schedules and new unsaved entries do not hold files. Duplicating a transaction starts a new entry without its receipts.
The API stores bytes in SQLite, so consistent online database backups include them. List endpoints return metadata
only, and original file paths are never uploaded.

**Settings → Export workspace** now creates a versioned JSON financial snapshot including receipts. The self-hosted
server reads all exported collections in one SQLite transaction and excludes subscriptions, delivery credentials and
notification settings. The device-local preview can also **review and restore** this JSON, or legacy raw Folio exports.
Selecting a file performs no writes. The review shows replacement counts; the final action replaces this preview's
financial data rather than merging it. Export the current preview first if a recovery copy is wanted. A change to the
preview after review blocks the replacement until the backup is selected and reviewed again.

Restore checks structure, UUID uniqueness, integer money, real dates, transfers, account/category/schedule links,
goals, reconciliation identities and balances, bank-import identities, receipt payloads and preview quotas. It accepts
files up to 8 MiB with at most 10,000 rows in each collection and 2 MiB of receipt bytes. Failed validation or browser
quota writes preserve the previous stored workspace. Notification settings, delivery history and appearance remain
on the device. The full app exports portable JSON but restores complete SQLite backups using the server recovery steps;
Version 1.9 adds reviewed financial JSON import on the server; use a complete SQLite backup for infrastructure recovery.

For self-hosted upgrades, stop the backend, take an online SQLite backup, run `pnpm db:migrate`, then `pnpm db:check`
and restart. Additive migration `0003_freezing_brother_voodoo.sql` adds only the receipt table and its index. Existing
financial tables are retained. No dependency was added.

## Version 1.3: budget copying and category workflows

Open **Budgets → A head start for this month** to reuse another month's allocations and rollover settings. Choose a
source month, then review every category before copying. The default keeps existing destination overrides and fills
missing categories. The optional replacement mode updates matching categories only; destination-only categories stay
intact. Archived categories are skipped. Zero allocations are copied explicitly. Spending, carried balances, goals,
account balances and transactions are never copied. Carry continues to be calculated from actual expense history.

The source uses its exact-month overrides and original baseline limits for otherwise unconfigured categories.
Changes to source allocations, relevant destination overrides or archived states invalidate the review. Refresh the
review before saving; the server applies a current batch in one SQLite transaction, with a limit of 500 categories.
The preview adapter uses the same calculation and persists its complete snapshot only after successful validation.
The review revision describes the reviewed values; it is a concurrency check, not an authorization credential.

On **Transactions**, select a category alongside account, type and text filters. Archived historical names remain
available and carry an archived label. Category matching is exact. Totals and CSV export follow the visible selection.
Category and account scopes are preserved together in URL query parameters so the filtered view can be bookmarked.

Transaction entry labels retained archived categories clearly. Editing an existing posting can keep its historical
category, while duplicating it requires an active category or restoring the archived category in Settings. The editor
explains this before attempting a save and preserves the open form for correction.

This release changes no schema or dependencies. Existing v1.2 databases and browser-local workspaces are compatible.

## Version 1.2: monthly planning and savings goals

- **Budgets** now saves an allocation for the selected month only. Editing October never changes September or November's
  allocation. Original category limits remain the baseline for unconfigured months; the legacy `/budgets` API remains
  available for compatibility. Set an exact-month allocation to zero to pause a category without deleting its history.
- Each monthly allocation can **carry positive unused funds into the next month**. The next month shows its allocation
  and carry separately. Enable rollover there as well to continue carrying. Missing/disabled months stop further carry;
  overspending never creates negative carry. Income, transfers and unpaid schedules do not count as spending. Editing
  a historical allocation or expense recalculates dependent carry, while other months' allocations remain unchanged.
- Create **savings goals** beneath the spending plan: name, target amount and optional target date. Record saved amounts
  or withdrawals, inspect the dated progress journal, edit targets, and archive/restore goals. Progress cannot go below
  zero or above the supported money range. A request UUID makes retries idempotent. Goal records are manual planning
  bookkeeping: they do not create transactions, transfer money, reserve account funds or enforce exclusive allocation
  between goals. Record real account transfers separately. The suggested monthly pace divides remaining money by the
  inclusive number of calendar months through the target; it is a calculation, not a forecast of available income.
- **Settings → Categories** creates custom names used in transaction entry, spending plans, reports and mapped CSV
  imports. Names are immutable and case-insensitive duplicates are rejected. Archive/restore custom categories to
  preserve historical references. Archived names are hidden for new transactions; unchanged historical categories may
  be retained while editing an existing record, and already-created schedules can still post. Restore a category before
  assigning it to a new record. Built-in categories remain available. Custom names use the neutral Other icon/color.
- Transaction entry suggests up to 30 recent merchant names. An exact name match of the same transaction type suggests
  its latest category/account, until you explicitly choose those fields. Amounts and dates remain yours to enter.
  Open an actual transaction and choose **Duplicate transaction** to copy its fields into a new entry dated today.
  Saving creates a fresh ID with no recurring or reconciliation link and leaves the original entry intact.

For a self-hosted upgrade, stop the backend, take an online SQLite backup, run `pnpm db:migrate`, then `pnpm db:check`
and restart. Migration `0002_late_amazoness.sql` adds four tables; it does not rebuild or alter existing tables.
A populated v1.1 migration is tested. Existing preview data keeps the same storage key, and new planning metadata is
added only as used. Export includes all planning records. Start fresh clears goals and custom categories as well.

## Version 1.1: forecasting, statements and reminder control

- Open **Forecast** from the overview's “A little further ahead” card or the Transactions workflow buttons.
  Choose 30, 60 or 90 days, one account or all accounts, a low-balance threshold, and whether to include overdue
  payments today. The forecast shows actual opening money, projected ending/minimum balances, first warning dates,
  per-account shortfalls, exact contributing events and CSV export. It includes future-dated actual postings once,
  excludes already-paid planned occurrences, and applies both transfer legs correctly. Actual total balances now
  exclude future-dated postings until their recorded date. Forecasts assume known schedules happen at their current
  amounts; unscheduled spending and unentered income are not predicted. Daily endings do not guarantee intraday liquidity.
- Open **Transactions → Import statement**. Raw CSV/TSV files remain in the browser. Upload up to 500 rows / 1 MiB,
  choose the account, review column mappings, explicitly choose date format, decimal convention and expense sign,
  then review every row before committing. CSV supports BOM, quoted delimiters, escaped quotes, multiline fields,
  CRLF, comma/semicolon/tab delimiters, bank IDs and optional categories/notes/currency/type. Only EUR is supported.
  Malformed dates, amounts, grouping, unsupported currencies and invalid rows block review; nothing disappears silently.
- Import review suggests manual matches within three calendar days for the same signed account movement, including
  existing transfers. A match keeps the original posting's date, amount, category and transfer identity; the bank
  reference is attached and only the selected account leg is marked cleared. Both sides of one transfer can match
  their respective bank statements. Ambiguous matches default to Skip. The user can explicitly import as new instead.
  Stable bank IDs deduplicate retries and overlapping files. Without a bank ID, matching date/type/amount/normalized
  description creates a fingerprint: identical same-day purchases require distinct mapped IDs or manual entry.
- Import commits run in one synchronous SQLite transaction, revalidate chosen matches, and skip fingerprints already
  imported or repeated in the file. Any stale match rolls back the entire commit. Server JSON bodies are bounded at
  2 MiB to accommodate the capped normalized batch. The ledger and metadata reload after success.
- Open **Transactions → Reconcile account**. Enter the statement ending date/balance, then clear matching movements.
  Exact integer-cent agreement is required; no automatic balancing adjustment is invented. Clearing is per account,
  so transfers clear independently. Completed statements lock their postings against edit/delete/unclear actions.
  Undo only the latest statement for that account to release its locks while retaining cleared flags. History is
  chronological, and each account's next statement must have a later ending date.
- Open the bell popover → **Timing, snoozes & overdue payments**, or use the link under Settings → Browser & phone notifications.
  Save an IANA timezone, local delivery time, individual versus daily-digest mode and a 0–30-day overdue follow-up
  window. Upcoming, due-today and overdue reminders are distinct phases; unpaid overdue items can follow up daily.
  Snooze one occurrence for 1 or 24 hours without moving its financial due date. Paid occurrences never generate jobs.
- The reminder center shows the latest 20 delivery attempts. “Sent” means the browser or push service accepted the
  notification; it is not a read receipt. Server attempts persist across restarts, retry at most three times per job
  with a 15-minute interval, and remove subscriptions on provider expiry. Timing uses Intl timezone rules, including
  DST. A daily digest is sent at most once per local calendar day. A snooze does not extend the overdue follow-up window.

Upgrade a self-hosted v1 database by stopping the backend, taking a backup, running `pnpm db:migrate`, checking
readiness, and restarting. Migration `0001_tearful_surge.sql` adds six metadata tables without rebuilding or changing
any existing money/schedule table. Populated-v1 upgrade coverage verifies balances, recurring links and foreign keys.
The preview preserves existing v1 browser data and adds statement metadata only when used. No dependency was added.
The malformed original development-watch command was also corrected to `node --watch --import tsx`.

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

The self-hosted backend supports Web Push while the page is closed. Configure both VAPID keys and an operator contact:

```bash
pnpm push:keys ./push.env mailto:you@example.com
```

Put the values in the untracked `.env`, restart the backend, build/serve the PWA over HTTPS, then choose **Enable this device** under Settings → Browser & phone notifications. Permission is requested only after that button action. This browser's subscription is stored
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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional push configuration; keep private key secret                   |
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
container configuration has not been executed. See `VALIDATION.md` for every unverified check.

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
alternatives are listed in `VALIDATION.md`. No console override is needed because the application uses pino.

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

Read `VALIDATION.md` for executed commands and exact gaps. This is a functional self-hosted personal-budget codebase
plus an isolated hosted preview. It has not been certified for public multi-user production hosting, browser-level
accessibility, real-device installation, background push delivery or container runtime behavior.
