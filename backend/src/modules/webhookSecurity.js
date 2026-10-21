/**
 * Webhook signature verification.
 * GitHub signs webhook payloads with HMAC-SHA256 over the raw body, sent as
 * `X-Hub-Signature-256: sha256=<hex>`. This is the exact verification
 * algorithm GitHub documents — testable locally without any external call.
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

const crypto = require('crypto');

function verifyGitHubSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * GitLab sends a static secret token in `X-Gitlab-Token`, not an HMAC —
 * verification is a direct (constant-time) comparison against the
 * configured webhook secret.
 */
function verifyGitLabToken(tokenHeader, secret) {
  if (!tokenHeader || !secret) return false;
  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Jenkins has no built-in webhook signing standard; SecureChain's Jenkins
 * plugin instead authenticates via a per-repo API key passed as a Bearer
 * token (see bin/securechain-cli.js), verified the same way as dashboard
 * API calls.
 */

module.exports = { verifyGitHubSignature, verifyGitLabToken };
