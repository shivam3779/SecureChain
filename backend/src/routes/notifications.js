const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { db } = require('../db/store');
const notifications = require('../modules/notificationService');

/**
 * Alert channel configuration per repository (report 3.2.5: "Configured
 * notification targets — Slack, Jira, PagerDuty, email"). Stored on the
 * repository record (mirrors the `alert_channels` table in the report's
 * schema, section 3.5).
 */

router.get('/repos/:id/alert-channels', requireAuth, async (req, res) => {
  await db.read();
  const repo = db.data.repositories.find((r) => r.id === req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  res.json(redact(repo.alertChannels || {}));
});

router.put('/repos/:id/alert-channels', requireAuth, async (req, res) => {
  await db.read();
  const repo = db.data.repositories.find((r) => r.id === req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });

  const { slackWebhookUrl, jira, pagerDutyRoutingKey, pagerDutyEndpointOverride, email } = req.body;
  repo.alertChannels = {
    ...(slackWebhookUrl !== undefined ? { slackWebhookUrl } : { slackWebhookUrl: repo.alertChannels?.slackWebhookUrl }),
    ...(jira !== undefined ? { jira } : { jira: repo.alertChannels?.jira }),
    ...(pagerDutyRoutingKey !== undefined ? { pagerDutyRoutingKey } : { pagerDutyRoutingKey: repo.alertChannels?.pagerDutyRoutingKey }),
    ...(pagerDutyEndpointOverride !== undefined ? { pagerDutyEndpointOverride } : { pagerDutyEndpointOverride: repo.alertChannels?.pagerDutyEndpointOverride }),
    ...(email !== undefined ? { email } : { email: repo.alertChannels?.email }),
  };
  await db.write();
  res.json(redact(repo.alertChannels));
});

/**
 * Sends a synthetic P0 finding through every configured channel and reports
 * exactly what each dispatcher did — this is the "Test notification" button
 * a dashboard would wire up. Real HTTP calls, real failure modes, nothing
 * mocked: if Slack rejects the webhook URL, you see that error here.
 */
router.post('/repos/:id/alert-channels/test', requireAuth, async (req, res) => {
  await db.read();
  const repo = db.data.repositories.find((r) => r.id === req.params.id);
  if (!repo) return res.status(404).json({ error: 'Repository not found' });
  if (!repo.alertChannels || Object.values(repo.alertChannels).every((v) => !v)) {
    return res.status(400).json({ error: 'No alert channels configured for this repository' });
  }

  const syntheticFinding = {
    type: 'TEST_ALERT',
    cveId: 'CVE-2025-TEST',
    component: 'test-package',
    version: '1.0.0',
    severity: 9.8,
    epss: 0.42,
    priorityLabel: 'P0_CRITICAL',
    summary: 'This is a SecureChain test notification — safe to ignore.',
    fixedVersions: ['1.0.1'],
  };

  // priorityLabel is P0_CRITICAL so all channel types are exercised
  // regardless of dispatchAlert's normal P0-only gating for Jira/PagerDuty.
  const results = await notifications.dispatchAlert(repo.alertChannels, syntheticFinding);
  res.json({ testFinding: syntheticFinding, results });
});

function redact(channels) {
  // Never echo back secrets in API responses; show presence only.
  return {
    slackWebhookUrl: channels.slackWebhookUrl ? '••••configured••••' : null,
    jira: channels.jira ? { baseUrl: channels.jira.baseUrl, projectKey: channels.jira.projectKey, configured: true } : null,
    pagerDutyRoutingKey: channels.pagerDutyRoutingKey ? '••••configured••••' : null,
    email: channels.email ? { to: channels.email.to, configured: true } : null,
  };
}

module.exports = router;
