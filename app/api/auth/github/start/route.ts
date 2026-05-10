import { NextResponse } from 'next/server';
import {
  GITHUB_OAUTH_STATE_COOKIE,
  buildGitHubOAuthUrl,
  createGitHubOAuthState,
  getGitHubOAuthConfig,
  githubOAuthCookieOptions,
  isGitHubOAuthConfigured,
} from '@/lib/maintaineros/github-oauth';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const config = getGitHubOAuthConfig();
  if (!isGitHubOAuthConfigured(config)) {
    return NextResponse.redirect(new URL('/connect?github=oauth-unconfigured', request.url));
  }

  const state = createGitHubOAuthState();
  const response = NextResponse.redirect(buildGitHubOAuthUrl(config, state, request.url));
  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, state, githubOAuthCookieOptions());
  return response;
}
