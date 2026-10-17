import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/client.js';
import { customCategories } from '../../db/schema/planning.js';
import { CATEGORIES } from '../budget/budget.constants.js';
import { AppError } from '../../lib/errors/AppError.js';
import { HTTP } from '../../constants/http.constants.js';
/** Accept active catalog values or the unchanged category on an existing record.
 * @param {DatabaseClient} client - SQLite connection. @param {string} name - Exact catalog name.
 * @param {string} previous - Existing category retained during editing. @returns {void} Throws on invalid names. */
export function requireCategory(client: DatabaseClient, name: string, previous?: string) {
  if ((CATEGORIES as readonly string[]).includes(name) || name === previous) {
    return;
  }
  const category = client.database.select().from(customCategories).where(eq(customCategories.name, name)).get();
  if (!category || category.isArchived) {
    throw new AppError(HTTP.badRequest, 'INVALID_CATEGORY', 'Choose an active category from your settings.');
  }
}
