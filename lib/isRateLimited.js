import { checkRateLimit, incrementRateLimit } from "./rateLimit";

export async function isRateLimited(email, ip, limit = 5) {
  const result = await checkRateLimit({
    service: "auth",
    key: `${email}-${ip}`,
    limit,
    windowSeconds: 600,
  });

  if (!result.allowed) return true;

  await incrementRateLimit({
    service: "auth",
    key: `${email}-${ip}`,
    windowSeconds: 600,
  });

  return false;
}
