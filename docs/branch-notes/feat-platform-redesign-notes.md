# Branch Notes: feat/platform-redesign

## 1. Discoveries & Deviations
- Platform transitioned from "So Clover! Platform" to generic **HobbyBoard** online tabletop platform.
- Banishment of over-rounded rectangle "AI look" (36px / pill buttons) in favor of tactile 4px/6px/8px radii and zero-blur 2px/3px offset shadows.
- Multi-page navigation implemented: Home, Play (Game Directory + filterable live matches), Admin, and Game match views.
- Lightweight Magic Link auth (`/api/auth/magic-link`, `/api/auth/verify`, `/api/auth/me`) + Guest account profiles.
- Fixed desktop (side-by-side) and mobile (stacked / 3-mode focus) in-game viewport toggles.

## 2. Blockers & Risks (4a)
- None.

## 3. Completed Quick Low-Complexity Opportunities (4b)
- [x] Deep linking into specific games via query hash (`#play?game=so-clover` or `#play`).
- [x] Simulated 1-click magic link auto-login button in modal during development for instant testing without an SMTP server.
- [x] Real-time live room filtering by game, open seats, and search query with 2.5s dynamic sync.
- [x] Configurable "House Rule" option for So Clover allowing a single card to be rotated during secret clue writing (with net-delta tracking, multi-player auth, and UI slot controls).
- [x] Componentized `<GameRoomSettings />` and in-game `<RoomSettingsModal />` with real-time `updateGameOptions` move synchronization and automatic disable resets.

## 4. High-Complexity / Breaking Deferred Opportunities (4c)
- Integration with external OAuth providers (Google / GitHub) or SMTP email gateways (Postmark / Resend) if needed in future production stages.
