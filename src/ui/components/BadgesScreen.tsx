// All twelve badges from src/core/badges.ts, locked or unlocked with the date.
import { BADGES, type Badges } from '@/src/core';
import { formatLongDate } from './format';
import { Glyph } from './Glyph';
import { Frame, ScreenHeader } from './Shell';

interface Props {
  badges: Badges;
  onBack: () => void;
}

export function BadgesScreen({ badges, onBack }: Props) {
  const unlocked = BADGES.filter((b) => badges[b.id] !== undefined).length;
  return (
    <Frame screen="badges">
      <ScreenHeader title="BADGES" onBack={onBack} right={`${unlocked}/${BADGES.length}`} />
      <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3.5 pb-3">
        {BADGES.map((def) => {
          const at = badges[def.id];
          const has = at !== undefined;
          return (
            <li
              key={def.id}
              data-testid={`badge-${def.id}`}
              data-unlocked={has ? 'true' : 'false'}
              className={`flex items-center gap-2.5 rounded border px-3 py-2 ${has ? 'border-line bg-surface' : 'border-line/60 bg-transparent'}`}
            >
              <Glyph name={has ? 'badge' : 'lock'} size={16} className={has ? 'text-cyan' : 'text-faint'} />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className={`text-[12px] font-bold ${has ? 'text-text' : 'text-muted'}`}>{def.name}</div>
                <div className="text-[11px] leading-snug text-muted">{def.how}</div>
              </div>
              <div className="text-[10px] whitespace-nowrap text-faint tabular-nums">{has ? formatLongDate(at) : 'Locked'}</div>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}
