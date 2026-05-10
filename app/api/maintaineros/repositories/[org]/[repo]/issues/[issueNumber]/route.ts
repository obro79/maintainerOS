import { NextResponse } from 'next/server';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

interface Context {
  params: Promise<{ org: string; repo: string; issueNumber: string }>;
}

export async function GET(_request: Request, { params }: Context) {
  const { org, repo, issueNumber } = await params;
  const parsedIssueNumber = Number(issueNumber);

  if (!Number.isInteger(parsedIssueNumber) || parsedIssueNumber < 1) {
    return NextResponse.json(
      { ok: false, error: 'issueNumber must be a positive integer.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const repositoryId = `${org}/${repo}`;
  const issue = await getMaintainerOSRepository().getIssueDetail(repositoryId, parsedIssueNumber);

  if (!issue) {
    return NextResponse.json(
      { ok: false, repositoryId, error: 'Issue not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      repositoryId,
      refreshedAt: new Date().toISOString(),
      issue,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
