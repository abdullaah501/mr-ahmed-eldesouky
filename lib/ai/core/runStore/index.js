import { aiEnv } from "../../config/env";
import { NullRunStore } from "./NullRunStore";

const RING_SIZE = 50;

function makeDebugRing() {
  const buffer = [];
  return {
    recordRun(run) {
      buffer.push(run);
      if (buffer.length > RING_SIZE) buffer.shift();
      return run;
    },
    snapshot() {
      return [...buffer];
    },
  };
}

let cached = null;

export function getRunStore() {
  if (cached) return cached;
  if (aiEnv().debug) {
    cached = makeDebugRing();
  } else {
    cached = NullRunStore;
  }
  return cached;
}

export function resetRunStoreCache() {
  cached = null;
}

export { NullRunStore };