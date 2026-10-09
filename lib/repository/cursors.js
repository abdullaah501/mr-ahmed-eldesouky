// lib/repository/cursors.js — Cursor encode/decode helpers
// All cursors are opaque (versioned JSON → base64). Consumers never parse them.

import mongoose from "mongoose";

function b64encode(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function b64decode(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.v !== "number") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

// ── Keyset cursor (v1) ─────────────────────────────────────

export function encodeKeysetCursor(doc, sortField, sortOrder) {
  return b64encode({
    v: 1,
    sf: sortField,
    so: sortOrder,
    sv: doc[sortField] ?? null,
    id: String(doc._id),
  });
}

export function decodeKeysetCursor(cursor, sortField, sortOrder) {
  const parsed = b64decode(cursor);
  if (!parsed || parsed.v !== 1) return null;
  if (parsed.sf !== sortField || parsed.so !== sortOrder) return null;
  if (!parsed.id || !mongoose.isValidObjectId(parsed.id)) return null;
  if (parsed.sv === undefined || parsed.sv === null) return null;
  return { sortValue: parsed.sv, id: parsed.id };
}

// ── Offset cursor (v2) ─────────────────────────────────────

export function encodeOffsetCursor(offset) {
  return b64encode({ v: 2, offset });
}

export function decodeOffsetCursor(cursor) {
  const parsed = b64decode(cursor);
  if (!parsed || parsed.v !== 2) return null;
  if (typeof parsed.offset !== "number" || parsed.offset < 0) return null;
  return { offset: parsed.offset };
}

// ── Utilities ──────────────────────────────────────────────

export function coerceSortValue(raw) {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return raw;
}
