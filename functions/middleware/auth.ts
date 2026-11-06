import { decodeJwt, jwtVerify, SignJWT } from "jose";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../types/hono";
import { fail } from "@utils/response";

const PUBLIC_PATHS = [
  /^\/$/,
  /^\/auth\/login/,
  /^\/auth\/telegram\/(start|callback|status)/,
  /^\/_next\//,
  /\.(ico|png|svg|jpg|jpeg|css|js|webmanifest|json|woff|woff2|ttf|eot)$/,
];

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const url = new URL(c.req.url);
    if (PUBLIC_PATHS.some((regex) => regex.test(url.pathname))) {
      return next();
    }

    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (c.env.API_TOKEN && token === c.env.API_TOKEN) {
        return next();
      }
    }

    const token = getCookie(c, "auth");
    if (!token) {
      return fail(c, "Unauthorized", 401);
    }

    if (!c.env.JWT_SECRET) {
      return fail(c, "Server misconfigured: JWT_SECRET is required", 500);
    }

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      await jwtVerify(token, secret);
      return next();
    } catch {
      return fail(c, "Invalid or expired token", 401);
    }
  }
);
