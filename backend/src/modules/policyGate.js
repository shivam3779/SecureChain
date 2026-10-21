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
  // Block the build if any confirmed malicious package or high-confidence typosquat is found.
  blockOnAnyMaliciousPackage: true,
  // Block on critical ML-flagged malware findings (>= 85% probability + high confidence)
  blockOnCriticalMalware: true,
  // Block on lower-confidence heuristic findings (unverified new package, burst)
  blockOnHeuristicFindings: false,
  // Maximum allowed critical vulnerabilities (P0) before gate fails
  maxCriticalVulns: 0,
  // Maximum allowed high vulnerabilities (P1) before gate fails
  maxHighVulns: 2,
  // Exploit Prediction Scoring System (EPSS) threshold (probability of active exploitation in wild)
  epssBlockThreshold: 0.60,
  // Priority labels that fail the gate
  blockOnPriorityLabels: ['P0_CRITICAL'],
  // Minimum raw CVSS score that fails the gate
  cvssBlockThreshold: 9.0,
  // Maximum total findings allowed before failing
  maxOpenFindings: 50,
  // Build script integrity: block on SHA-256 mismatch against baseline
  blockOnIntegrityMismatch: true,
  // Fail-closed on incomplete, aborted, or error scans
  failClosedOnIncomplete: true,
};

function evaluateGate(scanResult = {}, policyOverrides = {}, buildIntegrityVerdict = null) {
  const policy = { ...DEFAULT_POLICY, ...policyOverrides };
  const reasons = [];
  let verdict = 'PASS';

  const components = Array.isArray(scanResult.components) ? scanResult.components : null;
  const hasCorruptComponent = components ? components.some((c) => c.corruptEntry === true) : false;
  const isEmptyComponents = components !== null && components.length === 0;

  // Top-level fail-closed check: corrupt manifest, parse error, malformed component entries, or empty components
  if (
    scanResult.manifestCorrupted === true ||
    Boolean(scanResult.parseError) ||
    hasCorruptComponent ||
    isEmptyComponents
  ) {
    const corruptReasons = [];
    if (scanResult.manifestCorrupted === true) {
      corruptReasons.push('Manifest corrupted or invalid syntax');
    }
    if (scanResult.parseError) {
      corruptReasons.push(`Manifest parser error: ${scanResult.parseError}`);
    }
    if (hasCorruptComponent) {
      const count = components.filter((c) => c.corruptEntry).length;
      corruptReasons.push(`${count} malformed or invalid dependency entry(ies) in manifest`);
    }
    if (isEmptyComponents) {
      corruptReasons.push('No valid software components found in manifest');
    }

    return {
      verdict: 'BLOCKED',
      passed: false,
      riskScore: 0,
      reasons: [
        {
          type: 'MANIFEST_CORRUPTED_OR_EMPTY',
          detail: corruptReasons.join('; ') || 'Manifest is corrupted, unparseable, or empty — failing closed per policy',
        },
      ],
      evaluatedAt: new Date().toISOString(),
      policy,
    };
  }

  // 0. Fail-closed check: incomplete analysis or fatal error in pipeline
  if (scanResult.error || scanResult.incomplete) {
    if (policy.failClosedOnIncomplete) {
      return {
        verdict: 'FAILED',
        passed: false,
        reasons: [{
          type: 'ANALYSIS_INCOMPLETE',
          detail: scanResult.error || 'Security scan did not complete cleanly — failing closed per policy',
        }],
        evaluatedAt: new Date().toISOString(),
        policy,
      };
    }
  }

  // 1. Build integrity check (blocks immediately on tamper)
  if (buildIntegrityVerdict && policy.blockOnIntegrityMismatch && buildIntegrityVerdict.verdict === 'MISMATCH') {
    verdict = 'BLOCKED';
    reasons.push({
      type: 'BUILD_INTEGRITY_MISMATCH',
      detail: buildIntegrityVerdict.detail || 'Build workflow configuration modified unexpectedly',
    });
  }

  // 2. Malicious package check (BLOCKED)
  const maliciousFindings = scanResult.maliciousPackages || scanResult.malwareFindings || [];
  const blockingMalicious = maliciousFindings.filter((m) => {
    if (m.type === 'TYPOSQUAT') return policy.blockOnAnyMaliciousPackage;
    if (m.severity === 'critical') return policy.blockOnAnyMaliciousPackage;
    if (m.type === 'ML_CLASSIFIER' && m.confidence === 'high' && (m.maliciousProbability || 0) >= 0.85) {
      return policy.blockOnCriticalMalware;
    }
    return policy.blockOnHeuristicFindings;
  });

  if (blockingMalicious.length > 0) {
    verdict = 'BLOCKED';
    reasons.push({
      type: 'MALICIOUS_PACKAGE_DETECTED',
      count: blockingMalicious.length,
      packages: blockingMalicious.map((m) => m.packageName),
      detail: `${blockingMalicious.length} hostile package(s) detected — pipeline blocked immediately`,
    });
  }

  // 3. Vulnerability severity & EPSS threshold check (FAILED)
  const vulnFindings = scanResult.vulnerabilities || [];

  const criticalVulns = vulnFindings.filter((v) =>
    v.priorityLabel === 'P0_CRITICAL' || (v.severity != null && v.severity >= policy.cvssBlockThreshold)
  );
  if (criticalVulns.length > policy.maxCriticalVulns && verdict !== 'BLOCKED') {
    verdict = 'FAILED';
    reasons.push({
      type: 'CRITICAL_VULNERABILITY_LIMIT_EXCEEDED',
      count: criticalVulns.length,
      cveIds: criticalVulns.map((v) => v.cveId || v.id).filter(Boolean),
      detail: `${criticalVulns.length} critical vulnerability(ies) exceed policy limit of ${policy.maxCriticalVulns}`,
    });
  }

  const highVulns = vulnFindings.filter((v) => v.priorityLabel === 'P1_HIGH');
  if (highVulns.length > policy.maxHighVulns && verdict !== 'BLOCKED') {
    verdict = 'FAILED';
    reasons.push({
      type: 'HIGH_VULNERABILITY_LIMIT_EXCEEDED',
      count: highVulns.length,
      cveIds: highVulns.map((v) => v.cveId || v.id).filter(Boolean),
      detail: `${highVulns.length} high-severity findings exceed policy limit of ${policy.maxHighVulns}`,
    });
  }

  const highEpssVulns = vulnFindings.filter((v) =>
    typeof v.epss === 'number' && !isNaN(v.epss) && v.epss >= policy.epssBlockThreshold
  );
  if (highEpssVulns.length > 0 && verdict !== 'BLOCKED') {
    verdict = 'FAILED';
    reasons.push({
      type: 'EPSS_EXPLOIT_RISK_EXCEEDED',
      count: highEpssVulns.length,
      cveIds: highEpssVulns.map((v) => v.cveId || v.id).filter(Boolean),
      detail: `${highEpssVulns.length} finding(s) have EPSS exploit probability >= ${(policy.epssBlockThreshold * 100).toFixed(0)}%`,
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
