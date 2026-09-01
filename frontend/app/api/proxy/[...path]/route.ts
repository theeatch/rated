import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy to the RateFlow backend.
 *
 * Exists so dashboard credentials (DASHBOARD_API_KEY, ADMIN_TOKEN) stay on the
 * server: the browser calls /api/proxy/<path> with no secrets and this handler
 * attaches them. Traffic-generator requests deliberately bypass it — see
 * lib/api.ts `probe`.
 */

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOW_ADMIN_PROXY = process.env.ALLOW_ADMIN_PROXY !== 'false';

export const dynamic = 'force-dynamic';

const forward = async (request: NextRequest, path: string[]) => {
  const mutating = request.method !== 'GET' && request.method !== 'HEAD';

  if (mutating && !ALLOW_ADMIN_PROXY) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Admin proxying is disabled (ALLOW_ADMIN_PROXY=false)' } },
      { status: 403 },
    );
  }

  const search = request.nextUrl.search;
  const target = `${BACKEND_URL}/api/${path.join('/')}${search}`;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (DASHBOARD_API_KEY) headers['x-api-key'] = DASHBOARD_API_KEY;
  if (mutating && ADMIN_TOKEN) headers.authorization = `Bearer ${ADMIN_TOKEN}`;

  const body = mutating ? await request.text() : undefined;
  if (body) headers['content-type'] = 'application/json';

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: body || undefined,
      cache: 'no-store',
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'upstream_unreachable',
          message: `Cannot reach the RateFlow API at ${BACKEND_URL}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        },
      },
      { status: 502 },
    );
  }
};

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function POST(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return forward(request, (await params).path);
}
