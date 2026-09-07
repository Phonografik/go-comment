// The streak card: the number, the freeze pips, and the Mon–Sun cells with
// points under each. Cell states follow the mock: done = cyan fill + tick,
// frozen = dashed cyan + snowflake, today = cyan ring, today after 18:00 with
// nothing = amber ring, missed = a dash, future = faint, weekend = smaller.
import type { DayView, Derived } from '@/src/core';
import { Glyph } from './Glyph';
import { Card } from './Shell';

export type CellState = 'done' | 'frozen' | 'today' | 'risk' | 'missed' | 'future' | 'rest';

export function cellState(day: DayView, riskNow: boolean): CellState {
  if (day.shownUp) return 'done';
  if (day.frozen) return 'frozen';
  if (day.today) return riskNow ? 'risk' : 'today';
  if (day.future) return 'future';
  return day.weekday ? 'missed' : 'rest';
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FREEZE_BANK = 2;

const CELL: Record<CellState, string> = {
  done: 'border-cyan bg-cyan text-ink',
  frozen: 'border-dashed border-cyan bg-cyan-bg text-cyan',
  today: 'border-2 border-cyan',
  risk: 'border-2 border-amber bg-amber-bg',
  missed: 'border-faint',
  future: 'border-line',
  rest: 'border-line',
};

const POINTS_COLOUR: Record<CellState, string> = {
  done: 'text-text',
  frozen: 'text-muted',
  today: 'text-text',
  risk: 'text-amber',
  missed: 'text-faint',
  future: 'text-faint',
  rest: 'text-faint',
};

function WeekCell({ day, index, state }: { day: DayView; index: number; state: CellState }) {
  const weekend = !day.weekday;
  const size = weekend ? 'h-[22px] w-[22px]' : 'h-[30px] w-[30px]';
  const emphasis = state === 'today' || state === 'risk';
  const points = day.future ? '·' : state === 'frozen' ? '—' : String(day.points);
  return (
    <div
      data-testid="week-cell"
      data-day={day.d}
      data-state={state}
      className={`flex flex-col items-center gap-1 ${weekend ? 'w-[26px]' : 'w-[34px]'}`}
    >
      <div className={`text-[10px] font-bold ${emphasis ? 'text-text' : 'text-muted'}`}>{LETTERS[index]}</div>
      <div className={`flex items-center justify-center rounded border ${size} ${CELL[state]}`}>
        {state === 'done' ? <Glyph name="tick" size={14} /> : null}
        {state === 'frozen' ? <Glyph name="snow" size={12} /> : null}
        {state === 'missed' ? <div className="h-[2px] w-2 bg-faint" /> : null}
      </div>
      <div className={`text-[10px] tabular-nums ${POINTS_COLOUR[state]}`}>{points}</div>
    </div>
  );
}

interface Props {
  derived: Derived;
  /** at risk AND it is past 18:00 — the amber state */
  riskNow: boolean;
}

export function StreakCard({ derived, riskNow }: Props) {
  const { streak, freezes, weekDays } = derived;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <div
            data-testid="streak"
            className={`text-[32px] leading-none font-extrabold tabular-nums ${riskNow ? 'text-amber' : 'text-text'}`}
          >
            {streak}
          </div>
          <div className="text-[12px] text-muted">
            weekday streak
            {riskNow ? (
              <>
                {' · '}
                <span className="font-bold text-amber">at risk</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1" title="freezes banked" data-testid="freezes">
          {Array.from({ length: FREEZE_BANK }, (_, i) => (
            <Glyph key={i} name="snow" size={12} className={i < freezes ? 'text-cyan' : 'text-faint'} />
          ))}
          <span className="ml-0.5 text-[10px] text-muted">
            {freezes} freeze{freezes === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between">
        {weekDays.map((day, i) => (
          <WeekCell key={day.d} day={day} index={i} state={cellState(day, riskNow)} />
        ))}
      </div>
    </Card>
  );
}
