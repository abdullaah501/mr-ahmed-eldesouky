// lib/repository/pagination/offsetStrategy.js
//
// textScore sorting is non-deterministic — the same query can return different
// orderings across invocations. Keyset pagination is NOT valid here because
// the sort key (score) is not stable.
//
// Offset pagination is intentionally used for $text search.
// DO NOT replace this with keyset pagination without fixing the sort stability
// problem first (e.g., via Atlas Search "searchAfter" with a deterministic sort).
//
// Strategy is pure: receives a Mongoose query, returns { items, nextCursor, hasMore }.

import { decodeOffsetCursor, encodeOffsetCursor } from "../cursors";
import { toRepositoryQuestion } from "../mapper";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function offsetPaginate(query, params) {
  const limit = Math.min(Math.max(params.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);

  query = query
    .sort({ score: { $meta: "textScore" } })
    .limit(limit + 1);

  const prevCursor = decodeOffsetCursor(params.cursor);
  const offset = prevCursor ? prevCursor.offset : 0;
  if (offset > 0) {
    query = query.skip(offset * limit);
  }

  const docs = await query.lean();
  const hasMore = docs.length > limit;
  if (hasMore) docs.pop();

  const items = docs.map(toRepositoryQuestion);
  const nextCursor = hasMore ? encodeOffsetCursor(offset + 1) : null;

  return { items, nextCursor, hasMore };
}
