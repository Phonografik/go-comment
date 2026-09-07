// The popup against mocked background snapshots: every screen, every dashboard
// state the mock defines, asserted on the copy and the numbers a user reads.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import App from '@/entrypoints/popup/App';
import { BADGES, LEVELS, levelDef, MASCOT_STAGES, recipeText } from '@/src/core';
import { sendMessage, type StateSnapshot } from '@/src/messaging/protocol';
import { CAPPED_LINE, MOULT_BODY, MOULT_TITLE, NUDGE_BODY, NUDGE_TITLE, PRIZES_LINE, TAGLINES } from './copy';
import { STAGE_SEEN_KEY } from './moult';
import {
  AT_RISK,
  AT_RISK_NOW,
  FRESH,
  HEALTH_YELLOW,
  MIDWEEK,
  MIDWEEK_NOW,
  MOULT,
  MOULT_NOW,
  MOULT_SEEN,
  ONBOARDING,
  SELECTORS_VERSION,
  THURSDAY,
  THURSDAY_NOW,
  WITH_BADGES,
} from './snapshots.fixture';

vi.mock('@/src/messaging/protocol', () => ({ sendMessage: vi.fn(), onMessage: vi.fn() }));
const send = vi.mocked(sendMessage);

/** getState answers `initial`; setSettings answers `after` (or `initial` again) with the patch merged into settings. */
function mockBackground(initial: StateSnapshot, after?: StateSnapshot) {
  send.mockImplementation((async (type: string, data: unknown) => {
    if (type === 'getState') return initial;
    if (type === 'setSettings') {
      const base = after ?? initial;
      if (!base.onboarded) return base;
      return { ...base, settings: { ...base.settings, ...(data as object) } };
    }
    throw new Error(`unexpected message ${type}`);
  }) as never);
}

const screenEl = () => document.querySelector('[data-screen]')!;

beforeEach(() => {
  send.mockReset();
  localStorage.clear();
});
afterEach(cleanup);

describe('loading and errors', () => {
  it('shows the wordmark while getState is in flight, then the dashboard', async () => {
    let resolve!: (s: StateSnapshot) => void;
    send.mockImplementation((() => new Promise<StateSnapshot>((r) => (resolve = r))) as never);
    render(<App now={MIDWEEK_NOW} />);
    expect(screenEl().getAttribute('data-screen')).toBe('loading');
    resolve(MIDWEEK);
    await waitFor(() => expect(screenEl().getAttribute('data-screen')).toBe('dashboard'));
  });

  it('shows an error screen when the background does not answer', async () => {
    send.mockImplementation((() => Promise.reject(new Error('no receiver'))) as never);
    render(<App now={MIDWEEK_NOW} />);
    await waitFor(() => expect(screenEl().getAttribute('data-screen')).toBe('error'));
    expect(screen.getByText('no receiver')).toBeTruthy();
  });
});

describe('onboarding', () => {
  it('lists the six levels with recipes and taglines, and the prizes line', async () => {
    mockBackground(ONBOARDING, MIDWEEK);
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText(PRIZES_LINE);
    expect(screenEl().getAttribute('data-screen')).toBe('onboarding');
    for (const def of LEVELS) {
      expect(screen.getByText(def.name)).toBeTruthy();
      expect(screen.getByText(TAGLINES[def.level])).toBeTruthy();
      expect(screen.getByText(recipeText(def))).toBeTruthy();
    }
    expect(screen.getByText(/Good luck\./)).toBeTruthy();
    expect(screen.getByText('Choose your commitment level and start building your streak:')).toBeTruthy();
    // points table is generated from POINTS
    expect(screen.getByText(/post 8/)).toBeTruthy();
    expect(screen.getByText(/DM 4/)).toBeTruthy();
  });

  it('picking a level and pressing Begin sends setSettings({ level }) and lands on the dashboard', async () => {
    mockBackground(ONBOARDING, MIDWEEK);
    render(<App now={MIDWEEK_NOW} />);
    const begin = (await screen.findByRole('button', { name: 'Begin Challenge' })) as HTMLButtonElement;
    expect(begin.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Go Go Go!/ }));
    expect(begin.disabled).toBe(false);
    fireEvent.click(begin);
    await waitFor(() => expect(screenEl().getAttribute('data-screen')).toBe('dashboard'));
    expect(send).toHaveBeenCalledWith('setSettings', { level: 2 });
  });
});

describe('dashboard — mid-week Wednesday', () => {
  beforeEach(() => mockBackground(MIDWEEK));

  it('renders the wordmark, date, streak, freezes and week cells', async () => {
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getByTestId('date').textContent).toBe('Wed 9 Sep');
    expect(screen.getByTestId('streak').textContent).toBe('3');
    expect(screen.getByText('weekday streak')).toBeTruthy();
    expect(screen.getByTestId('freezes').textContent).toContain('1 freeze');
    const cells = screen.getAllByTestId('week-cell');
    expect(cells.map((c) => c.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'future', 'future', 'future', 'future']);
    expect(cells.map((c) => c.textContent)).toEqual(['M20', 'T20', 'W14', 'T·', 'F·', 'S·', 'S·']);
  });

  it('renders the level card from LEVELS: name, points / target, recipe, tagline', async () => {
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('Go Go Go!');
    expect(screen.getByTestId('week-points').textContent).toBe('54 / 50 this week');
    // the recipe is generated from levels.ts, never retyped in the popup
    expect(screen.getByText(recipeText(levelDef(2)))).toBeTruthy();
    expect(screen.getByText(/2 comments, 2 connections and 1 DM each weekday/)).toBeTruthy();
    expect(screen.getByText("Look Jack, I'm flying")).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders the mascot at the stage the engine decided, in the unlocking tier colour', async () => {
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(MIDWEEK.derived.mascotStage).toBe(3);
    const name = screen.getByTestId('stage-name');
    expect(name.textContent).toBe(MASCOT_STAGES[3]);
    expect(name.getAttribute('style')).toContain('--color-tier-2');
    expect(screen.getByRole('img', { name: 'Parrot' })).toBeTruthy();
    expect(document.querySelector('[data-sprite-stage="3"] svg rect')).toBeTruthy();
    expect(screen.getByText('Stage 3 · Show-off at 111')).toBeTruthy();
    expect(screen.getByText('Earned this week. 57 more for Show-off.')).toBeTruthy();
  });

  it("renders today's six counters with caps, no nudge, no health row, and the v1 legacy line", async () => {
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getByTestId('today-grid')).toBeTruthy();
    expect(screen.getByTestId('counter-m').textContent).toBe('DMs2/5');
    expect(screen.getByTestId('counter-n').textContent).toBe('Connects3/10');
    expect(screen.getByTestId('counter-c').textContent).toBe('Comments0/15');
    expect(screen.getByTestId('today-points').textContent).toBe('14 pts');
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(screen.queryByTestId('health-row')).toBeNull();
    expect(screen.queryByText(CAPPED_LINE)).toBeNull();
    expect(screen.getByTestId('legacy').textContent).toBe('v1 lifetime: 1234 comments · 56 connections · 7 posts · weekly streak best 4');
    expect(screen.getByText(PRIZES_LINE)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Badges 0\/12/ })).toBeTruthy();
  });
});

describe('dashboard — Thursday, the mock’s main state', () => {
  beforeEach(() => mockBackground(THURSDAY));

  it('shows the frozen Wednesday, the 18-day streak, one freeze left and 79 / 111', async () => {
    render(<App now={THURSDAY_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getByTestId('streak').textContent).toBe('18');
    expect(screen.getByTestId('freezes').textContent).toContain('1 freeze');
    const cells = screen.getAllByTestId('week-cell');
    expect(cells.map((c) => c.getAttribute('data-state'))).toEqual(['done', 'done', 'frozen', 'done', 'future', 'future', 'future']);
    expect(cells[2]!.textContent).toBe('W—');
    expect(screen.getByTestId('week-points').textContent).toBe('79 / 111 this week');
    expect(screen.getByText('Turn Dial to 11')).toBeTruthy();
    expect(screen.getByText('The keyboard is on fire')).toBeTruthy();
  });

  it('shows Show-off held by last week, with the moult warning in the note', async () => {
    render(<App now={THURSDAY_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getByTestId('stage-name').textContent).toBe('Show-off');
    expect(screen.getByTestId('stage-name').getAttribute('style')).toContain('--color-tier-3');
    expect(screen.getByText('Stage 4 · Loudmouth at 160')).toBeTruthy();
    expect(screen.getByText("Held by last week's 118. Finish this week under 111 and it moults on Monday.")).toBeTruthy();
  });

  it('turns the capped comment counter amber and shows the touch-grass line', async () => {
    render(<App now={THURSDAY_NOW} />);
    await screen.findByText('GO COMMENT');
    const comments = screen.getByTestId('counter-c');
    expect(comments.textContent).toBe('Comments15/15');
    expect(comments.getAttribute('data-capped')).toBe('true');
    expect(screen.getByTestId('counter-p').getAttribute('data-capped')).toBeNull();
    expect(screen.getByText(CAPPED_LINE)).toBeTruthy();
    expect(screen.getByTestId('today-points').textContent).toBe('39 pts');
  });
});

describe('dashboard — 18:35 on an empty weekday', () => {
  beforeEach(() => mockBackground(AT_RISK));

  it('shows the nudge card, the amber ring on today, "at risk", and collapses today to one row', async () => {
    render(<App now={AT_RISK_NOW} />);
    await screen.findByText(NUDGE_TITLE);
    expect(screen.getByText(`${NUDGE_BODY} You have 1 banked.`)).toBeTruthy();
    expect(screen.getByText('at risk')).toBeTruthy();
    const cells = screen.getAllByTestId('week-cell');
    expect(cells.map((c) => c.getAttribute('data-state'))).toEqual(['done', 'done', 'risk', 'future', 'future', 'future', 'future']);
    expect(screen.getByTestId('today-compact')).toBeTruthy();
    expect(screen.queryByTestId('today-grid')).toBeNull();
    expect(screen.getByTestId('today-points').textContent).toBe('nothing counted yet');
  });

  it('is only a cyan ring, with no nudge, before 18:00', async () => {
    render(<App now={new Date(2026, 8, 9, 15, 0)} />);
    await screen.findByText('GO COMMENT');
    expect(screen.queryByTestId('notice')).toBeNull();
    expect(screen.getAllByTestId('week-cell')[2]!.getAttribute('data-state')).toBe('today');
    expect(screen.queryByText('at risk')).toBeNull();
  });
});

describe('dashboard — Monday moult', () => {
  beforeEach(() => mockBackground(MOULT));

  it('shows the moult card when the popup last showed a higher stage, and the note says what brings it back', async () => {
    localStorage.setItem(STAGE_SEEN_KEY, JSON.stringify(MOULT_SEEN));
    render(<App now={MOULT_NOW} />);
    await screen.findByText(MOULT_TITLE);
    expect(MOULT.derived.mascotStage).toBe(3);
    expect(screen.getByText(MOULT_BODY)).toBeTruthy();
    expect(screen.getByTestId('stage-name').textContent).toBe('Parrot');
    expect(screen.getByText('Last week: 98. Hit 111 this week and Show-off comes back.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Show-off, before the moult' })).toBeTruthy();
    expect(screen.getByTestId('week-points').textContent).toBe('0 / 111 this week');
    expect(screen.getAllByTestId('week-cell')[0]!.getAttribute('data-state')).toBe('today');
    // the peak stays remembered until it ages out, so the card is still there on the next open
    expect(JSON.parse(localStorage.getItem(STAGE_SEEN_KEY)!)).toEqual(MOULT_SEEN);
  });

  it('shows no moult card on a first open, and remembers the current stage', async () => {
    render(<App now={MOULT_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.queryByTestId('notice')).toBeNull();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STAGE_SEEN_KEY) ?? 'null')).toEqual({ stage: 3, week: '2026-09-14' }));
  });
});

describe('dashboard — fresh user', () => {
  it('renders the weekdays before the install day as neutral, not missed', async () => {
    mockBackground({ ...FRESH, settings: { ...FRESH.settings, memberSince: new Date(2026, 8, 9, 9, 0).getTime() } });
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getAllByTestId('week-cell').map((c) => c.getAttribute('data-state'))).toEqual(['rest', 'rest', 'today', 'future', 'future', 'future', 'future']);
  });

  it('shows the egg, a zero streak and the compact today row', async () => {
    mockBackground(FRESH);
    render(<App now={MIDWEEK_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.getByTestId('stage-name').textContent).toBe('Egg');
    expect(screen.getByText('Nothing counted for two weeks. One action hatches it.')).toBeTruthy();
    expect(screen.getByText('Stage 0 · Hatchling on the first action')).toBeTruthy();
    expect(screen.getByTestId('streak').textContent).toBe('0');
    expect(screen.getAllByTestId('week-cell').map((c) => c.getAttribute('data-state'))).toEqual(['missed', 'missed', 'today', 'future', 'future', 'future', 'future']);
    expect(screen.getByTestId('today-compact')).toBeTruthy();
    expect(screen.getByTestId('week-points').textContent).toBe('0 / 25 this week');
  });
});

describe('dashboard — detection health', () => {
  it('shows the yellow row with the days since the last comment and a prefilled Report link', async () => {
    mockBackground(HEALTH_YELLOW);
    render(<App now={THURSDAY_NOW} />);
    await screen.findByText('GO COMMENT');
    const row = screen.getByTestId('health-row');
    expect(row.textContent).toContain("Last comment detected 3 days ago. If you've commented since, detection may be broken.");
    const link = within(row).getByRole('link', { name: 'Report' }) as HTMLAnchorElement;
    const url = new URL(link.href);
    expect(url.origin + url.pathname).toBe('https://github.com/Phonografik/go-comment/issues/new');
    expect(url.searchParams.get('title')).toContain(SELECTORS_VERSION);
    const body = url.searchParams.get('body')!;
    expect(body).toContain(`selectors: ${SELECTORS_VERSION}`);
    expect(body).toContain('comments=4, connections=1');
    expect(body).toContain('last comment detected: 3 days ago');
    expect(body).not.toContain('Mozilla');
  });

  it('stays hidden when detection is healthy', async () => {
    mockBackground(THURSDAY);
    render(<App now={THURSDAY_NOW} />);
    await screen.findByText('GO COMMENT');
    expect(screen.queryByTestId('health-row')).toBeNull();
  });
});

describe('badges screen', () => {
  it('lists all twelve, half unlocked with dates, and goes back', async () => {
    mockBackground(WITH_BADGES);
    render(<App now={THURSDAY_NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: /Badges 6\/12/ }));
    expect(screenEl().getAttribute('data-screen')).toBe('badges');
    expect(screen.getByText('6/12')).toBeTruthy();
    for (const def of BADGES) expect(screen.getByText(def.name)).toBeTruthy();
    expect(screen.getByTestId('badge-first-word').textContent).toContain('17 Aug 2026');
    expect(screen.getByTestId('badge-first-word').getAttribute('data-unlocked')).toBe('true');
    expect(screen.getByTestId('badge-centurion').textContent).toContain('Locked');
    expect(screen.getByTestId('badge-centurion').textContent).toContain('A 100-day streak.');
    expect(screen.getAllByText('Locked')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(screenEl().getAttribute('data-screen')).toBe('dashboard');
  });
});

describe('settings screen', () => {
  beforeEach(() => {
    mockBackground(MIDWEEK);
    fakeBrowser.runtime.getManifest = () => ({ version: '2.0.0' }) as never;
    fakeBrowser.runtime.getURL = ((path: string) => `chrome-extension://abc/${path.replace(/^\//, '')}`) as never;
  });

  it('shows the level picker with the current level checked, the links and the version', async () => {
    render(<App now={MIDWEEK_NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screenEl().getAttribute('data-screen')).toBe('settings');
    expect(screen.getByRole('radio', { name: /Go Go Go!/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /No Comment/ }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByRole('link', { name: 'Export or import your data' }) as HTMLAnchorElement).href).toBe('chrome-extension://abc/settings.html');
    expect((screen.getByRole('link', { name: 'Privacy' }) as HTMLAnchorElement).href).toBe('https://phonografik.github.io/go-comment/');
    expect((screen.getByRole('link', { name: 'Source' }) as HTMLAnchorElement).href).toBe('https://github.com/Phonografik/go-comment');
    expect(screen.getAllByText(/v2\.0\.0/).length).toBeGreaterThan(0);
    expect(screen.getByText('Member since 12 Aug 2025')).toBeTruthy();
  });

  it('changing level sends setSettings({ level }) and re-checks the picker from the reply', async () => {
    render(<App now={MIDWEEK_NOW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('radio', { name: /Turn Dial to 11/ }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /Turn Dial to 11/ }).getAttribute('aria-checked')).toBe('true'));
    expect(send).toHaveBeenCalledWith('setSettings', { level: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(screenEl().getAttribute('data-screen')).toBe('dashboard');
  });
});
