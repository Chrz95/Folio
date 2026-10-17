import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { readActualZip } from './actualZip';
import { readActualDatabase } from './readActualDatabase';
/** Decode the source off the UI thread; only normalized approved fields leave this worker.
 * @param {MessageEvent<ArrayBuffer>} event - Selected bytes. @returns {Promise<void>} Worker reply. */
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const native = readActualZip(new Uint8Array(event.data));
    const SQL = await initSqlJs({
      /** Resolve the pinned bundled WebAssembly asset. @returns {string} Same-origin WASM URL. */
      locateFile: () => wasmUrl,
    });
    const database = new SQL.Database(native.database);
    try {
      self.postMessage({ file: readActualDatabase(database, new TextDecoder().decode(native.metadata)) });
    } finally {
      database.close();
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unable to read this Actual export.' });
  }
};
