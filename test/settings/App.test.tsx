// The settings page against a mocked background. sendMessage is replaced
// wholesale, so nothing here depends on the storage branch — the page is
// tested purely as "what does it send, and what does it show for the reply".
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { derive } from '../../src/core/derive';
import { toDateKey } from '../../src/core/calendar';
import type { ActivityEvent, EventType } from '../../src/core/types';
import type { ExportFile, Health, StateSnapshot } from '../../src/messaging/protocol';

vi.mock('../../src/messaging/protocol', () => ({ sendMessage: vi.fn() }));

import { sendMessage } from '../../src/messaging/protocol';
import App, { emptyExport, exportFilename, summarise } from '../../entrypoints/settings/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const send = sendMessage as unknown as Mock<(type: string, data?: unknown) => Promise<unknown>>;

// Monday 7 Sep 2026, 15:30 BST.
const NOW = new Date(2026, 8, 7, 15, 30);
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const ev = (t: EventType, when: Date): ActivityEvent => ({ t, ts: when.getTime(), d: toDateKey(when) });

const health: Health = { lastPageLoad: at(2026, 9, 7, 9).getTime(), unconfirmed: {}, lastDetected: {}, selectorsVersion: '2026-09-07' };
const settings = { level: 2 as const, memberSince: Date.UTC(2025, 4, 19) };

/** A small but real export: 7 events over 2 days plus one compacted day. */
const exportFile: ExportFile = {
  schemaVersion: 2,
  exportedAt: at(2026, 9, 6, 18).getTime(),
  data: {
    events: [
      ev('c', at(2026, 9, 2)),
      ev('c', at(2026, 9, 2, 13)),
      ev('n', at(2026, 9, 2, 14)),
      ev('p', at(2026, 9, 3)),
      ev('c', at(2026, 9, 3, 13)),
      ev('m', at(2026, 9, 3, 14)),
      ev('q', at(2026, 9, 3, 15)),
    ],
    days: { '2026-08-31': { c: 5, r: 1, p: 0, q: 0, n: 2, m: 1 } },
    settings,
    badges: { 'first-word': at(2026, 8, 31).getTime() },
    health,
  },
};

/** What the background would answer after storing `file`. */
function snapshotFor(file: ExportFile, now = NOW): StateSnapshot {
  const { events, days, legacy, badges } = file.data;
  return {
    onboarded: true,
    derived: derive({ days, events, legacy, settings: file.data.settings, badges, now }),
    settings: file.data.settings,
    badges,
    legacy,
    health: file.data.health,
  };
}

const CURRENT = snapshotFor(exportFile);

// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
  send.mockReset();
  send.mockImplementation(async (type) => {
    if (type === 'getState') return CURRENT;
    throw new Error(`unexpected message ${type}`);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(<App />);
  });
  await flush();
}

/** Let pending promises (file reads, message replies) settle inside act. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function button(label: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no button "${label}" — buttons: ${[...container.querySelectorAll('button')].map((x) => x.textContent).join(' | ')}`);
  return b;
}

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flush();
}

async function chooseFile(contents: string, name = 'go-comment-2026-09-06.json') {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
  await flush();
}

const text = () => container.textContent ?? '';

// ---------------------------------------------------------------------------

describe('helpers', () => {
  it('names the file by the local day', () => {
    expect(exportFilename(NOW)).toBe('go-comment-2026-09-07.json');
  });

  it('summarises events, distinct days across rollup + log, and the level', () => {
    expect(summarise(exportFile)).toEqual({ events: 7, days: 3, level: 2 });
  });

  it('builds the empty file Reset imports: no events, no badges, no legacy, the level kept', () => {
    expect(emptyExport(settings, 123)).toEqual({
      schemaVersion: 2,
      exportedAt: 123,
      data: { events: [], days: {}, settings, badges: {}, health: { lastPageLoad: 0, unconfirmed: {}, lastDetected: {}, selectorsVersion: '' } },
    });
  });
});

describe('settings page', () => {
  it('shows the current state from getState and links the privacy policy', async () => {
    await render();
    expect(send).toHaveBeenCalledWith('getState');
    expect(text()).toContain('Go Go Go!');
    expect(text()).toContain('50 points a week');
    expect(text()).toContain('Lifetime');
    expect(text()).toContain('8 comments'); // 5 rolled up + 3 in the log
    expect(text()).toContain('Your level is set in the popup');
    const privacy = container.querySelector<HTMLAnchorElement>('a[href="https://phonografik.github.io/go-comment/"]');
    expect(privacy?.textContent).toBe('Privacy policy');
  });

  it('tells a user who has not onboarded to pick a level first, and disables Reset', async () => {
    send.mockImplementation(async (type) => {
      if (type === 'getState') return { onboarded: false } satisfies StateSnapshot;
      throw new Error(`unexpected message ${type}`);
    });
    await render();
    expect(text()).toContain('pick a level in the popup first');
    expect(button('Reset all activity').disabled).toBe(true);
    expect(text()).toContain('Nothing to reset yet.');
  });

  it('surfaces a background that does not answer', async () => {
    send.mockImplementation(async () => {
      throw new Error('no receiver');
    });
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('no receiver');
  });
});

describe('export', () => {
  it('builds a blob download link named by today and clicks it for the user', async () => {
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      if (type === 'exportData') return exportFile;
      throw new Error(`unexpected message ${type}`);
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:go-comment/1');
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await render();

    await click(button('Export'));

    expect(send).toHaveBeenCalledWith('exportData');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(JSON.stringify(exportFile, null, 2));

    const link = container.querySelector<HTMLAnchorElement>('a[download]')!;
    expect(link.getAttribute('download')).toBe('go-comment-2026-09-07.json');
    expect(link.getAttribute('href')).toBe('blob:go-comment/1');
    expect(link.textContent).toBe('Download go-comment-2026-09-07.json');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(text()).toContain('7 events in the file');
    expect(text()).toContain('no post text, names or links');
  });

  it('revokes the object URL a moment after the link is clicked', async () => {
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      if (type === 'exportData') return exportFile;
      throw new Error(`unexpected message ${type}`);
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:go-comment/2');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await render();
    await click(button('Export'));

    // A real click on the link (default action suppressed so happy-dom doesn't try to navigate).
    const link = container.querySelector<HTMLAnchorElement>('a[download]')!;
    container.addEventListener('click', (e) => e.preventDefault(), true);
    await click(link);
    expect(revoke).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(revoke).toHaveBeenCalledWith('blob:go-comment/2');
    expect(container.querySelector('a[download]')).toBeNull();
    expect(text()).toContain('Saved go-comment-2026-09-07.json.');
  });

  it('shows the error when the background refuses', async () => {
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      throw new Error('worker asleep');
    });
    await render();
    await click(button('Export'));
    expect(text()).toContain('Export failed: worker asleep');
  });
});

describe('import', () => {
  it.each(['replace', 'merge'] as const)('%s: shows the summary, sends the file with that mode, shows the result', async (mode) => {
    const after = snapshotFor({ ...exportFile, data: { ...exportFile.data, events: [...exportFile.data.events, ev('c', at(2026, 9, 7, 9))] } });
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      if (type === 'importData') return after;
      throw new Error(`unexpected message ${type}`);
    });
    await render();

    await chooseFile(JSON.stringify(exportFile));
    expect(text()).toContain('go-comment-2026-09-06.json');
    expect(text()).toContain('7 events across 3 days, level Go Go Go!');
    expect(send).not.toHaveBeenCalledWith('importData', expect.anything());

    await click(button(mode === 'replace' ? 'Replace' : 'Merge'));

    expect(send).toHaveBeenCalledWith('importData', { file: exportFile, mode });
    expect(text()).toContain(mode === 'replace' ? 'Replaced. You now have:' : 'Merged. You now have:');
    expect(text()).toContain(`${after.onboarded ? after.derived.streak : 0} day`);
    expect(text()).toContain('9 comments'); // 5 rolled up + 3 in the log + the new one
  });

  it('refuses a file with the wrong schemaVersion and says why', async () => {
    await render();
    await chooseFile(JSON.stringify({ ...exportFile, schemaVersion: 1 }), 'old.json');
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Can’t import old.json: schemaVersion is 1 — this page only reads version 2 exports.');
    expect(container.querySelector('button')?.textContent).not.toBe('Replace');
    expect(send).not.toHaveBeenCalledWith('importData', expect.anything());
  });

  it('refuses a file that is not JSON', async () => {
    await render();
    await chooseFile('not json at all', 'notes.txt');
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Can’t import notes.txt: The file is not valid JSON.');
  });

  it('points at the broken field in an otherwise plausible file', async () => {
    await render();
    const broken = JSON.parse(JSON.stringify(exportFile)) as { data: { events: { d: string }[] } };
    broken.data.events[2]!.d = '2026-09-02T00:00:00.000Z';
    await chooseFile(JSON.stringify(broken));
    expect(text()).toContain('events[2].d is not a YYYY-MM-DD day key.');
  });

  it('shows the error when the import itself fails', async () => {
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      throw new Error('storage full');
    });
    await render();
    await chooseFile(JSON.stringify(exportFile));
    await click(button('Merge'));
    expect(text()).toContain('Import failed: storage full');
  });
});

describe('reset', () => {
  it('asks first, then imports an empty file with replace and shows the result', async () => {
    const wiped = emptyExport(settings, NOW.getTime());
    const after = snapshotFor(wiped);
    send.mockImplementation(async (type) => {
      if (type === 'getState') return CURRENT;
      if (type === 'importData') return after;
      throw new Error(`unexpected message ${type}`);
    });
    await render();
    expect(text()).toContain('Keeps your level. Uninstalling the extension removes everything');

    await click(button('Reset all activity'));
    expect(text()).toContain('This can’t be undone. Export first if you might want it back.');
    expect(send).not.toHaveBeenCalledWith('importData', expect.anything());

    await click(button('Yes, wipe it'));
    expect(send).toHaveBeenCalledWith('importData', { file: wiped, mode: 'replace' });
    const sent = send.mock.calls.find(([type]) => type === 'importData')![1] as { file: ExportFile };
    expect(sent.file.data.events).toEqual([]);
    expect(sent.file.data.badges).toEqual({});
    expect(sent.file.data.legacy).toBeUndefined();
    expect(sent.file.data.settings).toEqual(settings);
    expect(text()).toContain('Reset. You now have:');
    expect(text()).toContain('0 days');
    expect(text()).toContain('0 comments');
  });

  it('can be backed out of', async () => {
    await render();
    await click(button('Reset all activity'));
    await click(button('Keep my data'));
    expect(text()).not.toContain('This can’t be undone');
    expect(button('Reset all activity')).toBeDefined();
    expect(send).not.toHaveBeenCalledWith('importData', expect.anything());
  });
});
