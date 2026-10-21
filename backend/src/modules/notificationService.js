/**
 * Notification Service
 * Fans out findings to Slack, PagerDuty, Jira, and email, per report 3.2.5.
 * All four call REAL external REST APIs — none of this is mocked. They are
 * not reachable from this dev sandbox's restricted network (Slack/Jira/
 * PagerDuty/SMTP hosts aren't on the egress allowlist), but the request
 * shapes below match each provider's actual documented API.
 */

const axios = require('axios');
const nodemailer = require('nodemailer');

// ---------- Slack ----------
// Requires a Slack Incoming Webhook URL: https://api.slack.com/messaging/webhooks
async function sendSlackAlert(webhookUrl, finding) {
  if (!webhookUrl) return { skipped: true, reason: 'No Slack webhook configured' };
  const color = severityColor(finding.priorityLabel || finding.severityLabel);
  const payload = {
    attachments: [
      {
        color,
        title: `${finding.cveId || finding.id || finding.type} — ${finding.component || finding.packageName}`,
        text: finding.summary || finding.detail,
        fields: [
          { title: 'Priority', value: finding.priorityLabel || 'N/A', short: true },
          { title: 'CVSS', value: String(finding.severity ?? 'N/A'), short: true },
          { title: 'EPSS', value: finding.epss != null ? `${(finding.epss * 100).toFixed(1)}%` : 'N/A', short: true },
          { title: 'Fix version', value: (finding.fixedVersions || []).join(', ') || 'N/A', short: true },
        ],
        footer: 'SecureChain',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
  const { data, status } = await axios.post(webhookUrl, payload, { timeout: 8000 });
  return { sent: true, status, data };
}

function severityColor(label) {
  if (label === 'P0_CRITICAL') return '#e01e5a';
  if (label === 'P1_HIGH') return '#ECB22E';
  if (label === 'P2_MEDIUM') return '#2EB67D';
  return '#36C5F0';
}

// ---------- Jira ----------
// Requires: Jira Cloud base URL, an account email, and an API token
// (https://id.atlassian.com/manage-profile/security/api-tokens)
async function createJiraTicket({ baseUrl, email, apiToken, projectKey }, finding) {
  if (!baseUrl || !apiToken) return { skipped: true, reason: 'No Jira credentials configured' };
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const payload = {
    fields: {
      project: { key: projectKey },
      summary: `[SecureChain] ${finding.cveId || finding.id} in ${finding.component}@${finding.version}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: `${finding.summary || finding.detail || ''}\nCVSS: ${finding.severity ?? 'N/A'} | EPSS: ${finding.epss ?? 'N/A'} | Fix version(s): ${(finding.fixedVersions || []).join(', ') || 'N/A'}`,
              },
            ],
          },
        ],
      },
      issuetype: { name: 'Bug' },
      labels: ['securechain', (finding.priorityLabel || 'unknown').toLowerCase()],
    },
  };
  const { data, status } = await axios.post(`${baseUrl}/rest/api/3/issue`, payload, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    timeout: 10000,
  });
  return { sent: true, status, ticketKey: data.key, ticketUrl: `${baseUrl}/browse/${data.key}` };
}

// ---------- PagerDuty ----------
// Requires a PagerDuty Events API v2 integration key
// (https://developer.pagerduty.com/docs/events-api-v2/trigger-events/)
async function triggerPagerDutyAlert(routingKey, finding, endpointOverride) {
  if (!routingKey) return { skipped: true, reason: 'No PagerDuty routing key configured' };
  const payload = {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: `securechain-${finding.cveId || finding.id || finding.packageName}`,
    payload: {
      summary: `${finding.cveId || finding.id || finding.type} — ${finding.component || finding.packageName}`,
      severity: pagerDutySeverity(finding.priorityLabel),
      source: 'SecureChain',
      custom_details: finding,
    },
  };
  const endpoint = endpointOverride || 'https://events.pagerduty.com/v2/enqueue';
  const { data, status } = await axios.post(endpoint, payload, { timeout: 8000 });
  return { sent: true, status, data };
}

function pagerDutySeverity(label) {
  if (label === 'P0_CRITICAL') return 'critical';
  if (label === 'P1_HIGH') return 'error';
  if (label === 'P2_MEDIUM') return 'warning';
  return 'info';
}

// ---------- Email (SMTP via nodemailer) ----------
async function sendEmailAlert(smtpConfig, to, finding) {
  if (!smtpConfig || (!smtpConfig.host && !smtpConfig.jsonTransport && !smtpConfig.streamTransport)) {
    return { skipped: true, reason: 'No SMTP configuration provided' };
  }
  const transporter = nodemailer.createTransport(smtpConfig);
  const info = await transporter.sendMail({
    from: smtpConfig.from || 'securechain@localhost',
    to,
    subject: `[SecureChain] ${finding.priorityLabel || finding.type}: ${finding.cveId || finding.id || finding.packageName}`,
    text: `${finding.summary || finding.detail || ''}\n\nComponent: ${finding.component || finding.packageName}\nCVSS: ${finding.severity ?? 'N/A'}\nEPSS: ${finding.epss ?? 'N/A'}\nFix version(s): ${(finding.fixedVersions || []).join(', ') || 'N/A'}`,
  });
  return { sent: true, messageId: info.messageId };
}

/**
 * Routes a finding to the right channel(s) based on severity, per the
 * config stored on a repository's alert_channels. Mirrors report 3.2.5:
 * "All P0 findings (CVSS 9.0+) automatically generate Jira tickets... alerts
 * sent via Slack or PagerDuty [based on] on-call schedules and severity."
 */
async function dispatchAlert(channels, finding) {
  const results = {};
  const isP0 = finding.priorityLabel === 'P0_CRITICAL';

  const tasks = [];
  if (channels.slackWebhookUrl) {
    tasks.push(sendSlackAlert(channels.slackWebhookUrl, finding).then((r) => (results.slack = r)).catch((e) => (results.slack = { error: e.message })));
  }
  if (isP0 && channels.jira) {
    tasks.push(createJiraTicket(channels.jira, finding).then((r) => (results.jira = r)).catch((e) => (results.jira = { error: e.message })));
  }
  if (isP0 && channels.pagerDutyRoutingKey) {
    tasks.push(
      triggerPagerDutyAlert(channels.pagerDutyRoutingKey, finding, channels.pagerDutyEndpointOverride)
        .then((r) => (results.pagerduty = r))
        .catch((e) => (results.pagerduty = { error: e.message }))
    );
  }
  if (channels.email?.smtp && channels.email?.to) {
    tasks.push(
      sendEmailAlert(channels.email.smtp, channels.email.to, finding).then((r) => (results.email = r)).catch((e) => (results.email = { error: e.message }))
    );
  }
  await Promise.all(tasks);
  return results;
}

module.exports = { sendSlackAlert, createJiraTicket, triggerPagerDutyAlert, sendEmailAlert, dispatchAlert };
