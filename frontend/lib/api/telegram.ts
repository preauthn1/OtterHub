import { client } from "./client";
import { API_URL, unwrap } from "./config";

export type TelegramWebhookInfo = {
  configured: boolean;
  reason?: string;
  url?: string;
  pendingUpdateCount?: number;
  lastErrorMessage?: string;
};

export type TelegramWebhookSetupResult = {
  webhookUrl: string;
  telegramResult: unknown;
};

export type TelegramOAuthConfigInfo = {
  enabled: boolean;
  configured: boolean;
  source: "kv" | "env" | "mixed" | "unconfigured";
  hasKvOverride: boolean;
  clientId: string;
  clientIdSource: "kv" | "env" | "bot_token" | "none";
  hasClientSecret: boolean;
  secretSource: "kv" | "env" | "none";
  allowedUserIds: string;
  allowedUserSource: "kv" | "env" | "chat_id" | "none";
  redirectUri: string;
  redirectSource: "kv" | "env" | "origin";
  origin: string;
  defaultCallbackUri?: string;
  envHints?: {
    botTokenClientId: string;
    hasEnvSecret: boolean;
    chatIdIsChannel: boolean;
  };
};

export type UpdateTelegramOAuthPayload = {
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  clearSecret?: boolean;
  allowedUserIds?: string;
  redirectUri?: string;
};

/**
 * Telegram Webhook 与 Web OAuth 管理接口。
 */
export const telegramWebhookApi = {
  getInfo(): Promise<TelegramWebhookInfo> {
    return unwrap<TelegramWebhookInfo>(client.telegram.webhook.info.$get());
  },

  setup(): Promise<TelegramWebhookSetupResult> {
    return unwrap<TelegramWebhookSetupResult>(
      client.telegram.webhook.setup.$post()
    );
  },
};

export const telegramOAuthApi = {
  getStatus(): Promise<{ enabled: boolean; configured: boolean }> {
    return unwrap<{ enabled: boolean; configured: boolean }>(
      fetch(`${API_URL}/auth/telegram/status`, {
        method: "GET",
        credentials: "include",
      })
    );
  },

  getConfig(): Promise<TelegramOAuthConfigInfo> {
    return unwrap<TelegramOAuthConfigInfo>(
      fetch(`${API_URL}/auth/telegram/config`, {
        method: "GET",
        credentials: "include",
      })
    );
  },

  saveConfig(
    payload: UpdateTelegramOAuthPayload
  ): Promise<TelegramOAuthConfigInfo> {
    return unwrap<TelegramOAuthConfigInfo>(
      fetch(`${API_URL}/auth/telegram/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
    );
  },

  resetConfig(): Promise<TelegramOAuthConfigInfo> {
    return unwrap<TelegramOAuthConfigInfo>(
      fetch(`${API_URL}/auth/telegram/config`, {
        method: "DELETE",
        credentials: "include",
      })
    );
  },
};
