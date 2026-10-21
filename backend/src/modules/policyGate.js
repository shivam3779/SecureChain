/**
 * Policy Gate
 * Implements the decision logic from the report's state chart (3.3) and
 * flowchart (3.4):
 *   Malicious package detected?       -> Build Blocked Immediately
 *   Vulnerabilities above threshold?  -> Fail Security Gate
 *   else                              -> Pass Build
 *
 * Policies are configurable per-repository (default policy below mirrors
 * a sane out-of-the-box posture).
 */

const DEFAULT_POLICY = {
  // Block the build if any malicious/typosquat package is found at all.
  blockOnAnyMaliciousPackage: true,
  // Block on malicious heuristic findings (lower confidence) too, or only
  // on high-confidence typosquats.
  blockOnHeuristicFindings: false,
  // Vulnerability priority labels that fail the gate.
  blockOnPriorityLabels: ['P0_CRITICAL', 'P1_HIGH'],
  // Minimum raw CVSS score that fails the gate regardless of EPSS, as a
  // backstop for findings where EPSS lookup failed.
  cvssBlockThreshold: 9.0,
  // Maximum total Open findings allowed before the gate fails outright,
  // even if none are individually critical (alert fatigue prevention is
  // about volume too, not just severity).
  maxOpenFindings: 50,
  // Build script integrity: block on any SHA-256 mismatch against baseline.
  blockOnIntegrityMismatch: true,
};

function evaluateGate(scanResult, policyOverrides = {}, buildIntegrityVerdict = null) {
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };
  const reasons = [];
  let verdict = 'PASS';

  // 1. Build integrity check (runs first, matches "verify build script
  //    integrity" happening at build start in section 3.2.4)
  if (buildIntegrityVerdict && policy.blockOnIntegrityMismatch && buildIntegrityVerdict.verdict === 'MISMATCH') {
    verdict = 'BLOCKED';
    reasons.push({
      type: 'BUILD_INTEGRITY_MISMATCH',
      detail: buildIntegrityVerdict.detail,
    });
  }

  // 2. Malicious package check (highest priority — blocks immediately per
  //    flowchart, independent of CVE severity)
  const maliciousFindings = scanResult.maliciousPackages || [];
  const blockingMalicious = maliciousFindings.filter((m) => {
    if (m.type === 'TYPOSQUAT') return policy.blockOnAnyMaliciousPackage;
    return policy.blockOnHeuristicFindings;
  });
  if (blockingMalicious.length > 0) {
    verdict = 'BLOCKED';
    reasons.push({
      type: 'MALICIOUS_PACKAGE_DETECTED',
      count: blockingMalicious.length,
      packages: blockingMalicious.map((m) => m.packageName),
      detail: `${blockingMalicious.length} malicious/typosquatted package(s) detected — build blocked immediately`,
    });
  }

  // 3. Vulnerability severity threshold check
  const vulnFindings = scanResult.vulnerabilities || [];
  const blockingVulns = vulnFindings.filter(
    (v) => policy.blockOnPriorityLabels.includes(v.priorityLabel) || (v.severity != null && v.severity >= policy.cvssBlockThreshold)
  );
  if (blockingVulns.length > 0 && verdict !== 'BLOCKED') {
    verdict = 'FAILED';
    reasons.push({
      type: 'VULNERABILITY_THRESHOLD_EXCEEDED',
      count: blockingVulns.length,
      cveIds: blockingVulns.map((v) => v.cveId || v.id).filter(Boolean),
      detail: `${blockingVulns.length} finding(s) at or above policy threshold (${policy.blockOnPriorityLabels.join('/')}, CVSS≥${policy.cvssBlockThreshold})`,
    });
  }

  // 4. Volume-based alert fatigue backstop
  if (vulnFindings.length > policy.maxOpenFindings && verdict === 'PASS') {
    verdict = 'FAILED';
    reasons.push({
      type: 'FINDING_VOLUME_EXCEEDED',
      count: vulnFindings.length,
      detail: `${vulnFindings.length} total findings exceeds maxOpenFindings policy (${policy.maxOpenFindings})`,
    });
  }

  return {
    verdict, // PASS | FAILED | BLOCKED
    passed: verdict === 'PASS',
    reasons,
    evaluatedAt: new Date().toISOString(),
    policy,
  };
}

module.exports = { evaluateGate, DEFAULT_POLICY };
