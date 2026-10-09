import { verifyJWT } from "../../../../../lib/jwt";

const ALLOWED_ROLES = new Set(["admin", "assistant"]);

export async function authorizeAiRequest(req) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return { ok: false, status: 401, message: "Unauthorized" };

  try {
    const user = await verifyJWT(token);
    if (!ALLOWED_ROLES.has(user?.role)) {
      return { ok: false, status: 403, message: "Forbidden" };
    }
    return { ok: true, userId: String(user._id), user };
  } catch {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
}

export function authResponse(auth) {
  return new Response(auth.message || "Unauthorized", { status: auth.status || 401 });
}
