import { FileMetadata } from "@shared/types";

export interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: any, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
  getWithMetadata<T = unknown>(
    key: string
  ): Promise<{ value: any; metadata: T }>;
}

export interface R2Bucket {
  get(key: string): Promise<any>;
  put(key: string, value: any, options?: any): Promise<any>;
  delete(key: string): Promise<void>;
}

export interface WorkersAI {
  run(model: string, inputs: Record<string, any>): Promise<any>;
}

export type Env = {
  oh_file_url: KVNamespace;
  oh_file_r2?: R2Bucket;
  /** JWT 签名密钥，必填；缺失时登录与鉴权将拒绝服务 */
  JWT_SECRET: string;
  PASSWORD?: string;
  API_TOKEN?: string;

  TG_CHAT_ID?: string;
  TG_BOT_TOKEN?: string;
  TG_WEBHOOK_SECRET?: string;

  /** Telegram Web Login (OIDC) 环境变量（可选，亦可在系统设置面板在线配置） */
  TG_CLIENT_ID?: string;
  TG_OIDC_CLIENT_ID?: string;
  TG_OIDC_SECRET?: string;
  TG_ALLOWED_USER_IDS?: string;
  TG_ALLOWED_USER_ID?: string;
  TG_REDIRECT_URI?: string;

  AI?: WorkersAI;
};
