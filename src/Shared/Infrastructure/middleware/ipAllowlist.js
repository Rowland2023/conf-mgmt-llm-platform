import ipaddr from 'ipaddr.js';

export const ipAllowlist = (allowedRanges = [], { onBlock, allowPrivateNetworks = false } = {}) => {
  const compiledRanges = [
   ...(allowPrivateNetworks? [
      '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '::1/128'
    ] : []),
   ...allowedRanges
  ].map(range => {
    try {
      const trimmed = String(range).trim();
      return trimmed.includes('/')
     ? { type: 'cidr', value: ipaddr.parseCIDR(trimmed), raw: trimmed }
        : { type: 'static', value: ipaddr.process(trimmed), raw: trimmed };
    } catch (err) {
      throw new Error(`Invalid IP/CIDR in allowlist [${range}]: ${err.message}`);
    }
  });

  return (req, res, next) => {
    // REQUIRES: app.set('trust proxy', N) where N = number of proxies
    const clientIpRaw = req.ip || req.socket.remoteAddress;

    if (!clientIpRaw) {
      return res.status(403).json({ error: 'Forbidden', message: 'Cannot determine client IP.' });
    }

    try {
      let clientIp = ipaddr.process(clientIpRaw);

      // Normalize IPv4-mapped IPv6 to IPv4
      if (clientIp.kind() === 'ipv6' && clientIp.isIPv4MappedAddress()) {
        clientIp = clientIp.toIPv4Address();
      }

      const clientKind = clientIp.kind();
      const matchedRule = compiledRanges.find(range => {
        if (range.type === 'cidr') {
          const [cidrIp] = range.value;
          return clientKind === cidrIp.kind() && clientIp.match(range.value);
        }
        return clientIp.toString() === range.value.toString();
      });

      if (!matchedRule) {
        req.log?.warn({ clientIp: clientIpRaw, path: req.path }, 'IP allowlist block');
        onBlock?.(clientIpRaw, req);
        return res.status(403).json({
          error: 'Forbidden',
          code: 'IP_NOT_ALLOWED',
          message: 'Your IP address is not authorized.'
        });
      }

      req.log?.debug({ clientIp: clientIpRaw, rule: matchedRule.raw }, 'IP allowlist pass');
      next();
    } catch (err) {
      req.log?.error({ err, clientIpRaw }, 'IP allowlist error');
      return res.status(403).json({ error: 'Forbidden', message: 'IP validation failed.' });
    }
  };
};
