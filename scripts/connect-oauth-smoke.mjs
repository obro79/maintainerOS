import { readFileSync } from 'node:fs';

const files = {
  helper: readFileSync('lib/maintaineros/github-oauth.ts', 'utf8'),
  startRoute: readFileSync('app/api/auth/github/start/route.ts', 'utf8'),
  callbackRoute: readFileSync('app/api/auth/github/callback/route.ts', 'utf8'),
  connectPage: readFileSync('app/connect/page.tsx', 'utf8'),
  landing: readFileSync('components/blocks/hero-section-1.tsx', 'utf8'),
  docs: readFileSync('components/blocks/docs-page.tsx', 'utf8'),
  changelog: readFileSync('components/blocks/changelog-page.tsx', 'utf8'),
  envExample: readFileSync('.env.example', 'utf8'),
};

assertIncludes(files.helper, 'GITHUB_OAUTH_STATE_COOKIE', 'shared OAuth state cookie name exists');
assertIncludes(files.helper, 'randomBytes(24).toString', 'OAuth state uses cryptographic randomness');
assertIncludes(files.helper, "new URL('https://github.com/login/oauth/authorize')", 'OAuth start builds a GitHub authorization URL');
assertIncludes(files.helper, "url.searchParams.set('client_id'", 'OAuth authorization URL includes client id');
assertIncludes(files.helper, "url.searchParams.set('redirect_uri'", 'OAuth authorization URL includes redirect URI');
assertIncludes(files.helper, "url.searchParams.set('state'", 'OAuth authorization URL includes state');
assertNotIncludes(files.helper, "url.searchParams.set('scope'", 'OAuth authorization URL does not request a broad repo scope');
assertNotIncludes(files.helper, "'repo'", 'OAuth helper does not request the GitHub repo scope');
assertIncludes(files.helper, 'https://github.com/login/oauth/access_token', 'OAuth callback can exchange a code');
assertIncludes(files.helper, 'https://api.github.com/user', 'OAuth callback can fetch the authenticated user');
assertIncludes(files.helper, 'httpOnly: true', 'OAuth state cookie is HttpOnly');
assertIncludes(files.helper, "sameSite: 'lax'", 'OAuth state cookie is SameSite lax');

assertIncludes(files.startRoute, 'createGitHubOAuthState()', 'OAuth start route creates state');
assertIncludes(files.startRoute, 'buildGitHubOAuthUrl', 'OAuth start route redirects to GitHub authorization');
assertIncludes(files.startRoute, 'GITHUB_OAUTH_STATE_COOKIE', 'OAuth start route writes the state cookie');
assertIncludes(files.startRoute, 'githubOAuthCookieOptions()', 'OAuth start route uses shared cookie settings');
assertIncludes(files.startRoute, 'oauth-unconfigured', 'OAuth start route handles missing credentials');

assertIncludes(files.callbackRoute, 'state !== expectedState', 'OAuth callback rejects mismatched state');
assertIncludes(files.callbackRoute, 'state-mismatch', 'OAuth callback reports missing or mismatched state');
assertIncludes(files.callbackRoute, 'exchangeGitHubOAuthCode', 'OAuth callback exchanges the authorization code');
assertIncludes(files.callbackRoute, 'fetchGitHubOAuthUser', 'OAuth callback fetches the GitHub user');
assertIncludes(files.callbackRoute, "redirect.searchParams.set('github', 'connected')", 'OAuth callback redirects back to the connect flow');
assertIncludes(files.callbackRoute, "searchParams.set('owner', user.login)", 'OAuth callback pre-fills the GitHub owner');
assertIncludes(files.callbackRoute, 'clearStateCookie', 'OAuth callback clears the one-time state cookie');

assertIncludes(files.connectPage, 'href="/api/auth/github/start"', 'Connect page starts GitHub OAuth');
assertIncludes(files.connectPage, 'OWNER_REPO_PATTERN', 'Connect page validates owner and repo');
assertIncludes(files.connectPage, "fetch('/api/maintaineros/import-github'", 'Connect page calls the import endpoint');
assertIncludes(files.connectPage, 'body: JSON.stringify({ owner: nextOwner, repo: nextRepo, limit })', 'Connect page sends owner, repo, and limit');
assertIncludes(files.connectPage, 'router.push(`/${encodeURIComponent(nextOwner)}/${encodeURIComponent(nextRepo)}`)', 'Connect page redirects to the imported repository');
assertIncludes(files.connectPage, 'OAuth uses public GitHub access only', 'Connect page explains public-only OAuth');

assertNotIncludes(files.landing, 'href="#connect"', 'Landing page no longer points Connect repo CTAs at an anchor');
assertIncludes(files.landing, 'href="/connect"', 'Landing page points Connect repo CTAs at /connect');
assertIncludes(files.docs, 'This flow does not request private-repo scopes or write access.', 'Docs describe the public-only OAuth flow');
assertNotIncludes(files.docs, 'read:issues', 'Docs do not claim deprecated read:issues scope usage');
assertNotIncludes(files.docs, 'read:org', 'Docs do not claim deprecated read:org scope usage');
assertIncludes(files.changelog, 'public-only connect flow', 'Changelog describes public-only OAuth');

assertIncludes(files.envExample, 'GITHUB_OAUTH_CLIENT_ID=', '.env.example documents GitHub OAuth client id');
assertIncludes(files.envExample, 'GITHUB_OAUTH_CLIENT_SECRET=', '.env.example documents GitHub OAuth client secret');
assertIncludes(files.envExample, 'GITHUB_OAUTH_REDIRECT_URL=', '.env.example documents GitHub OAuth redirect URL');
assertIncludes(files.envExample, 'GITHUB_TOKEN=', '.env.example keeps optional server-side GitHub token support');

console.log('Connect repo OAuth smoke check passed.');

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Connect OAuth smoke failed: ${label}`);
  }
}

function assertNotIncludes(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Connect OAuth smoke failed: ${label}`);
  }
}
