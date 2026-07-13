import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const apiHandlers: Record<string, string> = {
  "/api/popbill/issue": "./api/popbill/issue.js",
  "/api/popbill/detail": "./api/popbill/detail.js",
  "/api/popbill/status": "./api/popbill/status.js",
  "/api/popbill/webhook": "./api/popbill/webhook.js"
};

// Dev-only bridge: adapt Node req/res to the Vercel-style (request, response) handlers in api/.
function apiRoutes(): Plugin {
  return {
    name: "api-routes",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || "";
        if (!rawUrl.startsWith("/api/")) {
          next();
          return;
        }

        const pathname = rawUrl.split("?")[0];
        const modulePath = apiHandlers[pathname];

        const resLike = {
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          json(obj: unknown) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(obj));
          }
        };

        if (!modulePath) {
          resLike.status(404).json({ ok: false, message: "Not found" });
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
          let parsedBody: unknown = undefined;
          const raw = Buffer.concat(chunks).toString("utf-8");
          if (raw) {
            try {
              parsedBody = JSON.parse(raw);
            } catch {
              parsedBody = raw;
            }
          }

          const reqLike = {
            method: req.method,
            body: parsedBody,
            headers: req.headers,
            query: Object.fromEntries(new URL(rawUrl, "http://localhost").searchParams.entries())
          };

          server
            .ssrLoadModule(modulePath)
            .then((mod) => (mod.default as (r: unknown, s: unknown) => unknown)(reqLike, resLike))
            .catch((error: unknown) => {
              resLike.status(500).json({
                ok: false,
                message: error instanceof Error ? error.message : String(error)
              });
            });
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // Load .env values into process.env so dev-only api/ handlers can read keys.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), apiRoutes()]
  };
});
