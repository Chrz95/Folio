import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actualFixture } from '../../../../scripts/actualFixtures';
import { convertActual } from './convertActual';
import { readActualFile } from './actualFile';
import { ACTUAL } from './actual.constants';
const file = convertActual(actualFixture(), JSON.stringify({ id: 'worker-fixture', budgetName: 'Worker fixture' }));
const worker = {
  onmessage: null as ((event: { data: unknown }) => void) | null,
  onerror: null as (() => void) | null,
  terminate: vi.fn(),
  postMessage: vi.fn(),
};
beforeEach(() => {
  worker.onmessage = null;
  worker.onerror = null;
  worker.terminate.mockClear();
  worker.postMessage.mockReset();
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        return worker;
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('bounded native import worker controller', () => {
  it('transfers the selected bytes, validates the reply and terminates the worker', async () => {
    worker.postMessage.mockImplementation(() => worker.onmessage?.({ data: { file } }));
    await expect(readActualFile(new File(['zip'], 'actual.zip'), new AbortController().signal)).resolves.toEqual(file);
    expect(worker.postMessage.mock.calls[0]![1]).toHaveLength(1);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('enforces the file bound, aborts old selections and rejects invalid replies', async () => {
    const selected = new File(['zip'], 'actual.zip');
    Object.defineProperty(selected, 'size', { value: ACTUAL.zipBytes + 1 });
    await expect(readActualFile(selected, new AbortController().signal)).rejects.toThrow(/25 MiB/);
    const controller = new AbortController();
    worker.postMessage.mockImplementation(() => controller.abort());
    await expect(readActualFile(new File(['zip'], 'actual.zip'), controller.signal)).rejects.toThrow(/cancelled/);
    worker.postMessage.mockImplementation(() => worker.onmessage?.({ data: { file: { broken: true } } }));
    await expect(readActualFile(new File(['zip'], 'actual.zip'), new AbortController().signal)).rejects.toThrow(
      /unsupported/,
    );
  });
  it('terminates a stalled worker at the deadline', async () => {
    vi.useFakeTimers();
    const result = readActualFile(new File(['zip'], 'actual.zip'), new AbortController().signal);
    const assertion = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(ACTUAL.timeout);
    await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
