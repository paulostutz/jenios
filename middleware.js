import { NextResponse } from 'next/server';
import { stagingRouteDecision } from './lib/staging/route-policy.mjs';

/** No financial, private, or production-backed routes in this preview. */
export function middleware(request) {
  const {pathname} = request.nextUrl;
  const verdict = stagingRouteDecision(pathname, request.method);
  if (verdict === 'redirect') {
    const response = NextResponse.redirect(new URL('/s04-laboratorio', request.url), 307);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
  if (verdict === 'block') {
    return new NextResponse('Rota indisponível neste ambiente isolado de homologação.', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy':'no-referrer',
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {matcher: ['/:path*']};
