import { defineContentScript } from 'wxt/utils/define-content-script';

// The only thing this script is allowed to do on linkedin.com is WATCH.
// No injected UI, no dispatched events, no network, no content stored.
// Detection (hints + outcomes) arrives in src/detect/ — this file stays a
// thin mount point so `selectors.ts` remains the only file that knows LinkedIn.
export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    // Detection pipeline mounts here.
  },
});
