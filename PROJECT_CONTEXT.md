# Project Context

> **AI import → Question Bank staleness (latest):** root cause after 4 prior "fixes" — the modal refresh was gated on `Number(report.imported) > 0` (`AIGeneratorModal.jsx:handleImport`), but `preFlightStage.js` dedupes by `sha256` of the generated file and `ImportPipeline` resolves `success:true` with `imported:0, skipped:1` (`already_imported`), while an aborted earlier run may have persisted server-side (import chain has no abort-signal checks; route keeps running `ai()` after client disconnect). `isAlreadyImported` matches soft-deleted docs (no status filter); generation is Redis-cached/deterministic so retests reproduce identical hashes. Plus `importing={false}` was hardcoded on the ValidationStep import button (no disable/feedback → double-click aborts run 1 client-side while the server completes it). Fix: invalidate on any non-cancelled resolved import (`result && result.cancelled !== true`) + `importing={workflow.step === "importing"}`. Contract test 3 rewritten to lock the corrected gate. Component suite 57/57 green; build passes. Flagged, NOT fixed: same `imported > 0` gate in `RepositoryClient.handleImportSuccess` (file-import path); ✕ close button clickable during import; refactor regression `subject: "Math"` default in AIGeneratorModal source state (was `"الرياضيات"`).

> **Post-upload audit:** an upload/merge restored the old AccessCode/GradeAccessGrant island (15 runtime files + 3 tests + grantRules.js) as orphaned-but-URL-reachable routes. Verified the rest of the tree matched the approved implementation (mode=admin signup, self-service grade change, ScheduleEvent, LecturePlayer preview, query-key fix, notifications, auth freeze, English UI keeps) and re-removed the stack. Build + full suite green. `deriveGrantStatus`/grant helpers no longer exist anywhere; gradeAuth exports only the ID-based API.

## Overview

Education platform with Next.js application code, a question-system plugin architecture, and an AI platform under `lib/ai`.

## Architecture Map

- `src/app`: Next.js routes, UI, and repository question-generation flow.
- `src/question-system`: question-type plugins, normalization, validation, grading, and import integration.
- `lib/ai/providers`: provider adapters, model catalogs, capability resolution, and provider registry.
- `lib/ai/prompts`: versioned prompt templates and prompt registry/manager.
- `lib/ai/workflows`: knowledge extraction, question generation, canonical JSON, repository import, and shared artifacts.
- `lib/ai/schemas`: registered workflow schemas, including StructuredContext and DraftQuestions.
- `lib/ai/cache`: deterministic generation/cache keys and cache adapters.
- `tests/ai`: AI platform and workflow verification tests.

## Conventions

- Prompt versions are registered by task and selected through `AI_PROMPT_*` environment settings.
- `v1` prompt files are immutable once versioned; new prompt behavior uses a new version.
- ImportEngine dry-run remains the authoritative import validator.
- Provider/model IDs remain part of deterministic cache keys.
- Keep changes scoped and preserve existing architecture.

## Current State

- C1/C2 AI foundation and C2.5 UI integration are implemented.
- Wave 1 stabilization is complete: navigation, stale artifacts, resource handling, cancellation, StructuredContext unwrapping, enum mapping, and generation cache parameters were fixed.
- AI verification currently has 194 passing tests across 32 files; the application build passes.
- Wave 2 Prompt Hardening v2 is approved for implementation. Scope is limited to the question-generation prompt, its version wiring, and approved deterministic tests. No schema change is planned.

## Wave 2 (Prompt Hardening v2) — Complete

- Added `lib/ai/prompts/question-generation/v2.js`: self-registered `question-generation@v2` with the 13-section structure (system role, non-negotiable rules, allowed types, per-type contracts, fitness check, canonical enums, grounding, Arabic rules, output contract, forbidden behaviors, input context, generation parameters).
- Canonical grade/subject/difficulty enums are interpolated at render time from `constants/grades.js`, `constants/subjects.js`, `constants/questionDifficulty.js` (grade/subject = exact Arabic labels; difficulty = internal English value only).
- Contracts match the actual plugin source: MCQ >= 4 options; true-false `صح`/`خطأ` no hedging; essay free-form only; fill-blank `____` + `options[]` (3+ candidates, exactly 1 `isCorrect`); matching `config.pairs[]` >= 2, `correctAnswer` left empty.
- Wiring: `lib/ai/prompts/question-generation/index.js` adds `import "./v2"`; `lib/ai/config/env.js` code default changed to `"v2"` (rollback = `AI_PROMPT_QUESTION_GENERATION=v1` in `.env`, currently set there).
- No schema changes; `v1/**` files untouched (git diff clean).
- New deterministic test file `tests/ai/questionGenerationPrompt.test.js` (26 tests): versioning, v2 prompt content, enum interpolation, fixture schema assertions, canonical enum mapping. No live API calls.
- AI suite: 220 tests across 33 files pass; eslint clean; build passes.

## Phase C2.5 Fill-Blank Schema Consolidation — Complete

- Canonical fill-blank candidates now live in `options[]` as `{ id, text, isCorrect }`; `config` contains behavior settings only (`caseSensitive`). `fill-blank/core.js` is the single normalization boundary and converts legacy `config.answers` only when `options` is absent.
- Updated fill-blank validation (minimum 3 candidates, unique non-empty text, exactly one correct candidate, matching `correctAnswer`) and grading (only `isCorrect:true` is accepted while preserving case behavior). Updated Editor, Preview, Renderer, import detector/parser, DOCX exporter, AI schema/prompt, canonical mapping, model schema, and client DTOs.
- Draft-question schema/cache version is `2`; canonical JSON metadata is `2`, preventing reuse of old cached generation shapes. v2 prompt was updated in place per decision.
- Added consolidation regression coverage and updated import/AI fixtures. AI/import plus question-system verification: 298 tests pass; build compiles. Full-suite unrelated auth/student-orders baseline failures remain outside this task.

## AI Review Editor Reuse Fix — Complete

- Root cause: `QuestionWorkspace` initialized local question state once and never synced when the `question` prop changed; AI drafts lack stable ids, so Review edits showed stale `correctAnswer`/options.
- Fix 1 (`QuestionWorkspace.jsx`): render-phase identity sync — local state resets only when the `question` prop reference changes (new draft/regenerated/parent-saved); same-reference re-renders preserve unsaved local edits. Shared `buildInitialState` replaces the inline initializer.
- Fix 2 (`ReviewStep.jsx`): assigns each id-less draft a stable local `id` (`draft-{index}`) via a WeakMap cache; the id persists into the stored draft through the normal save path. No plugin, workflow, or schema changes; the existing plugin editors (e.g. `multiple-choice/Editor.jsx`) are untouched and reused as-is.
- Tests: `tests/components/aiReviewEditorReuse.test.js` (4 tests, mocked-react element-tree convention): correct option rendered from `correctAnswer`, select→C→onSave delivers `"c"` with untouched options/valueText, identity-based sync preserving unsaved edits, ReviewStep reuse + stable ids + onSave→onChange wiring.
- Infra: `vitest.config.js` now maps the `@` alias to `./src` (matches jsconfig paths), enabling component imports in tests.
- Verification: 700 tests pass (same 7 pre-existing unrelated auth/orders failures); build compiles.

## Final AI Generator Stability Fix — Complete

- Duplicate safety: `useAiWorkflow.duplicateQuestion` strips `id`/`_id`; `ReviewStep` assigns collision-safe local ids without changing plugin editors or workflow payloads.
- Extraction: default prompt selection is now `v2` (`AI_PROMPT_EXTRACTION=v1` remains the rollback); `aiExtractionStage` converts only non-empty string StructuredContext list fields to one-item arrays and leaves malformed objects/numbers for clear schema failure.
- Error attribution: fallback behavior is unchanged; task failures retain requested provider/model, actual provider/model, fallback flag, and providers tried in `AiError.extra`, stage errors, hook debug metadata, and concise UI text.
- Run/cache stability: new extraction runs clear downstream context, artifacts, drafts, progress, errors, and generation settings while preserving provider/model selection. Generation cache input strips only `_meta` bookkeeping (`provider`, `model`, prompt/schema metadata, timestamp) and preserves semantic confidence metadata/context fields.
- Source copy now lists only the file formats supported by the selected model/local extractors; PDF/DOCX local extraction remains enabled for all models where implemented.
- Added focused stability regressions. Full `npm test`: 706 passing with the same 7 unrelated auth/student-orders failures; affected AI/component tests: 240 passing; lint has 0 errors (existing JSX ignore warnings); build compiles.

## StructuredContext / MissingInfo Flow Fix — Complete

- Separated structural validation from completeness assessment without changing the public `assertStructuredContext` contract. Structurally valid incomplete extraction now returns successfully with `AI_CONTEXT_INCOMPLETE` warnings; malformed shapes remain fatal.
- Added optional canonical subject, grade, and lesson-title inputs to the AI source step. Non-empty teacher hints flow through extraction, override extracted metadata fields authoritatively, reach extraction v2, and participate in extraction cache identity.
- Existing MissingInfo collection is now reachable for incomplete contexts. Added optional `lessonTitle` to `requiredFields`; the existing inspect/merge/form path remains authoritative.
- Replaced internal StructuredContext teacher-facing wording with Arabic structural-error messaging while retaining internal details; MissingInfo displays dynamic Arabic clarification bullets from `missingFields` labels.
- Added focused StructuredContext flow tests covering incomplete/invalid extraction, teacher metadata precedence and prompt propagation, MissingInfo merging, cache hint identity, dynamic Arabic messaging, and internal error retention. AI/flow verification: 31 focused tests and 714 full-suite passes; same 7 unrelated auth/student-orders failures remain. Build compiles; affected lint has 0 errors with existing JSX ignore warnings.

## Reusable Building Blocks

- `lib/trace` — request-scoped tracing (emit\*/withCaller/withHttpTrace) used across auth routes; pass-through mock shape documented in `tests/auth/BASELINE.md`.
- `lib/securityLogger` — non-blocking security event logger (LOGIN_SUCCESS, REFRESH_REPLAY_DETECTED, SESSION_ROTATED...).
- `tests/auth/*` — auth behavior suite (vitest; conventions in `tests/auth/BASELINE.md`).
- `lib/services/sessionService.js` — revokeSession/revokeUserSessions.

## Auth Refactor — Phase 1 (Central Auth Config) — Complete

- New `lib/auth/config.js` — SINGLE source for auth constants: `ACCESS_TOKEN_TTL="30m"`, `REFRESH_TOKEN_TTL="7d"`, cookie names (`access_token`/`s-i`), `authCookieOpts()/accessCookieOpts()/sessionCookieOpts()` (policy byte-identical to before), `serialize{Access,Session,Cleared{Access,Session}}Cookie()` helpers (wrap the `cookie` package). Cookie maxAges are DERIVED from the TTL strings via `ttlToSeconds` (1800 / 604800) — future 3m/7m test config is a 2-constant edit.
- Wired (values unchanged): `api/auth/login`, `api/auth/register`, `api/auth/refresh`, `api/auth/logout`, `middleware.js` (cookie reads/writes + internal refresh header), `lib/refreshAuth.js` (signJWT literals — small plan deviation: plan said don't touch refreshAuth in P1, but the constant swap was required for the "no literals in issuing paths" exit criterion), `pageActions.js` (`ACCESS_COOKIE_OPTS` now from config; `updateUserData` signJWT literals + inline cookie.set swapped).
- NOT changed (by design, later phases): ~16 consumer call sites with inline `maxAge: 60*30` in pageActions/repositoryActions/API routes (Phase 3/8), `models/Session.js` TTL `expires:"7d"` (Phase 4 sliding), `lib/jwt.js` default param.
- New `tests/auth/config.test.js` (CFG1–6): locks constants, cookie policy, and exact Set-Cookie strings (incl. epoch-expires logout form) so the 3m/7m switch later is provably one-edit.
- Verification: auth suite 82/82; full suite 763+ passing with only the pre-existing unrelated `studentOrders` failure; eslint clean; `npm run build` passes (middleware/Edge bundle accepts `lib/auth/config` + `cookie` import).
- Rollback: single revert of `lib/auth/config.js` + the 7 wired files (no schema/cookie/behavior changes anywhere).

## Auth Refactor — Phase 2 (Refresh Concurrency) — Complete

- `lib/refreshAuth.js`: successful CAS rotations now record `previousRefreshToken` + `previousRefreshTokenExpiresAt`; CAS failures are classified by a fresh session read. Exact predecessor inside the grace window is a legitimate concurrent loser and receives a new access token without a second rotation or revocation. Unknown/expired predecessors still trigger `isExp` revocation. `AUTH_GRACE_WINDOW_MS` defaults to 30s; `0` restores the old punitive behavior as a rollback flag.
- `models/Session.js`: additive predecessor fields added; no migration or TTL change in this phase.
- `lib/axios/axios.js`: module-scoped single-flight refresh coordinator; concurrent 401s in one tab share one `/api/auth/refresh` call and each retry once. Existing refresh-failure behavior remains unchanged; client invalidation is Phase 5.
- Tests: updated old CAS-collision expectations and added `tests/auth/grace-window.test.js` (7 tests) plus `tests/auth/axios-interceptor.test.js` (5 tests). Auth/concurrency suite: 95/95 passing across 20 files.
- Verification: lint clean; `npm run build` passes; full suite retains only the pre-existing unrelated `tests/routes/studentOrders.test.js` failure.
- Known boundary for Phase 3: `pageActions.js:updateUserData` directly replaces `Session.refreshToken` outside `refreshAuth`; it remains a separate token-rotation path and must be centralized or made compatible before claiming all server-action/refresh races are covered.

## Auth Refactor — Phase 3 (Refresh Persistence Correctness) — Complete

- New `lib/auth/persistAuth.js` — single best-effort persistence helper (`persistNewAccessToken`) that calls `cookies().set` inside a `try/catch`. Throws `ReadonlyRequestCookiesError` in Server Component renders (verified earlier against Next 16); succeeds in Route Handlers and Server Actions. Never throws.
- `lib/checkUser.js` now calls `persistNewAccessToken(result.newAccessToken)` after a successful refresh — fixing Invariant 6 (refreshed token never dropped) for **every** existing consumer with zero per-call-site changes. Existing route-level `if (newAccessToken) cookie.set(...)` blocks become redundant (still safe to remove in Phase 8).
- `src/app/actions/pageActions.js:updateUserData` now performs an atomic rotation via a Mongo aggregation pipeline update, capturing the outgoing refresh token as `previousRefreshToken` and stamping `previousRefreshTokenExpiresAt = now + REFRESH_GRACE_WINDOW_MS`. A concurrent in-flight `refreshAuth` holding the old token is now treated as a legitimate concurrent loser instead of a replay — server-action / refresh race resolved.
- New `tests/auth/persistence.test.js` (P1–P5): verifies that `checkUser()` writes the access cookie with the canonical opts (Route Handler / Server Action context), degrades silently in RSC render, leaves the cookie untouched on the fast path and on failure, and that the helper is a no-op for falsy tokens. `tests/auth/updateUserData.test.js` U6 verifies the pipeline rotation shape.
- **Role-authorization gap inventory** (report only — no fixes in scope):
  - **CRITICAL:** `src/app/api/getAdminAnalytics/route.js` has no `checkUser` and no role guard — global admin metrics are reachable unauthenticated.
  - **High:** `src/app/api/getStudents/route.js` has no role guard — student list to any authenticated user.
  - **Medium-High:** `src/app/api/getSubmission/route.js` has no role/ownership guard.
  - **Low (owner-scoped, OK):** `student/analytics`, `student/orders`, `timeline/response` scope by caller `user._id`.
  - Routes with working role checks (unchanged): `examsResults`, `getEssays`, `getOrderMessages`, `progressResults`, `repository/import/presigned`, `timeline-analytics`, `usersExamsResults`, `usersExamsResults/[id]`.
- Verification: auth/concurrency suite 21 files green; full suite retains only the pre-existing unrelated `studentOrders` failure; eslint clean (advisory only); `npm run build` passes.

## Auth Refactor — Phase 4 (Sliding Session Lifetime) — Complete

- **One authoritative clock:** `Session.expiresAt` is the single source of truth for session lifetime. Login/register stamp `expiresAt = now + SESSION_TTL_MS` on creation; every successful `refreshAuth` rotation slides it forward to `now + SESSION_TTL_MS`; `updateUserData`'s profile/role rotation also slides it.
- **Mongo TTL index moved:** `models/Session.js` no longer carries `expires: "7d"` on `createdAt`. `expiresAt` uses `expires: 0` → Mongoose emits `expireAfterSeconds: 0` (absolute-date TTL). `createdAt` is kept as an audit field with no TTL.
- **Refresh tokens now slide too:** `refresh` route and middleware both re-issue the `s-i` cookie with the sliding `SESSION_COOKIE_MAX_AGE` whenever the access token is refreshed.
- **Explicit expiry check in `refreshAuth`:** because MongoDB's TTL monitor runs ~every 60s, a session whose `expiresAt` just passed may still be readable; `refreshAuth` now rejects with `reason: "session_sliding_expired"` to avoid issuing tokens for a logically-expired session.
- **Backward-compatible for legacy sessions:** a session with `expiresAt: null` (pre-migration, never refreshed) is allowed through and stamped forward on the next successful refresh.
- **Migration script `scripts/migrate-session-ttl.js`:** idempotent forward + rollback (`--rollback`). Forward: backfills `expiresAt = createdAt + 7d` for existing sessions, drops the old `createdAt_1` TTL index, creates `expiresAt_1` with `expireAfterSeconds: 0`. Backward-compat note: sessions whose `createdAt` predates the migration keep their original fixed-7d window because the backfill formula is `createdAt + 7d`.
- **New `tests/auth/sliding-session.test.js` (SL1–SL5):** winner stamps `expiresAt ≈ now + TTL`, loser leaves `expiresAt` untouched, session past `expiresAt` is rejected, `expiresAt: null` legacy sessions pass through and are stamped on the next refresh, twenty back-to-back rotations all remain valid.
- **Updated tests:** `refresh-route.test.js` RE1 (s-i now re-issued), `middleware.test.js` MW2 (s-i cookie slides on hard navigation), `login.test.js` LI1 (session created with `expiresAt ≈ now + TTL`), `updateUserData.test.js` U6 (pipeline rotation slides `expiresAt`), `checkUser.test.js` T15 seed (refreshed session carries `expiresAt: null` in the reread for the grace scenario).
- **Verification:** auth/concurrency suite **22 files green** (101 tests); full suite retains only the pre-existing unrelated `studentOrders` failure; eslint clean (advisory only); `npm run build` passes; `git diff --check` clean.

## Auth Refactor — Phase 5 (Client Identity Synchronization) — Complete

- New `lib/auth/clientSync.js` — one `invalidateAuth(queryClient?)` operation removes the React Query `["user"]` entry and clears the Zustand user mirror atomically. `registerAuthQueryClient` lets non-hook callers (Axios) use the active root QueryClient without adding an AuthProvider.
- `lib/QueryProvider.js` registers its existing singleton QueryClient via an effect; no provider/state-management replacement.
- `LoginForm.jsx` calls `invalidateAuth(queryClient)` after successful login and before seeding the newly returned user, preventing a prior Admin cache entry from overriding a Student `initialData` payload.
- `lib/axios/axios.js` calls the same operation once at the shared single-flight refresh failure boundary; all pending 401 callers still reject together, while client identity converges to unauthenticated. Full logout pipeline remains Phase 6.
- New `tests/auth/client-sync.test.js` (CS1–CS4): RQ + Zustand atomic clear, registered-client fallback, idempotence, and Admin→Student transition. Auth/concurrency suite: **23 files / 110 tests green**.
- Verification: full suite retains only the pre-existing unrelated `tests/routes/studentOrders.test.js` failure; build passes; lint has 0 errors (existing ignored-file warning for `LoginForm.jsx` plus baseline-browser-mapping advisory).

## Auth Refactor — Phase 6 (Logout Synchronization) — Complete

- **Flag-revocation (user-approved):** `lib/services/sessionService.js` — `revokeSession` now `updateOne({_id, isExp:{$ne:true}}, {$set:{isExp:true, expiredAt:now}})` instead of `deleteOne`; `revokeUserSessions` (password reset) uses `updateMany` with the same shape. Rationale: the `isNewDevice` SSE change stream watches `updatedFields.isExp` — deletes never fired it, so open tabs never learned about a logout; flag-revoke keeps an audit tombstone until the sliding `expiresAt` TTL removes it. Both are idempotent (`isExp:{$ne:true}` filter no-ops on re-revoke).
- **Single client pipeline:** `lib/auth/clientSync.js:performClientLogout({router, queryClient, redirectTo})` — POST `/api/auth/logout` (plain `axios`, deliberately bypassing the 401-refresh interceptor) → `invalidateAuth()` → `router.refresh()` → `router.push(redirectTo)`. The `finally` block guarantees client convergence to unauthenticated even on network failure (fixes the "must click logout twice / refresh" symptom). Returns the response (or null) so callers can toast the server message.
- **`LogoutBtn.jsx`** now calls the shared pipeline (toast + default redirect "/"). **`useIsNewDevice.jsx`** routes SSE `isExp` revocations through the same pipeline (redirect "/login") instead of its duplicated logout POST — logout, password reset, and replay revocation all converge through one code path.
- Session revoked in Tab A now fires SSE in Tab B (server-side effect of flag-revoke); BroadcastChannel `storage`-fallback messaging remains Phase 7.
- Tests updated to the flag-revoke contract: `logout.test.js` (L1–L5, updateOne shape + idempotency), `password-reset-invalidation.test.js` (updateMany), `routes/reset-password.test.js` (updateMany + fail-open preserved). New `tests/auth/logout-client.test.js` (LO1–LO4): pipeline order (POST → invalidate → refresh → push), network-failure convergence, custom redirectTo, registered-client fallback.
- Verification: auth/concurrency suite **24 files / 114 tests green**; full suite 101 passing files with only the pre-existing unrelated `studentOrders` failure; `npm run build` passes; eslint 0 errors (2 pre-existing ignored-file warnings).

## Auth Refactor — Phase 7 (Cross-Tab Synchronization) — Complete

- **Two transports, one envelope.** `lib/auth/clientSync.js` exposes `broadcastAuth(type, payload)` and `installAuthSync(handler)` — `BroadcastChannel('auth')` is the primary transport; the `storage` event is the fallback. The envelope is `{type, ts, payload}` and neither transport echoes to the originating document, so handlers only run in _other_ tabs.
- **`performClientLogout` broadcasts the transition.** A new `broadcastType` parameter (default `"logout"`) lets callers tag the broadcast — `useIsNewDevice` passes `"session-expired"` so forced revocations redirect other tabs to `/login` rather than just invalidating local state.
- **`ClientWrapper.jsx`** mounts an `installAuthSync` subscriber on first render. The subscriber calls `invalidateAuth(queryClient)` + `router.refresh()` for every cross-tab event, and additionally `router.push("/login")` for `session-expired`. `LoginForm.jsx` calls `broadcastAuth("login")` after seeding the new user, so other tabs drop the stale identity.
- **SSE is wired into the same path.** `useIsNewDevice.jsx` continues to subscribe to `/api/stream/isNewDevice`; on `isExp` it now calls `performClientLogout({broadcastType: "session-expired"})` so the local tab _and_ every other tab converge to unauthenticated immediately.
- Tests: new `tests/auth/cross-tab.test.js` (XT1–XT11) covers the channel/storage transports, typed envelope, storage-key filter, handler-error isolation, graceful degradation when globals are absent, the `logout` / `session-expired` broadcast types, and finally-clause broadcast on POST failure.
- Verification: auth/concurrency suite **25 files / 125 tests green**; full suite 102 passing files (only the pre-existing unrelated `studentOrders` failure); `npm run build` passes; eslint 0 errors (4 pre-existing ignored-file warnings).

## Auth Refactor — Phase 0 (Baseline) — Complete

- Scope: TEST-ONLY. No production/auth code changed. Plan: risk-ordered phases (1 config → 2 refresh concurrency/grace-window rotation → 3 persistence → 4 sliding session via `expiresAt` TTL + backfill → 5 client `invalidateAuth()` → 6 logout flag-revoke pipeline → 7 cross-tab BroadcastChannel → 8 cleanup → 9 3m/7m stress). Approved by user: test files, flag-revoke logout, TTL migration + backfill.
- Repaired 3 stale suites: `logout.test.js` + `logout-after-rotation.test.js` (route now exports POST; tests imported GET), `updateUserData.test.js` (added `vi.mock("server-only", () => ({}))` because pageActions pulls `lib/progress/*` which imports server-only).
- New baseline suites (24 tests): `login.test.js` (LI1–7), `refresh-route.test.js` (RE1–4), `getUser.test.js` (GU1–4), `middleware.test.js` (MW1–5), `client-identity.test.js` (CI1–4). They document current behavior including the four confirmed defects (A concurrent-refresh revocation, B RQ `["user"]` cache staleness, C non-persisted newAccessToken, D fixed 7d clocks).
- Spike: Next 16 `cookies().set()` in RSC render throws `ReadonlyRequestCookiesError` (`node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js`) — validates Phase 3 best-effort try/catch persistence.
- Full suite: 763 passing / 1 pre-existing unrelated failure (`tests/routes/studentOrders.test.js` — orders route 500 under mocks, outside auth scope). Auth suite fully green (76 tests / 17 files).
- See `tests/auth/BASELINE.md` for the full captured baseline, manual checklist (M1–M7), and test conventions.

## Auth Refactor — Phase 9 (3m / 7m Stress Validation) — Complete

- **Config-only change** to `lib/auth/config.js`: the two TTL strings are now env-driven via `AUTH_ACCESS_TOKEN_TTL` and `AUTH_REFRESH_TOKEN_TTL`, with production defaults unchanged (`"30m"` / `"7d"`). One-line switch for the 3m/7m test config; no auth-code changes. `AUTH_GRACE_WINDOW_MS` continues to drive the rotation-grace window (rollback flag at 0).
- **New `tests/auth/phase9-stress.test.js` (10 tests):** the suite mocks the DB and runs in seconds via `vi.useFakeTimers()` + the env stub set in `vi.hoisted` (with a captured `__envBak` restored in `afterAll` to prevent cross-file pollution). Scenarios:
  - **A. Normal expiration** — login → advance past 3m → refresh succeeds (sliding session keeps it alive).
  - **B. 20 concurrent expired** — exactly one CAS rotation; the other 19 hit the grace-window loser path; 0 revocations; 0 unexpected 401/429; all 20 recover.
  - **C. Middleware + Axios collision** — two concurrent refreshes on the same session both succeed; 0 revocations.
  - **D. Multiple tabs** — same outcome as C; cross-tab is the same server-side concurrent-refresh path (the BroadcastChannel sync lives in the browser, not exercised here).
  - **E. Real replay (grace=0)** — stale-replica scenario where the initial `sessionFindOne` returns the pre-rotation token; CAS misses; re-read shows the rotated state; the unchanged-current check is false AND the grace-predecessor check is false (grace=0) → the genuine-replay revoke path fires (`Session.updateOne({_id, isExp:{$ne:true}}, {$set:{isExp:true, expiredAt:now}})`).
  - **F. Sliding session** — six back-to-back refreshes at 60s intervals over 6 minutes, all `expiresAt` stamps are `now + 420s`, strictly monotonic, and the session never expires despite total elapsed > sliding-window/2.
  - **G. Idle expiration** — advance past 7m with no activity → refresh rejected with `session_sliding_expired`; 0 revocations.
  - **H. Logout during refresh** — CAS paused via deferred promise → `revokeSession` runs first → CAS resolves null → refresh falls to revoke path → final state unauthenticated, no second refresh, no auth retry loop.
  - **I. Account switching** — admin and student sessions each have their own `Session._id`; revoking admin does not affect student. `refreshAuth(adminOid)` post-revoke returns `{success:false}`; `refreshAuth(studentOid)` post-admin-revoke still returns `{success:true, user:{role:"student"}}`. The test mocks `Session.findOne` per-id via a shared pointer because the mock chain's `lean()` callback receives no arguments.
- **Verification:** auth suite **25 files / 135 tests green** (the new Phase 9 suite contributes 10). Full suite 103 passing files / 104 total (only the pre-existing unrelated `tests/routes/studentOrders.test.js` failure remains). Lint has 0 errors. `npm run build` passes. `git diff --check` clean. The three `tests/concurrency.test.js` rate-limit failures observed in one run are a transient `MemJS` `ECONNRESET` against the real `mc2.dev.ec2.memcachier.com:11211` server — a network flake unrelated to this change; verified to pass on a clean rerun.

## AI Source File Capability Resolution — Complete

- Replaced the `"files === true"` short-circuit with a true per-type resolver that mirrors server precedence: local extraction wins when available, native only when `!local && files && <type>`.
- Removed the hook's provider-baseline fallback so the UI relies on the model-resolved capabilities the providers endpoint already returns per model.
- SourceStep exposes the real reason per file type: `مدعوم مباشرة بواسطة الموديل` / `سيتم استخراج الملف محليًا` / `غير مدعوم`, narrows the file picker accept attribute to supported types, and disables the file card only when every type is unsupported.
- New `tests/components/sourceStepCapabilities.test.js` (14 tests) covers the full Google/Groq/OpenRouter/OpenCode model matrix, the resource normalization native-vs-local routing, and the SourceStep UI contract. AI + import + component verification: 332 tests pass; build compiles; lint shows 0 errors with existing JSX ignore warnings. Unknown suite-level flakes remain unrelated.

## Manual Course Access Grants (صلاحيات الوصول) — Complete

- **New model `models/CourseAccessGrant.js`**: `studentId`, `courseId`, `grantedBy`, `scope` (`full_course | up_to_lesson`), `lessonId`, `startsAt`, `expiresAt`, `revokedAt`, `revokedBy`, `timestamps`. Single compound index `{studentId:1, courseId:1, revokedAt:1}`; state derived from timestamps (no `isActive`/`isExpired` flags). Soft revocation only.
- **New access-source registry `lib/services/courseAccess/`**: mirrors `src/question-system/scopes/registry.js`. `registry.js` (Map + `assertAccessSource`/`registerAccessSource`/`getAccessSources`), `grantRules.js` (shared `isGrantActive`, `deriveGrantStatus`, `buildActiveGrantFilter`, `getCanonicalLessonIds`, `getLessonPrefixUpTo`), `sources/orderAccess.js` (priority 1, full_course), `sources/manualGrantAccess.js` (priority 2, full_course beats up_to_lesson; among lesson-scoped, largest canonical prefix wins; tie → later `expiresAt`, null=latest). `index.js` (`resolveCourseAccess` iterates sources in priority order, first allowed wins).
- **Hot-path integration**: `fetchLessonsByIdUser` (pageActions.js:411) now calls `resolveCourseAccess` once per request; entitlement's `allowedLessonIds` is added to the aggregation `$match` to cap the server-side lesson list. Paid order → identical path/queries (1 Order.findOne unchanged). Grant-only → 1 Order + 1 Grant + (lesson-ids only if scoped). `resetUserCourseLessonsCache(courseId, studentId)` is called by grant mutations to evict the existing 5-min Redis cache. No changes to `LessonsSidebar` lesson-lock chain or `Order` model.
- **API**: `src/app/api/courseAccessGrants/route.js` (GET list, POST create) + `src/app/api/courseAccessGrants/[id]/route.js` (PATCH edit/revoke/restore). Guardian-route wrapper (withCaller/withTracePhase/withHttpTrace + validateOrigin + checkRouteRateLimit). **Admin-only** authorization (401 unauth, 403 student/assistant). All IDs validated server-side (24-hex + existence); `grantedBy`/`revokedBy` from `checkUser()`, never the body. New rate-limit config entry `courseAccessGrants: { limit:30, windowSeconds:600 }` in `lib/routeRateLimit.js`. Soft revoke only (no DELETE).
- **UI**: New `src/app/components/analytics/AccessGrantsTab.jsx` (admin-only, gated by `useUser()`). Third tab added to `StudentDetails.jsx`; existing analytics + guardian tabs unchanged. Reuses `getLessonsById` server action for lesson selector, `/api/courses?search=` for course search, GuardianLinkCard chrome patterns, react-hot-toast + useMutation/useQuery.
- **Course listing**: `/api/courses?ui=` and `userDashboard/courses` page union grant course IDs into the `purchasedIdsSet` / enrolled list (reuse `buildActiveGrantFilter`).
- **Tests (user-approved)**: `tests/services/courseAccess.test.js` (25 tests: pure rules + resolver priority/most-permissive/scope overlap/deleted-lesson inert) + `tests/routes/courseAccessGrants.test.js` (17 tests: auth, validation, create, revoke, cache eviction). New tests: 42/42 green.
- **Verification**: my new files lint clean (`npx eslint` on every touched file → 0 errors). `npm run build` passes. Full suite retains only the pre-existing unrelated `studentOrders` and env-driven auth-config failures (same baseline as Phase 9). No deviations from Planner plan.
- **Reusable Building Blocks added**:
- `lib/services/courseAccess` — `resolveCourseAccess`, `isGrantActive`, `deriveGrantStatus`, `buildActiveGrantFilter`, `getCanonicalLessonIds`, `getLessonPrefixUpTo` (single source of truth for grant state and access resolution).
- `models/CourseAccessGrant` — grant persistence with single compound index.

## Manual Course Access Grants — Post-Implementation Fixes

Four targeted fixes applied to the previously-shipped Manual Course Access Grants feature. No architecture changes; smallest possible diff; reuse of existing helpers only.

- **Fix 1 — Overview enrollment (`src/app/api/student/analytics/route.js`):** the Overview's five sections (`متابعة التعلم`, `ملخص الأداء`, `الدورات المسجلة`, `تقدم دراستك في الدورات` via `StudentProgressChart`, `الدورات المشترك بها`) all flow from one API. Added ONE indexed `CourseAccessGrant.find(buildActiveGrantFilter(userId))` and merged its populated courses into the `enrolled` array (orders win on duplicate). Continue-learning fallback now reads `enrolled[0]` instead of `validOrders[0]`. `gradeSummary`/submissions/`lastEvent` untouched. `tests/routes/studentAnalytics.test.js` received only two added `vi.mock` declarations (`server-only` + `CourseAccessGrant`) and an empty-grant default in `beforeEach` — no assertion/behavior changes; existing 4 tests still green.
- **Fix 2 — Course URL encoding (`src/app/components/analytics/UserAnalyticsSection.jsx`):** added the exact `Hashids(process.env.NEXT_PUBLIC_SECRET_ID, 10).encodeHex` pattern reused from `CourseCard.jsx`. Both `متابعة الدرس` and `الدخول للكورس` hrefs now use `encodeCourseId(...)`. Other static links (`/userDashboard/courses`, `/userDashboard/exams`) unchanged.
- **Fix 3 — Cache TTL cap (`src/app/actions/pageActions.js`):** inside `fetchLessonsByIdUser` only, compute `cacheTtlSeconds = min(300, max(1, floor((entitlement.expiresAt - now)/1000)))` when the active entitlement has an expiry; default remains 300s for paid orders and indefinite grants. Replaces the fixed `300` in the single `redis.setex(cacheKey, ...)` call. Bounds server-side staleness for time-expiring grants to roughly their expiry moment; zero extra queries; revoke/create/edit already evict immediately.
- **Fix 4 — Mutation spam guards (`src/app/components/analytics/AccessGrantsTab.jsx`):** added a per-row `patchingThisGrant` derived from `patchMutation.isPending && variables.id === g._id`. Edit / Revoke / Restore buttons now have `disabled={patchingThisGrant}` + `disabled:opacity-50 disabled:cursor-not-allowed`. Submit button label switches to `"جارٍ التنفيذ..."` when create or patch is pending (existing `isPending` guard preserved). No debounce, no new package.
- **Verification:** `npx vitest run tests/routes tests/services` → 81 passing; only pre-existing `studentOrders` failure remains. `npx eslint` on every touched file → 0 errors. `npx next build` passes. No deviations.

## Student Search in Admin Student List

Small UX addition so Admin can find a student before opening Student Details → صلاحيات الوصول. No architecture change; reused existing infrastructure only.

- **API (`src/app/api/getStudents/route.js`):** added optional `search` URL param. Trim + cap to 100 chars; when non-empty, the `User.find({role:"student"})` filter gains `$or` over `firstName`/`lastName`/`phone`/`email` with case-insensitive `$regex` — the exact search convention already used by `/api/courses`. `countDocuments` and `find` now share one `query` object so pagination totals track the filtered set. Auth path unchanged (`checkUser` 401; pre-existing no-role-guard gap left untouched — widening/narrowing auth was out of scope). Server-side search only; no client-side full-table filtering.
- **Field exposure fix (user-approved, in-file):** `.select` changed from `"-password -__v"` to `"-password -__v -guardianTokenHash -tokenVersion"`. Stops leaking the guardian token hash + token version to any authenticated caller (pre-existing exposure). Verified no consumer uses those fields (`StudentsAnalyticsSection`/`StudentDetails` use only `firstName/lastName/email/grade/phone/guardianPhone/governorate/createdAt/image`).
- **UI (`src/app/components/analytics/StudentsAnalyticsSection.jsx`):** added a debounced search input (reusing `lib/debounce` exactly like `AccessGrantsTab`). State: `searchInput` (instant) → `debouncedSearch` (query) via `useMemo(() => debounce(setDebouncedSearch, 400), [])`. React Query key extended to `["students", currentPage, debouncedSearch]`; URL includes `&search=`. `useEffect([debouncedSearch])` resets `currentPage` to 1 so a new search can't strand the user on a stale page > totalPages. Empty-results state: Arabic `لا يوجد طلاب مطابقون للبحث` rendered in place of the table/cards (existing loading/error early returns unchanged). Row click → existing `Modal` + `StudentDetails` → `صلاحيات الوصول` flow untouched. New `FiSearch` icon import; added `useEffect`/`useMemo` to the react import.
- **Tests:** none created (user decision — no test file). `npx vitest run tests/routes tests/services` → 81 passing, only the pre-existing `studentOrders` baseline failure (no `getStudents` test exists, so the select-field change has zero test impact). `npx eslint` on both files → 0 errors (1 pre-existing JSX ignore warning). `npx next build` passes. No deviations.

## Batch Access Codes (أكواد الدخول)

New parallel entitlement source: signed tokens students redeem to unlock a `CourseAccessGrant`. Independent of Order model, guardian flow, and lesson-locking logic.

- **Models**: `models/AccessCodeBatch.js` (one doc per generation — batch metadata: courseId/scope/lessonId/grantDays/grantExpiresAt/codeExpiresAt/quantity/createdBy + timestamps). `models/AccessCode.js` — minimal registry { jti (unique), batchId, expiresAt, redeemedAt, redeemedBy, createdBy + timestamps }; indexes `{jti:1} unique`, `{batchId:1}`, and a TTL on `expiresAt` with `{expireAfterSeconds: 0, partialFilterExpression: { redeemedAt: null }}` so unredeemed expired codes auto-purge while redeemed records stay forever for audit. TTL is cleanup only — redemption checks `expiresAt > now` explicitly.
- **Token helper** `lib/accessCodeToken.js` — jose SignJWT/jwtVerify, HS256, dedicated `ACCESS_CODE_SECRET` env (must differ from `JWT_SECRET`). Payload carries `type="course_access_code"`, `courseId`, `scope`, `lessonId`, `grantDays`, `grantExpiresAt`, `iss="access-codes"`, `jti`, `exp`. No student data. `jti` stored unhashed because the HMAC signature is the secret (verified before DB lookup).
- **APIs** (guardian naming + wrapper pattern: withCaller/withTracePhase/withHttpTrace + validateOrigin + checkRouteRateLimit + checkUser + connectToDatabase):
  - `POST /api/accessCodes/generate` — admin only. Validates course/lesson/policy/codeExpiresAt/quantity (1–500). One `AccessCodeBatch.create` + N signed tokens in memory + ONE `AccessCode.insertMany` (never per-code DB writes). Plaintext tokens returned exactly once in `{ batchId, codes }`.
  - `POST /api/accessCodes/redeem` — authenticated students only (401 anon / 403 admin & assistant). Body is `{ code }` only; no courseId/studentId from the request. Flow: `verifyAccessCodeToken(code)` → atomic `findOneAndUpdate({jti, redeemedAt:null, expiresAt:{$gt:now}}, {set:{redeemedAt:now, redeemedBy:user._id}}, {new:true})` → on null, one diagnostic `findOne` for the precise Arabic error → validate Course/lesson still exist (rollback `$set: redeemedAt:null, $unset: redeemedBy` on failure) → create `CourseAccessGrant({studentId: user._id, courseId: token, scope, lessonId, startsAt: now, expiresAt: derived, grantedBy: codeRecord.createdBy})` → `resetUserCourseLessonsCache(courseId, user._id)`. Duplicate redemption allowed → existing most-permissive resolver handles overlap.
  - `GET /api/accessCodes` — admin only. Lists batches with one `AccessCode.aggregate` for used/remaining counts; never returns plaintext codes.
- **Rate limits** (`lib/routeRateLimit.js`): `accessCodesGenerate: 10/600s`, `accessCodesRedeem: 20/600s`. Existing presets untouched.
- **Shared form** `src/app/components/access/AccessGrantForm.jsx` — extracted VERBATIM from `AccessGrantsTab.jsx` (course search + scope radios + lesson select + duration radios/inputs + submit) into one shared component with `mode: "student" | "batch"`. Student mode preserves exact direct-grant behavior (POST or PATCH `/api/courseAccessGrants/:id`); batch mode adds `العدد` (1–500) and `صلاحية الكود حتى` (`datetime-local`) and POSTs `/api/accessCodes/generate`. Submit label switches to `جارٍ التنفيذ...` while pending.
- **Direct-grant tab rewired** (`src/app/components/analytics/AccessGrantsTab.jsx`) — now renders `<AccessGrantForm mode="student" studentId editingGrant onDone>`; keeps header + add button + grants list + edit/revoke/restore row actions + per-row `patchingThisGrant` disabled guard. Edit uses `key={editingGrant?._id || "new"}` to remount the shared form with the grant's initial values.
- **Admin batch UI** `src/app/components/access/AccessCodesSection.jsx` + `src/app/(dashboard)/dashboard/accessCodes/page.jsx` (server page, admin-gated, `redirect("/")` for non-admin). Form toggle → `AccessGrantForm mode="batch"`; on `onGenerated`, renders a one-time display with the warning `احفظ الأكواد — لن يتم عرضها مرة أخرى`, per-code copy (`navigator.clipboard`), QR toggle (`QRCodeSVG` from existing `qrcode.react` dep — encodes the raw code, same redemption endpoint, no second token), and a `نسخ الكل` button. Below: batch list page (course/scope/policy/code-expiry/createdBy/used/remaining) — never plaintext.
- **Sidenav**: one `adminLinks` entry only `{ id: 11, title: "أكواد الدخول", href: "/dashboard/accessCodes", icon: FaTicketAlt }`. Assistant links untouched.
- **Student redemption UI** `src/app/components/access/RedeemCodeCard.jsx` — paste-friendly `dir="ltr"` textarea + `تفعيل الكود` / `جارٍ التفعيل...` button. Success → `toast.success` + `router.refresh()` (deny path is not Redis-cached, so the fresh server render evaluates the new grant). Inserted into BOTH course deny blocks (`(platform)/course/[courseId]/page.jsx` + `(userDashboard)/userDashboard/course/[courseId]/page.jsx`) below the BuyCourseBtn row — purchase flow + logged-out state untouched.
- **Tests** (user-approved):
  - `tests/services/accessCodeToken.test.js` — 9 tests: jti format/uniqueness, sign/verify roundtrip, null-passthrough, exp matches codeExpiresAt, expired/wrong-type/wrong-issuer/tampered-signature rejection. Uses `vi.hoisted` env stub + `afterAll` restore (Phase-9 pattern).
  - `tests/routes/accessCodes.test.js` — 29 tests covering the full matrix from the plan: auth matrix (anon/student/assistant/admin), all validation paths, `insertMany` called once with `quantity` docs, generated code length, successful grant creation with `studentId` from auth + `grantedBy` from code record + cache eviction, `grantDays` and `grantExpiresAt` policies honored, lesson-deleted rollback, course-deleted rollback, race test (second redeem returns `تم استخدام هذا الكود من قبل`, exactly one grant created), list aggregation never exposes plaintext.
- **Env**: `ACCESS_CODE_SECRET=<random 64-hex>` appended to `.env`.
- **Verification**: `npx vitest run tests/routes tests/services` → 119/120 passing (only pre-existing `studentOrders` baseline failure). `npx eslint` on all 13 touched files → 0 errors (5 pre-existing JSX ignore warnings). `npx next build` → passes. Direct-grant regression gate: `AccessGrantsTab` rewired, all existing access-grants tests stay green. No deviations from Planner plan.
- **Reusable Building Blocks added**:
  - `lib/accessCodeToken` — `signAccessCodeToken` / `verifyAccessCodeToken` / `generateAccessCodeJti` (single source of truth for batch-code signing).
  - `models/AccessCodeBatch` + `models/AccessCode` — credential registry.
  - `src/app/components/access/AccessGrantForm` — shared grant-config form reused for direct-grant + batch-code modes.

## Batch Access Codes — Opaque Code Credential Replacement

Credential-layer replacement of the previous JWT implementation. Architecture (AccessCodeBatch → AccessCode → CourseAccessGrant → resolveCourseAccess) unchanged. Only the credential mechanism changed from a signed token to a short opaque random code + HMAC-peppered hash lookup.

- **Removed**: `lib/accessCodeToken.js` (SignJWT/jwtVerify) and its test file `tests/services/accessCodeToken.test.js`. Removed JWT env `ACCESS_CODE_SECRET`. Removed `jti` and `createdBy` from `AccessCode`.
- **New helper** `lib/accessCode.js` (mirrors `lib/guardianToken.js` shape): `generateAccessCode()` (16 chars from the 32-symbol alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — excludes `0 O 1 I`; displayed as `XXXX-XXXX-XXXX-XXXX`), `normalizeAccessCode()` (uppercase, strip whitespace + hyphens, 100-char raw cap), `isValidAccessCodeFormat()` (canonical regex `^[A-HJ-NP-Z2-9]{16}$`), `hashAccessCode()` (HMAC-SHA256 with `process.env.ACCESS_CODE_PEPPER` read at call time, hex output).
- **Entropy**: `log2(32) = 5 bits/symbol × 16 = 80 bits`. Birthday collision for a 500-code batch ≈ 1×10⁻¹⁹. Combined with rate limit + one-time + expiry, online brute force is infeasible.
- **Model `models/AccessCode.js`**: `{codeHash, batchId, expiresAt, redeemedAt, redeemedBy}` + `timestamps`. Indexes: `{codeHash: 1} unique`, `{batchId: 1}`, TTL `{expiresAt: 1} expireAfterSeconds: 0 partialFilterExpression: { redeemedAt: null }}` (unchanged — TTL is cleanup only). `jti` and `createdBy` removed; grant template lives only in the batch.
- **Generate route**: one `AccessCodeBatch.create` + N codes generated in memory (canonicalized → hashed) + `insertMany(docs, { ordered: false })` with a bounded retry (max 3 attempts) that regenerates only the E11000-failed entries. Always returns exactly `quantity` codes or a 500 — never silently fewer. Plaintext codes returned once; only hashes stored.
- **Redeem route**: student-only auth, body `{code}` only; trim → 100-cap → `normalizeAccessCode` → `isValidAccessCodeFormat` (400 before any DB hit on invalid) → `hashAccessCode` → atomic `AccessCode.findOneAndUpdate({codeHash, redeemedAt: null, expiresAt: {$gt: now}}, {$set:{redeemedAt, redeemedBy}}, {new:true})` → diagnostic `findOne` for specific Arabic messages (`الكود غير صالح` / `تم استخدام هذا الكود من قبل` / `انتهت صلاحية الكود`) → load `AccessCodeBatch` → validate course/lesson (rollback on missing) → create `CourseAccessGrant` with all grant fields from the batch (`grantedBy = batch.createdBy`) → `resetUserCourseLessonsCache(batch.courseId, user._id)`. Duplicate redemption allowed → existing most-permissive resolver.
- **UI**: `RedeemCodeCard` input changed from a 3-row `textarea` to a single-line `input` (`maxLength={100}`, `dir="ltr"`, `font-mono`, `tracking-widest`, placeholder `ABCD-EFGH-JKLM-NPQR`). Mutation / toast / `router.refresh()` unchanged. `AccessCodesSection.jsx` unchanged — verified format-agnostic (displays whatever strings generation returns).
- **Env**: `ACCESS_CODE_PEPPER=<fresh 64-hex random>` appended to `.env` (replaces the deleted `ACCESS_CODE_SECRET`; net env count unchanged).
- **Tests (approved)**: `tests/services/accessCode.test.js` (17 tests — generation format/uniqueness×500/alphabet; normalization matrix incl. non-string; format validation matrix; hashing determinism/diff/64-hex/pepper sensitivity). `tests/routes/accessCodes.test.js` updated (33 tests, +4 new): collision-retry, malformed-format-never-hits-DB, normalization-to-hash, batch-missing rollback, response-leakage (`data` equals exactly `{courseId}`, no `code`/`codeHash`/`token`), stored docs contain 64-hex `codeHash` matching the plaintext's hash, no `jti`/`createdBy`/`code` fields.
- **Verification**: `npx vitest run tests/routes tests/services` → 131/132 passing (only pre-existing `studentOrders` baseline). `npx next build` passes. `npx eslint` on every touched file → 0 errors (1 pre-existing JSX ignore warning). Grep for `accessCodeToken|ACCESS_CODE_SECRET` outside PROJECT_CONTEXT history returns nothing. Direct-grant tab unchanged (regression gate held). No deviations from Planner plan.

## Access Code History + Secure Recovery (Admin Management)

Added persistent history and admin-only code recovery to the existing AccessCode system. Architecture (AccessCodeBatch → AccessCode → CourseAccessGrant → resolveCourseAccess) unchanged; only the credential layer and read paths extended.

- **Crypto helper** `lib/accessCode.js`: added `buildCodeHint(formattedCode)` (first4-last4, e.g. `ABCD-NPQR`), `encryptAccessCode()` / `decryptAccessCode()` — AES-256-GCM, 12-byte random IV, authenticated tag, versioned payload `v1:<ivB64>:<tagB64>:<ctB64>`. Key = dedicated `ACCESS_CODE_ENCRYPTION_KEY` (64-hex / 32 bytes), read at call time, separate from `ACCESS_CODE_PEPPER` and all auth secrets. Tamper of ciphertext/tag/IV throws on `final()`; unsupported version throws.
- **Model** `models/AccessCode.js`: added `encryptedCode` (required), `codeHint` (required), `grantId` (ref CourseAccessGrant, default null). Removed the TTL index (permanent history). `expiresAt` field and redemption `expiresAt > now` check unchanged. Indexes: `{codeHash:1} unique`, `{batchId:1}`.
- **Generate route**: each insertMany doc now also stores `encryptedCode` + `codeHint`. Plaintext still returned once.
- **Redeem route**: after `CourseAccessGrant.create`, best-effort `AccessCode.updateOne({codeHash}, {$set:{grantId: grant._id}})` — failure never breaks redemption (try/catch, no rollback of the grant).
- **Secret endpoint** `src/app/api/accessCodes/[id]/secret/route.js` (GET): admin-only, `accessCodesReveal` rate limit (30/600s), `select("encryptedCode")`, decrypt, `logSecurityEvent("ACCESS_CODE_REVEALED", {codeId, adminId})` (no plaintext logged), response `{data:{code}}` with `Cache-Control: private, no-store`. Never returns `codeHash`/`encryptedCode`.
- **List route** `src/app/api/accessCodes/route.js`: added optional `?batchId=` → paginated codes view (≤100/page). Safe `select("_id codeHint redeemedAt redeemedBy expiresAt grantId createdAt")` + `.populate("redeemedBy","firstName lastName")` + `.populate({path:"grantId",select:"expiresAt"})` — guarantees `codeHash`/`encryptedCode` never leave the DB layer. Unknown batchId → 404.
- **Rate limit** `lib/routeRateLimit.js`: added `accessCodesReveal: {limit:30, windowSeconds:600}`.
- **UI** `src/app/components/access/AccessCodesSection.jsx`: batch cards now expandable (`عرض الأكواد`); expanded panel fetches `?batchId=` (React Query key `["accessCodeBatchCodes", batchId, page]`, 10/page). Each code row shows masked `ABCD-****-****-****` (from `codeHint`) + status badge (متاح/مستخدم/منتهي, derived). `عرض` calls the secret endpoint → reveals full code in local row state → enables `نسخ` (existing `copyText`+toast), `QR` (existing `QRCodeSVG`), and `تنزيل QR` (existing `downloadQrPng`). No bulk decryption; one decrypt per explicit reveal.
- **Env**: `ACCESS_CODE_ENCRYPTION_KEY=<fresh 64-hex>` appended to `.env`.
- **Tests (approved)**: `tests/services/accessCode.test.js` (+13 → 30 total): encrypt/decrypt roundtrip, random-IV uniqueness, wrong-key failure, ciphertext/tag/IV tamper failures, unsupported-version failure, plaintext-not-in-ciphertext, invalid-key failure, `buildCodeHint` cases. `tests/routes/accessCodes.test.js` (+11 → 44 total): generate stores `encryptedCode`+`codeHint` (no plaintext/jti/createdBy), redeem sets `grantId` (best-effort, failure-safe), list `?batchId=` safe-select + pagination + 404, secret endpoint full matrix (401/403/400/404/success/no-store/no-codeHash/log-no-plaintext/decryption-failure-500).
- **Verification**: `npx vitest run tests/routes tests/services` → 155/156 (only pre-existing `studentOrders` baseline). `npx eslint` on all 11 touched files → 0 errors (1 pre-existing JSX ignore warning). `npx next build` passes. Direct-grant tab + opaque-code redemption regression gates held.
- **Ops note**: the previously-created MongoDB TTL index must be dropped once so expired unused codes persist for history: `db.accesscodes.dropIndex("expiresAt_1")`. `expiresAt` field and redemption expiry checks are unaffected.
- **Reusable Building Blocks added**:
  - `lib/accessCode` — `encryptAccessCode` / `decryptAccessCode` / `buildCodeHint` (single source of truth for access-code credential handling, alongside `hashAccessCode`).
  - `src/app/api/accessCodes/[id]/secret` — admin-only credential-reveal pattern (rate-limited, no-store, audit-logged).

## Changelog (rolled-up summary of older entries)

Everything before the "Student Grade Simplification" entry below is summarized here. Highlights: AI platform (C1/C2/C2.5, prompt hardening v2, fill-blank consolidation, generator stability, StructuredContext flow) all complete with deterministic test coverage; Auth refactor Phases 0–9 complete (central config, refresh CAS + grace window, persistence, sliding sessions, client identity sync, logout flag-revoke pipeline, cross-tab BroadcastChannel, 3m/7m stress); question-system plugin architecture with string-based `Question.grade` compatibility contract; exam/lecture/schedule/attendance/notifications systems built on real `Grade` entities; manual course access grants + batch access codes were built and then fully removed (see latest entry). Full details of older work are intentionally collapsed to save tokens.

### 7 targeted fixes (latest)

1. AI question generation: `aiQuestionGenerationStage.js` now batches (max 10/call, request max 100), aggregates valid questions up to requested count, per-batch deterministic cache keys (`batchIndex` added only when multi-batch). Prompt/provider/parser untouched.
2. Question Bank: `RepositoryClient.jsx` filter defaults `subject: ["الرياضيات"]` (editable/clearable); `AIGeneratorModal.jsx` subject default "الرياضيات". Exam picker (`QuestionRepositoryModal`) NOT narrowed.
3. Essays: `getEssays` aggregate now returns `examTitle`/`gradeName` (bounded post-pagination lookups); `EssayCard` renders الاختبار/الصف context rows.
4. Attendance: `AttendanceSection` sync-key includes `sessionQuery.dataUpdatedAt`; removed `setLoadedKey(null)` in save onSuccess (was re-syncing from stale cache → UI revert). Failed saves never commit UI state.
5. Exams: `getExams(gradeId, {page,limit})` — bounded (default 50/max 100), returns `pagination`, adds `hasAttempted` for current student via ONE `Submission.find({student, exam:$in, isCompleted:true})`. `ExamCard` shows "عرض النتيجة" when attempted.
6. Assistant exam creation: `GradeContextAdapter` accepts `role` (admin→/api/grades, assistant→getMyGradesForAssistant); wired page→ExamNewClient→adapter. Server `addExam` already enforced staff auth.
7. Assistant Question Bank: `repositoryActions.searchRepositoryQuestions` scopes by `getStaffedGradeIds()` ($in, single query), drops `createdBy=assistant`; empty staffed grades → 200 + `items: []`.

Reusable building blocks added earlier: `GradesSelection` fetchUrl prop, `StudentSearchSelect` (excludeAdmins/showRole), `lib/schedule/time.js` (Africa/Cairo helpers), `ScheduleEvent` model + `scheduleActions`, `AdminNotificationsTable`, `Notification.groupId`, `/api/notifications/admin`, public `/api/public/grades`, `LectureForm` exported from LecturesSection.

## Student Grade Simplification (User.gradeId + automatic access + English UI) — Complete

Product change: student access no longer uses Access Codes / GradeAccessGrant / approval. The student's profile Grade is the single authorization source, and the visible UI copy is English.

- **User schema** (`models/User.js`): added `gradeId: ObjectId(ref Grade, index)` — NOT required (admins/assistants may be grade-less; verified against role flows). Legacy `grade: String (required)` kept as a synchronized display mirror only — it NEVER authorizes. Runtime authorization uses `gradeId` exclusively.
- **gradeAuth** (`lib/services/gradeAuth/index.js`, rewritten): `resolveGradeAccess({userId, gradeId, userGradeId})` = cheap id-compare first (wrong-grade probes cost 0 queries, no existence leak) → one indexed `Grade.findOne({_id, active:true})` for the active check; `getUserGradeIds(userId, userGradeId)` (ex-students' `getGrantedGradeIds`, renamed) → `[gradeId]`/`[]`; NEW `getStudentIdsForGrade(gradeId)` = inactive/missing → `[]`, else `User.find({role:"student", gradeId})`; `isStaff`/`getStaffedGradeIds` (GradeStaffAssignment) unchanged. `grantRules.js` deleted.
- **Student consumers**: `studentActions.getMyGrades`, `examActions` (getExam/getExams/addSubmission student branches), `lectureActions.getLecturesForStudent`, `scheduleActions.getScheduleForStudent`, `attendanceActions.getMyAttendance` — all pass `userGradeId: user.gradeId` (from checkUser payload) and are grant-free. Wrong-grade URL → denied; inactive grade → normal empty state; no constants fallback.
- **Roster/fan-out switched to `User.gradeId` membership**: `notificationService.createNotificationsForGrade`, `attendanceActions.getRoster`, `api/usersExamsResults/[id]`.
- **Analytics compatibility shapes preserved**: `student/analytics` grades from profile Grade (`enrolledAt: null`); `getUserAnalytics` grantedGrades → `[{_id, name, expiresAt: null, status: "active"}]` from the student's gradeId. Display-only `grade` string consumers (getStudents, guardian verify/page, StudentDetails, StudentsAnalyticsSection, StudentSearchSelect, ParentDashboard) unchanged thanks to the synchronized mirror.
- **Registration** (`api/auth/register`): client sends `gradeId` from `/api/public/grades` selector; server validates 24-hex + exists + `active` BEFORE create; stores `gradeId` AND `grade = gradeDoc.name` (client string never authoritative). `GradesSelection.jsx` submits `g._id` now; SignUpForm/UserDataForm field renamed to `gradeId`.
- **Self-service Grade change**: `userActions.updateUserData` accepts `gradeId` (validated + synced), filters by SESSION email (can only update own profile), userToken carries `gradeId` + `grade`. `UserDataForm` invalidates `["myGrades"]`/`["myGradesList"]` + `router.refresh()` on grade change. Auth payload changes: `refreshAuth`/`login` add `gradeId` (auth architecture otherwise frozen).
- **Grade.name is immutable**: `gradeActions.updateGrade` rejects `name` (only `active` patchable); admin `GradesSection` edit/rename affordance removed (create/activate/deactivate/delete remain). Rationale: `Exam.gradeId → Grade.name → Question.grade` is the frozen compatibility bridge.
- **Deleted grant/code stack** (after consumer audit proved self-contained): `models/{GradeAccessGrant,AccessCode,AccessCodeBatch}.js`, `lib/accessCode.js`, `api/accessGrants/**`, `api/accessCodes/**`, `components/access/*`, `components/analytics/AccessGrantsTab.jsx`, `dashboard/accessCodes/`, Sidenav admin entry, `gradeActions` grant count, rate-limit entries, `ACCESS_CODE_*` env vars.
- **English UI**: all static visible copy in src/app (+ client-facing lib messages: apiError, video/recording, services/grades, adminAnalyticsService/DataCards pair, examQuestionsService, plugin core labels/validation, import stage messages) translated. Protected data-bound values stay Arabic: Grade.name display, EgyptGovernoratesSelect values, GradeCard levelMeta keys/regexes, ExamCard diffMap, RepositoryClient/AIGeneratorModal `subject: ["الرياضيات"]` filter defaults, `صح`/`خطأ` canonical answers, AI prompts (`lib/ai/prompts/**`), import detection mappings (answerDetector/metadataParser/labelNormalizer/heuristicDetector/templateDefinition/docx exporter), enum values, `dir="ltr"`/layout untouched.
- **Tests**: deleted `tests/routes/accessCodes.test.js`, `tests/routes/accessCodesRedeem.test.js`, `tests/services/accessCode.test.js`; rewrote `tests/services/gradeAuth.test.js` (ID-based semantics incl. no-gradeId graceful, inactive, mismatch-doesn't-query-Grade, roster); new `tests/routes/registerGrade.test.js` (grade validation matrix + grade/gradeId sync + schema-optionality check + client-grade-string distrust); updated `studentAnalytics`, `notificationAutomation`, `scheduleAndStaff`, `questionCompatibility`, `logout`, `send-code`, `updateUserData` (U7 own-profile-only, U8 sync, U9/U10 validation), `hookHelpers`, `structuredContextFlow`, `finalAiGeneratorStability`, `sourceStepCapabilities`, `aiReviewEditorReuse`, `lecturePreview.contract`, `studentQueries.contract` (removed deleted-file contract) to new strings/mocks.
- **Verification**: `npx vitest run` → 96/96 files green (previous studentOrders/auth-config baseline failures no longer reproduce); `npx next build` passes; eslint 0 errors on touched files; straggler greps clean (no grant/code identifiers outside history; `constants/grades` only in seed scripts).
- **Known one-time impact**: existing dev users lack `gradeId` (DB check: 6 users, 0 with gradeId) → they see the graceful empty state until they pick a Grade in Settings or re-register. Old access tokens (30m TTL) carry the old payload shape; checkUser re-reads the DB doc.
- **Reusable Building Blocks added**: `getStudentIdsForGrade(gradeId)` (roster/fan-out membership), `getUserGradeIds(userId, userGradeId)` (student profile-Grade resolution). Removed from the building-blocks list: `lib/accessCode`, access-code credential patterns, courseAccess grant helpers (the `lib/services/courseAccess/*` stack for Courses was verified unrelated to Grades and left intact).

## Hybrid Quiz/HW Draft Persistence (exam runner) — Complete

- **Architecture**: `models/QuizDraft.js` is the canonical server state (`studentId`, `examId`, `answers` Mixed, `revision`, timestamps); localStorage is only a fast cache / offline buffer. Exactly one active draft per `studentId + examId` via a single unique compound index (no redundant per-field indexes, no TTL, no per-question docs, no Redis/worker/polling).
- **Local payload**: `lib/quizDraft.js` (client-safe, SSR-safe) — key `quizDraft_{studentId}_{examId}`, v2 `{v, updatedAt, serverRevision, baseAnswers, answers}`; v1 payloads migrate without discarding answers (`baseAnswers={}`, `serverRevision=0`); malformed data / unavailable storage resolves safely to no draft. Only answer strings + reconciliation metadata are stored (never questions, options, images, tokens, UI state).
- **Server ordering**: `lib/services/quizDraftService.js` (`server-only`) — client sends `baseRevision`; `=== stored revision` accepts and increments; anything else returns the canonical draft without overwriting. Device clocks never order state. Duplicate-create races resolve through the unique index (`E11000` → canonical conflict). `saveDraft` checks Submission before the write and re-checks after a successful write; a submitted exam deletes any leftover draft and returns `submitted` (late-sync resurrection protection).
- **Conflict model**: `reconcileAnswers` per question — `local==server` same; `server==base` local wins; `local==base` server wins; all-differ server wins. Different-question device edits survive; same-question conflicts deterministically prefer the server. Retry bounded to ≤2 immediate attempts per sync invocation.
- **Timing**: 500 ms local debounce, 5000 ms coalesced server sync (one request per burst, never per keystroke). Interruption safety is local-only (`visibilitychange→hidden`, `pagehide`, unmount flush); `online` triggers a coalesced sync; network failure never deletes the local buffer; a newer edit made while a save is in flight is never overwritten by the response. `lib/debounce.js` gained the additive idempotent `cancel()`.
- **Submission boundary**: `addSubmission` deletes the draft inside the existing Mongo transaction (abort rolls back and preserves it); a successful submission clears localStorage and stops all further draft writes.
- **Read path**: drafts ride the existing `getExam` server action (student callers only — admin/assistant analytics pay no extra query); no new draft-read API. TARGET has no lesson-embedded Quiz path, so the feature is exam-runner only.
- **Hydration**: reconciled answers are computed synchronously before renderers mount (`useForm({defaultValues})` + the existing `userAnswer` prop) because fill-blank/matching initialize internal state from `userAnswer` at mount and essay uses it as its default — no empty-first-render restore.
- **Reusable Building Blocks added**: `lib/quizDraft.js` (`quizDraftKey`, `read/write/clearLocalDraft`, `reconcileAnswers`, `buildInitialDraftState`, `sanitizeDraftAnswers`, 500/5000 timing constants), `lib/services/quizDraftService.js` (`getDraft`, `saveDraft`, `deleteDraft`, `hasSubmission`), `models/QuizDraft.js`.

## Question Bank → Word (.docx) Export — Complete

- **Selection**: `lib/repository/exportSelection.js` (client-safe, pure reducer) — explicit `selectedIds` behavior unchanged; `allFiltered` stores the filters intent + `excludedIds` only (no id materialization; memory scales with exclusions). Filter changes reset allFiltered; explicit selection is unaffected. `buildExportRequest` sends ids OR filters+exclusions + `includeAnswers` — never Question documents.
- **Server resolver**: `lib/repository/exportSelectionService.js` (`server-only`) — sanitizes the compact request, reuses the existing `buildFilter()` (now exported from `questionService.js`), intersects assistant staffed-grade scope with any requested grade filter in both modes, bounds `excludedIds`, and rejects `> MAX_EXPORT_QUESTIONS (1000)` before generation (`countDocuments` for allFiltered; no silent truncation). One bounded `.lean()` query path; deterministic `updatedAt/_id` export ordering (the interactive list keeps textScore ordering for `$text` search).
- **Plugin architecture**: registry gained optional `docxContent(type, question, context)`; five cores expose pure `toDocxContent` returning format-neutral descriptors (`option/candidate/answer/pair/note`); essay intentionally uses the common fallback. Plugins never import `docx`; the exporter contains no `switch(question.type)` (only a switch over descriptor kinds).
- **Exporter**: `lib/repository/exporters/docx.js` (repository domain) builds one RTL/bidi document (section `textDirection`, paragraph `bidirectional`, run `rightToLeft`, Arial, Arabic labels); missing/unknown/throwing formatters fall back safely and never drop a question (number, type label, text, image placeholder, metadata always emitted). Phase 1 uses `[صورة]` placeholders — no image embedding/fetching. Import-template exporter `lib/import/template/exporters/docx.js` untouched; existing `docx ^9.7.1` reused (no new package).
- **Route**: `src/app/api/repository/export/docx/route.js` — validateOrigin → `repositoryExport` rate limit (10/600s) → checkUser → admin/assistant → sanitize → bounded DB query → one `Packer.toBuffer` → single binary response (`Content-Type` OOXML, `Content-Disposition: attachment; filename="questions-export.docx"`, `Cache-Control: private, no-store`). Client performs one Blob download via object URL.
- **Answer gating**: `includeAnswers` defaults to false and is validated strictly server-side (`=== true`); formatters and the exporter both enforce it, so no correct answers/explanations leak when disabled.
- **Reusable Building Blocks added**: `lib/repository/exportSelection.js`, `lib/repository/exportSelectionService.js`, `lib/repository/exporters/docx.js`, `lib/repository/staffScope.js` (`getStaffedGradeNames`, now shared by `repositoryActions`), `src/question-system/plugins/docxDescriptors.js`.

## Rebrand: Ahmed El Desouky — Chemistry, Arabic-first RTL — Complete

Full rebrand/refactor of the platform (previously Mohamed Talaat / Math / English-LTR UI) into the official Arabic-first RTL educational platform of **أ. أحمد الدسوقي — مدرس كيمياء**. Functionality preserved; only identity, language, direction, and static copy changed (plus 3 functional subject-default flips listed below).

- **Teacher**: أحمد الدسوقي (formal display: أ. أحمد الدسوقي). **Profession**: مدرس كيمياء. **Subject**: الكيمياء. **Language**: Arabic only (Egyptian educational Arabic). **Direction**: RTL (`<html lang="ar" dir="rtl">`).
- **Socials** (single source in `src/app/components/brand/teacherBrand.js` — TEACHER, TEACHER_SOCIALS, NAV_LINKS, FOOTER_LINKS, SITE_SEO): Instagram https://www.instagram.com/eldesouky726, TikTok https://www.tiktok.com/@ahmed.eldesouky71, YouTube https://youtube.com/@mr.ahmedeldesouky-bondinch1057, Facebook https://www.facebook.com/Mr.DesoukyChemistry. All old socials/phones/emails removed from user-facing UI.
- **Research note**: public social profiles were not scrapeable (login-walled), so the About section makes NO invented claims (no years of experience, qualifications, student counts, locations). It focuses on verified-safe content: teaching chemistry, clear explanations, practice, exam prep, organized content.
- **What changed**: root layout (ar/RTL + Arabic title/description), manifest (rtl/ar + Arabic name), `globals.css` (kept token system; added RTL rules — right-aligned text/inputs, `.ltr-field` for email/phone/code, `.flip-rtl` arrow utility, `.chem-pattern` dot grids; header comment updated), `brand/MTLogo.jsx` (same exports for compatibility, Arabic wordmark "أ. أحمد الدسوقي / مدرس كيمياء"), Navbar (new Arabic links: الرئيسية، الصفوف الدراسية، الاختبارات، عن الأستاذ، تواصل معنا + auth-aware), Footer (Arabic, teacher identity, new socials, dynamic-year Arabic copyright), Hero (chemistry symbols H₂O/⚗/NaCl/⬡, Arabic copy "اتعلّم الكيمياء بطريقة أبسط وأوضح"), Benefits/WhyChooseMe (`#teacher` anchor = "عن الأستاذ" target)/CTA, homepage (Arabic + `#grades` anchor), platform layout (Arabic SEO + JSON-LD Person "مدرس كيمياء" + new sameAs), contact page + form (social cards replace old teacher phones/email; backend recipient unchanged), auth (Login/SignUp/forget-password 3 steps/grades/governorates/logout/errors), Quiz runner (all states incl. result feedback/pills/submit bar), ExamCard/Admin/SectionExams/generator workspace/collection/grade-adapter, GradeCard, Sidenav (Arabic links/roles/version), student + admin dashboard pages/headers/metadata, userDashboard sections + GradeDetail (Arabic weekday names), guardian/parent UI, UserDataForm, ChatBot UI + chat system prompt, email templates (sendEmail/send-code from-name + Arabic bodies), ResultsClient + RepositoryClient chrome + QuestionFilters labels, MathToolbar labels/tooltips, ThemeToggle aria, LecturePlayer empty state, guardian-token page title, error pages, loading skeleton dir fix.
- **Functional flips (3, intentional)**: `AIGeneratorModal` default `subject: "الكيمياء"` (was the "Math" regression), `RepositoryClient` + `QuestionRepositoryModal` default filter `subject: ["الكيمياء"]` (was ["الرياضيات"]). Canonical subject enum (`constants/subjects.js`, already Arabic incl. الكيمياء), difficulty values, grading/scoring/auth/DB logic untouched.
- **Reusable components** (unchanged architecture): GradeCard, ExamCard(+Admin), Quiz + question-system plugins, SectionExams/ExamGenerator, LecturesSection/ScheduleSection/AttendanceSection, analytics sections, Sidenav/ClientWrapper/QueryProvider, FloatingInput, Modal, MathToolbar/MathRenderer, ChatBot, GuardianLinkCard, Notifications stack, theme tokens in `globals.css` + new `teacherBrand.js`.
- **Scope notes**: `public/{hero,login,signup}.jpeg` + `logo.png` assets reused as-is (no fabricated teacher photo; alt texts Arabic; imagery replaceable later). AI workbench internals keep technical English where bound to canonical enums/schemas; page chrome around them is Arabic/RTL. Test fixtures keep الرياضيات as an arbitrary valid enum value (plumbing only).
- **Tests updated to new UI strings**: `chatBot.test.js` (expects أحمد الدسوقي), `repositoryExportSelection.test.js` (تحديد الكل/تصدير Word/حذف المحدد/الكيمياء default), `examAttemptDetails.contract.test.js`, `examResultsTable.test.js` (التالي/السابق), `lecturePreview.contract.test.js`.
- **Verification**: `npm run build` passes; full suite 984 passed / 8 failed — the 8 are the pre-existing env-driven `updateUserData` auth failures documented in this file's baseline (untouched code path), plus 3 suites unloadable on the pre-existing PostCSS-config env issue; eslint 0 errors on touched files (ignore-list warnings only). Grep clean: no `Mohamed Talaat`, old socials, old phones/emails, or `MATH TEACHER` remain in `src`.

## Chemistry Visual Redesign (teal/amber/cyan) — Complete

Redesigned the visual identity on top of the Arabic-first platform: deep teal `#073B40` / dark teal `#0B5155` / amber `#FFB81C` / cyan `#159A9C`, light bg `#F1F7F6`, text `#152D30`, muted `#718487`, borders `#DCE8E6`, dark surface `#102F33`. Teacher: أحمد الدسوقي, مدرس كيمياء, الإسماعيلية. Brand line in hero: "الكيمياء مش حفظ معادلات... دي فهم وتفكير." No reference image file exists in the repo — direction implemented from the written description. No new dependencies; icons from existing react-icons/lucide.

- **Tokens (`globals.css`, same class contract)**: `--brand-navy` → deep teal, `--brand-teal` → cyan, NEW `--brand-amber` (+soft/border/ink) wired into `@theme`; neutrals/text/borders/shadows/selection (amber)/focus-ring retinted; dark mode remapped to teal surfaces with white-safe teal primaries; footer/sidebar token gradient ready. Added `.btn-amber`, `.badge-amber`, `prefers-reduced-motion` kill-switch. Replaced the global `:focus` outline-killer with `:focus-visible` rings (mouse clicks stay clean, keyboard users get visible focus). `chem-pattern-dark` retinted.
- **Brand/shared**: `MTMark` redrawn (teal badge + amber benzene hexagon + cyan molecule); wordmark teal/ink-amber; Navbar amber signup CTAs + amber "مدرس كيمياء • الإسماعيلية"; Sidenav is now a deep-teal gradient sidebar (white text, amber active pill via new `SideNavLink tone="teal"`, amber role chip, `aria-current` added); Footer deep-teal gradient with amber accents; Toaster/theme-color/manifest retinted; contact location "الإسماعيلية، مصر".
- **Student experience**: Hero rebuilt as deep-teal panel (amber headline accent, cyan/amber formula motifs, teacher photo in brand frame); Benefits panel teal with amber numerals; CTA teal + amber signup; student overview/exams/grades/contact headers converted to teal panels with amber CTAs/badges; ExamCard + GradeCard CTAs amber.
- **Exam interface (priority)**: calm light cards preserved; progress bar amber; submit button amber; review header teal gradient with amber date badge; score figure on amber-soft card. Answer states: selected = teal (token), correct/wrong = green/red (semantic, kept), navigator pills unchanged. No new exam animations.
- **Missed-strings sweep (question-system, display-only — values/logic untouched)**: all 6 plugin Renderers (صحيحة/إجابتك, صح/خطأ display, essay labels/placeholder, image alt/zoom, fill-blank hints/aria, matching table/arrow/options), all 6 Editors, all 6 Previews, all 6 `meta.label` (SourceStep display + Word export headings now emit Arabic type labels — `docxExporter.test.js` updated to "سؤال 1 — اختيار من متعدد"). True-false canonical values stay "true"/"false" (normalize maps صح/خطأ → canonical).
- **RTL sweep**: 13 files `text-left` → `text-right` (tables, forms, selects, cards); LTR preserved for code/phone/email/link inputs, MathRenderer, timers/numerals.
- **Preserved**: routes, auth/permissions, exam logic/timers/grading/persistence/drafts, scoring, submission/review flows, analytics calculations, admin functionality, API contracts, schemas. No fake data, no dead buttons, no new packages.
- **Verification**: `npm run build` passes; full suite 984 passed / 8 failed (same pre-existing env-driven `updateUserData` baseline; 3 PostCSS-env suites unloadable as before); eslint 0 errors on touched files. Palette grep clean (no `#1E237E`/`#10B981`/`#12145a`/indigo rgba left in `src`).

## Reference-Style Homepage (personalized, real data only) — Complete

Recomposed the homepage to mirror the supplied reference layout WITHOUT inventing data, fake stats, dead buttons, or links to non-existent pages (no FAQ/privacy/terms pages exist — footer help column deliberately omitted).

- **Navbar**: 6 links per reference — الرئيسية، الامتحانات، النتائج، المحتوى التعليمي، عن الأستاذ، تواصل معنا — all mapped to real routes (exam/overview pages redirect guests to login via existing guards).
- **Hero**: photo-right/text-left per reference, "ابدأ الآن" CTA, login button relabeled "دخول المنصة", central animated fingerprint, scroll cue → `#welcome` (always-present wrapper), hero stat band removed (stats now real, below).
- **New `StudentHome`** (logged-in students only): welcome with real first name + real available-exam count; next-exam card from first unattempted exam across own grades (real title/grade/questions/duration shown only when the field exists — no date shown, exams have no date field); 3 SVG rings from real aggregates using the exact `/api/student/analytics` formulas (accuracy, completed taken/total, attendance; honest empty states); showcase of up to 3 real exams via new client `ExamShowcaseCard` (fingerprint art header, real `hasAttempted` status → مكتمل/عرض النتيجة or متاح الآن/ابدأ الامتحان, hashids-encoded links like ExamCard); last-3 real submissions table (title/score/date/mكتمل state — no invented pass/fail); brand quote card with fingerprint.
- **Logged-out marketing** preserved (WhyChooseMe/steps/grades/CTA); grades section retitled "المواد الدراسية"; CTA band gained fingerprint art.
- **Verification**: `npm run build` passes; full suite 984/8 (same pre-existing baseline).

## Structural Redesign (layouts, not just colors) — Complete

Second redesign pass: genuine composition/layout/component changes (previous pass was mostly token-level). All routes, APIs, auth, exam logic, timers, grading, drafts, scoring, and data models untouched; only presentation markup/classes changed. No new dependencies; no browser/screenshot tooling available in this environment, so visual verification is via build + tests + code review (no screenshots claimed).

- **Navbar**: rebuilt as deep-teal dark bar — MTMark monogram (replaces logo img), white links with amber active-underline (`usePathname`, `aria-current`), auth-aware actions, amber signup CTA, redesigned mobile panel (teal, active amber rows, user card).
- **Hero**: recomposed — oversized display headline with amber accent line, trust checklist, portrait card with amber frame + floating formula chips, integrated stat band (replaces separate BenefitsSection, now unused), new `Marquee` divider (RTL keyframes in CSS, reduced-motion safe). Homepage: static stage cards replaced by "إزاي تبدأ؟" 3-step strip with real route links; grades grid kept with redesigned GradeCard.
- **WhyChooseMe**: editorial split — sticky intro with amber-underline headline + CTAs beside numbered (01–04) cards.
- **ExamCard**: horizontal row — status ribbon (solved/new), teal identity block with count, title + meta row (questions/duration now displayed/difficulty dot), full-width amber CTA. **GradeCard**: teal band header (giant numeral, level chip, formula) + checklist body + footer CTA.
- **Quiz (exam screen)**: desktop two-column with sticky navigator rail (legend, counts) + mobile scroll strip; status-dot pills; live "answered X of Y" + live progress %; larger question type with square chips; amber submit bar with count summary; review shows SVG score ring, tiered headline, per-question status labels (incl. unanswered/essay states); emojis removed (FiEdit3 etc.).
- **MCQ options**: letter chips (أ ب ج د...) with selected fill + keyboard focus-visible ring.
- **Dashboard overview**: editorial band (logo chip, greeting, brand line, amber CTA, quick-nav rail with 3 icon cards) + analytics untouched.
- **Sidenav**: narrowed 288→256px (both dashboard layouts updated), teal mobile top bar, section label, amber teacher card, `aria-current` links.
- **GradeDetail tabs** → segmented pill control with `role=tablist`; **Pagination** rebuilt with السابق/التالي + numbered buttons + single-page guard; **Footer** brand block recomposed (lockup + amber pull-quote); **404** branded panel with second action; **empty states** (exams/grades) with icon + real action links; **auth panels** gain brand-quote band.
- **Tests**: only `docxExporter.test.js` expectation updated (Arabic type label flows into export headings by design). Full suite: 984 passed / 8 failed — identical pre-existing `updateUserData` env baseline, no regressions. `npm run build` passes.

## Chemical Fingerprint Identity + Icon Audit + GSAP Motion — Complete

No reference image file exists in the repo; direction implemented from the written spec (amber/cyan on deep teal). No new dependencies (gsap@3.13, @gsap/react@2, react-icons@5.5 reused). No browser tooling here, so no screenshots claimed — verified via build + tests + code review.

- **New `ChemicalFingerprint`** (`src/app/components/brand/ChemicalFingerprint.jsx`): custom 200×200 SVG — 5 hand-authored wobble arc ridges, 2 orbital ellipses, 3 bonds, 4 atom nodes, radial halo; `size`/`variant(dark|light)`/`animated`/`showMolecules`/`className`/`label` props. Scoped `useGSAP` timeline: ridges draw via measured dashoffset (stagger), orbits fade, bonds draw, nodes pop + one restrained pulse, one glow dot travels ridge[0] via MotionPath then settles. Nothing hidden in markup (visible if JS fails); `prefers-reduced-motion` renders the complete static symbol. Appears: Hero backdrop (animated), Quiz exam header (static), Sidenav teacher card (static, molecules off), footer (static), 404 (animated), contact header (static).
- **New motion infra**: `lib/anim.js` (once-only ScrollTrigger+MotionPath registration, `prefersReducedMotion()`); `src/app/components/ui/Reveal.jsx` (mount/scroll entrance wrapper, `as` prop, reduced-motion safe). Used on: hero text+portrait, homepage steps/grades headers, overview/exams/grades/contact headers, CTA. Exam runner untouched by entrance animation (focused env). Fixed latent bug: `WhyChooseMeCard` used ScrollTrigger without registration (worked only while the now-unused BenefitsSection registered it) — now via `lib/anim` + `once:true` + reduced-motion guard.
- **Icon audit**: all decorative Unicode/emoji replaced with `react-icons/lu` (all names verified against installed v5.5): ~35 files — 12 dashboard pages (badges: LuClipboardList/LuPlus/LuPlay/LuLayers/LuCalendarDays/LuChartNoAxesCombined/LuUsers/LuBell/LuPenLine/LuDatabase; back arrows LuArrowLeft), Repository/AI workbench (LuFlaskConical/LuCheck/LuX + ValidationStep Arabic string), SignUpForm stepper, GradesSection CSS dots, DataCards iconMap→components, ResultsByExam, NotificationBell (dropped emoji toast icon), contact/CTA/homepage arrows, Footer dot, student sections (LuFlaskConical/LuCircleCheck), UserAnalyticsSection (LuSigma/LuDiamond/LuTriangle), guardian backdrops, plus my files (ExamCard/GradeCard/Pagination/WhyChooseMe/Hero/overview/exams/grades/settings/gradeId). Kept legitimately: MathToolbar/MathRenderer math symbols, formula strings (H₂O/NaCl/pH), LTR time-range arrows, MTMark logo, `π` faint backdrops.
- **Verification**: `npm run build` passes; full suite 984/8 (same pre-existing env baseline); eslint 0 errors; symbol grep clean in `src/app`.

## Homepage Reference-Fidelity Pass (attached Chemistry Learning Dashboard PNG) - Complete

Compared the rendered markup against the attached reference image and closed the remaining gaps. Build passes; full suite 984 passed / 8 failed (identical pre-existing `updateUserData` baseline).

- **Hero**: rebuilt to a full-bleed photo background (`/hero.jpeg` as absolute fill + teal gradient scrim, so the portrait reads at full scale like the reference) instead of the framed portrait card; dropped the floating formula chips and trust checklist; headline/name/role/CTA order now matches the reference. Fingerprint moved to a decorative bottom-left mark.
- **StudentHome section order** now mirrors the reference exactly: stats (right) + welcome & next exam (left) -> available exams -> subjects -> recent results (right) + quote (left) -> full-width CTA band. Cards tightened from `rounded-3xl` to `rounded-2xl` for the reference's softer radius; stats strip got the fingerprint icon.
- **New `SubjectCard`** (`src/app/components/home/SubjectCard.jsx`): dark teal "المواد الدراسية" tile with flask icon, real enrolled grade name, derived level label, and arrow affordance linking to `/userDashboard/grades/[gradeId]`. `page.js` now passes the student's real `myGrades` list - no invented subjects.
- **ExamShowcaseCard**: restructured to reference anatomy - fixed-height art band with status pill, then a white body carrying title/grade/question-count/duration and the CTA. Middle card is elevated (`featured`) with the filled amber button; untaken outer cards use the outlined button, completed ones use the soft navy button. Grid uses `items-start` so the featured lift doesn't stretch siblings.
- **Results table**: columns reordered to match the reference (الامتحان / التاريخ / الدرجة / الحالة), score column now shows the real computed percentage, and status is a real pass/fail pill (`>= 50%`) instead of a constant "مكتمل". Empty state added when a student has no submissions.
- **CTA band** now renders for logged-in students too (previously guest-only via `CTASection`), wired to the student's next exam with a browse fallback.

## Guest Dashboard Mockup - Complete

Requested: show a stats/dashboard mockup on the homepage when there is no session. Build passes; suite unchanged at 984 passed / 8 failed (pre-existing baseline).

- **New `MetricRing`** (`src/app/components/home/MetricRing.jsx`): the SVG progress ring extracted out of `StudentHome` so the logged-in dashboard and the guest mockup share one implementation. Added a `dimmed` variant.
- **New `MockDashboard`** (`src/app/components/home/MockDashboard.jsx`): static preview of the student dashboard for guests, mirroring the reference layout - stats card with three rings (72% / 4-5 / 12), welcome card with a sample "next exam" panel, and a sample results table. Explicitly badged as `معاينة تجريبية` / `بيانات توضيحية`, and all values are hard-coded illustrative constants (`MOCK_STATS`, `MOCK_RESULTS`) so they can never be mistaken for real user data.
- **No real-data leakage**: the mockup makes no database calls and every action links to `/signup` (or `/login` in the hero) instead of a real exam route.
- **Wiring**: rendered only in the guest branch of `src/app/(platform)/page.js`, above `WhyChooseMe`. Logged-in students still get the fully real `StudentHome` - the mockup and real dashboard never render together.

## Animated Stats + Atom Orbit & Lab Glassware - Complete

Build passes; suite unchanged at 984 passed / 8 failed (pre-existing `updateUserData` baseline).

- **`MetricRing` is now a client component that animates in view**: on mount it registers GSAP + ScrollTrigger and, when the ring reaches `top 88%` (`once: true`), the arc fills from empty to its real percentage over 1.2s while the readout counts up. The counter parses the display string so `"72%"` counts to 72 and keeps `%`, and `"4/5"` counts to 4 and keeps `/5`. Final values are still rendered server-side, so the numbers are correct with JS disabled, and `prefers-reduced-motion` skips the animation entirely. Used by both the real `StudentHome` and the guest `MockDashboard`.
- **New `AtomOrbit`** (`src/app/components/brand/AtomOrbit.jsx`): brand atom mark replacing the fingerprint in the hero. Three tilted elliptical orbits draw themselves in via measured dashoffset, then loop forever: the amber **core rides the main orbit** (`svgOrigin` rotation), two cyan electrons counter-rotate on the outer orbit, an amber trail arc marks the core's path, and the central nucleus breathes. Fully static (nothing hidden in markup) when `prefers-reduced-motion` is set.
- **New `LabGlassware`** (`src/app/components/brand/LabGlassware.jsx`): animated conical flask + round-bottom flask + test tube. Glass outlines draw on, liquid gradients slosh, bubbles rise and fade on staggered infinite loops (clipped inside each vessel), and a bonded 3-atom molecule cluster rotates inside the bulb. Each vessel's liquid and bubbles are `clipPath`-scoped to the glass so nothing spills past the outline.
- **Placement**: hero now shows `AtomOrbit` (top-left) + `LabGlassware` (bottom-left) in place of the single fingerprint; `CTASection` gained the glassware; the student dashboard CTA band gained the orbit. The fingerprint remains as the identity mark elsewhere (footer, 404, sidebar, quiz, cards).
- **Verification**: rasterised both SVGs to PNG with `sharp` and inspected them, which caught two real defects that were then fixed - the conical flask's liquid meniscus line extended past the glass walls (now clipped), and the main orbit was too faint under the core (thicker stroke plus the amber trail arc).

## Removed ChemicalFingerprint - Complete

`src/app/components/brand/ChemicalFingerprint.jsx` deleted along with every import and usage. The brand mark is now `AtomOrbit` (with `LabGlassware` for the lab scene); nothing references the fingerprint symbol any more.

- **Migrated to `AtomOrbit`**: `not-found.jsx` (404 panel), `Footer.jsx` (brand lockup), `components/ui/Sidenav.jsx` (teacher card), `components/Quiz.jsx` (exam header), `components/home/ExamShowcaseCard.jsx` (card art band), `components/home/SubjectCard.jsx` (tile art), `components/home/StudentHome.jsx` (stats strip, next-exam panel, quote card - the quote card now uses the animated orbit), `components/home/MockDashboard.jsx` (same three spots).
- **Import-only cleanup**: `(platform)/contact/page.jsx` had a dead import plus a commented-out usage - both removed.
- **`components/CTASection.jsx`**: the fingerprint was dropped rather than replaced because the section already carries the animated `LabGlassware`, which was scaled up to 200px in that spot.
- The now-unused `showMolecules` prop disappeared with the last fingerprint call sites; verified no `showMolecules` references remain in `src`.
- **Verification**: `npm run build` compiles successfully and a recursive grep for `ChemicalFingerprint` / `fp-ridge` / `fp-node` / `fp-traveler` in `src` returns nothing. Suite unchanged: 984 passed / 8 failed (pre-existing `updateUserData` baseline).

## Dark Mode Removed + Split Hero Images - Complete

Build passes; suite unchanged at 984 passed / 8 failed (pre-existing `updateUserData` baseline).

- **Dark mode is gone end to end**:
  - `globals.css`: dropped `@custom-variant dark`, the whole 80-line `.dark {}` token override block, and the six `.dark .btn-secondary` / `.inlined-btn` / `.badge-*` rules. The `:root` light tokens are now the only theme.
  - Stripped **261 `dark:*` variant tokens across 50 source files** with a token-boundary regex (only standalone `dark:`-prefixed classes; the `variant="dark"` palette prop on `AtomOrbit`/`LabGlassware` and the `dark:` object keys inside their PALETTES maps were deliberately preserved). Where a ternary collapsed to two identical branches the surviving light-mode class is what renders.
  - Deleted `components/ui/ThemeToggle.jsx` and its four mount points (Navbar desktop actions, Navbar mobile actions, Sidenav header, Sidenav mobile panel).
  - Removed the blocking pre-paint theme script and both `suppressHydrationWarning` flags from `layout.js` - there is no longer any client-side theme resolution.
- **Split hero images**: `public/hero-desk.jpeg` (1920w landscape, from the 1402x1122 original) and `public/hero-mobile.jpeg` (900x1200 portrait crop framed on the teacher via sharp's `attention` crop). `HeroSection` renders both with `next/image fill`: the portrait one is `lg:hidden` with `object-[50%_18%]`, the landscape one is `hidden lg:block`. The scrim switches direction with the layout - vertical `bg-gradient-to-t` (opaque at the bottom where mobile text sits) on small screens, horizontal `lg:bg-gradient-to-l` on desktop. The original `public/hero.jpeg` is kept but no longer referenced.
- **Note on tooling**: PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM, and a BOM in `globals.css` made the Tailwind/PostCSS output fail to parse (`Invalid dangling combinator in selector`). The BOM was stripped from `globals.css`, `Navbar.jsx` and `Sidenav.jsx`; future edits to these files should avoid PowerShell `Set-Content`.

## Real Logo Replaces The Custom Marks - Complete

Build passes; suite unchanged at 984 passed / 8 failed (pre-existing `updateUserData` baseline).

- **Navbar** (`components/Navbar.jsx`): the `MTMark` SVG monogram is gone. The brand slot now renders `/logo.png` via `next/image` inside a `h-11 w-11` white rounded chip, so the square artwork with its white background sits deliberately on the deep-teal bar instead of floating as a white square. `priority` is set since it is above the fold.
- **Sidenav teacher card** (`components/ui/Sidenav.jsx`): the `AtomOrbit` avatar mark replaced with the same `/logo.png` chip treatment at 38px, matching the navbar.
- **Footer**: dropped the `AtomOrbit` that sat next to the logo image - it was duplicating the brand mark rather than adding anything.
- **Deleted `components/brand/MTLogo.jsx`** (`MTMark` + the unused `MTLogo` lockup). Nothing imports it now.
- `AtomOrbit` is intentionally kept where it is illustration rather than identity: the hero art, the 404 panel, the exam-runner header, and the homepage card art. Say the word if those should go too.
- PWA/favicon entries in `layout.js` already pointed at `/favicon.ico` and `/icons/icon-192.png`, so they were untouched.

## Diagnosis: Frozen Animations Were A Corrupt Turbopack Cache, Not A Code Bug

Reported symptom: every animation on the homepage frozen (hero orbit/flasks, stats rings, scroll reveals) plus red errors in the browser console. The errors were all `SyntaxError: Unexpected end of input` / `Invalid or unexpected token` inside **Next.js's own framework chunks** (`next/dist/compiled/react-dom`, `react-server-dom-turbopack`, `next/dist/client`, `next-devtools`, `katex`, `gsap`) - i.e. the client bundle failed to parse, so no client effect ever ran. That is why everything was frozen at once.

- **Root cause**: the served chunk files were physically truncated (files ending mid-token, e.g. `module.exports = __turbopa`). A `npm run dev` server had been running while `npm run build` repeatedly rewrote the same `.next` directory, interleaving writes and leaving partial chunk files. This session's builds also raced with that server.
- **Fix**: killed the dev server on port 3000, deleted `.next` entirely, ran a clean `npm run build` (compiles successfully).
- **Verification**: restarted `npm run dev`, loaded `/`, waited for compilation to settle, then downloaded all 33 client chunks referenced by the page and ran `node --check` on each (copied to `.mjs` so ESM chunks parse correctly) - **33/33 valid**. An earlier run that fetched chunks immediately after first paint showed 10-11 truncated files, which identified the write race.
- Also confirmed along the way: SSR HTML contains the animation markup (`ao-ring`, `lg-glass`, `mr-arc`, hero images), GSAP + ScrollTrigger are present in the client bundle, and disk space is fine (34 GB free on C:, 59 GB on D:).
- **Real code fix made in passing**: `MetricRing` used to zero the readout at mount and animate via a ScrollTrigger-bound timeline, so any ring not yet scrolled into view displayed "0". It now builds a paused timeline and plays it from a one-shot `ScrollTrigger.create({ onEnter })`, so off-screen rings keep their server-rendered value and only animate when they enter view.
- **If it recurs**: never run `npm run build` while `npm run dev` is running - both write `.next`. Stop the dev server, delete `.next`, then restart, and hard-refresh (Ctrl+Shift+R) so the browser drops the previously truncated chunks from cache.

## public/og.jpeg Wired As The Social Image - Complete

Build passes. The user supplied `public/og.jpeg` (1200x896, jpeg); it is now the OG/Twitter image everywhere instead of `logo.png`.

- **`src/app/layout.js`**: added site-wide `openGraph` (type/locale/siteName/title/description/images) and `twitter` (`card: summary_large_image`) defaults pointing at `/og.jpeg`. The existing `metadataBase` resolves the relative URL to `https://mr-ahmed-eldesouky.pixelpulse.online/og.jpeg`.
- **`src/app/(platform)/page.js`**: homepage metadata now uses `/og.jpeg` with the real 1200x896 dimensions, `url: "/"`, plus a matching `twitter` block.
- **Scripted sweep** over `src/app/**`: every remaining social-image reference that pointed at the absolute `.../logo.png` (with a declared 1200x630 that never matched the asset) now points at `.../og.jpeg`, and the declared dimensions were corrected to `width: 1200, height: 896`. Files touched: `(auth)/layout.js`, `(auth)/login/page.jsx`, `(auth)/signup/page.jsx`, `(dashboard)/layout.js`, `(dashboard)/dashboard/overview/page.jsx`, `(platform)/layout.js`, `(platform)/contact/page.jsx`, `(userDashboard)/userDashboard/layout.js`. In-page `<Image src="/logo.png">` UI logos were left alone.
- **Exception**: the schema.org JSON-LD `EducationalOrganization.logo` in `(platform)/contact/page.jsx` still uses `/logo.png` (a square mark is the right asset for `logo`); a sibling `image` property was added with the OG URL instead.
- **Verified live**: the dev server renders `og:image` = absolute `/og.jpeg`, `og:image:width=1200`, `og:image:height=896`, `og:image:alt`, and `twitter:card=summary_large_image` with `twitter:image` pointing at the same file.
- **Note**: `og.jpeg` is 1.34:1, while Facebook/X prefer 1.91:1 (1200x630) for `summary_large_image`; the image will be slightly letterboxed or centre-cropped in link previews.
- **Open item (not caused by this change)**: `tests/repository/docxExporterReal.test.js` now fails on `expect(arabicBlock).toContain('<w:jc w:val="right"/>')`. Root cause verified in isolation - `docx@9.9.0` rewrites paragraph alignment when `bidirectional: true`: `new Paragraph({bidirectional:true, alignment:"right"})` serialises to `<w:bidi/><w:jc w:val="left"/>`, while the same paragraph without `bidirectional` keeps `w:val="right"`. The exporter at `lib/repository/exporters/docx.js` still asks for RIGHT, so the library is normalising it. Needs a decision: adjust the test expectation, or switch the exporter to `AlignmentType.START`.
- **Heads-up**: `src/app/components/HeroSection.jsx` was modified outside this session (19:54) - the hero images switched to `/hero-mobile.png` and `/hero-desk.png` and the gradient scrim div was emptied to `<div className="absolute inset-0 -z-10" />`. Without that scrim the headline and CTA sit directly on the photo with no contrast layer.

## Logo Backgrounds Removed + Navbar Wordmark Deleted - Complete

Build passes. Suite: 983 passed / 9 failed - the 8 pre-existing `updateUserData` failures plus the `docxExporterReal` RTL-alignment mismatch documented in the previous entry (unrelated to this work).

- **Finding**: `public/logo.png` was never the problem - inspected its pixels and the corners are already `[0,0,0,0]`, i.e. the artwork is a transparent PNG (the white seen in the earlier preview render was just the image viewer compositing transparency on white). The visible white blocks were the `bg-white` containers added when the logo replaced the old monogram.
- **Removed every white backdrop around the logo**:
  - `components/Navbar.jsx` - the `rounded-xl bg-white` chip is gone; the `<Image>` renders directly on the teal bar.
  - `components/ui/Sidenav.jsx` - teacher-card `rounded-xl bg-white` chip removed, and the mobile top-bar logo lost `rounded-lg bg-white p-0.5`.
  - `components/Footer.jsx` - the `rounded-2xl bg-white p-2 shadow-sm` wrapper is gone (logo grew to 48px).
- **Deleted the wordmark next to the logo**: the Navbar brand lockup is now just `/logo.png` at 44px (the name, the "مدرس كيمياء • الإسماعيلية" subtitle and the wrapper span are all gone), and the Sidenav mobile top bar logo lost its name/subtitle stack for the same reason. `aria-label`/`alt` still carry the name for screen readers and SEO.
- **Left in place on purpose**: the Footer brand block name/role, the Sidenav teacher card, and the header name blocks on `/contact`, the admin dashboard and the student dashboard - those are informational blocks, not logo lockups. Say the word if they should go too.
- **Contrast warning (verified by compositing the PNG over `#073B40` and inspecting it)**: the artwork's dark-teal outlines and strokes are almost the same value as the navbar/sidebar background, so on those dark surfaces only the amber and white lettering reads and the rest of the mark disappears - worse at 44px. If legibility matters more than the flat look, a `bg-white/10` + `backdrop-blur` glass chip (instead of solid white) or a lighter variant of the asset would fix it without bringing back an opaque white block.

## Fixed: Mojibake Arabic In `components/home/StudentHome.jsx`

Reported symptom: the welcome subtitle rendered as garbage, e.g. `Ø§Ø³ØªÙ…Ø± ÙÙŠ Ø±Ø­Ø†ØªÙƒ...`. That is Arabic text that had been decoded as Windows-1252 and re-saved as UTF-8 (mojibake) - and it was rendering live on the logged-in homepage.

- **Scope**: swept every `.js/.jsx` file under `src`, `lib` and `tests` for the classic signatures (`Ø§`, `Ù`, `â€`). Exactly one source file was affected: `components/home/StudentHome.jsx` (whole file, plus a UTF-8 BOM). `src` and `lib` are now clean; the only other hits were 8 AI/import test files each carrying a single mangled em dash in a comment, which were also repaired.
- **Why a mechanical fix was not enough**: the reverse transform (re-encode to cp1252 bytes, decode as UTF-8) initially produced valid-looking but _wrong_ Arabic ("إىن إحصائىاتقؙ" instead of "إيه إحصائياتك؟") - the corruption was lossier than a clean double-encode (characters had been substituted, not just re-encoded). So the file was rebuilt by hand with correct Arabic while preserving every class name, component and data binding exactly.
- Also removed the now-unused `ChemicalFingerprint` import from that file (it had been swapped for `AtomOrbit` earlier).
- **Verified**: the Arabic strings in `StudentHome.jsx` and `MockDashboard.jsx` now read correctly when extracted from disk; build compiles; suite unchanged at 983 passed / 9 failed (8 pre-existing `updateUserData` + the `docxExporterReal` RTL-alignment mismatch).
- **Likely cause**: the file's mtime (18:59:02) matched a batch of files written outside this session, and PowerShell-style `Set-Content -Encoding utf8` on Windows is the usual way this corruption enters. Anyone editing Arabic in this repo from PowerShell should write files through an editor or Node instead.

## Input Focus Outline Removed - Complete

Reported: focusing an input drew a visible outline around it. Two separate mechanisms were responsible.

- **Global `:focus-visible`** was applying a hard `outline: 2px solid var(--focus)` with `outline-offset: 2px` to _every_ focusable element, inputs included, so the ring floated 2px away from the field like a stray box.
- **Per-field Tailwind rings**: most text inputs in the app carry `focus:border-brand-navy focus:ring-4 focus:ring-ring focus:outline-none` (a 4px teal halo), and the AI/exam-generator editors use `focus:ring-2 focus:ring-blue-400`.

**Changes (all in `src/app/globals.css`, no per-file edits needed):**

1. The hard keyboard outline is now scoped to interactive controls only: `:where(a, button, summary, [role="button"], [role="tab"], [role="switch"], [tabindex]):focus-visible`. Buttons/links keep their crisp keyboard ring, which is an accessibility requirement.
2. Text form fields get no outline and no halo at all - the existing 2px border simply turns brand teal (`border-color: var(--focus)`):
   `:where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select):focus, ...:focus-visible { outline: none; box-shadow: none; border-color: var(--focus); }`
   Because `globals.css` rules are **unlayered**, this also overrides the Tailwind `focus:ring-*` utilities on inputs - which is why ~25 component files did not need touching. Checkboxes/radios/range/file inputs are excluded so their small focus ring survives.
3. `.input:focus` was updated to match (it previously forced `box-shadow: none` but also reset `border-color` back to the default, so `.input` fields had no focus indication at all - now the border turns teal).

- **Verified in the built CSS** (`.next/static/chunks/3598jdi-_69qx.css`): both rules compile as expected, and they sit outside `@layer utilities`, so they take precedence over the utilities they replace.
- Unchanged on purpose: `.input-container:focus-within::after`, the 2px underline that grows across the field bottom, and `.custom-input`'s bottom border. Those are design elements flush with the field, not an outline.
- Build passes; suite unchanged at 983 passed / 9 failed (8 pre-existing `updateUserData` + the `docxExporterReal` RTL-alignment mismatch).

## Lighter Navbar/Footer + "Bond in Chemistry" Slogan - Complete

Build passes; suite unchanged at 983 passed / 9 failed (8 pre-existing `updateUserData` + the `docxExporterReal` RTL-alignment mismatch).

**Lighter surfaces** (the navbar and footer were the two darkest elements on the page):

- `components/Navbar.jsx`: bar background `#073B40` -> `#0E666B`, matching shadow `shadow-[#073B40]/20` -> `shadow-[#073B40] -> shadow-[#0E666B]/25`; mobile panel `#0B5155` -> `#0A5A5F`.
- `components/Footer.jsx`: gradient `from-[#073B40] to-[#0A2124]` -> `from-[#0E666B] to-[#0A4F53]` (lighter at the top, still grounding at the bottom).
- White body text on `#0E666B` measures ~6.7:1 contrast, so readability improved rather than dropped. These are hardcoded hexes in two files - if they want it lighter still, `#0E666B` is the single knob (navbar + footer top) and `#0A5A5F`/`#0A4F53` are the darker ends.

**Slogan** - "Bond in Chemistry" (matching the artwork in `logo.png` and the YouTube handle `@mr.ahmedeldesouky-bondinch1057`):

- `components/brand/teacherBrand.js`: added `slogan: "Bond in Chemistry"`, set `brandLine` to the same, and moved the old Arabic hook to a new `heroLine: "الكيمياء مش حفظ معادلات... دي فهم وتفكير."` so nothing is lost.
- `components/Footer.jsx`: the amber pull-quote is now the Latin slogan (`dir="ltr"`, `tracking-wide`) instead of the two-line Arabic hook. The Arabic platform description paragraph underneath was kept - the old pull-quote and the description had become near-duplicates.
- `components/ui/Sidenav.jsx`: teacher-card tagline is now the Latin slogan.
- `(userDashboard)/userDashboard/overview/page.jsx`: the eyebrow above the greeting is now the Latin slogan.
- `components/HeroSection.jsx`: added the slogan as an amber, uppercase, wide-tracked eyebrow above the Arabic headline, which keeps the Arabic hook as the dominant line. If they want the hero headline itself replaced by the slogan, that's a one-line change.
- All Arabic in the touched files was verified intact afterwards (no BOM, no mojibake signatures) - the edits went through Node/`.NET` file APIs rather than PowerShell `Set-Content`, which is what corrupted `StudentHome.jsx` earlier.

## Glassmorphism Navbar & Footer - Complete

Clarification on the previous entry: "lighter" meant **more opacity / translucent**, not a lighter hue. Both surfaces are now frosted glass over the page content. Build passes; suite unchanged at 983 passed / 9 failed.

- **`components/Navbar.jsx`**: `bg-[#0E666B]` -> `bg-[#0E666B]/70` (solid) with `supports-[backdrop-filter]:bg-[#0E666B]/60` as the fallback-corrected value, plus `backdrop-blur-xl`, `backdrop-saturate-150`, a `border-b border-white/15` hairline and a soft `shadow-[#0A4F53]/20`. The mobile dropdown panel went to `bg-[#0A5A5F]/80 backdrop-blur-xl` so it matches.
- **`components/Footer.jsx`**: `from-[#0E666B]/75 to-[#0A4F53]/85` with `backdrop-blur-xl backdrop-saturate-150`, a `border-t border-white/15` hairline and `shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]` - that inner top highlight is the detail that sells the glass edge.
- **`components/ui/Sidenav.jsx`**: the mobile top bar (the mobile counterpart of the navbar) got the identical treatment, including the `supports-[backdrop-filter]` fallback.
- **Verified in the compiled CSS**: `bg-[#0E666B]/70` compiles to `background-color:#0e666bb3` (70% alpha) and both `backdrop-blur-xl` and `backdrop-saturate-150` emit real `backdrop-filter` declarations - so the effect is not silently dropped.
- **Contrast note**: the alpha sits at 60-85%, so white text keeps roughly the 6:1+ range it had when the bar was solid; the light `--background` (#F1F7F6) showing through slightly lifts the surface without hurting legibility.
- **Expectation to set**: the navbar blurs page content scrolling under it, which is where the frosted read is strongest. The footer sits at the page end over a flat background, so it reads as *translucent* more than *frosted* - there is nothing textured behind it to blur.
- All edits went through `.NET`/Node file APIs (no PowerShell `Set-Content`) to avoid the BOM/mojibake trap; Arabic in the touched files verified intact.

## Hero Top Padding Removed - Complete

Reported: extra space above the homepage hero content. Build passes.

- **`components/HeroSection.jsx`**: the hero content wrapper used `py-20` (5rem top *and* bottom). Split it to `pb-20 pt-0` (plus the pre-existing `max-md:pb-4`), so the hero no longer pushes the "Bond in Chemistry" eyebrow and headline down. Bottom padding is kept so the headline/CTA still breathe against the bottom edge and the absolutely-positioned scroll cue keeps its room.
- Checked for other sources of top spacing on the homepage and found none: `(platform)/layout.js` wraps children in a bare `overflow-x-clip` + font container with no padding, and `globals.css` sets no `padding-top`/`scroll-padding` on `html`/`body`. The `py-8`/`py-10` values on the sections below the hero are section rhythm, not top-of-page padding.
- Note: `lg:min-h-screen` on the same wrapper means the hero fills the viewport height, so on large screens the content is now vertically centred rather than centred-plus-80px.
