// lib/repository/pagination/keysetStrategy.js
// Compound keyset pagination — generic, works with any sortField + sortOrder.
// Strategy is pure: receives a Mongoose query, returns { items, nextCursor, hasMore }.

import mongoose from "mongoose";
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  coerceSortValue,
} from "../cursors";
import { toRepositoryQuestion } from "../mapper";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function keysetPaginate(query, params, sortField, sortOrder) {
  const limit = Math.min(Math.max(params.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);

  query = query
    .sort({ [sortField]: sortOrder, _id: sortOrder })
    .limit(limit + 1);

  const cursor = decodeKeysetCursor(params.cursor, sortField, sortOrder);
  if (cursor) {
    const sortVal = coerceSortValue(cursor.sortValue);
    const comparison = sortOrder === -1 ? "$lt" : "$gt";
    const objId = new mongoose.Types.ObjectId(cursor.id);

    query = query.where({
      $or: [
        { [sortField]: { [comparison]: sortVal } },
        { [sortField]: sortVal, _id: { [comparison]: objId } },
      ],
    });
  }

  const docs = await query.lean();
  const hasMore = docs.length > limit;
  if (hasMore) docs.pop();

  const items = docs.map(toRepositoryQuestion);
  const nextCursor = hasMore && items.length > 0
    ? encodeKeysetCursor(items[items.length - 1], sortField, sortOrder)
    : null;

  return { items, nextCursor, hasMore };
}
