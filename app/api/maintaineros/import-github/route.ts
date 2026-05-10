import { NextResponse } from 'next/server';
import { importGitHubIssues, validateImportInput } from '@/lib/maintaineros/github-import';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = validateImportInput(body);
    const run = await importGitHubIssues(input);
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown import error.';
    const status = message.includes('GITHUB_TOKEN') ? 401 : message.includes('must be') ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
