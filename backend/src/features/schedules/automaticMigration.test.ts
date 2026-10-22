import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { openDatabase, verifySchema } from '../../db/client.js';
import { applyMigrations } from '../../db/migrations.js';
import { accounts, recurring, transactions } from '../../db/schema/budget.js';
import { scheduleSettings, skippedOccurrences } from '../../db/schema/schedules.js';
describe('migration from populated Folio 1.14', () => {
  it('preserves pauses, endings, skips and paid history and defaults every schedule to manual', () => {
    const root = resolve('.test-data');
    mkdirSync(root, { recursive: true });
    const directory = mkdtempSync(join(root, 'auto-upgrade-'));
    if (directory === root || relative(root, directory).startsWith('..')) {
      throw new Error('Unsafe cleanup');
    }
    const client = openDatabase({ filePath: join(directory, 'legacy.sqlite'), busyTimeout: 0 }, true);
    try {
      const folder = join(directory, 'migrations');
      cpSync(resolve('backend/src/db/migrations'), folder, { recursive: true });
      const journalFile = join(folder, 'meta/_journal.json');
      const journal = JSON.parse(readFileSync(journalFile, 'utf8'));
      journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 5);
      writeFileSync(journalFile, JSON.stringify(journal));
      migrate(client.database, { migrationsFolder: folder });
      const accountId = '11111111-1111-4111-8111-111111111111';
      const id = '22222222-2222-4222-8222-222222222222';
      client.database.insert(accounts).values({ id: accountId, name: 'Keep', openingBalance: 1234 }).run();
      const rule = {
        id,
        name: 'Keep schedule',
        amount: 500,
        type: 'expense' as const,
        category: 'Housing',
        accountId,
        destinationAccountId: null,
        date: '2026-01-31',
        notes: '',
        frequency: 'monthly' as const,
        reminderDays: 0,
      };
      client.database.insert(recurring).values(rule).run();
      client.sqlite
        .prepare('INSERT INTO schedule_settings (recurring_id, is_paused, end_date) VALUES (?, ?, ?)')
        .run(id, 1, '2026-12-31');
      client.database.insert(skippedOccurrences).values({ recurringId: id, date: '2026-02-28' }).run();
      client.database
        .insert(transactions)
        .values({ ...rule, id: '33333333-3333-4333-8333-333333333333', recurringId: id, createdAt: 1 })
        .run();
      applyMigrations(client);
      verifySchema(client);
      expect(client.database.select().from(scheduleSettings).get()).toEqual({
        recurringId: id,
        isPaused: true,
        endDate: '2026-12-31',
        autoConfirm: false,
        autoConfirmFrom: null,
      });
      expect(client.database.select().from(transactions).get()?.recurringId).toBe(id);
      expect(client.database.select().from(skippedOccurrences).all()).toEqual([
        { recurringId: id, date: '2026-02-28' },
      ]);
      expect(client.database.select().from(accounts).get()?.openingBalance).toBe(1234);
      expect(client.sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(() => client.sqlite.prepare('UPDATE schedule_settings SET auto_confirm = 1').run()).toThrow();
      expect(() => client.sqlite.prepare('UPDATE schedule_settings SET auto_confirm = 2').run()).toThrow();
      applyMigrations(client);
      expect(client.database.select().from(transactions).all()).toHaveLength(1);
    } finally {
      client.sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
