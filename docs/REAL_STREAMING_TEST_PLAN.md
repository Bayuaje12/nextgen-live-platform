# Real Streaming Verification Plan

Status: **BLOCKED in current Termux environment** (no two independent physical browsers/devices verified here). Do not mark live tests PASS without execution evidence.

## Prerequisites

- Supabase configured and migrations `0001_init.sql`, `0002_hardening.sql`, `0003_room_permissions.sql` applied.
- Web and server running with valid env vars.
- Two independent browser sessions/devices (prefer desktop + mobile or two separate browser profiles/devices).
- Camera/microphone permissions available.

## Test Matrix

| ID | Scenario | Steps | Expected | Status |
|---|---|---|---|---|
| RT-01 | Host creates room | Login as host, create room, confirm slug/invite link | Room created, host member joined | BLOCKED |
| RT-02 | Guest joins room | Open invite in second browser, submit guest name/password if needed | Guest enters waiting or joined state per room config | BLOCKED |
| RT-03 | Guest approval | Host approves pending guest | Guest status becomes approved/joined; can enter studio | BLOCKED |
| RT-04 | Camera publishing | Approved guest enables camera | Local preview visible; remote peer receives video track | BLOCKED |
| RT-05 | Microphone publishing | Approved guest enables mic | Remote peer hears audio; mute/unmute reflected | BLOCKED |
| RT-06 | Remote video rendering | Host and guest in same room | Both see remote video tiles | BLOCKED |
| RT-07 | Remote audio playback | Both publish audio | Audio audible; no severe echo in normal setup | BLOCKED |
| RT-08 | Camera toggle | Toggle camera off/on | Track disabled/enabled or replaced; remote sees change | BLOCKED |
| RT-09 | Microphone toggle | Toggle mic off/on | Remote audio mutes/unmutes | BLOCKED |
| RT-10 | Screen sharing | Start screen share | Shared screen replaces camera track for peers | BLOCKED |
| RT-11 | Screen-share stop | Stop screen share | Camera restored; tracks cleaned up | BLOCKED |
| RT-12 | Participant removal | Host removes guest | Guest loses access/publish/chat; UI updates | BLOCKED |
| RT-13 | Host ends room | Host ends room | Room status ended/locked; participants disconnected gracefully | BLOCKED |
| RT-14 | Unexpected disconnect | Disable network on guest briefly | Status shows reconnect/disconnect; app handles gracefully | BLOCKED |
| RT-15 | Reconnection | Restore network | SDK reconnects or user can rejoin; no duplicate zombie tracks | BLOCKED |
| RT-16 | Media cleanup | Leave/end room | Local camera/mic/screen tracks stopped; listeners removed | BLOCKED |

## Evidence to capture

- Browser console logs/screenshots per test.
- Network condition (Wi-Fi/mobile/NAT).
- Browser/device/OS versions.
- Supabase room/member/chat rows before/after sensitive actions.
- Any SDK error events (`connectionFailed`, `disconnected`, `reconnecting`).

## Security checks during live test

- Unapproved guest cannot publish or chat.
- Private room URL does not grant access without authorization.
- Removed guest cannot re-publish/chat.
- Locked room rejects new joins.
