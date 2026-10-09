import { listProviders } from "../../../../../lib/ai/providers/registry";
import "../../../../../lib/ai/providers";
import { aiEnv } from "../../../../../lib/ai/config/env";
import { runtimeFlags } from "../../../../../lib/ai/capabilities/runtimeCapabilities";
import { staticProfile } from "../../../../../lib/ai/capabilities/staticCapabilities";
import { listExtractors } from "../../../../../lib/ai/resources";
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

  const env = aiEnv();
  const disabledSet = env.disabled;
  const providers = listProviders().map((adapter) => {
    const flags = runtimeFlags(adapter, { disabledSet });
    const models = (adapter.models || []).map((model) => ({
      id: model.id,
      label: model.label || model.id,
      default: Boolean(model.default),
      contextWindow: model.contextWindow ?? null,
      maxOutputTokens: model.maxOutputTokens ?? null,
      pricing: model.pricing || null,
      capabilities: staticProfile(adapter, { model: model.id }),
    }));

    return {
      id: adapter.id,
      label: adapter.label,
      configured: Boolean(adapter.apiKey?.()),
      status: providerStatus(adapter, flags),
      capabilities: staticProfile(adapter),
      models,
    };
  });

  const resourceExtractors = Object.fromEntries(
    listExtractors().map((extractor) => [extractor.id, {
      category: extractor.category,
      implemented: extractor.implemented !== false,
    }])
  );

  return Response.json({ providers, order: env.order, resourceExtractors });
}
