import crypto from "crypto";

const TOKEN_BYTES = 32;
const TOKEN_REGEX = /^[a-f0-9]{64}$/;

export function generateGuardianToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashGuardianToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function isValidGuardianTokenFormat(token) {
  return typeof token === "string" && TOKEN_REGEX.test(token);
}