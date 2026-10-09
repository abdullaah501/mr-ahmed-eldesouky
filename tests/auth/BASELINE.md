# Auth Baseline — Phase 0 (captured 2026-08-21)

Purpose: know exactly what the authentication system currently does BEFORE changing it.
These tests document current behavior — including confirmed defects — they do not endorse it.
Defect-marked expectations will be inverted in later refactor phases (2, 4, 5, 6, 7).

Run: `npx vitest run tests/auth tests/checkUser.test.js tests/concurrency.test.js`

## Unit-captured current behavior

| Area | Tests | Captured behavior |
|---|---|---|
| Refresh rotation | `refresh-rotation.test.js` R1–R4 | Success rotates refreshToken via CAS; CAS failure = replay → session revoked (`isExp:true`), no new access token |
| Concurrent refresh | `concurrent-refresh.test.js` C1–C2, `checkUser.test.js` T15 | **BUG (A):** concurrent refresh losers are treated as replay → session revoked → forced logout. Root cause of "logged out before 7 days" |
| checkUser | `checkUser.test.js` T1–T14 | Access JWT fast path (zero DB); expired token + `s-i` → in-render refresh; DB user wins over stale JWT claims; tokenVersion enforced |
| Login | `login.test.js` LI1–LI7 | **BUG (D):** dual clocks — access JWT "30m"/refresh JWT "7d" vs cookie MaxAge 1800/604800, all independent literals. Other-fingerprint sessions expired on login. 401/429/403 paths verified |
| Refresh route | `refresh-route.test.js` RE1–RE4 | **FIXED (Phase 4):** refresh route now sets BOTH `access_token` (1800s) AND `s-i` (604800s). The sliding cookie closes defect D — an active user no longer gets logged out at the original login boundary. 401 on failure, 429 when rate-limited |
| getUser | `getUser.test.js` GU1–GU4 | Reads access JWT only; never refreshes; 401 on expired token — this is what triggers the axios interceptor refresh |
| Middleware | `middleware.test.js` MW1–MW5 | Navigate-only refresh (fast path / one fetch / failure pass-through). **BUG (C):** MW4 — SPA/RSC requests (`sec-fetch-mode: cors`) never refresh; checkUser's in-render refresh does not persist the cookie |
| Client identity | `client-identity.test.js` CI1–CI4 | **BUG (B):** global RQ `["user"]` cache survives logout/login; a disabled query ignores new `initialData` when cache exists (CI1); `invalidateQueries` alone does NOT fix it (CI3); `removeQueries` does (CI4 — validates the Phase 5 `invalidateAuth()` design) |
| Logout | `logout.test.js` L1–L5, `logout-after-rotation.test.js` LO1 | `Session.deleteOne` + both cookies cleared; idempotent. **BUG (E/F):** delete means the `isExp` change-stream SSE never fires on logout, so other tabs never learn about it |

## Verified platform facts (spikes)

- **Next 16 cookie mutation:** `cookies().set()` in a Server Component render throws `ReadonlyRequestCookiesError` ("Cookies can only be modified in a Server Action or Route Handler") — `node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js`. Confirms the Phase 3 design: best-effort persistence inside `checkUser()` (try/catch; succeeds in Route Handlers/Server Actions, degrades in RSC).
- **`server-only` guard:** `lib/progress/lessonCompletionService.js` and `lib/progress/progressService.js` import `server-only`, which any test importing `pageActions` must stub (`vi.mock("server-only", () => ({}))` — see `updateUserData.test.js`).
- **Session TTL:** `models/Session.js:7` — TTL index on `createdAt` `expires:"7d"` (login-anchored, not sliding). DB-level; not unit-testable here.
- **Rate limits:** login 5/10min, refresh 30/10min per IP (`lib/routeRateLimit.js`).

## Manual scenario checklist (re-run after Phases 5–7)

| # | Scenario | Current (buggy) expected outcome | Fixed by |
|---|---|---|---|
| M1 | Admin → logout → Student login → dashboard | Sidenav/Navbar show ADMIN until hard browser refresh | Phase 5 |
| M2 | Login → immediate dashboard navigation | Dashboard may render stale/empty identity; refresh fixes | Phase 5 |
| M3 | ~20 concurrent expired requests (or middleware+axios overlap) | Session revoked; user logged out | Phase 2 |
| M4 | Logout from dashboard | Current tab clears after redirect; OTHER tabs stay authenticated; SSE silent | Phases 6–7 |
| M5 | Active user past 7 days from login | Forced logout despite activity (TTL + cookie anchored to login) | Phase 4 |
| M6 | Idle 7 days | Logout (correct) | — |
| M7 | Genuine refresh-token replay (old token, after grace) | Session revoked (correct — must keep working) | Phase 2 (keep) |

## Test conventions (for future auth tests)

- `vi.hoisted` mock store + `vi.mock` factories for `lib/jwt`, `lib/connectToDb`, `models/Session`, `models/User`, `next/server`, `cookie`.
- `lib/trace/index.js` pass-through mock shape: `withCaller/withTracePhase/withHttpTrace` invoke the wrapped fn; emit* are no-ops.
- Route handler mocks: capture `NextResponse.json` data/status; headers.set/append push to an array for Set-Cookie assertions.
- Watch out: destructuring defaults re-apply on `undefined` — pass `null` to omit; `vi.clearAllMocks()` does not clear implementations — use `mockReset()` + re-seed in `beforeEach`.

## Phase 2 overlay

The baseline CAS expectations for concurrent refresh are now replaced by the
Phase 2 grace-window expectations:

- `concurrent-refresh.test.js` C1–C3, `checkUser.test.js` T15, and
  `grace-window.test.js` GW1–GW7 require legitimate concurrent losers to
  succeed without a second rotation or revocation.
- `refresh-rotation.test.js` R2–R4 now model a genuine replay explicitly:
  the re-read session has an unrelated current/predecessor token, or an
  expired predecessor window. Those cases still revoke.
- `axios-interceptor.test.js` AX1–AX5 verify per-tab single-flight behavior:
  20 simultaneous 401s share one refresh call, retries remain bounded, and
  refresh failure rejects all pending requests.
- `pageActions.js:updateUserData` remains a separate direct refresh-token
  replacement path. It is intentionally not changed in Phase 2 and is a
  required Phase 3 boundary review before server-action concurrency is claimed
  fully covered.

## Phase 3 overlay

- `lib/auth/persistAuth.js:persistNewAccessToken` is the new single entry
  point for refreshing the browser access cookie from the auth boundary.
  `lib/checkUser.js` calls it after every successful `refreshAuth`, so the
  prior "refreshed token dropped on most paths" defect (C) is fixed for all
  ~30 consumer sites with zero per-site changes. Route Handler / Server Action
  contexts succeed; Server Component renders degrade silently.
- `pageActions.js:updateUserData` is now grace-compatible via an aggregation
  pipeline update that records the predecessor atomically — Phase 3's
  server-action / refresh boundary is closed.
- New `tests/auth/persistence.test.js` documents the new context-tolerant
  persistence contract (P1–P5). `tests/auth/updateUserData.test.js` U6
  locks the pipeline rotation shape.
- The route-level `if (newAccessToken) cookie.set(...)` blocks in the ~13
  API routes that previously persisted manually are now redundant (they
  duplicate the central write) and are scheduled for removal in Phase 8.
- **Role-authorization inventory** (kept as a stand-alone report; not a fix):
  - CRITICAL — `api/getAdminAnalytics/route.js`: no auth/role guard; public
    admin metrics exposure.
  - High — `api/getStudents/route.js`: any authenticated user can list all
    students.
  - Medium-High — `api/getSubmission/route.js`: no role/ownership guard.
  - Low (OK, owner-scoped) — `student/analytics`, `student/orders`,
    `timeline/response`.
  - Working — `examsResults`, `getEssays`, `getOrderMessages`,
    `progressResults`, `repository/import/presigned`, `timeline-analytics`,
    `usersExamsResults`, `usersExamsResults/[id]`.

## Phase 5 overlay

- `lib/auth/clientSync.js:invalidateAuth` is the single client transition
  contract. It removes the cached React Query `["user"]` data and clears the
  Zustand mirror in one operation; it does not authenticate or originate
  identity.
- The login path now invalidates before seeding the server-returned user.
  `client-sync.test.js` CS1–CS4 prove that a cached Admin cannot override a
  newly logged-in Student and that the operation is idempotent.
- Axios refresh failure uses the same operation at the shared single-flight
  boundary, avoiding N duplicate invalidations from N pending 401s. Full
  logout and cross-tab broadcasts remain Phases 6–7.

## Phase 6 overlay

- Logout is now **flag-revocation**, not deletion: `revokeSession` /
  `revokeUserSessions` set `isExp: true, expiredAt: now` (idempotent via the
  `isExp: {$ne: true}` filter). This makes the `isNewDevice` SSE change
  stream fire on every revocation — logout, password reset, and replay
  detection are now all observable by open tabs — and leaves an audit
  tombstone until the sliding TTL removes the document.
- `tests/auth/logout.test.js` L1–L5 now assert the updateOne flag-revoke
  shape; `tests/routes/reset-password.test.js` and
  `tests/auth/password-reset-invalidation.test.js` assert updateMany.
- `lib/auth/clientSync.js:performClientLogout` is the single client logout
  pipeline (POST → invalidateAuth → refresh → navigate, fail-safe in
  `finally`). `logout-client.test.js` LO1–LO4 lock the order, the
  network-failure convergence, and the redirect override used by the SSE
  path. `useIsNewDevice` no longer duplicates the logout flow.

## Phase 7 overlay

- `lib/auth/clientSync.js` adds `broadcastAuth` / `installAuthSync` —
  `BroadcastChannel('auth')` plus a `storage`-event fallback. The envelope is
  `{type, ts, payload}` and neither transport echoes to the originating
  document. `ClientWrapper` mounts the subscriber on first render and
  invalidates + refreshes server state (and pushes `/login` on
  `session-expired`).
- `performClientLogout` accepts `broadcastType` (default `"logout"`); SSE
  `isExp` uses `"session-expired"` so other tabs redirect, not just refresh.
  `LoginForm` broadcasts `"login"` after seeding the new user so other tabs
  drop the stale identity immediately.
- `tests/auth/cross-tab.test.js` XT1–XT11 lock the transport contract
  (channel + storage), envelope, key-filter, handler-error isolation, and
  the `logout` / `session-expired` broadcast types.

## Phase 4 overlay

- Session lifetime is sliding, anchored to the database row's `expiresAt`
  field (MongoDB TTL index with `expireAfterSeconds: 0`). One clock — the
  cookie `maxAge`, the DB TTL, and the in-process `refreshAuth` check all
  read the same constant (`SESSION_TTL_MS` derived from `REFRESH_TOKEN_TTL`).
- Login, register, every successful refresh, and the `updateUserData`
  pipeline all stamp `expiresAt ≈ now + SESSION_TTL_MS`. The previous
  three independent clocks (JWT 7d / cookie maxAge 7d / DB TTL on
  `createdAt`) collapsed into one.
- The legacy `createdAt` TTL index is dropped by the migration script
  `scripts/migrate-session-ttl.js` (idempotent, supports `--rollback`).
  Old sessions keep their original fixed-7d expiry via the backfill formula
  `expiresAt = createdAt + 7d`.
- `refresh-route.test.js` RE1 and `middleware.test.js` MW2 both now assert
  the sliding `s-i` cookie. `tests/auth/sliding-session.test.js` (SL1–SL5)
  locks the rotation / reject / legacy-null / twenty-rotation invariants.
