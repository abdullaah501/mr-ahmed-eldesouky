import { assertProviderAdapter } from "./base/BaseProviderAdapter";

const providers = new Map();

export function registerProvider(adapter) {
  assertProviderAdapter(adapter);
  providers.set(adapter.id, adapter);
}

export function listProviders() {
  return [...providers.values()];
}

export function getProvider(id) {
  return providers.get(id) || null;
}

export function clearProviders() {
  providers.clear();
}

export function isImplemented(adapter) {
  return Boolean(adapter && adapter.implemented !== false);
}