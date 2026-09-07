// Today's six counters against their daily caps. A capped one goes amber and
// the "touch grass" line appears. An empty day collapses to one compact row so
// the nudge card fits in 600px.
import { DAILY_CAPS, POINTS, type Derived, type EventType } from '@/src/core';
import { CAPPED_LINE } from './copy';
import { Glyph, type GlyphName } from './Glyph';

const COUNTERS: ReadonlyArray<{ t: EventType; icon: GlyphName; label: string }> = [
  { t: 'p', icon: 'post', label: 'Posts' },
  { t: 'm', icon: 'dm', label: 'DMs' },
  { t: 'q', icon: 'repost', label: 'Reposts' },
  { t: 'n', icon: 'connect', label: 'Connects' },
  { t: 'c', icon: 'comment', label: 'Comments' },
  { t: 'r', icon: 'reply', label: 'Replies' },
];

export function TodayCard({ derived }: { derived: Derived }) {
  const { todayCounts, todayPoints, capped } = derived;
  const empty = COUNTERS.every(({ t }) => todayCounts[t] === 0);
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-bold tracking-[0.6px] text-muted uppercase">Today</h2>
        <div className="text-[11px] text-muted" data-testid="today-points">
          {empty ? (
            'nothing counted yet'
          ) : (
            <>
              <span className="font-bold text-text">{todayPoints}</span> pts
            </>
          )}
        </div>
      </div>
      {empty ? (
        <div
          data-testid="today-compact"
          className="flex items-center justify-between rounded border border-line bg-surface-2 px-2.5 py-2"
        >
          {COUNTERS.map(({ t, icon, label }) => (
            <div key={t} className="flex items-center gap-1 text-muted" title={label}>
              <Glyph name={icon} size={13} />
              <span className="text-[11px] tabular-nums">
                0<span className="text-faint">/{DAILY_CAPS[t]}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="today-grid" className="grid grid-cols-3 gap-1.5">
          {COUNTERS.map(({ t, icon, label }) => {
            const n = todayCounts[t];
            const isCapped = capped.includes(t);
            return (
              <div
                key={t}
                data-testid={`counter-${t}`}
                data-capped={isCapped ? 'true' : undefined}
                title={`${POINTS[t]} pt${POINTS[t] === 1 ? '' : 's'} each, cap ${DAILY_CAPS[t]} a day`}
                className={`flex items-center gap-1.5 rounded border px-2 py-1.5 ${
                  isCapped ? 'border-amber bg-amber-bg text-amber' : 'border-line bg-surface-2 text-text'
                }`}
              >
                <Glyph name={icon} size={14} className={n > 0 ? undefined : 'text-muted'} />
                <div className="flex min-w-0 flex-col">
                  <div className="text-[10px] whitespace-nowrap text-muted">{label}</div>
                  <div className="text-[12px] font-bold tabular-nums">
                    {n}
                    <span className="font-normal text-muted">/{DAILY_CAPS[t]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {capped.length > 0 ? <div className="text-[10px] text-amber">{CAPPED_LINE}</div> : null}
    </section>
  );
}
