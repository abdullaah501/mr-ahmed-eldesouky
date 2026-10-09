import { isRateLimited } from "./isRateLimited";

const CONFIGS = {
  login: { limit: 5, windowSeconds: 600 },
  refresh: { limit: 30, windowSeconds: 600 },
  guardianGenerate: { limit: 10, windowSeconds: 600 },
  guardianVerify: { limit: 60, windowSeconds: 600 },
  guardianAttempt: { limit: 60, windowSeconds: 600 },
  // Grades is the highest-fan-out selector endpoint (13 dashboard surfaces
  // refetch it on navigation via React Query). 300/10min comfortably covers
  // legitimate multi-selector navigation (including several admins behind
  // one office IP) while staying bounded.
  grades: { limit: 300, windowSeconds: 600 },
  publicGrades: { limit: 60, windowSeconds: 600 },
  attendance: { limit: 60, windowSeconds: 600 },
  notifications: { limit: 120, windowSeconds: 600 },
  repositoryExport: { limit: 10, windowSeconds: 600 },
};

function getIp(req) {
  try {
    const fwd = req.headers?.get?.("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return req.headers?.get?.("host") || "unknown";
  } catch {
    return "unknown";
  }
}

export async function checkRouteRateLimit(req, routeName) {
  const cfg = CONFIGS[routeName];
  if (!cfg) return false;
  const ip = getIp(req);
  return await isRateLimited(`route:${routeName}`, ip, cfg.limit);
}
