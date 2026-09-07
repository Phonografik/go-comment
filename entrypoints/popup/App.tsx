// Routes the popup by local state: loading → onboarding (until a level is
// set) → dashboard ⇄ badges / settings. `now` is injectable for tests.
import { useState } from 'react';
import { BadgesScreen } from '@/src/ui/components/BadgesScreen';
import { Dashboard } from '@/src/ui/components/Dashboard';
import { Onboarding } from '@/src/ui/components/Onboarding';
import { SettingsScreen } from '@/src/ui/components/SettingsScreen';
import { Frame, Wordmark } from '@/src/ui/components/Shell';
import { useSnapshot } from '@/src/ui/components/useSnapshot';

type Screen = 'dashboard' | 'badges' | 'settings';

export default function App({ now }: { now?: Date }) {
  const { state, setSettings } = useSnapshot();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const clock = now ?? new Date();

  if (state.status === 'loading') {
    return (
      <Frame screen="loading">
        <div className="flex flex-1 items-center justify-center">
          <Wordmark className="text-[14px] opacity-40" />
        </div>
      </Frame>
    );
  }

  if (state.status === 'error') {
    return (
      <Frame screen="error">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Wordmark />
          <p className="text-[11px] text-muted">Couldn&apos;t reach the background. Try closing and reopening the popup.</p>
          <pre className="max-w-full overflow-x-auto text-[10px] text-faint">{state.message}</pre>
        </div>
      </Frame>
    );
  }

  const snapshot = state.snapshot;
  if (!snapshot.onboarded) return <Onboarding onPick={(level) => setSettings({ level })} />;

  if (screen === 'badges') return <BadgesScreen badges={snapshot.badges} onBack={() => setScreen('dashboard')} />;
  if (screen === 'settings') {
    return <SettingsScreen settings={snapshot.settings} onLevel={(level) => setSettings({ level })} onBack={() => setScreen('dashboard')} />;
  }
  return <Dashboard snapshot={snapshot} now={clock} onBadges={() => setScreen('badges')} onSettings={() => setScreen('settings')} />;
}
