# PowerMySport — Community

Social layer of PowerMySport: Q&A feed, blog/"Experiences" publishing, group discovery, and real-time chat. Next.js 16 (App Router, Turbopack), React 19. Runs on port 3002 and talks to the same backend API as `client/` and `admin/` (`NEXT_PUBLIC_API_URL`, cookie/token-based auth).

## Getting started

```bash
npm install        # from the repo root — this app is an npm workspace
npm run dev         # community/ — next dev -p 3002
```

Copy `.env.example` to `.env.local`. Key vars: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` (realtime), `NEXT_PUBLIC_MAIN_APP_URL`, `NEXT_PUBLIC_CHAT_BUCKET_DOMAIN`, `NEXT_PUBLIC_SITE_URL`.

## Scripts

| Script                            | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `npm run dev`                     | Dev server on port 3002                      |
| `npm run build` / `npm start`     | Production build / serve                     |
| `npm run lint`                    | ESLint                                       |
| `npm run typecheck`               | `tsc --noEmit` against `tsconfig.check.json` |
| `npm test` / `npm run test:watch` | Vitest                                       |

## Structure

```
src/
  app/         Next.js App Router routes
  lib/         api, auth, db (IndexedDB chat cache), hooks, realtime (sockets), seo, toast
  modules/
    community/ Main domain — components below
    sports/    Sport-selection widgets (fuzzy search via fuse.js)
```

### `modules/community/components`

- `blog/` — "Experiences" (formerly blog) authoring and viewing: editor, profile modal, comments, likes, category picker
- `chat/` — 1:1 and group messaging UI (conversation list, bubbles, voice messages, report/delete)
- `contributors/` — top-contributor leaderboard
- `discover/` — community/group discovery, creation, player detail modals
- `layout/` — top nav, notification toast listener
- `page/` (+ `page/home`) — home feed, Q&A feed/detail, ask-question modal, filters, hero search
- `seo/` — JSON-LD structured data

Rich text is authored with Tiptap and sanitized with DOMPurify (`modules/community/utils/sanitizeHtml.ts`) before rendering via `dangerouslySetInnerHTML` — never skip that step when touching blog/experience rendering.

## Real-time (`src/lib/realtime/socket.ts`)

A single `socket.io-client` instance connects to a `/community` namespace. Rooms: `qna:feed`, `blog:feed`, `qna:post:<id>`, `blog:<id>` (ref-counted subscribe/unsubscribe), plus per-conversation chat rooms.

**Room membership does not survive a reconnect on the server** — a new socket id starts in no rooms. The client replays every subscribed room and joined conversation on the `connect` event; skipping this on any future rewrite of the socket layer means a reconnecting user silently stops receiving Q&A/blog/chat updates. Chat messages are additionally cached locally via `idb-keyval` (`lib/db/chatDB.ts`) so a conversation still renders from cache immediately after reconnect.

## Testing

`tests/socket.test.ts` covers singleton creation, namespace URL resolution, auth-token attachment, room ref-counting, and reconnect replay — the socket layer's correctness rests almost entirely on this file. No architecture-ratchet tests here yet (unlike `client/`).

## Environment variables

See `.env.example` for the full list, including a commented waitlist-mode flag.
