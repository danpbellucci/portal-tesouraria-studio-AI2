import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    plugins: [
      {
        name: "local-api-backend",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url || !req.url.startsWith("/api/")) {
              return next();
            }

            try {
              const { localFetch } = await import("./src/portal/backend/app");
              const host = req.headers.host || "localhost:3000";
              const fullUrl = new URL(req.url, `http://${host}`);

              const headers: Record<string, string> = {};
              for (const [k, v] of Object.entries(req.headers)) {
                if (typeof v === "string") headers[k] = v;
                else if (Array.isArray(v)) headers[k] = v.join(", ");
              }

              let body: any = undefined;
              if (req.method !== "GET" && req.method !== "HEAD") {
                const chunks: Buffer[] = [];
                for await (const chunk of req) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const rawBuffer = Buffer.concat(chunks);
                const contentType = req.headers["content-type"] || "";
                if (contentType.includes("multipart/form-data")) {
                  try {
                    const dummyReq = new Request("http://localhost", {
                      method: req.method,
                      headers,
                      body: rawBuffer,
                      // @ts-ignore
                      duplex: "half",
                    });
                    body = await dummyReq.formData();
                  } catch {
                    body = rawBuffer;
                  }
                } else {
                  body = rawBuffer.toString("utf-8");
                }
              }

              const response = await localFetch(fullUrl.pathname + fullUrl.search, {
                method: req.method,
                headers,
                body,
              });

              res.statusCode = response.status;
              response.headers.forEach((val, key) => {
                res.setHeader(key, val);
              });

              const responseBuffer = Buffer.from(await response.arrayBuffer());
              res.end(responseBuffer);
            } catch (err: any) {
              console.error("[Local API Error]", err);
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ error: err?.message || "Erro no servidor local" }));
            }
          });
        },
      },
    ],
  },
});
