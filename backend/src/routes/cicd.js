const express = require('express');
const router = express.Router();

const sbomEngine = require('../modules/sbomEngine');
const vulnEngine = require('../modules/vulnerabilityEngine');
const malwareAnalyzer = require('../modules/maliciousPackageAnalyzer');
const buildIntegrity = require('../modules/buildIntegrity');
const policyGate = require('../modules/policyGate');
const notifications = require('../modules/notificationService');
const { verifyGitHubSignature, verifyGitLabToken } = require('../modules/webhookSecurity');
const { db, uuid } = require('../db/store');
const { requireAuth } = require('../middleware/auth');

/**
 * THE CI/CD PLUGIN ENDPOINT (report 3.2.4)
 * ------------------------------------------------------------------
 * This is what the GitHub Action / GitLab CI job / Jenkins pipeline step
 * actually calls, post-dependency-install, before the build is allowed to
 * proceed. It:
 *   1. Accepts a project's resolved dependency manifest (or raw
 *      package.json) submitted directly by the pipeline runner — no GitHub
 *      API round-trip needed, since the pipeline already has the
 *      dependencies installed locally.
 *   2. Runs SBOM generation, vulnerability correlation, and malicious
 *      package analysis.
 *   3. Optionally verifies CI config SHA-256 against a stored baseline.
 *   4. Evaluates the Policy Gate.
 *   5. Dispatches alerts for anything above threshold.
 *   6. Returns a verdict the CI runner uses to pass/fail the build.
 *
 * Auth: a per-repository API key (Bearer token), generated via
 * POST /api/repos/:id/api-key — this is what's embedded as a CI secret,
 * distinct from the human GitHub-OAuth session JWT.
 */
async function authenticateApiKey(req, res, next) {
  const header = req.headers.authorization || '';
  const key = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!key) return res.status(401).json({ error: 'Missing CI API key' });
  await db.read();
  const record = db.data.repositories.find((r) => r.ciApiKey === key);
  if (!record) return res.status(401).json({ error: 'Invalid CI API key' });
  req.repo = record;
  next();
}

router.post('/repos/:id/api-key', requireAuth, async (req, res) => {
  await db.read();
  const repo = db.data.repositories.find((r) => r.id === req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  repo.ciApiKey = `sk_ci_${uuid().replace(/-/g, '')}`;
  await db.write();
  res.json({ apiKey: repo.ciApiKey });
});

router.post('/sbom-submit', express.json({ limit: '5mb' }), authenticateApiKey, async (req, res) => {
  const startedAt = Date.now();
  try {
    const { manifest, ciConfigContent, ciConfigBaselineHash, ecosystem = 'npm', maxDepth = 2 } = req.body;
    if (!manifest) return res.status(400).json({ error: 'manifest (parsed package.json contents) is required' });

    const rootDeps = { ...(manifest.dependencies || {}), ...(manifest.devDependencies || {}) };
    const tree = await sbomEngine.resolveDependencyTree(rootDeps, { maxDepth });
    const cycloneDX = sbomEngine.toCycloneDX(manifest.name || req.repo.fullName, manifest.version, tree);

    const [vulnerabilities, maliciousPackages] = await Promise.all([
      vulnEngine.correlateComponents(tree.components, ecosystem),
      malwareAnalyzer.analyzeComponents(tree.components),
    ]);

    let integrityVerdict = null;
    if (ciConfigContent && ciConfigBaselineHash) {
      integrityVerdict = buildIntegrity.verifyBuildIntegrity(ciConfigContent, ciConfigBaselineHash);
    }

    const scanResult = { vulnerabilities, maliciousPackages };
    const gate = policyGate.evaluateGate(scanResult, req.repo.policy, integrityVerdict);

    // Persist
    await db.read();
    const repo = db.data.repositories.find((r) => r.id === req.repo.id);
    const scanJob = {
      id: uuid(),
      repoId: repo.id,
      source: 'CI_PLUGIN',
      status: 'completed',
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      gateVerdict: gate.verdict,
    };
    db.data.scan_jobs.push(scanJob);
    for (const v of vulnerabilities) db.data.vulnerabilities.push({ id: uuid(), repoId: repo.id, scanJobId: scanJob.id, ...v, status: 'Open' });
    for (const m of maliciousPackages) db.data.malicious_packages.push({ id: uuid(), repoId: repo.id, scanJobId: scanJob.id, ...m });
    repo.lastScanId = scanJob.id;
    await db.write();

    // Notify on anything that triggered a non-PASS verdict, plus all P0s regardless
    const channels = repo.alertChannels || {};
    const notifyTargets = [
      ...vulnerabilities.filter((v) => v.priorityLabel === 'P0_CRITICAL'),
      ...(gate.verdict !== 'PASS' ? maliciousPackages : []),
    ];
    const notifyResults = await Promise.all(notifyTargets.map((f) => notifications.dispatchAlert(channels, f)));

    res.json({
      verdict: gate.verdict, // PASS | FAILED | BLOCKED  <-- CI step exits non-zero unless this is PASS
      reasons: gate.reasons,
      scanJobId: scanJob.id,
      summary: {
        components: tree.components.length,
        vulnerabilities: vulnerabilities.length,
        maliciousPackages: maliciousPackages.length,
        p0Count: vulnerabilities.filter((v) => v.priorityLabel === 'P0_CRITICAL').length,
      },
      buildIntegrity: integrityVerdict,
      notificationsSent: notifyResults.length,
      sbomPreview: { bomFormat: cycloneDX.bomFormat, componentCount: cycloneDX.components.length },
    });
  } catch (err) {
    res.status(500).json({ verdict: 'ERROR', error: 'SBOM submit failed', detail: err.message });
  }
});

// ------------------------------------------------------------------
// Webhook receivers: GitHub Actions / GitLab CI notify SecureChain when a
// pipeline run completes, so the dashboard can show pipeline_runs status
// even for runs that didn't go through the in-pipeline plugin step above.
// ------------------------------------------------------------------

router.post(
  '/webhooks/github-actions',
  express.raw({ type: 'application/json' }), // need raw body for HMAC verification
  async (req, res) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (secret && !verifyGitHubSignature(req.body, signature, secret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(req.body.toString('utf-8'));
    if (event !== 'workflow_run') return res.json({ ignored: true, event });

    await db.read();
    const run = payload.workflow_run;
    db.data.scan_jobs.push({
      id: uuid(),
      source: 'GITHUB_ACTIONS_WEBHOOK',
      repoFullName: payload.repository?.full_name,
      workflowName: run.name,
      conclusion: run.conclusion,
      status: run.status,
      headSha: run.head_sha,
      htmlUrl: run.html_url,
      receivedAt: new Date().toISOString(),
    });
    await db.write();

    res.json({ received: true, conclusion: run.conclusion });
  }
);

router.post('/webhooks/gitlab-ci', express.json(), async (req, res) => {
  const secret = process.env.GITLAB_WEBHOOK_SECRET;
  const token = req.headers['x-gitlab-token'];
  if (secret && !verifyGitLabToken(token, secret)) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }

  const payload = req.body;
  if (payload.object_kind !== 'pipeline') return res.json({ ignored: true, kind: payload.object_kind });

  await db.read();
  db.data.scan_jobs.push({
    id: uuid(),
    source: 'GITLAB_CI_WEBHOOK',
    repoFullName: payload.project?.path_with_namespace,
    status: payload.object_attributes?.status,
    ref: payload.object_attributes?.ref,
    receivedAt: new Date().toISOString(),
  });
  await db.write();

  res.json({ received: true, status: payload.object_attributes?.status });
});

/**
 * Jenkins has no native webhook format; the Jenkinsfile snippet (see
 * /jenkins/Jenkinsfile.example) posts its own build metadata here after
 * calling the securechain-cli sbom-submit step.
 */
router.post('/webhooks/jenkins', express.json(), authenticateApiKey, async (req, res) => {
  await db.read();
  db.data.scan_jobs.push({
    id: uuid(),
    source: 'JENKINS_WEBHOOK',
    repoId: req.repo.id,
    buildNumber: req.body.buildNumber,
    result: req.body.result,
    jobUrl: req.body.jobUrl,
    receivedAt: new Date().toISOString(),
  });
  await db.write();
  res.json({ received: true });
});

router.get('/pipeline-runs', async (req, res) => {
  await db.read();
  const runs = db.data.scan_jobs.filter((s) => s.source && s.source.includes('WEBHOOK'));
  res.json(runs);
});

module.exports = router;
