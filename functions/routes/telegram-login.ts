import { Hono } from "hono";
import { EncryptJWT, jwtDecrypt } from "jose";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../types/hono";
import { authMiddleware } from "../middleware/auth";
import { fail, ok } from "@utils/response";
import { signJWT } from "@utils/auth";
import {
  clearStoredTelegramOAuthConfig,
  extractBotIdFromToken,
  parseAllowedUserIds,
  readStoredTelegramOAuthConfig,
  resolveTelegramOAuthConfig,
  verifyTelegramIdToken,
  writeStoredTelegramOAuthConfig,
} from "@utils/telegram-oidc";

export const telegramLoginRoutes = new Hono<{ Bindings: Env }>();
const OAUTH_COOKIE = "__Host-oh_tg_oauth";
const OAUTH_TTL = 600;
const STATE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function oauthKey(secret: string) {
  return new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`otterhub:telegram-oauth:v1:${secret}`)
    )
  );
}

telegramLoginRoutes.use("/telegram/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  await next();
});

telegramLoginRoutes.use("/telegram/config", authMiddleware);

/**
 * Public lightweight readiness check for the login page (exposes zero secrets or IDs).
 */
telegramLoginRoutes.get("/telegram/status", async (c) => {
  const cfg = await resolveTelegramOAuthConfig(c.env, c.req.url);
  return ok(c, {
    enabled: cfg.enabled,
    configured: cfg.configured,
  });
});

/**
 * Authenticated admin endpoint: inspect current Telegram Web OAuth status & defaults.
 */
telegramLoginRoutes.get("/telegram/config", async (c) => {
  const cfg = await resolveTelegramOAuthConfig(c.env, c.req.url);
  const rawChatId = Number((c.env.TG_CHAT_ID || "").trim());
  const chatIdIsChannel = Number.isFinite(rawChatId) && rawChatId < 0;

  return ok(c, {
    enabled: cfg.enabled,
    configured: cfg.configured,
    source: cfg.source,
    hasKvOverride: cfg.hasKvOverride,
    clientId: cfg.clientId,
    clientIdSource: cfg.clientIdSource,
    hasClientSecret: Boolean(cfg.clientSecret),
    secretSource: cfg.secretSource,
    allowedUserIds: cfg.allowedUserIdsRaw,
    allowedUserSource: cfg.allowedUserSource,
    redirectUri: cfg.redirectUri,
    redirectSource: cfg.redirectSource,
    origin: cfg.origin,
    defaultCallbackUri: new URL(
      "/auth/telegram/callback",
      cfg.origin
    ).toString(),
    envHints: {
      botTokenClientId: extractBotIdFromToken(c.env.TG_BOT_TOKEN),
      hasEnvSecret: Boolean((c.env.TG_OIDC_SECRET || "").trim()),
      chatIdIsChannel,
    },
  });
});

/**
 * Authenticated admin endpoint: save encrypted Telegram Web OAuth config in KV.
 */
telegramLoginRoutes.post("/telegram/config", async (c) => {
  if (!c.env.JWT_SECRET) {
    return fail(c, "JWT_SECRET 未配置，无法加密保存 OAuth 凭据", 500);
  }

  const body = await c.req
    .json<{
      enabled?: boolean;
      clientId?: string;
      clientSecret?: string;
      clearSecret?: boolean;
      allowedUserIds?: string;
      redirectUri?: string;
    }>()
    .catch(() => null);

  if (!body || typeof body !== "object") {
    return fail(c, "请求格式无效", 400);
  }

  const existing = await readStoredTelegramOAuthConfig(c.env);
  const clientId =
    body.clientId !== undefined
      ? body.clientId.trim()
      : existing?.clientId || "";

  if (clientId && !/^\d{5,20}$/.test(clientId)) {
    return fail(c, "Client ID 必须为纯数字 Bot ID（例如 123456789）", 400);
  }

  const allowedRaw =
    body.allowedUserIds !== undefined
      ? body.allowedUserIds.trim()
      : existing?.allowedUserIds || "";

  if (allowedRaw && parseAllowedUserIds(allowedRaw).length === 0) {
    return fail(
      c,
      "允许登录的 Telegram 用户 ID 必须为正整数（多个 ID 用逗号分隔，不可填负数频道 ID）",
      400
    );
  }

  const redirectUri =
    body.redirectUri !== undefined
      ? body.redirectUri.trim()
      : existing?.redirectUri || "";

  if (redirectUri) {
    try {
      const u = new URL(redirectUri);
      if (u.protocol !== "https:" && u.hostname !== "localhost") {
        return fail(c, "Redirect URI 必须使用 HTTPS 协议", 400);
      }
    } catch {
      return fail(c, "Redirect URI 不是有效的 URL", 400);
    }
  }

  let clientSecret = existing?.clientSecret || "";
  if (body.clearSecret) {
    clientSecret = "";
  } else if (
    typeof body.clientSecret === "string" &&
    body.clientSecret.trim().length > 0
  ) {
    clientSecret = body.clientSecret.trim();
  }

  await writeStoredTelegramOAuthConfig(c.env, {
    enabled:
      typeof body.enabled === "boolean"
        ? body.enabled
        : existing?.enabled ?? true,
    clientId,
    clientSecret,
    allowedUserIds: allowedRaw,
    redirectUri,
  });

  const resolved = await resolveTelegramOAuthConfig(c.env, c.req.url);
  return ok(
    c,
    {
      enabled: resolved.enabled,
      configured: resolved.configured,
      source: resolved.source,
      hasKvOverride: resolved.hasKvOverride,
      clientId: resolved.clientId,
      clientIdSource: resolved.clientIdSource,
      hasClientSecret: Boolean(resolved.clientSecret),
      secretSource: resolved.secretSource,
      allowedUserIds: resolved.allowedUserIdsRaw,
      allowedUserSource: resolved.allowedUserSource,
      redirectUri: resolved.redirectUri,
      redirectSource: resolved.redirectSource,
      origin: resolved.origin,
    },
    "Telegram Web OAuth 配置已保存"
  );
});

/**
 * Authenticated admin endpoint: remove KV override and restore env defaults.
 */
telegramLoginRoutes.delete("/telegram/config", async (c) => {
  await clearStoredTelegramOAuthConfig(c.env);
  const resolved = await resolveTelegramOAuthConfig(c.env, c.req.url);
  return ok(
    c,
    {
      enabled: resolved.enabled,
      configured: resolved.configured,
      source: resolved.source,
      hasKvOverride: resolved.hasKvOverride,
      clientId: resolved.clientId,
      clientIdSource: resolved.clientIdSource,
      hasClientSecret: Boolean(resolved.clientSecret),
      secretSource: resolved.secretSource,
      allowedUserIds: resolved.allowedUserIdsRaw,
      allowedUserSource: resolved.allowedUserSource,
      redirectUri: resolved.redirectUri,
      redirectSource: resolved.redirectSource,
      origin: resolved.origin,
    },
    "已清除在线覆盖配置，恢复使用环境变量"
  );
});

telegramLoginRoutes.get("/telegram/start", async (c) => {
  const cfg = await resolveTelegramOAuthConfig(c.env, c.req.url);
  if (!cfg.configured) {
    const accept = c.req.header("Accept") || "";
    if (accept.includes("text/html")) {
      const loginUrl = new URL("/login", cfg.origin);
      loginUrl.searchParams.set(
        "tg_error",
        !cfg.enabled ? "disabled" : "not_configured"
      );
      return c.redirect(loginUrl.toString(), 302);
    }
    return fail(c, "Telegram login is not configured", 503);
  }

  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(verifier)
      )
    )
  );
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));

  // Stateless encrypted cookie: zero KV writes on login
  const transaction = await new EncryptJWT({ state, verifier, nonce })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer("otterhub:telegram-oauth")
    .setAudience(cfg.clientId)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL}s`)
    .encrypt(await oauthKey(c.env.JWT_SECRET));

  setCookie(c, OAUTH_COOKIE, transaction, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: OAUTH_TTL,
  });

  const url = new URL("https://oauth.telegram.org/auth");
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return c.redirect(url.toString(), 302);
});

telegramLoginRoutes.get("/telegram/callback", async (c) => {
  const code = c.req.query("code") || "";
  const state = c.req.query("state") || "";
  const cfg = await resolveTelegramOAuthConfig(c.env, c.req.url);
  if (!cfg.configured) {
    return fail(c, "Telegram login is not configured", 503);
  }
  if (!STATE_PATTERN.test(state)) return fail(c, "Invalid login state", 400);

  const transaction = getCookie(c, OAUTH_COOKIE);
  if (!transaction) return fail(c, "Login expired; start again", 401);

  let verifier: string;
  let nonce: string;
  try {
    const { payload } = await jwtDecrypt(
      transaction,
      await oauthKey(c.env.JWT_SECRET),
      {
        issuer: "otterhub:telegram-oauth",
        audience: cfg.clientId,
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
        maxTokenAge: `${OAUTH_TTL}s`,
        requiredClaims: ["exp", "iat"],
      }
    );
    if (
      payload.state !== state ||
      typeof payload.verifier !== "string" ||
      !VERIFIER_PATTERN.test(payload.verifier) ||
      typeof payload.nonce !== "string" ||
      !STATE_PATTERN.test(payload.nonce)
    ) {
      return fail(c, "Invalid login state", 401);
    }
    verifier = payload.verifier;
    nonce = payload.nonce;
  } catch {
    return fail(c, "Login expired or invalid; start again", 401);
  }

  deleteCookie(c, OAUTH_COOKIE, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });

  if (c.req.query("error")) {
    const accept = c.req.header("Accept") || "";
    if (accept.includes("text/html")) {
      return c.redirect(
        new URL("/login?tg_error=cancelled", cfg.origin).toString(),
        302
      );
    }
    return fail(c, "Telegram login was cancelled", 401);
  }
  if (!code || code.length > 4096)
    return fail(c, "Missing or invalid code", 400);

  let tokenJson: { id_token?: string };
  try {
    const tokenRes = await fetch("https://oauth.telegram.org/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: cfg.redirectUri,
        client_id: cfg.clientId,
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      id_token?: string;
    };
    if (!tokenRes.ok || !tokenJson.id_token)
      return fail(c, "Telegram token exchange failed; start again", 401);
  } catch {
    return fail(c, "Telegram is temporarily unavailable; start again", 502);
  }

  let payload;
  try {
    payload = await verifyTelegramIdToken(tokenJson.id_token!, cfg.clientId);
    if (payload.nonce !== nonce) return fail(c, "Invalid Telegram nonce", 401);
  } catch {
    return fail(c, "Invalid Telegram token", 401);
  }

  const tgId = Number(payload.id ?? payload.sub);
  if (
    !Number.isSafeInteger(tgId) ||
    tgId <= 0 ||
    !cfg.allowedUserIds.includes(tgId)
  ) {
    return fail(c, "Unauthorized Telegram account", 401);
  }

  const token = await signJWT(c.env.JWT_SECRET);
  setCookie(c, "auth", token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 86400,
  });
  return c.redirect("/", 302);
});
