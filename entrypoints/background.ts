import { defineBackground } from 'wxt/utils/define-background';

// The background is the single writer of storage.local. Content scripts and
// the popup only send messages. Storage, migration, DM hashing, the toolbar
// badge and the two alarms all arrive here in later milestones.
export default defineBackground(() => {
  // Nothing yet.
});
