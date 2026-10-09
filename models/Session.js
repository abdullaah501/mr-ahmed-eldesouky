import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    refreshToken: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    fingerprint: { type: String, required: true},
    isExp: { type: Boolean, default: false },
    expiredAt: { type: Date, default: null },
    // Sliding session lifetime (Phase 4): the absolute time the session
    // document expires. The TTL index uses expireAfterSeconds=0, so MongoDB
    // deletes the document when expiresAt falls into the past. Each successful
    // refresh (and updateUserData rotation) slides expiresAt forward by
    // SESSION_TTL_MS. Login/register stamp it on creation.
    expiresAt: { type: Date, default: null, expires: 0 },
    previousRefreshToken: { type: String, default: null },
    previousRefreshTokenExpiresAt: { type: Date, default: null },
  }
);

const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);
export default Session;
