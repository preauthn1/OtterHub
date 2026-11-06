import { createRemoteJWKSet, EncryptJWT, jwtDecrypt, jwtVerify } from "jose";
import { CF } from "../types";
import type { Env } from "../types/hono";

const JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);

export const TG_ISSUER = "https://oauth.telegram.org";

export interface StoredTelegramOAuthConfig {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  allowedUserIds?: string;
  redirectUri?: string;
  updatedAt?: number;
}

export interface ResolvedTelegramOAuthConfig {
  enabled: boolean;
  configured: boolean;
  source: "kv" | "env" | "mixed" | "unconfigured";
  clientId: string;
  clientIdSource: "kv" | "env" | "bot_token" | "none";
  clientSecret: string;
  secretSource: "kv" | "env" | "none";
  allowedUserIds: number[];
  allowedUserIdsRaw: string;
  allowedUserSource: "kv" | "env" | "chat_id" | "none";
  redirectUri: string;
  redirectSource: "kv" | "env" | "origin";
  origin: string;
  hasKvOverride: boolean;
}

async function configEncryptionKey(jwtSecret: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`otterhub:tg-oauth-config:v1:${jwtSecret}`)
    )
  );
}

export async function readStoredTelegramOAuthConfig(
  env: Env
): Promise<StoredTelegramOAuthConfig | null> {
  if (!env.oh_file_url || !env.JWT_SECRET) return null;
  try {
    const raw = await env.oh_file_url.get(CF.TG_OAUTH_CONFIG_KEY, {
      type: "text",
      cacheTtl: 60,
    });
    if (!raw || typeof raw !== "string") return null;
    const { payload } = await jwtDecrypt(
      raw,
      await configEncryptionKey(env.JWT_SECRET),
      {
        issuer: "otterhub:tg-oauth-config",
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      }
    );
    return {
      enabled:
        typeof payload.enabled === "boolean" ? payload.enabled : undefined,
      clientId:
        typeof payload.clientId === "string" ? payload.clientId.trim() : "",
      clientSecret:
        typeof payload.clientSecret === "string"
          ? payload.clientSecret.trim()
          : "",
      allowedUserIds:
        typeof payload.allowedUserIds === "string"
          ? payload.allowedUserIds.trim()
          : "",
      redirectUri:
        typeof payload.redirectUri === "string"
          ? payload.redirectUri.trim()
          : "",
      updatedAt:
        typeof payload.updatedAt === "number" ? payload.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export async function writeStoredTelegramOAuthConfig(
  env: Env,
  config: StoredTelegramOAuthConfig
): Promise<void> {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required to encrypt OAuth configuration");
  }
  const jwe = await new EncryptJWT({
    enabled: config.enabled !== false,
    clientId: (config.clientId || "").trim(),
    clientSecret: (config.clientSecret || "").trim(),
    allowedUserIds: (config.allowedUserIds || "").trim(),
    redirectUri: (config.redirectUri || "").trim(),
    updatedAt: Date.now(),
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer("otterhub:tg-oauth-config")
    .setIssuedAt()
    .encrypt(await configEncryptionKey(env.JWT_SECRET));

  await env.oh_file_url.put(CF.TG_OAUTH_CONFIG_KEY, jwe);
}

export async function clearStoredTelegramOAuthConfig(env: Env): Promise<void> {
  await env.oh_file_url.delete(CF.TG_OAUTH_CONFIG_KEY);
}

export function extractBotIdFromToken(botToken?: string): string {
  if (!botToken) return "";
  const prefix = botToken.trim().split(":")[0] || "";
  return /^\d{5,20}$/.test(prefix) ? prefix : "";
}

export function parseAllowedUserIds(raw?: string): number[] {
  if (!raw) return [];
  const ids = raw
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  return Array.from(new Set(ids));
}

export async function resolveTelegramOAuthConfig(
  env: Env,
  requestUrl: string
): Promise<ResolvedTelegramOAuthConfig> {
  const stored = await readStoredTelegramOAuthConfig(env);
  const hasKvOverride = Boolean(stored);
  const enabled = stored?.enabled !== undefined ? stored.enabled : true;

  // 1. Client ID: KV -> TG_OIDC_CLIENT_ID / TG_CLIENT_ID -> TG_BOT_TOKEN numeric prefix
  let clientId = "";
  let clientIdSource: ResolvedTelegramOAuthConfig["clientIdSource"] = "none";
  const envClientId = (env.TG_OIDC_CLIENT_ID || env.TG_CLIENT_ID || "").trim();
  const botTokenId = extractBotIdFromToken(env.TG_BOT_TOKEN);

  if (stored?.clientId) {
    clientId = stored.clientId;
    clientIdSource = "kv";
  } else if (envClientId) {
    clientId = envClientId;
    clientIdSource = "env";
  } else if (botTokenId) {
    clientId = botTokenId;
    clientIdSource = "bot_token";
  }

  // 2. Client Secret: KV -> TG_OIDC_SECRET
  let clientSecret = "";
  let secretSource: ResolvedTelegramOAuthConfig["secretSource"] = "none";
  const envSecret = (env.TG_OIDC_SECRET || "").trim();

  if (stored?.clientSecret) {
    clientSecret = stored.clientSecret;
    secretSource = "kv";
  } else if (envSecret) {
    clientSecret = envSecret;
    secretSource = "env";
  }

  // 3. Allowed Telegram User IDs: KV -> TG_ALLOWED_USER_IDS / TG_ALLOWED_USER_ID -> positive TG_CHAT_ID
  let allowedUserIds: number[] = [];
  let allowedUserSource: ResolvedTelegramOAuthConfig["allowedUserSource"] =
    "none";
  const envAllowedRaw = (
    env.TG_ALLOWED_USER_IDS ||
    env.TG_ALLOWED_USER_ID ||
    ""
  ).trim();
  const chatIdNum = Number((env.TG_CHAT_ID || "").trim());

  if (stored?.allowedUserIds) {
    allowedUserIds = parseAllowedUserIds(stored.allowedUserIds);
    if (allowedUserIds.length > 0) allowedUserSource = "kv";
  }
  if (allowedUserIds.length === 0 && envAllowedRaw) {
    allowedUserIds = parseAllowedUserIds(envAllowedRaw);
    if (allowedUserIds.length > 0) allowedUserSource = "env";
  }
  if (
    allowedUserIds.length === 0 &&
    Number.isSafeInteger(chatIdNum) &&
    chatIdNum > 0
  ) {
    allowedUserIds = [chatIdNum];
    allowedUserSource = "chat_id";
  }

  // 4. Redirect URI: KV -> TG_REDIRECT_URI -> request origin
  const parsedReqUrl = new URL(requestUrl);
  const origin = parsedReqUrl.origin;
  let redirectUri = new URL("/auth/telegram/callback", origin).toString();
  let redirectSource: ResolvedTelegramOAuthConfig["redirectSource"] = "origin";

  if (stored?.redirectUri) {
    redirectUri = stored.redirectUri;
    redirectSource = "kv";
  } else if (env.TG_REDIRECT_URI && env.TG_REDIRECT_URI.trim()) {
    redirectUri = env.TG_REDIRECT_URI.trim();
    redirectSource = "env";
  }

  const configured = Boolean(
    env.JWT_SECRET &&
      enabled &&
      /^\d+$/.test(clientId) &&
      clientSecret.length > 0 &&
      allowedUserIds.length > 0
  );

  const usedKv =
    clientIdSource === "kv" ||
    secretSource === "kv" ||
    allowedUserSource === "kv" ||
    redirectSource === "kv";
  const usedEnv =
    clientIdSource === "env" ||
    clientIdSource === "bot_token" ||
    secretSource === "env" ||
    allowedUserSource === "env" ||
    allowedUserSource === "chat_id" ||
    redirectSource === "env";

  const source: ResolvedTelegramOAuthConfig["source"] = !configured
    ? "unconfigured"
    : usedKv && usedEnv
      ? "mixed"
      : usedKv
        ? "kv"
        : "env";

  return {
    enabled,
    configured,
    source,
    clientId,
    clientIdSource,
    clientSecret,
    secretSource,
    allowedUserIds,
    allowedUserIdsRaw: allowedUserIds.join(", "),
    allowedUserSource,
    redirectUri,
    redirectSource,
    origin,
    hasKvOverride,
  };
}

export async function verifyTelegramIdToken(idToken: string, clientId: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: TG_ISSUER,
    audience: clientId,
  });
  return payload;
}
