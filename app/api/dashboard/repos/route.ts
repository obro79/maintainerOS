import { NextResponse } from 'next/server';

const FALLBACK_REPOS = [
  { id: 'acme/frontend', label: 'acme/frontend' },
  { id: 'acme/api', label: 'acme/api' },
];

export async function GET() {
  return NextResponse.json(FALLBACK_REPOS);
}
