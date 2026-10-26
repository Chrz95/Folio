# Folio

**Your money, your schedule, your own server.**

Folio is a self-hosted personal budget manager that brings everyday transactions, recurring bills,
spending plans and payment reminders into one place. See where your money goes, what is coming next,
and how your balance could change over the weeks ahead.

Built for desktop and mobile, with a calendar for upcoming payments and a clear view of your financial history.

[Features](#what-you-can-do) · [Getting started](#getting-started) ·
[Import your data](#bring-your-existing-budget) · [Documentation](#documentation)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Q1J229F1AG)

## What you can do

### Track everyday finances

- Record **income, expenses and transfers** across multiple accounts.
- Search transactions and filter by month, account and transaction type.
- Create your own spending categories, duplicate transactions and use recent merchant suggestions.
- Attach **PNG, JPEG or PDF receipts** to saved transactions.
- Review bulk category changes or deletions before applying them.
- Export your filtered transaction history to CSV.

### Plan recurring bills and paydays

Manage subscriptions, rent, installments, salary and other scheduled payments alongside one-time plans.

- Schedule **weekly, monthly or yearly** transactions, with an editable due date and upcoming-date preview.
- Repeat indefinitely, end on a chosen date, or set a **custom number of repetitions**.
- Keep month-end dates consistent: a January 31 schedule returns to March 31 after February.
- Confirm a payment manually, skip an occurrence, restore skipped dates, or pause a schedule.
- Enable **automatic confirmation on the due date** for individual schedules.
- Use the default sortable **table view**, ordered by the unconfirmed occurrence closest to today,
  or switch to cards. Sort every data column in either direction, including frequency, remaining count and status. See the **remaining unconfirmed count** for each finite schedule, or **∞** for one with no end date or repetition limit. On mobile, table rows become labelled, stacked entries.

Automatic confirmation records a transaction in your ledger. It does not initiate a bank payment.

### See every payment on a calendar

View recorded transactions and each recurring occurrence together in a monthly calendar.
Select a day to see its agenda and manage planned payments.

| Color     | Meaning                                |
| --------- | -------------------------------------- |
| 🟠 Orange | Unconfirmed payment due today or later |
| 🔴 Red    | Overdue, unconfirmed payment           |
| 🟢 Green  | Confirmed, recorded transaction        |

Status labels accompany the colors. Upcoming plans affect forecasts; they change account balances when recorded.

### Budget, forecast and understand your spending

- See account balances, monthly income, expenses, net savings and upcoming payments on the overview.
- Set **monthly category budgets**, adjust individual months and optionally carry positive balances forward.
- Track savings goals with manual progress updates.
- Explore **30-, 60- or 90-day balance forecasts**, including low-balance warnings and contributing payments.
- Compare spending over a month, year or custom date range, filtered by account and category.
- Export reports, matching transactions and forecasts to CSV.

Forecasts use the transactions and schedules you have entered; they do not predict unrecorded spending.

### Get reminders on your browser and phone

- Receive upcoming, due-today and overdue payment reminders.
- Choose your **time zone, delivery time and individual or daily-digest notifications**.
- Snooze an occurrence for one hour or 24 hours without changing its due date.
- Enable each device independently and send a test notification from Settings.
- Export upcoming payments to an **ICS calendar file** with reminder alarms.

The self-hosted backend supports background Web Push while the page is closed and automatically creates and
persists its notification signing keys. Enable notifications under
**Settings → Browser & phone notifications → Enable this device**.

Phone push requires trusted HTTPS, a supported browser and notification permission. On supported iPhones and iPads,
install Folio on the Home Screen first. The server must remain running; delivery depends on browser and OS policies.

## Bring your existing budget

### Import from Actual Budget

Open **Transactions → Import Actual Budget** and select a native Actual export ZIP.
Review the data and compatibility report before committing the import.

- Import accounts, income, expenses, transfers, categories and cleared flags.
- Optionally import supported monthly budget allocations and recurring schedules.
- Preserve supported schedule due dates and finite endings.
- Choose **Add to current data** or review an **overwrite** of the financial workspace.
- Re-import an unchanged export without adding duplicate records.

The ZIP is decoded locally in your browser; only validated normalized records are sent to your Folio server.
Unsupported schedules and other exclusions appear in the review. Actual's bank connections, rules and every advanced
schedule pattern are not migrated. Folio currently supports **EUR**, without currency conversion.

Imported schedules start **paused**, with automatic confirmation disabled, so you can review dates and history before
resuming them under **Recurring → Schedule controls**.

### Statements and Folio workspace files

- Import **CSV or TSV bank statements** with column mapping, date/amount settings and a row-by-row review.
- Review suggested matches to existing transactions and detect previously imported statement entries.
- Reconcile account balances against statements, with completed reconciliations protecting their transactions.
- Export a portable **Folio JSON workspace**, including receipts, and restore it through a reviewed replacement import.

Workspace replacement requires an acknowledgment and typing **REPLACE**. Deleting all app data is a separate Settings
flow that requires confirmation and typing **DELETE**.

## Built for your own setup

- **Self-hosted storage:** financial data lives in SQLite on your server.
- **No bank connection required:** enter transactions yourself or import statements.
- **No third-party analytics.**
- **Mobile-friendly interface:** responsive layouts, touch-sized actions and light, dark or system appearance.
- **Installable PWA:** launch Folio from your desktop or phone's home screen on supported browsers.
- **Docker deployment:** separate frontend, backend and migration targets, with an ARM64 registry configuration
  for Raspberry Pi deployments.

Folio is a **single-user application** with no built-in login. Use a trusted local environment or protect remote
access with an authentication proxy or VPN and HTTPS. Financial API data is not cached for offline editing.

## Getting started

### Docker from source

Requires Docker Engine, BuildKit and Docker Compose 2.20 or newer. From the repository root:

```bash
docker compose --profile app build
docker compose --profile app up -d
```

Open **http://localhost:8080**. The migration service prepares SQLite before the backend starts, and the named volume
keeps your data across normal container shutdowns. Keep the supplied directory layout for the nginx configuration.

To use a different frontend port:

```bash
FRONTEND_PORT=8081 PUBLIC_ORIGIN=http://localhost:8081 docker compose --profile app up -d
```

Ports bind to loopback by default. For phone or remote access, configure your private access and HTTPS reverse proxy;
`PUBLIC_ORIGIN` must match the address used in the browser and does not configure TLS itself.

For ARM64 images, a private registry and the supplied Raspberry Pi configuration, see the
[deployment guide](docs/OPERATIONS.md#raspberry-pi-images-and-registry-deployment).

### Local development

Use **Node.js 24.19.x** and **pnpm 11.25.0**:

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:check
pnpm dev
```

Open **http://localhost:5173**, add an account in Settings, and start recording transactions.

## Documentation

| Guide                                      | Contents                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [Setup and operations](docs/OPERATIONS.md) | Configuration, Docker and Raspberry Pi deployment, backups, API, reminders and development conventions |
| [Release notes](RELEASE-NOTES.md)          | Release history and upgrade information                                                                |
| [Validation](VALIDATION.md)                | Completed checks and remaining verification gaps                                                       |

The browser-only demo uses a separate local workspace with sample data and foreground reminders.
Deploy the full backend for shared access to your own workspace and background notifications.
Docker/ARM64 runtime behavior and real-device push delivery have not yet been verified in the build environment.

## Technology

**React · TypeScript · Vite · Express · SQLite · Drizzle ORM · Web Push · Docker**

Money is stored as integer cents. The frontend and backend share a single root package manifest and lockfile.

## Support Folio

If Folio helps you manage your budget, you can support its development on Ko-fi.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Q1J229F1AG)
