import { listProviders } from "../../../../../lib/ai/providers/registry";
import "../../../../../lib/ai/providers";
import { aiEnv } from "../../../../../lib/ai/config/env";
import { runtimeFlags } from "../../../../../lib/ai/capabilities/runtimeCapabilities";
import { inspect } from "../../../../../lib/ai/core/circuitBreaker";
import { authorizeAiRequest, authResponse } from "../_shared/auth";

function providerStatus(adapter, flags) {
  if (flags.disabled) return "disabled";
  if (flags.cooldown) return "cooldown";
  if (flags.circuitOpen) return "circuitOpen";
  if (!adapter.apiKey?.()) return "unconfigured";
  return "healthy";
}

export async function GET(req) {
  const auth = await authorizeAiRequest(req);
  if (!auth.ok) return authResponse(auth);

  const disabledSet = aiEnv().disabled;
  const providers = listProviders().map((adapter) => {
    const flags = runtimeFlags(adapter, { disabledSet });
    const state = inspect(adapter.id);
    return {
      id: adapter.id,
      status: providerStatus(adapter, flags),
      configured: Boolean(adapter.apiKey?.()),
      cooldownUntil: state.cooldownEndsAt || null,
      consecutiveFailures: state.consecutiveFailures,
    };
  });

  return Response.json({ providers });
}
