// The level card: name in its tier colour, this week's points against the
// target, the bar, the recipe generated from levels.ts, and v1's tagline.
import { levelDef, recipeText, type Derived } from '@/src/core';
import { TAGLINES, tierVar } from './copy';
import { Card } from './Shell';

export function LevelCard({ derived }: { derived: Derived }) {
  const def = levelDef(derived.level);
  const tier = tierVar(derived.level);
  const hasTarget = def.target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((derived.weekPoints / def.target) * 100)) : 0;
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-pixel text-[11px] tracking-[0.5px] uppercase" style={{ color: tier }}>
          {def.name}
        </div>
        <div className="text-[11px] whitespace-nowrap text-muted tabular-nums" data-testid="week-points">
          <span className="font-bold text-text">{derived.weekPoints}</span>
          {hasTarget ? ` / ${def.target} this week` : ' pts this week'}
        </div>
      </div>
      {hasTarget ? (
        <div
          className="h-1.5 overflow-hidden rounded-sm bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={def.target}
          aria-valuenow={Math.min(derived.weekPoints, def.target)}
          aria-label="Weekly target"
        >
          <div className="h-full" style={{ width: `${pct}%`, background: tier }} />
        </div>
      ) : null}
      <div className="text-[11px] leading-snug text-muted">{recipeText(def)}</div>
      <div className="text-[11px] text-faint italic">{TAGLINES[derived.level]}</div>
    </Card>
  );
}
