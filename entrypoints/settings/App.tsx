// The settings tab: export, import, reset. The level itself is set in the
// popup — this page exists because OS file pickers close a popup on macOS
// Chrome. Everything here goes through the typed protocol; the page never
// touches storage and never talks to anything but the background.
//
// Export uses an <a download> on an object URL — no `downloads` permission,
// no network. Reset is an import of an empty file, so it needs no protocol of
// its own and cannot drift from what import does.
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { toDateKey } from '../../src/core/calendar';
import { levelDef } from '../../src/core/levels';
import { EVENT_LABELS, EVENT_TYPES, type Counts, type Level, type Settings } from '../../src/core/types';
import { sendMessage, type ExportFile, type StateSnapshot } from '../../src/messaging/protocol';
import { validateExportFile } from './validate';

/** PRIVACY.md on GitHub Pages. On the no-network guard's URL allowlist. */
export const PRIVACY_URL = 'https://phonografik.github.io/go-comment/';

type Mode = 'replace' | 'merge';

export function exportFilename(now: Date): string {
  return `go-comment-${toDateKey(now)}.json`;
}

export interface ImportSummary {
  events: number;
  /** distinct active days across the rollup and the event log */
  days: number;
  level: Level;
}

export function summarise(file: ExportFile): ImportSummary {
  const days = new Set(Object.keys(file.data.days));
  for (const e of file.data.events) days.add(e.d);
  return { events: file.data.events.length, days: days.size, level: file.data.settings.level };
}

/** What Reset imports: nothing, except the level you already chose. No legacy block, so the v1 totals go too. */
export function emptyExport(settings: Settings, now: number): ExportFile {
  return {
    schemaVersion: 2,
    exportedAt: now,
    data: {
      events: [],
      days: {},
      settings,
      badges: {},
      health: { lastPageLoad: 0, unconfirmed: {}, lastDetected: {}, selectorsVersion: '' },
    },
  };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function lifetimeText(lifetime: Counts): string {
  return EVENT_TYPES.map((t) => plural(lifetime[t], EVENT_LABELS[t].one, EVENT_LABELS[t].many)).join(' · ');
}

// ---------------------------------------------------------------------------

export default function App() {
  const [state, setState] = useState<StateSnapshot | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendMessage('getState').then(
      (s) => {
        if (!cancelled) setState(s);
      },
      (e: unknown) => {
        if (!cancelled) setStateError(errorText(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = state?.onboarded ? state.settings : undefined;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.25em] text-cyan">GO COMMENT</p>
        <h1 className="mt-1 text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-white/60">
          Your level is set in the popup — click the toolbar icon. This page is for getting your data in and out.
        </p>
      </header>

      <Section title="Right now">
        {stateError ? (
          <p role="alert" className="text-sm text-orange">
            Couldn’t reach the extension: {stateError}
          </p>
        ) : state === null ? (
          <p className="text-sm text-white/60">Loading…</p>
        ) : (
          <Snapshot snapshot={state} />
        )}
      </Section>

      <ExportSection />
      <ImportSection onImported={setState} />
      <ResetSection settings={settings} onReset={setState} />

      <footer className="mt-10 text-xs text-white/50">
        Nothing on this page, or anywhere in Go Comment, leaves your device.{' '}
        <a href={PRIVACY_URL} className="text-cyan underline hover:text-cyan/80" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-white/10 bg-white/5 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Snapshot({ snapshot }: { snapshot: StateSnapshot }) {
  if (!snapshot.onboarded) {
    return <p className="text-sm text-white/70">Not set up yet — pick a level in the popup first.</p>;
  }
  const { derived, settings } = snapshot;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-white/60">Level</dt>
      <dd>
        {levelDef(settings.level).name}
        <span className="text-white/50"> · {derived.weekTarget} points a week</span>
      </dd>
      <dt className="text-white/60">Streak</dt>
      <dd>
        {plural(derived.streak, 'day', 'days')}
        <span className="text-white/50"> · longest {derived.longestStreak}</span>
      </dd>
      <dt className="text-white/60">This week</dt>
      <dd>{derived.weekPoints} points</dd>
      <dt className="text-white/60">Lifetime</dt>
      <dd>{lifetimeText(derived.lifetime)}</dd>
    </dl>
  );
}

const button = 'rounded px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${button} bg-cyan text-ink hover:bg-cyan/90`;
const secondary = `${button} border border-white/25 text-white hover:bg-white/10`;
const danger = `${button} bg-orange text-ink hover:bg-orange/90`;

// ---------------------------------------------------------------------------

type ExportState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'ready'; url: string; filename: string; events: number }
  | { status: 'done'; filename: string }
  | { status: 'error'; message: string };

/** How long the download link stays live after it's clicked before its object URL is revoked. */
const REVOKE_AFTER_MS = 1500;

function ExportSection() {
  const [exp, setExp] = useState<ExportState>({ status: 'idle' });
  const linkRef = useRef<HTMLAnchorElement>(null);
  const autoClicked = useRef<string | null>(null);

  async function onExport() {
    setExp({ status: 'working' });
    try {
      const file = await sendMessage('exportData');
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      setExp({ status: 'ready', url: URL.createObjectURL(blob), filename: exportFilename(new Date()), events: file.data.events.length });
    } catch (e) {
      setExp({ status: 'error', message: errorText(e) });
    }
  }

  // One click on Export = one download: click the link for the user once it exists.
  // The ref guard keeps StrictMode's double effect from downloading twice in dev.
  useEffect(() => {
    if (exp.status !== 'ready' || autoClicked.current === exp.url) return;
    autoClicked.current = exp.url;
    linkRef.current?.click();
  }, [exp]);

  function onLinkClick() {
    if (exp.status !== 'ready') return;
    const { url, filename } = exp;
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setExp({ status: 'done', filename });
    }, REVOKE_AFTER_MS);
  }

  return (
    <Section title="Export">
      <p className="mb-3 text-sm text-white/70">
        Save everything Go Comment knows as one JSON file. What’s in the file: counts, timestamps and day keys only — no post
        text, names or links.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} onClick={onExport} disabled={exp.status === 'working'}>
          {exp.status === 'working' ? 'Preparing…' : 'Export'}
        </button>
        {exp.status === 'ready' && (
          <a ref={linkRef} href={exp.url} download={exp.filename} onClick={onLinkClick} className="text-sm text-cyan underline">
            Download {exp.filename}
          </a>
        )}
      </div>
      {exp.status === 'ready' && (
        <p role="status" className="mt-2 text-xs text-white/50">
          {plural(exp.events, 'event', 'events')} in the file. If the download didn’t start, click the link.
        </p>
      )}
      {exp.status === 'done' && (
        <p role="status" className="mt-2 text-sm text-cyan">
          Saved {exp.filename}.
        </p>
      )}
      {exp.status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-orange">
          Export failed: {exp.message}
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

type ImportState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'invalid'; filename: string; reason: string }
  | { status: 'valid'; filename: string; file: ExportFile; summary: ImportSummary }
  | { status: 'importing'; mode: Mode }
  | { status: 'imported'; mode: Mode; snapshot: StateSnapshot }
  | { status: 'error'; message: string };

function ImportSection({ onImported }: { onImported: (s: StateSnapshot) => void }) {
  const [imp, setImp] = useState<ImportState>({ status: 'idle' });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again re-runs this
    if (!f) return;
    setImp({ status: 'reading' });
    let parsed: unknown;
    try {
      parsed = JSON.parse(await f.text());
    } catch {
      setImp({ status: 'invalid', filename: f.name, reason: 'The file is not valid JSON.' });
      return;
    }
    const result = validateExportFile(parsed);
    if (!result.ok) {
      setImp({ status: 'invalid', filename: f.name, reason: result.reason });
      return;
    }
    setImp({ status: 'valid', filename: f.name, file: result.file, summary: summarise(result.file) });
  }

  async function onImport(mode: Mode) {
    if (imp.status !== 'valid') return;
    const { file } = imp;
    setImp({ status: 'importing', mode });
    try {
      const snapshot = await sendMessage('importData', { file, mode });
      setImp({ status: 'imported', mode, snapshot });
      onImported(snapshot);
    } catch (e) {
      setImp({ status: 'error', message: errorText(e) });
    }
  }

  return (
    <Section title="Import">
      <p className="mb-3 text-sm text-white/70">Load a file exported from Go Comment — from this machine or another one.</p>
      <label className="block text-sm">
        <span className="sr-only">Choose an export file</span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="block w-full text-sm text-white/70 file:mr-3 file:rounded file:border file:border-white/25 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-white/10"
        />
      </label>

      {imp.status === 'invalid' && (
        <p role="alert" className="mt-3 text-sm text-orange">
          Can’t import {imp.filename}: {imp.reason}
        </p>
      )}

      {imp.status === 'valid' && (
        <div className="mt-4">
          <p role="status" className="text-sm">
            <span className="font-semibold">{imp.filename}</span>
            <span className="text-white/70">
              {' '}
              — {plural(imp.summary.events, 'event', 'events')} across {plural(imp.summary.days, 'day', 'days')}, level{' '}
              {levelDef(imp.summary.level).name}.
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={danger} onClick={() => onImport('replace')}>
              Replace
            </button>
            <button type="button" className={primary} onClick={() => onImport('merge')}>
              Merge
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-white/60">
            <li>
              <strong className="text-white/80">Replace</strong> overwrites everything on this machine with the file.
            </li>
            <li>
              <strong className="text-white/80">Merge</strong> adds the file’s events to what’s here — an event with the same type and
              timestamp is only counted once. Badges are kept from both.
            </li>
          </ul>
        </div>
      )}

      {imp.status === 'importing' && <p className="mt-3 text-sm text-white/60">Importing…</p>}

      {imp.status === 'imported' && (
        <div role="status" className="mt-4">
          <p className="text-sm text-cyan">{imp.mode === 'replace' ? 'Replaced.' : 'Merged.'} You now have:</p>
          <div className="mt-2">
            <Snapshot snapshot={imp.snapshot} />
          </div>
        </div>
      )}

      {imp.status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-orange">
          Import failed: {imp.message}
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

type ResetState =
  | { status: 'idle' }
  | { status: 'confirm' }
  | { status: 'working' }
  | { status: 'done'; snapshot: StateSnapshot }
  | { status: 'error'; message: string };

function ResetSection({ settings, onReset }: { settings: Settings | undefined; onReset: (s: StateSnapshot) => void }) {
  const [reset, setReset] = useState<ResetState>({ status: 'idle' });

  async function onConfirm() {
    if (!settings) return;
    setReset({ status: 'working' });
    try {
      const snapshot = await sendMessage('importData', { file: emptyExport(settings, Date.now()), mode: 'replace' });
      setReset({ status: 'done', snapshot });
      onReset(snapshot);
    } catch (e) {
      setReset({ status: 'error', message: errorText(e) });
    }
  }

  return (
    <Section title="Reset">
      <p className="mb-3 text-sm text-white/70">
        Clears every count, badge and carried-over v1 total from this browser. Keeps your level. Uninstalling the extension removes
        everything, including the level.
      </p>

      {reset.status === 'idle' && (
        <button type="button" className={secondary} onClick={() => setReset({ status: 'confirm' })} disabled={!settings}>
          Reset all activity
        </button>
      )}
      {reset.status === 'idle' && !settings && <p className="mt-2 text-xs text-white/50">Nothing to reset yet.</p>}

      {reset.status === 'confirm' && (
        <div>
          <p role="status" className="text-sm text-orange">
            This can’t be undone. Export first if you might want it back.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={danger} onClick={onConfirm}>
              Yes, wipe it
            </button>
            <button type="button" className={secondary} onClick={() => setReset({ status: 'idle' })}>
              Keep my data
            </button>
          </div>
        </div>
      )}

      {reset.status === 'working' && <p className="text-sm text-white/60">Resetting…</p>}

      {reset.status === 'done' && (
        <div role="status">
          <p className="text-sm text-cyan">Reset. You now have:</p>
          <div className="mt-2">
            <Snapshot snapshot={reset.snapshot} />
          </div>
        </div>
      )}

      {reset.status === 'error' && (
        <p role="alert" className="text-sm text-orange">
          Reset failed: {reset.message}
        </p>
      )}
    </Section>
  );
}
