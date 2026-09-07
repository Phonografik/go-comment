import { beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Every date-sensitive test runs in Europe/London so DST transitions are real
// (BST starts on the last Sunday of March, ends on the last Sunday of October).
// calendar.test.ts asserts this actually took effect.
process.env.TZ = 'Europe/London';

// WxtVitest stubs the `chrome` / `browser` globals with @webext-core/fake-browser,
// an in-memory implementation of storage, alarms, runtime messaging, action…
// Its state persists across tests in a file unless reset, so reset it before
// every test — storage is empty, listeners are gone, alarms are cleared.
beforeEach(() => {
  fakeBrowser.reset();
});
