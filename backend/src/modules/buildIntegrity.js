/**
 * CI/CD Build Integrity Module
 * Verifies CI config file hashes against an approved baseline (report 3.2.4).
 */

const crypto = require('crypto');

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compares the current CI config content's hash against a stored baseline
 * hash. Returns a verdict object, never throws.
 */
function verifyBuildIntegrity(currentContent, baselineHash) {
  const currentHash = sha256(currentContent);
  const match = currentHash === baselineHash;
  return {
    match,
    currentHash,
    baselineHash,
    verdict: match ? 'VERIFIED' : 'MISMATCH',
    detail: match
      ? 'CI configuration matches approved baseline'
      : 'CI configuration hash differs from approved baseline — possible tampering',
  };
}

function setBaseline(content) {
  return sha256(content);
}

module.exports = { sha256, verifyBuildIntegrity, setBaseline };
