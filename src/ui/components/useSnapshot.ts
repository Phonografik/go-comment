// The popup's only data path: one getState on open, and setSettings replaces
// the snapshot with whatever the background answers. Nothing here touches
// storage — the background is the single writer.
import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/src/core';
import { sendMessage, type StateSnapshot } from '@/src/messaging/protocol';

export type SnapshotState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: StateSnapshot };

export function useSnapshot() {
  const [state, setState] = useState<SnapshotState>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    sendMessage('getState', undefined)
      .then((snapshot) => {
        if (live) setState({ status: 'ready', snapshot });
      })
      .catch((err: unknown) => {
        if (live) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      live = false;
    };
  }, []);

  const setSettings = useCallback(async (patch: Partial<Settings>) => {
    const snapshot = await sendMessage('setSettings', patch);
    setState({ status: 'ready', snapshot });
    return snapshot;
  }, []);

  return { state, setSettings };
}
