import { defineBackground } from 'wxt/utils/define-background';
import { setupBackground } from '@/src/storage/background-main';

// The background is the single writer of storage.local. Content scripts and
// the popup only send messages. Everything it does lives in
// src/storage/background-main.ts so it can run under fake-browser in tests.
export default defineBackground(() => {
  setupBackground();
});
