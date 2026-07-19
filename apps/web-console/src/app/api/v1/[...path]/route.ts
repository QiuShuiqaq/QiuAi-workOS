import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const proxyBaseUrl = process.env.SERVER_INTERNAL_BASE_URL ?? process.env.SERVER_API_BASE_URL ?? 'http://127.0.0.1:4000';

async function proxy(request: NextRequest, pathParts: string[]) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
      }
    });
  }

  const targetUrl = new URL(proxyBaseUrl);
  targetUrl.pathname = `/api/v1/${pathParts.join('/')}`;
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const init: RequestInit = {
    method: request.method,
    headers
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = Buffer.from(body);
    }
  }

  const response = await fetch(targetUrl, init);
  const body = await response.text();
  const setCookie = response.headers.get('set-cookie');

  const responseHeaders: Record<string, string> = {
    'content-type': response.headers.get('content-type') ?? 'application/json'
  };

  if (setCookie) {
    responseHeaders['set-cookie'] = setCookie;
  }

  return new Response(body, {
    status: response.status,
    headers: responseHeaders
  });
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}
