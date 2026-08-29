# Branch Notes: feat/frontend-ui-redesign

## 1. Discoveries & Deviations
- **OKLCH Uniformity & Perceptual Contrast**: Upgraded global color tokens to the OKLCH color space; calibrated brand emerald (`oklch(42% 0.16 142)`) to guarantee > 5.2:1 contrast against light canvas surfaces.
- **Zero-Blur Tactile Geometry**: Banish pill buttons (`border-radius: 9999px`) in favor of structured geometric radii (`4px/6px/8px`) and hard offset shadows (`3px 3px 0px var(--color-border-contrast)`).
- **Consensus Auto-Reset on Card Manipulation**: Modifying or rotating cards on the board or in the pool dynamically invalidates prior guesser agreement; requiring explicit auto-reset of `readyVotes = []` to prevent stale submissions.
- **Zero-CDN Compliance**: Eliminated external Google Fonts CDN links from `index.html` in favor of self-hosted local font stacks (`Fredoka` display + `Outfit`/`Lexend` body).
- **Strict Zero-Inline-CSS**: Migrated all dynamic transforms (rotations 0°, 90°, 180°, 270°) and theme variables to discrete CSS classes and semantic styles.

## 2. Blockers & Risks (4a)
- **Concurrent Touch / Mobile Gesture Conflict**: Resolved — tap-and-hold temporary peek on mobile handles context menu suppression via `-webkit-touch-callout: none` and `onContextMenu={(e) => e.preventDefault()}`.
- **Lead Guesser Overrule Safety**: Resolved — gated behind a 2-step confirmation modal with clear warnings to prevent quarterbacking.

## 3. Out-of-Scope Opportunities (4b)
- **Tactile Web Audio Sound Effects**: Subtle synthetic Web Audio click and card-sliding sounds matching the warm tactile tabletop theme.
- **Spectator Turn Browser Notifications**: Web Notification API alerts when it becomes the local player's turn to spectate or guess.
- **Custom Distractor Challenge Mode**: Option to configure 2 or 3 distractor cards per board as detailed in the official rulebook "Add a Challenge" variant.
