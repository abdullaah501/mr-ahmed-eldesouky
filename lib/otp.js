import crypto from "crypto";
import { createMemcachedAdapter } from "./storage/MemcachedAdapter";

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300;
const OTP_FENCE_TTL_SECONDS = 10;
const MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_SECONDS = 600;

if (!process.env.OTP_PEPPER || process.env.OTP_PEPPER.length < 32) {
  throw new Error(
    "OTP_PEPPER is required and must be at least 32 characters"
  );
}
const OTP_PEPPER = process.env.OTP_PEPPER;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashEmail(email) {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex");
}

function hmacOtp(otp) {
  return crypto
    .createHmac("sha256", OTP_PEPPER)
    .update(otp)
    .digest("hex");
}

function buildOtpStoreKey(email) {
  return `otp:store:${hashEmail(email)}`;
}

function buildOtpFenceKey(email) {
  return `otp:fence:${hashEmail(email)}`;
}

function buildOtpAttemptsKey(email) {
  return `otp:attempts:${hashEmail(email)}`;
}

function buildOtpClaimKey(email, otp) {
  return `otp:claim:${hashEmail(email)}:${hmacOtp(otp)}`;
}

function buildResetTokenKey(token) {
  return `reset:token:${token}`;
}

function buildResetCurrentKey(email) {
  return `reset:current:${hashEmail(email)}`;
}

function buildResetClaimKey(token) {
  return `reset:claim:${token}`;
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidOtp(otp) {
  if (typeof otp !== "string") return false;
  return /^\d{6}$/.test(otp);
}

function isValidResetToken(token) {
  if (typeof token !== "string") return false;
  return /^[a-f0-9]{64}$/.test(token);
}

function generateOtp(length = OTP_LENGTH) {
  const otp = crypto.randomInt(0, 10 ** length);
  return otp.toString().padStart(length, "0");
}

async function storeOtp({ email, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  const fenceKey = buildOtpFenceKey(email);
  const storeKey = buildOtpStoreKey(email);

  const fenceAcquired = await storage.add(fenceKey, "1", {
    expires: OTP_FENCE_TTL_SECONDS,
  });
  if (!fenceAcquired) {
    return null;
  }

  const otp = generateOtp();
  const otpHash = hmacOtp(otp);
  await storage.set(storeKey, otpHash, { expires: OTP_TTL_SECONDS });
  return otp;
}

async function verifyOtp({ email, otp, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  const storeKey = buildOtpStoreKey(email);
  const attemptsKey = buildOtpAttemptsKey(email);

  // Atomically claim one attempt slot before anything else.
  // increment() maps to Memcached native `incr`, which is a single
  // server-side operation — concurrent requests each get a unique counter
  // value and cannot split-read the same number.
  const newCount = await storage.increment(attemptsKey, 1, {
    initial: 1,
    expires: OTP_TTL_SECONDS,
  });

  // newCount === null means the storage call failed — fail closed.
  if (newCount === null || newCount > MAX_ATTEMPTS) {
    return { success: false, code: "MAX_ATTEMPTS" };
  }

  const storedHash = await storage.get(storeKey);
  if (!storedHash) {
    return { success: false, code: "INVALID_OTP" };
  }

  const userHash = hmacOtp(otp);

  const storedBuf = Buffer.from(storedHash, "hex");
  const userBuf = Buffer.from(userHash, "hex");
  if (
    storedBuf.length !== userBuf.length ||
    !crypto.timingSafeEqual(storedBuf, userBuf)
  ) {
    return { success: false, code: "INVALID_OTP" };
  }

  const claimKey = buildOtpClaimKey(email, otp);
  const claimed = await storage.add(claimKey, "1", {
    expires: OTP_TTL_SECONDS,
  });
  if (!claimed) {
    return { success: false, code: "OTP_ALREADY_USED" };
  }

  await storage.delete(storeKey);
  await storage.delete(attemptsKey);

  return { success: true };
}

async function consumeOtp({ email, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  await storage.delete(buildOtpStoreKey(email));
  await storage.delete(buildOtpAttemptsKey(email));
  await storage.delete(buildOtpFenceKey(email));
}

async function getRemainingAttempts({ email, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  const attemptsKey = buildOtpAttemptsKey(email);
  const attemptsStr = await storage.get(attemptsKey);
  const attemptCount = attemptsStr ? parseInt(attemptsStr, 10) : 0;
  return Math.max(0, MAX_ATTEMPTS - attemptCount);
}

async function storeResetToken({ email, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenKey = buildResetTokenKey(token);
  const currentKey = buildResetCurrentKey(email);

  const oldToken = await storage.get(currentKey);
  if (oldToken) {
    await storage.delete(buildResetTokenKey(oldToken));
  }

  await storage.set(tokenKey, email, { expires: RESET_TOKEN_TTL_SECONDS });
  await storage.set(currentKey, token, { expires: RESET_TOKEN_TTL_SECONDS });

  return token;
}

async function consumeResetToken({ token, storageAdapter }) {
  const storage = storageAdapter || createMemcachedAdapter();
  const tokenKey = buildResetTokenKey(token);

  const email = await storage.get(tokenKey);
  if (!email) {
    return null;
  }

  const claimKey = buildResetClaimKey(token);
  const claimed = await storage.add(claimKey, "1", {
    expires: RESET_TOKEN_TTL_SECONDS,
  });
  if (!claimed) {
    return null;
  }

  await storage.delete(tokenKey);
  await storage.delete(buildResetCurrentKey(email));

  return email;
}

export {
  OTP_LENGTH,
  OTP_TTL_SECONDS,
  OTP_FENCE_TTL_SECONDS,
  MAX_ATTEMPTS,
  RESET_TOKEN_TTL_SECONDS,
  generateOtp,
  storeOtp,
  verifyOtp,
  consumeOtp,
  getRemainingAttempts,
  storeResetToken,
  consumeResetToken,
  isValidEmail,
  isValidOtp,
  isValidResetToken,
  buildOtpStoreKey,
  buildOtpFenceKey,
  buildOtpAttemptsKey,
  buildOtpClaimKey,
  buildResetTokenKey,
  buildResetCurrentKey,
  buildResetClaimKey,
  hmacOtp,
  hashEmail,
};
