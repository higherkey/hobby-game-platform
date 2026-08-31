# 🍀 Hobby Game Platform

A lightweight, extensible multiplayer turn-based board game platform powered by [boardgame.io](https://boardgame.io/), React, Vite, and TypeScript.

---

## 🌐 Live Deployments

- **Live Production App (Render)**: [https://hobby-game-server.onrender.com](https://hobby-game-server.onrender.com)
- **Frontend Vercel Deployment**: [https://hobby-game-platform-pqv4b1yjp-higherkeys-projects.vercel.app](https://hobby-game-platform-pqv4b1yjp-higherkeys-projects.vercel.app)

---

## 🏛️ Platform Core Architecture

The platform architecture is designed around clean, reusable, decoupled base classes and robust backend persistence:

### 1. `BaseGame<G, Ctx>` ([`src/core/Game.ts`](file:///c:/Programming/hobby-game-platform/src/core/Game.ts))
- **Strict JSON-Serializable State Enforcement**: Automatically checks and asserts at runtime that the developer-managed game state `G` consists purely of JSON-serializable structures (plain objects, arrays, primitives, null) and strictly rejects functions, classes, Symbols, or circular references.
- **Pure Move Functions**: Enforces deterministic, side-effect-free moves `({ G, ctx, events }, ...args) => G | void`.
- **Phases & Stages Support**: Declarative wrappers for game phases (e.g. `clue_writing`, `resolution`) and individual player stages.
- **Config Export**: `toBoardgameConfig()` produces a clean, compliant `Game` definition for boardgame.io.

### 2. `BaseRoom<G>` ([`src/core/Room.ts`](file:///c:/Programming/hobby-game-platform/src/core/Room.ts))
- **Matchmaking & Lobby Interface**: Interfaces with `boardgame.io/client` `LobbyClient` for creating matches, joining seats, listing active rooms, and leaving rooms.
- **Session Persistence**: Stores player seat credentials and room tokens in `localStorage` for seamless reconnections.
- **Client Synchronization**: Supports both local hotseat/pass-and-play clients (`Local()`) and real-time remote WebSocket clients (`SocketIO()`).

### 3. `BaseServer` ([`src/core/Server.ts`](file:///c:/Programming/hobby-game-platform/src/core/Server.ts))
- Encapsulates `boardgame.io/server` for hosting multiplayer matches with Koa and Socket.io.
- **Unified Monolith Deployment**: Automatically serves the production React SPA bundle (`dist/`) directly alongside the API and WebSocket listeners.
- **PostgreSQL Persistence & Game History**: Stores matches and historical match results in PostgreSQL when `DATABASE_URL` is configured, with fallback in-memory operation.
- **Telemetry & Admin API**: Built-in endpoints for monitoring active connections, server logs, latency tracking, match administration, and room garbage collection.

---

## 🎮 Games

### 1. *So Clover!*
A full digital clone of the cooperative word-association party game **So Clover!** by François Romain.

#### Rules & Mechanics ([`src/games/so-clover/game.ts`](file:///c:/Programming/hobby-game-platform/src/games/so-clover/game.ts))
1. **Secret Setup**: Each player receives a 4-leaf clover board (2x2 grid) with 4 keyword cards placed randomly with secret rotations.
2. **Phase 1: Choosing Clues**: Players secretly formulate 4 single-word clues that tie together the outer keyword pairs (North, East, South, West).
3. **Phase 2: Resolution**:
   - For each player (the *Spectator*), a 5th *distractor card* is shuffled into their pool, and all cards are removed from the clover.
   - Teammates work together to place and rotate the keyword cards onto the clover board slots.
   - **First Attempt**:
     - If all 4 slots and rotations are correct: **+6 points** (+1 pt per card + 2 bonus points)!
     - If any errors exist: Incorrect cards are returned to the pool while correct cards remain locked on the board.
   - **Second Attempt**: Teammates reposition the remaining cards. **+1 point per correct card** (0 to 4 pts).
4. **End Game**: Team score is evaluated against the official *Record of Legends* ratings (Grand Masters, Heroes, Botanists, Apprentices).

### 2. *Counter Game*
A minimal reference counter example verifying multi-game registration, dynamic phase transitions, and turn synchronization.

---

## 📱 Mobile-First Frontend & Desktop Board View Toggle

- **Mobile-First UX**: Responsive vertical layout tailored for touch interactions, card tap-to-rotate, and quick slot placement.
- **Desktop All-In-One Board View Toggle**: Instant header toggle switch enabling side-by-side view of the full 4-leaf clover board, 4 clue banners, and keyword card tray.
- **Strict CSS Architecture**: Zero inline styles, zero `!important`, structured into modular external stylesheets (`main.css`, `clover.css`, `lobby.css`, `score.css`).

---

## 🛠️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listening port | `8000` |
| `DATABASE_URL` | PostgreSQL connection string | `undefined` (in-memory mode) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `*` |
| `VITE_SERVER_URL` | Frontend API & Socket.io server target | Auto-detected |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Client
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Run the Multiplayer Server
```bash
npm run server
```
The server will start listening on port `8000` (or `process.env.PORT`).

### 4. Run Unit & Component Tests
```bash
npm test
```

### 5. Run End-to-End Tests
```bash
npm run test:e2e
```

### 6. Build for Production
```bash
npm run build
```
