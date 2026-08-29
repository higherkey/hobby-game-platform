# Branch Notes: feat/event-logging-traceability

## 1. Discoveries & Deviations
- **Silent React StrictMode / Hook Cleanup Bug**: Discovered that `useEffect(..., [clientInstance])` in `App.tsx` was inadvertently cancelling `connectingTimeoutRef` immediately upon setting the client instance state on room join, which caused the 30s connection timeout to never fire.
- **Isomorphic Environment Formatting**: Browser DevTools requires `%c` CSS styling, whereas Node/Render requires clean ISO terminal output.
- **Silent Telemetry Loop Risk**: Telemetry errors must be isolated with an un-hooked transport so logging a failed telemetry request cannot cause recursive log storms.
- **Consensus Reset on Card Manipulation**: Modifying or rotating cards on the board or in the pool dynamically invalidates prior guesser agreement; requiring explicit auto-reset of `readyVotes = []` to prevent stale submissions.
- **Strict Zero-Inline-CSS Mandate**: All dynamic transformations (card rotations 0°, 90°, 180°, 270°) and theme variables migrated to discrete CSS classes and OKLCH design tokens.

## 2. Blockers & Risks (4a)
- **Stale LocalStorage Credentials**: If a player joined a match before a database reset, `joinRoom` was reusing unverified cached credentials that the server silently rejects during WebSocket `sync`. (Resolution: Handle 401 rejection by clearing stale cache and prompting clean re-join).
- **Parallel UI Redesign Sync**: Resolved — Universal AI Design System (v2) tokens, 3-mode mobile focus, and consensus mechanics integrated cleanly with logging and telemetry layers.
- **Concurrent Touch / Mobile Gesture Conflict**: Tap-and-hold peek on mobile can trigger default browser callout menus. (Resolution: Handled via `-webkit-touch-callout: none` and `onContextMenu={(e) => e.preventDefault()}`).

## 3. Out-of-Scope Opportunities (4b)
- **Live Log Streaming in Admin Dashboard**: WebSocket push events for real-time admin log tailing instead of polling / ring-buffer queries.
- **Web Audio Sound Effects**: Subtle tactile click/card-placement audio cues conforming to the warm tactile tabletop theme.
- **Spectator Turn Browser Notifications**: Web Notification API alerts when it becomes the local player's turn to spectate or guess.
- **Custom Distractor Challenge Mode**: Option to configure 2 or 3 distractor cards per board as detailed in the official rulebook "Add a Challenge" variant.

