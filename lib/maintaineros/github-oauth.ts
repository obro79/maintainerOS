import { randomBytes } from 'node:crypto';

export const GITHUB_OAUTH_STATE_COOKIE = 'maintaineros_github_oauth_state';

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUrl: string | null;
}

export interface GitHubOAuthUser {
  login: string;
  htmlUrl: string;
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig {
  return {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? '',
    redirectUrl: process.env.GITHUB_OAUTH_REDIRECT_URL || null,
  };
}

export function isGitHubOAuthConfigured(config = getGitHubOAuthConfig()) {
  return Boolean(config.clientId && config.clientSecret);
}

export function createGitHubOAuthState() {
  return randomBytes(24).toString('base64url');
}

export function buildGitHubOAuthUrl(config: GitHubOAuthConfig, state: string, requestUrl: string) {
  const callbackUrl = config.redirectUrl ?? new URL('/api/auth/github/callback', requestUrl).toString();
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'true');
  return url;
}

export async function exchangeGitHubOAuthCode(code: string, config: GitHubOAuthConfig, requestUrl: string) {
  const redirectUrl = config.redirectUrl ?? new URL('/api/auth/github/callback', requestUrl).toString();
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'MaintainerOS-Hackathon',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUrl,
    }),
  });

  const payload = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? `GitHub OAuth token exchange failed with ${response.status}.`);
  }
  return payload.access_token;
}

export async function fetchGitHubOAuthUser(accessToken: string): Promise<GitHubOAuthUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MaintainerOS-Hackathon',
    },
  });

  const payload = await response.json() as { login?: string; html_url?: string; message?: string };
  if (!response.ok || !payload.login) {
    throw new Error(payload.message ?? `GitHub user lookup failed with ${response.status}.`);
  }

  return {
    login: payload.login,
    htmlUrl: payload.html_url ?? `https://github.com/${payload.login}`,
  };
}

export function githubOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  };
}
