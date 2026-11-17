/**
 * Cloudflare Workers Script for Arch-System
 * Handles routing, rules, and various Cloudflare integrations
 */

addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // === Redirect Rules ===
  if (path === '/old-api' && request.method === 'GET') {
    return Response.redirect('https://arch-system.vercel.app/new-api', 301);
  }

  if (path === '/old-page' && request.method === 'GET') {
    return Response.redirect('https://arch-system.vercel.app/new-page', 301);
  }

  // === Onion Routing (Tor) ===
  if (url.hostname === 'onion.arch-system') {
    // Route Tor traffic through Cloudflare's onion service
    return new Response('Onion service endpoint', {
      headers: {
        'cf-onion': 'true',
        'access-control-allow-origin': '*',
      },
    });
  }

  // === IPv6 Support ===
  if (request.headers.get('cf-ipv6')) {
    // Add pseudo IPv4 header
    return new Response(request.body, {
      headers: {
        'cf-ipv4': request.headers.get('cf-ipv6').replace('::ffff:', ''),
      },
    });
  }

  // === gRPC Support ===
  if (url.pathname === '/grpc' && request.headers.get('accept-encoding').includes('gzip')) {
    return new Response('gRPC endpoint', {
      headers: {
        'content-type': 'application/grpc',
        'cf-allow-grpc': 'true',
      },
    });
  }

  // === WebSockets Support ===
  if (url.pathname === '/ws' && request.headers.get('upgrade') === 'websocket') {
    // WebSocket upgrade handled by Workers Durable Objects
    return new Response('WebSocket upgrade', {
      status: 101,
      headers: {
        upgrade: 'websocket',
        connection: 'upgrade',
        'cf-websocket': 'true',
      },
    });
  }

  // === Pseudo IPv4 ===
  if (url.pathname === '/ipv4' && request.headers.get('cf-visitor-country')) {
    return new Response('IPv4 mapping', {
      headers: {
        'cf-ipv4': request.headers.get('cf-ipv6')?.replace('::ffff:', '') || '127.0.0.1',
      },
    });
  }

  // === IP Geolocation ===
  if (url.pathname === '/geo') {
    const country = request.headers.get('cf-ipcountry') || 'US';
    return new Response(`{"country": "${country}"}`, {
      headers: {
        'content-type': 'application/json',
        'cf-ipcountry': country,
      },
    });
  }

  // === Maximum Upload Size ===
  if (url.pathname === '/upload' && request.method === 'POST') {
    const contentLength = request.headers.get('content-length');
    const maxSize = 10 * 1024 * 1024; // 10MB

    const parsedLength = contentLength ? Number.parseInt(contentLength, 10) : 0;
    if (Number.isFinite(parsedLength) && parsedLength > maxSize) {
      return new Response(JSON.stringify({ error: 'File too large', maxSize }), {
        status: 413,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Process the upload
    const data = await request.json();
    return new Response(JSON.stringify({ success: true, size: contentLength, data }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // === Default routing to Durable Object ===
  const coordinator = await getBindings().agentCoordinator;

  // Route based on path
  if (path === '/status') {
    return await coordinator.fetch(request);
  }

  // Default response
  return new Response(
    JSON.stringify({
      message: 'Arch-System Workers API',
      routes: ['/old-api', '/old-page', '/status', '/ws', '/geo', '/ipv4', '/upload'],
    }),
    { headers: { 'content-type': 'application/json' } }
  );
}

async function getBindings() {
  // Get bindings from the worker context
  // In production, these are provided by wrangler.toml
  return {
    agentCoordinator: await getAgentCoordinator(),
  };
}

async function getAgentCoordinator() {
  // Return the durable object coordinator
  // This is a placeholder - in production, use the actual binding
  return {
    fetch: async (request) => {
      return new Response(JSON.stringify({ status: 'ok' }));
    },
  };
}
