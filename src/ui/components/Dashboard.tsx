// The dashboard, top to bottom as the mock lays it out: wordmark + date ·
// mascot hero · nudge / moult card · streak card · level card · today ·
// health row · footer. Built purely from a StateSnapshot; `now` is a prop so
// tests can pin the clock.
import { useEffect, useMemo } from 'react';
import { BADGES, type Legacy } from '@/src/core';
import type { Health, StateSnapshot } from '@/src/messaging/protocol';
import { MOULT_BODY, MOULT_TITLE, NUDGE_BODY, NUDGE_TITLE, PRIZES_LINE, stageLine, stageName, stageNote, stageTier, tierVar } from './copy';
import { formatDay } from './format';
import { Glyph } from './Glyph';
import { detectionIssue, issueMessage, reportUrl } from './health';
import { LevelCard } from './LevelCard';
import { MascotSprite } from './MascotSprite';
import { moultedFrom, nextStageSeen, readStageSeen, writeStageSeen } from './moult';
import { Frame, Wordmark } from './Shell';
import { StreakCard } from './StreakCard';
import { TodayCard } from './TodayCard';

export type OnboardedSnapshot = Extract<StateSnapshot, { onboarded: true }>;

/** The amber hour: an empty weekday turns "at risk" in the UI from 18:00. */
export const NUDGE_HOUR = 18;

interface Props {
  snapshot: OnboardedSnapshot;
  now: Date;
  onBadges: () => void;
  onSettings: () => void;
}

export function Dashboard({ snapshot, now, onBadges, onSettings }: Props) {
  const { derived, badges, legacy, health } = snapshot;
  const riskNow = derived.atRisk && now.getHours() >= NUDGE_HOUR;

  // The moult card needs the stage the popup last showed — see moult.ts.
  const seen = useMemo(() => readStageSeen(), []);
  const moulted = moultedFrom(seen, derived);
  useEffect(() => {
    writeStageSeen(nextStageSeen(seen, derived));
  }, [seen, derived]);

  const issue = detectionIssue(health, now);
  const badgeCount = BADGES.filter((b) => badges[b.id] !== undefined).length;

  return (
    <Frame screen="dashboard">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3.5 pt-3 pb-2.5">
        <header className="flex items-center justify-between">
          <Wordmark />
          <div className="text-[11px] text-muted" data-testid="date">
            {formatDay(now)}
          </div>
        </header>

        <Hero snapshot={snapshot} moulted={moulted} />

        {riskNow ? (
          <Notice tone="amber" title={NUDGE_TITLE} body={`${NUDGE_BODY} ${freezeLine(derived.freezes)}`} />
        ) : moulted !== undefined ? (
          <Notice tone="plain" title={MOULT_TITLE} body={MOULT_BODY} sprite={moulted} />
        ) : null}

        <StreakCard derived={derived} riskNow={riskNow} />
        <LevelCard derived={derived} />
        <TodayCard derived={derived} />

        {issue ? <HealthRow message={issueMessage(issue)} href={reportUrl(issue, health, navigator.userAgent)} /> : null}

        <footer className="mt-auto flex flex-col gap-1 pt-1">
          {legacy ? <LegacyLine legacy={legacy} /> : null}
          <div className="text-center text-[10px] text-faint">{PRIZES_LINE}</div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onBadges}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface hover:text-text"
            >
              <Glyph name="badge" size={10} />
              Badges {badgeCount}/{BADGES.length}
            </button>
            <button
              type="button"
              onClick={onSettings}
              aria-label="Settings"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface hover:text-text"
            >
              <Glyph name="gear" size={10} />
              Settings
            </button>
          </div>
        </footer>
      </div>
    </Frame>
  );
}

function freezeLine(freezes: number): string {
  if (freezes === 0) return 'You have none banked.';
  return `You have ${freezes} banked.`;
}

function Hero({ snapshot, moulted }: { snapshot: OnboardedSnapshot; moulted?: number }) {
  const { derived } = snapshot;
  const stage = derived.mascotStage;
  const name = stageName(stage);
  return (
    <div className="flex items-center gap-3">
      <MascotSprite stage={stage} scale={4} title={name} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="font-pixel text-[13px] tracking-[0.5px] uppercase" style={{ color: tierVar(stageTier(stage)) }} data-testid="stage-name">
          {name}
        </div>
        <div className="text-[11px] text-muted">{stageLine(stage)}</div>
        <div className="text-[11px] leading-snug text-muted">{stageNote(derived, moulted)}</div>
      </div>
    </div>
  );
}

function Notice({ tone, title, body, sprite }: { tone: 'amber' | 'plain'; title: string; body: string; sprite?: number }) {
  const amber = tone === 'amber';
  return (
    <div
      role="status"
      data-testid="notice"
      className={`flex items-start gap-2.5 rounded border px-3 py-2 ${amber ? 'border-amber bg-amber-bg' : 'border-line bg-surface'}`}
    >
      {sprite !== undefined ? <MascotSprite stage={sprite} scale={2} title={`${stageName(sprite)}, before the moult`} /> : null}
      <div className="flex flex-col gap-0.5">
        <div className={`text-[12px] font-bold ${amber ? 'text-amber' : 'text-text'}`}>{title}</div>
        <div className="text-[11px] leading-snug text-muted">{body}</div>
      </div>
    </div>
  );
}

function HealthRow({ message, href }: { message: string; href: string }) {
  return (
    <div role="alert" data-testid="health-row" className="rounded border border-amber bg-amber-bg px-3 py-2 text-[11px] leading-snug text-amber">
      {message}{' '}
      <a href={href} target="_blank" rel="noreferrer" className="font-bold underline">
        Report
      </a>
    </div>
  );
}

function LegacyLine({ legacy }: { legacy: Legacy }) {
  return (
    <div className="text-center text-[10px] text-faint" data-testid="legacy">
      v1 lifetime: {legacy.c} comments · {legacy.n} connections · {legacy.p} posts · weekly streak best {legacy.longestWeeklyStreak}
    </div>
  );
}

export type { Health };
