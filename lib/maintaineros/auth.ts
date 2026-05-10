export interface AuthConfig {
  enabled: boolean;
  provider: 'neon' | 'dev-bypass' | 'disabled';
  bypassDev: boolean;
  neonAuthEnabled: boolean;
  authenticatedDatabaseConfigured: boolean;
  projectIdConfigured: boolean;
  publishableKeyConfigured: boolean;
  serverKeyConfigured: boolean;
}

export function getAuthConfig(): AuthConfig {
  const bypassDev = process.env.AUTH_BYPASS_DEV === 'true';
  const neonAuthEnabled = process.env.NEON_AUTH_ENABLED === 'true' || process.env.AUTH_ENABLED === 'true';
  const authenticatedDatabaseConfigured = Boolean(process.env.DATABASE_AUTHENTICATED_URL);
  const projectIdConfigured = Boolean(process.env.NEXT_PUBLIC_STACK_PROJECT_ID);
  const publishableKeyConfigured = Boolean(process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY);
  const serverKeyConfigured = Boolean(process.env.STACK_SECRET_SERVER_KEY);
  const enabled = !bypassDev && neonAuthEnabled && authenticatedDatabaseConfigured;
  return {
    enabled,
    provider: bypassDev ? 'dev-bypass' : enabled ? 'neon' : 'disabled',
    bypassDev,
    neonAuthEnabled,
    authenticatedDatabaseConfigured,
    projectIdConfigured,
    publishableKeyConfigured,
    serverKeyConfigured,
  };
}
