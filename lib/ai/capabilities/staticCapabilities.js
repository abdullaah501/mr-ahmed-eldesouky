import { resolveCapability } from "../providers/base/BaseProviderAdapter";
import { CAPABILITY, CAPABILITIES } from "../types/capabilities";

export function staticSupports(adapter, capability, opts) {
  return resolveCapability(adapter, capability, opts);
}

export function staticProfile(adapter, { model } = {}) {
  const flags = {};
  for (const cap of CAPABILITIES) flags[cap] = staticSupports(adapter, cap, { model });
  return flags;
}