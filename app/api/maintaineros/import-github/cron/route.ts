import { NextResponse } from 'next/server';
import { importGitHubIssues, validateImportInput } from '@/lib/maintaineros/github-import';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const input = validateImportInput({
      owner: process.env.GITHUB_IMPORT_OWNER,
      repo: process.env.GITHUB_IMPORT_REPO,
      limit: Number(process.env.GITHUB_IMPORT_LIMIT ?? 100),
    });
    const run = await importGitHubIssues(input);
    return NextResponse.json({
      ok: true,
      trigger: 'cron',
      repository: `${run.owner}/${run.repo}`,
      run,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown GitHub import cron error.';
    const status = message.includes('must be') ? 400 : 500;
    return NextResponse.json({ ok: false, trigger: 'cron', error: message }, { status });
  }
}
