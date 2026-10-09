import pLimit from "p-limit";

const queues = new Map();

export function getQueue(name, concurrency = 3) {
  const key = String(name || "default");
  let limiter = queues.get(key);
  if (!limiter) {
    limiter = pLimit(concurrency);
    queues.set(key, limiter);
  }
  return limiter;
}

export function resetQueues() {
  queues.clear();
}