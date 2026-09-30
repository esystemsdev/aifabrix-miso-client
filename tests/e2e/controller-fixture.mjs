import { createServer } from "node:http";
import { once } from "node:events";

export const credentials = {
  id: "e2e-client-id",
  secret: "e2e-client-secret",
  key: "e2e-encryption-key",
};
export async function controllerFixture() {
  const requests = [];
  let handler;
  let token = 0;
  const values = new Map();
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    const request = {
      path: req.url,
      method: req.method,
      headers: req.headers,
      body,
    };
    requests.push(request);
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(typeof data === "string" ? data : JSON.stringify(data));
    };
    try {
      if (req.url === "/api/v1/auth/token") {
        if (
          req.headers["x-client-id"] !== credentials.id ||
          req.headers["x-client-secret"] !== credentials.secret
        )
          return send(401, { code: "bad_credentials" });
        return send(201, {
          success: true,
          data: {
            token: `issued-token-${++token}`,
            expiresIn: 300,
            expiresAt: new Date(Date.now() + 300000).toISOString(),
          },
        });
      }
      if (req.url === "/api/v1/auth/bootstrap")
        return send(200, {
          success: true,
          data: {
            protocolVersion: 1,
            issuedAt: new Date().toISOString(),
            context: {
              installationId: "installation",
              applicationId: "application",
              environmentId: "environment",
            },
            clientId: credentials.id,
            clientToken: req.headers["x-client-token"],
            clientTokenExpiresAt: new Date(Date.now() + 300000).toISOString(),
            configuration: { ENCRYPTION_KEY: credentials.key },
            refreshAfter: new Date(Date.now() + 120000).toISOString(),
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        });
      if (req.url.includes("/logs")) return send(200, { success: true });
      if (handler && (await handler(request, send, req))) return;
      if (!req.headers["x-client-token"])
        return send(401, { code: "missing_token" });
      if (req.url.startsWith("/api/security/parameters/")) {
        if (body.encryptionKey !== credentials.key)
          return send(422, {
            type: "/Errors/InvalidKey",
            title: "Invalid key",
            status: 422,
            code: "INVALID_ENCRYPTION_KEY",
            detail: `Rejected ${body.encryptionKey}`,
            correlationId: "encryption-correlation",
          });
        if (req.url.endsWith("/encrypt")) {
          const value = `enc://fixture-${values.size}`;
          values.set(value, body.plaintext);
          return send(200, { value, storage: "local" });
        }
        return send(200, { plaintext: values.get(body.value) });
      }
      return send(200, { success: true });
    } catch {
      send(500, { code: "fixture_failure" });
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    handle(fn) {
      handler = fn;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
