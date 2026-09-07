import { defineContentScript } from 'wxt/utils/define-content-script';
import type { EventType } from '@/src/core/types';
import { mountPipeline } from '@/src/detect/pipeline';
import { SELECTORS_VERSION } from '@/src/detect/selectors';
import { sendMessage, type ActionMessage } from '@/src/messaging/protocol';

// The only thing this script is allowed to do on linkedin.com is WATCH.
// No injected UI, no dispatched events, no network, no content stored, and
// nothing logged. It is a thin mount point: detection lives in src/detect/,
// and src/detect/selectors.ts is the only file that knows LinkedIn.
export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    // The background may be asleep or the extension reloaded from under us;
    // either way a failed send is nobody's problem on the page.
    const quiet = (p: Promise<unknown>) => {
      p.catch(() => {});
    };

    quiet(sendMessage('pageLoad', { selectorsVersion: SELECTORS_VERSION }));

    const unmount = mountPipeline({
      send: (_type: 'action' | 'unconfirmed', data: ActionMessage | { t: EventType }) => {
        if ('ts' in data) quiet(sendMessage('action', data));
        else quiet(sendMessage('unconfirmed', data));
      },
    });

    // An orphaned script (extension updated/reloaded) removes its listeners.
    ctx.onInvalidated(unmount);
  },
});
