import { config } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Startup audit for settings that are fine on a laptop and dangerous on a
 * public host.
 *
 * Lives outside config/index.js because the logger reads its own level from
 * the config — importing it there would close an ESM cycle and trip the TDZ on
 * `export const config`.
 *
 * Warnings only. Refusing to boot would turn a misconfigured deploy into a
 * silent restart loop instead of a visible line in the logs.
 */
const PLACEHOLDER = /^replace-me/i;

export const auditConfig = () => {
  const findings = [];
  const warn = (issue, detail) => {
    findings.push(issue);
    logger.warn('config.insecure', { issue, detail });
  };

  if (config.trustProxy === true) {
    warn(
      'trust_proxy_wide_open',
      'TRUST_PROXY=true trusts a client-supplied X-Forwarded-For, so any caller can mint a fresh bucket per request — set it to the proxy hop count instead',
    );
  }
  if (config.corsOrigins.includes('*')) {
    warn('cors_any_origin', 'CORS_ORIGIN=* allows any site to call this API');
  }
  if (!config.auth.requireApiKey) {
    warn('metrics_api_open', 'REQUIRE_API_KEY=false leaves the metrics API unauthenticated');
  }
  if (!config.auth.adminToken || PLACEHOLDER.test(config.auth.adminToken)) {
    warn('admin_token_placeholder', 'ADMIN_TOKEN is unset or still a placeholder');
  }
  if (!config.auth.dashboardApiKey || PLACEHOLDER.test(config.auth.dashboardApiKey)) {
    warn('dashboard_key_placeholder', 'DASHBOARD_API_KEY is unset or still a placeholder');
  }
  if (config.env === 'production' && !config.redis.password && !config.redis.url.includes('@')) {
    warn('redis_no_auth', 'Redis has no password configured');
  }

  if (findings.length === 0) logger.info('config.audit_clean');
  return findings;
};

export default auditConfig;
