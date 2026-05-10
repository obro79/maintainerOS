import { NextResponse } from 'next/server';
import {
  GITHUB_OAUTH_STATE_COOKIE,
  exchangeGitHubOAuthCode,
  fetchGitHubOAuthUser,
  getGitHubOAuthConfig,
  githubOAuthCookieOptions,
  isGitHubOAuthConfigured,
} from '@/lib/maintaineros/github-oauth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = readCookie(request.headers.get('cookie') ?? '', GITHUB_OAUTH_STATE_COOKIE);
  const redirect = new URL('/connect', request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    redirect.searchParams.set('github', 'state-mismatch');
    return clearStateCookie(NextResponse.redirect(redirect));
  }

  const config = getGitHubOAuthConfig();
  if (!isGitHubOAuthConfigured(config)) {
    redirect.searchParams.set('github', 'oauth-unconfigured');
    return clearStateCookie(NextResponse.redirect(redirect));
  }

  try {
    const accessToken = await exchangeGitHubOAuthCode(code, config, request.url);
    const user = await fetchGitHubOAuthUser(accessToken);
    redirect.searchParams.set('github', 'connected');
    redirect.searchParams.set('owner', user.login);
    return clearStateCookie(NextResponse.redirect(redirect));
  } catch (error) {
    redirect.searchParams.set('github', 'failed');
    if (error instanceof Error) redirect.searchParams.set('reason', error.message);
    return clearStateCookie(NextResponse.redirect(redirect));
  }
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, '', {
    ...githubOAuthCookieOptions(),
    maxAge: 0,
  });
  return response;
}

function readCookie(cookieHeader: string, name: string) {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}
