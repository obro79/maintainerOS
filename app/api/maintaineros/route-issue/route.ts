import { NextResponse } from 'next/server';
import { generateClodRoutingArtifact } from '@/lib/maintaineros/clod';
import { persistClodArtifact } from '@/lib/maintaineros/clod-artifacts';
import { getMaintainerOSRepository } from '@/lib/maintaineros/repository';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const repositoryId = typeof body.repositoryId === 'string' && body.repositoryId.trim() ? body.repositoryId.trim() : 'maintaineros-demo-large';
  const issueNumber = Number(body.issueNumber || 41);

  if (!Number.isInteger(issueNumber) || issueNumber < 1) {
    return NextResponse.json({ ok: false, error: 'issueNumber must be a positive integer.' }, { status: 400 });
  }

  const repository = getMaintainerOSRepository();
  const issue = await repository.getIssueDetail(repositoryId, issueNumber);

  if (!issue) {
    return NextResponse.json({ ok: false, error: 'Issue not found.' }, { status: 404 });
  }

  const result = await generateClodRoutingArtifact(issue);
  if (result.blocked) {
    return NextResponse.json({
      ok: false,
      providerOk: false,
      blocked: true,
      sourceState: result.modelRun.sourceState,
      error: result.error,
      fallbackReason: result.fallbackReason ?? null,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        route: issue.route,
      },
      modelRun: result.modelRun,
    }, { status: 424 });
  }

  const stored = persistClodArtifact(repositoryId, issue, result);
  const { ok: providerOk, ...artifactResult } = result;
  return NextResponse.json({
    ok: true,
    providerOk,
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      route: issue.route,
    },
    sourceState: result.modelRun.sourceState,
    fallbackReason: result.fallbackReason ?? null,
    stored: {
      repositoryId: stored.repositoryId,
      issueNumber: stored.issueNumber,
      createdAt: stored.createdAt,
    },
    ...artifactResult,
  });
}
