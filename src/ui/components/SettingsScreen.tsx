// In-popup settings: the level picker (retroactive — the fold recomputes every
// week), a link to the full-tab settings page for export / import (OS file
// pickers close a popup), the privacy page, and the version.
import { browser, type PublicPath } from 'wxt/browser';
import { LEVELS, type Level, type Settings } from '@/src/core';
import { tierVar } from './copy';
import { formatLongDate } from './format';
import { Frame, ScreenHeader } from './Shell';

export const PRIVACY_URL = 'https://phonografik.github.io/go-comment/';
export const SOURCE_URL = 'https://github.com/Phonografik/go-comment';

/** The manifest version, or '' where there is no runtime (tests without a stub). */
export function manifestVersion(): string {
  try {
    return browser.runtime.getManifest().version;
  } catch {
    return '';
  }
}

/** The full-tab settings page (entrypoints/settings, built on another branch). */
export function settingsPageUrl(): string {
  try {
    // The settings entrypoint is built on another branch; PublicPath is generated from the entrypoints present.
    return browser.runtime.getURL('/settings.html' as PublicPath);
  } catch {
    return '/settings.html';
  }
}

interface Props {
  settings: Settings;
  onLevel: (level: Level) => Promise<unknown> | void;
  onBack: () => void;
}

export function SettingsScreen({ settings, onLevel, onBack }: Props) {
  const version = manifestVersion();
  return (
    <Frame screen="settings">
      <ScreenHeader title="SETTINGS" onBack={onBack} right={version ? `v${version}` : undefined} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 pb-3">
        <section>
          <h2 className="text-[11px] font-bold tracking-[0.6px] text-muted uppercase">Level</h2>
          <div role="radiogroup" aria-label="Level" className="mt-1.5 flex flex-col gap-1">
            {LEVELS.map((def) => {
              const current = def.level === settings.level;
              return (
                <button
                  key={def.level}
                  type="button"
                  role="radio"
                  aria-checked={current}
                  onClick={() => {
                    if (!current) void onLevel(def.level);
                  }}
                  className={`flex items-baseline justify-between gap-2 rounded border px-3 py-1.5 text-left ${
                    current ? 'border-cyan bg-cyan-bg' : 'border-line bg-surface hover:bg-surface-2'
                  }`}
                >
                  <span className="font-pixel text-[11px] tracking-[0.5px] uppercase" style={{ color: tierVar(def.level) }}>
                    {def.name}
                  </span>
                  <span className="text-[10px] whitespace-nowrap text-muted tabular-nums">
                    {def.target === 0 ? 'no target' : `${def.target} / week`}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-faint">
            Changing level applies to every week, past ones included — the streak, freezes and parrot are all recomputed.
          </p>
        </section>

        <section>
          <h2 className="text-[11px] font-bold tracking-[0.6px] text-muted uppercase">Data</h2>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Everything lives in this browser. Counts and day keys only — never what you wrote or who you wrote to.
          </p>
          <a
            href={settingsPageUrl()}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block rounded border border-line bg-surface px-3 py-1.5 text-[11px] text-cyan hover:bg-surface-2"
          >
            Export or import your data
          </a>
        </section>

        <section className="text-[11px] text-muted">
          <h2 className="text-[11px] font-bold tracking-[0.6px] text-muted uppercase">About</h2>
          <div className="mt-1 flex flex-col gap-0.5">
            <div>Member since {formatLongDate(settings.memberSince)}</div>
            <div>
              <a href={PRIVACY_URL} target="_blank" rel="noreferrer" className="text-cyan underline">
                Privacy
              </a>
              {' · '}
              <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="text-cyan underline">
                Source
              </a>
              {version ? ` · v${version}` : null}
            </div>
          </div>
        </section>
      </div>
    </Frame>
  );
}
