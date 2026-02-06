export interface Env {
  TUNNEL_KV: KVNamespace;
  UPDATER_TOKEN: string;
}

const ACTIVE_TUNNEL_KEY = "active_tunnel";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isValidTryCloudflareUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_health") {
      const active = await env.TUNNEL_KV.get(ACTIVE_TUNNEL_KEY);
      return json({ ok: true, activeTunnel: active ?? null });
    }

    if (url.pathname === "/_update" && request.method === "POST") {
      const auth = request.headers.get("authorization") ?? "";
      if (auth !== `Bearer ${env.UPDATER_TOKEN}`) {
        return json({ error: "unauthorized" }, 401);
      }

      let body: { tunnelUrl?: string };
      try {
        body = (await request.json()) as { tunnelUrl?: string };
      } catch {
        return json({ error: "invalid_json" }, 400);
      }

      const tunnelUrl = (body.tunnelUrl ?? "").trim();
      if (!isValidTryCloudflareUrl(tunnelUrl)) {
        return json({ error: "invalid_tunnel_url" }, 400);
      }

      await env.TUNNEL_KV.put(ACTIVE_TUNNEL_KEY, tunnelUrl);
      return json({ ok: true, tunnelUrl });
    }

    const activeTunnel = await env.TUNNEL_KV.get(ACTIVE_TUNNEL_KEY);
    if (!activeTunnel) {
      return json({ error: "no_active_tunnel" }, 503);
    }

    const target = new URL(url.pathname + url.search, activeTunnel);
    const headers = new Headers(request.headers);
    headers.set("host", target.host);

    const proxied = new Request(target.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    return fetch(proxied);
  },
};
