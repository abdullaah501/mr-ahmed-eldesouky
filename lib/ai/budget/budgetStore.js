let _redisPromise = null;
let _warned = false;

async function getRedis() {
  if (_redisPromise !== null) return _redisPromise;
  _redisPromise = (async () => {
    try {
      const mod = await import("../../redis.js");
      return mod.default || null;
    } catch (err) {
      if (!_warned) {
        _warned = true;
        console.warn("[ai:budget] Upstash Redis unavailable — budget store fail-open:", err?.message);
      }
      return null;
    }
  })();
  return _redisPromise;
}

function periodKey(scope, period) {
  return `ai:budget:${scope}:${period}`;
}

function monthlyPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function dailyPeriod() {
  return new Date().toISOString().slice(0, 10);
}

function round(amount) {
  return Math.round(amount * 1_000_000) / 1_000_000;
}

async function add(scope, period, amount, ttlSeconds) {
  const client = await getRedis();
  if (!client || !amount || amount <= 0) return null;
  const key = periodKey(scope, period);
  try {
    await client.incrby(key, round(amount));
    await client.expire(key, ttlSeconds);
    const val = await client.get(key);
    return Number(val) || 0;
  } catch (err) {
    if (!_warned) {
      _warned = true;
      console.warn("[ai:budget] store add error:", err?.message);
    }
    return null;
  }
}

async function read(scope, period) {
  const client = await getRedis();
  if (!client) return 0;
  const key = periodKey(scope, period);
  try {
    const val = await client.get(key);
    return Number(val) || 0;
  } catch (err) {
    if (!_warned) {
      _warned = true;
      console.warn("[ai:budget] store read error:", err?.message);
    }
    return 0;
  }
}

export function _resetBudgetStoreForTests() {
  _redisPromise = null;
  _warned = false;
}

export const budgetStore = {
  readMonthly(scope) {
    return read(scope, monthlyPeriod());
  },
  readDaily(scope) {
    return read(scope, dailyPeriod());
  },
  addMonthly(scope, amount) {
    return add(scope, monthlyPeriod(), amount, 32 * 86_400);
  },
  addDaily(scope, amount) {
    return add(scope, dailyPeriod(), amount, 2 * 86_400);
  },
};