// Small in-memory rate limiter (no extra package needed).
// Protects login, registration codes and password reset from brute-force attempts.
// Note: counts are per server instance, which is fine for a single-instance deployment.
const rateLimit = ({ windowMs = 15 * 60 * 1000, max = 20, message = 'Too many attempts. Please try again later.', keyBy } = {}) => {
  const hits = new Map();

  // Forget old entries now and then so memory stays small
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.reset <= now) hits.delete(key);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const key = keyBy ? keyBy(req) : `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ message });
    }
    next();
  };
};

module.exports = rateLimit;
