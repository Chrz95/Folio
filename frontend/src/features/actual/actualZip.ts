import { Unzip, UnzipInflate } from 'fflate';
import { ACTUAL } from './actual.constants';
/** Extract one native budget pair with limits on actual inflated output and entry count.
 * @param {Uint8Array} bytes - Selected ZIP. @returns {object} SQLite and metadata bytes. */
export function readActualZip(bytes: Uint8Array) {
  if (bytes.length > ACTUAL.zipBytes) {
    throw new Error('Choose an Actual ZIP of up to 25 MiB.');
  }
  const selected = new Map<string, Uint8Array>();
  let entries = 0;
  const unzip = new Unzip((file) => {
    entries += 1;
    if (entries > ACTUAL.entries) {
      throw new Error('The ZIP contains too many files.');
    }
    if (!/(^|\/)(db\.sqlite|metadata\.json)$/.test(file.name)) {
      return;
    }
    if (selected.has(file.name)) {
      throw new Error('The ZIP contains duplicate budget files.');
    }
    selected.set(file.name, new Uint8Array());
    if (selected.size > ACTUAL.nativeFiles) {
      throw new Error('Choose an export containing one budget.');
    }
    const limit = file.name.endsWith('db.sqlite') ? ACTUAL.databaseBytes : ACTUAL.metadataBytes;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        throw error;
      }
      size += chunk.length;
      if (size > limit) {
        file.terminate();
        throw new Error('The expanded budget exceeds the import limit.');
      }
      chunks.push(chunk);
      if (final) {
        const output = new Uint8Array(size);
        let offset = 0;
        for (const part of chunks) {
          output.set(part, offset);
          offset += part.length;
        }
        selected.set(file.name, output);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += ACTUAL.chunkBytes) {
    unzip.push(bytes.subarray(offset, offset + ACTUAL.chunkBytes), offset + ACTUAL.chunkBytes >= bytes.length);
  }
  const database = [...selected.keys()].find((name) => name.endsWith('db.sqlite'));
  const metadata = database?.replace(/db\.sqlite$/, 'metadata.json');
  if (!database || !metadata || !selected.get(database)?.length || !selected.get(metadata)?.length) {
    throw new Error('Choose an Actual export with db.sqlite and metadata.json in the same folder.');
  }
  return { database: selected.get(database)!, metadata: selected.get(metadata)! };
}
