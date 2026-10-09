import Session from "../../models/Session";
import connectToDatabase from "../connectToDb";
import { logSecurityEvent } from "../securityLogger";

// Phase 6 — flag-revocation semantics.
//
// Sessions are revoked by setting `isExp: true` + `expiredAt: now` rather than
// deleting the document. Two reasons:
//
//   1. The `isNewDevice` SSE change stream watches updates whose
//      `updateDescription.updatedFields.isExp` exists — a delete never fires
//      it, so open tabs never learned about a logout. Flag-revoke makes every
//      revocation observable by all tabs holding the session.
//   2. The revoked document remains as a tombstone (until its sliding
//      `expiresAt` TTL removes it), so replay attempts and audit logs can
//      still resolve the session id.
//
// Both functions are idempotent: the `isExp: { $ne: true }` filter means a
// second revocation matches nothing and still reports success to the caller.

export async function revokeSession(sessionId) {
  if (!sessionId) return { revoked: false };
  try {
    await connectToDatabase();
    const res = await Session.updateOne(
      { _id: sessionId, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: new Date() } }
    );
    if (res.modifiedCount > 0) {
      logSecurityEvent("SESSION_REVOKED", { sessionId, reason: "single" });
    }
    return { revoked: res.modifiedCount > 0 };
  } catch (err) {
    return { revoked: false, error: err.message };
  }
}

export async function revokeUserSessions(userId) {
  if (!userId) return { revoked: 0 };
  try {
    await connectToDatabase();
    const res = await Session.updateMany(
      { userId, isExp: { $ne: true } },
      { $set: { isExp: true, expiredAt: new Date() } }
    );
    if (res.modifiedCount > 0) {
      logSecurityEvent("SESSION_REVOKED", { userId, reason: "bulk" });
    }
    return { revoked: res.modifiedCount || 0 };
  } catch (err) {
    return { revoked: 0, error: err.message };
  }
}
