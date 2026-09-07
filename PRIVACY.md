# Go Comment — Privacy Policy

**Effective 2026-09-07.** Applies to Go Comment version 2.0.0 and later on Chrome, Edge and
Firefox.

## Summary

Nothing leaves your device. Go Comment counts your own activity on LinkedIn and keeps those counts
in your browser's extension storage. It has no server, sends no analytics, loads no remote code and
never calls LinkedIn's APIs. The only way data gets out is if you export it yourself.

## What it stores

Everything below lives in your browser's local extension storage (`storage.local`), on your device
only. It is never synced to another device; if you change machines, use export and import.

- **An activity log.** One entry per detected action: the type (comment, reply, post, repost with
  thoughts, connection request, or message), a timestamp, and the local calendar day it happened
  on. Nothing else.
- **Per-day totals.** Older log entries are folded into counts per day, per type.
- **Your settings.** The level (weekly target) you chose, and the date you started.
- **Badges** you've earned, with the date each was unlocked.
- **Detection-health counters.** When a linkedin.com page last loaded with the extension running,
  when each action type was last detected, how many hints went unconfirmed per type, and which
  version of the detection rules you're running. Counts and timestamps only. These power the
  "detection may be broken" row in the popup.
- **A cached scoreboard** (streak, points, level progress, mascot stage), recomputed from the log
  whenever anything changes. It can always be rebuilt.
- **Only if you upgraded from version 1:** your version 1 lifetime totals and weekly-streak
  numbers, shown as an archive line, plus a copy of the version 1 data kept for 30 days in case
  the upgrade needs to be undone, then deleted.

Held in memory only (`storage.session`), never written to disk, never exported, and cleared when
you close your browser: a random salt, and the current day's message fingerprints described
below. The fingerprints are also cleared at midnight.

## What it never stores

- The text of any post, comment, reply or message
- Names, yours or anyone else's
- Profile URLs or profile slugs
- Post, comment or activity ids (URNs)
- Links, images, or anything else from the page
- Your browsing on any site other than linkedin.com. The extension doesn't run anywhere else.

## Messages: counting without identifying

Go Comment scores only your first message to each person per day. To do that it has to know
whether you've already messaged someone today, without remembering who. Here is exactly how that
works:

> Go Comment never stores message text, names, profile URLs or post content. To count only your first message to each person per day, it keeps a one-way, randomly salted fingerprint of the conversation id in memory for the current day only. It is deleted at midnight and when you close your browser, cannot be turned back into a person, and never leaves your device.

To be plain about what this is: a salted hash of a conversation id is pseudonymous data. This
policy does not claim "no identifiers ever". The fingerprint is held in memory only, scoped to the
current day, deleted at midnight and on browser close, never written to local storage, never
included in an export, and useless without the random salt that lives and dies with the same
browser session.

## Network: none

Go Comment makes no network requests of any kind. There is no backend, no account, no analytics,
no crash reporting, no telemetry and no remotely loaded code. It never calls LinkedIn's APIs.

This is checked, not just promised. Every build is scanned for the primitives a network call would
need (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`) and for any URL outside
a short allowlist, and the release fails if one is found. The source is public, so you can read the
scan yourself: `scripts/no-network-guard.mjs`.

## Permissions and why

- **`storage`** keeps your counts on your device.
- **`alarms`** runs two scheduled timers: one at midnight (roll the day over, clear the message
  fingerprints) and one at 18:00 (turn the toolbar badge amber if you haven't shown up on a
  weekday).
- **A content script on `https://www.linkedin.com/*`** lets the extension watch the page for the
  outcomes of your own actions. It runs nowhere else. It reads the page; it never changes it, never
  injects anything, and never sends anything.

That is the whole list. There are no host permissions and no optional permissions. Chrome describes
any extension with a content script as able to "read and change your data on www.linkedin.com";
Go Comment only reads, and the test suite asserts that the built permission list is exactly the
one above. On Firefox, the add-on declares its data collection as "none".

## Export and import

The settings page can export everything under "What it stores" as a single JSON file, saved
wherever you choose. The file contains those counts and nothing else: no session data, no
fingerprints. It's yours to keep, move to another machine, or import back (replace or merge).
Nothing is uploaded anywhere in the process, and no download permission is used.

## Deleting your data

- **Uninstall the extension.** Your browser deletes its storage with it.
- **Or reset from the settings page**, which clears everything listed above and starts you from
  zero.

## Accounts, children, and everyone else

There are no accounts, no sign-in and no way for Go Comment to know who you are. It is not directed
at children and collects nothing from anyone. There is no third party: no data processor, no ad
network, no partner. If a future version ever needed to send anything anywhere, this policy would
change first and the extension would have to ask for a new permission. It cannot do that silently:
the permission list is tested and the bundle is scanned.

## Changes to this policy

This policy lives in the repository as `PRIVACY.md` and is published at
[phonografik.github.io/go-comment](https://phonografik.github.io/go-comment/). Any change is a
dated commit you can read, and the effective date at the top moves when the text does.

## Contact

Questions, concerns or a report: open an issue at
[github.com/Phonografik/go-comment/issues](https://github.com/Phonografik/go-comment/issues).

Go Comment is developed by Phonografik (Ryan Mulchrone).

Go Comment is an independent project and is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.
