import { NextResponse } from 'next/server';
import { getProviderRuntimeConfig } from '@/lib/maintaineros/provider-runtime';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    runtime: getProviderRuntimeConfig(),
  });
}
