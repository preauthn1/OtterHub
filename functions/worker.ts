import { app } from "./app";
import type { Env } from "./types/hono";

export default {
  async fetch(request: Request, env: Env, ctx: any) {
    return app.fetch(request, env, ctx);
  },
};
