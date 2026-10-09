"use client"; // Ensure it runs in the client-side

import FingerprintJS from "@fingerprintjs/fingerprintjs";

const getFingerprint = async () => {
  if (typeof window === "undefined") return null; // Prevent running on the server

  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId; // Unique device ID
};

export default getFingerprint;
