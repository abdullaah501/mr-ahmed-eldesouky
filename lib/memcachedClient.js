import memjs from "memjs";

let client = null;

export function getMemcachedClient() {
  if (client) return client;

  const url = process.env.MEMCACHED_URL || process.env.MEMCACHIER_SERVERS;

  console.log({
    MEMCACHED_URL: !!process.env.MEMCACHED_URL,
    MEMCACHIER_SERVERS: !!process.env.MEMCACHIER_SERVERS
});

  if (!url) {
    console.warn("Memcached URL not configured. Rate limiting will fail open.");
    return null;
  }

  try {
    client = memjs.Client.create(url, {
      username: process.env.MEMCACHIER_USERNAME,
      password: process.env.MEMCACHIER_PASSWORD,
    });
    return client;
  } catch (err) {
    console.warn("Failed to create Memcached client:", err.message);
    return null;
  }
}
