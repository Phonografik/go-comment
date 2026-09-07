// First open: the rules in brief, then the six level cards. Picking one and
// pressing Begin is the `setSettings({ level })` call that completes onboarding.
// Copy follows v1's onboarding where it still fits; the points table is
// generated from POINTS so it can never drift from the maths.
import { useState } from 'react';
import { EVENT_LABELS, LEVELS, POINTS, recipeText, type Level } from '@/src/core';
import { BEGIN_LABEL, CHOOSE_LINE, PRIZES_LINE, TAGLINES, tierVar } from './copy';
import { Frame, Wordmark } from './Shell';

interface Props {
  onPick: (level: Level) => Promise<unknown> | void;
}

const POINTS_ORDER = ['p', 'm', 'q', 'n', 'c', 'r'] as const;

export function Onboarding({ onPick }: Props) {
  const [picked, setPicked] = useState<Level | undefined>();
  const [busy, setBusy] = useState(false);

  const begin = async () => {
    if (picked === undefined || busy) return;
    setBusy(true);
    try {
      await onPick(picked);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame screen="onboarding">
      <div className="flex-1 overflow-y-auto px-3.5 pt-3 pb-2">
        <Wordmark className="text-[18px]" />
        <p className="mt-1 text-[11px] text-muted">Keep score of your own LinkedIn. Nothing leaves this device.</p>

        <ul className="mt-3 flex flex-col gap-1 text-[11px] text-muted">
          <li>
            <span className="font-bold text-text">Points.</span>{' '}
            {POINTS_ORDER.map((t, i) => (
              <span key={t}>
                {i > 0 ? ' · ' : ''}
                {EVENT_LABELS[t].one} {POINTS[t]}
              </span>
            ))}
          </li>
          <li>
            <span className="font-bold text-text">Streak.</span> Show up Mon–Fri with one action of any kind. Weekends are free.
          </li>
          <li>
            <span className="font-bold text-text">Caps.</span> Grinding one action stops scoring after a day&apos;s cap. Touch grass.
          </li>
        </ul>

        <p className="mt-3 text-[11px] text-faint">{PRIZES_LINE}</p>
        <p className="mt-3 text-[11px] text-text">{CHOOSE_LINE}</p>

        <div role="radiogroup" aria-label="Commitment level" className="mt-2 flex flex-col gap-1.5">
          {LEVELS.map((def) => {
            const selected = picked === def.level;
            return (
              <button
                key={def.level}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPicked(def.level)}
                className={`rounded border px-3 py-2 text-left ${
                  selected ? 'border-cyan bg-cyan-bg' : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-pixel text-[11px] tracking-[0.5px] uppercase" style={{ color: tierVar(def.level) }}>
                    {def.name}
                  </span>
                  <span className="text-[10px] whitespace-nowrap text-muted tabular-nums">
                    {def.target === 0 ? 'no target' : `${def.target} / week`}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted">{recipeText(def)}</div>
                <div className="mt-0.5 text-[11px] text-faint italic">{TAGLINES[def.level]}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-line px-3.5 py-2.5">
        <button
          type="button"
          onClick={begin}
          disabled={picked === undefined || busy}
          className="w-full rounded bg-cyan py-2 font-pixel text-[12px] tracking-[0.5px] text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {BEGIN_LABEL}
        </button>
      </div>
    </Frame>
  );
}
