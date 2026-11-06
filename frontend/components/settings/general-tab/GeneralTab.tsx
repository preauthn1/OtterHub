"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  CloudSync,
  CloudUpload,
  Info,
  ShieldAlert,
  FolderOpen,
  Trash2,
  RefreshCw,
  Download,
  AlertCircle,
  Sparkles,
  Webhook,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGeneralSettingsStoreClient } from "@/stores/general-store";
import { cn } from "@/lib/utils";
import {
  loadDirectoryHandle,
  clearDirectoryHandleCache,
  pickDownloadDirectoryForFirstTime,
} from "@/lib/utils/file";
import { TagSelector } from "@/components/TagSelector";
import { SafeModeToggle } from "@/components/SafeModeToggle";
import { ImageLoadModeToggle } from "@/components/ImageLoadModeToggle";
import { ImageLoadMode } from "@shared/types";
import {
  telegramOAuthApi,
  TelegramOAuthConfigInfo,
  telegramWebhookApi,
} from "@/lib/api/telegram";

const SettingCard = ({ icon: Icon, iconColor, title, desc, badge, children }: any) => (
  <Card className="border border-border bg-card rounded-[var(--r-md)] shadow-none overflow-hidden py-5 gap-4">
    <CardHeader className="px-5 pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <CardTitle className="text-base font-semibold text-foreground">
            {title}
          </CardTitle>
        </div>
        {badge}
      </div>
      {desc && (
        <CardDescription className="text-xs text-muted-foreground mt-1">
          {desc}
        </CardDescription>
      )}
    </CardHeader>
    <CardContent className="px-5 grid gap-4">{children}</CardContent>
  </Card>
);

const SettingItem = ({ title, desc, children }: any) => (
  <div className="flex items-center justify-between gap-4">
    <div className="space-y-0.5 text-left">
      <Label className="text-sm font-medium text-foreground">{title}</Label>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
    {children}
  </div>
);

const HintBox = ({ icon: Icon = Info, variant = "default", children }: any) => {
  const styles = {
    default: "bg-secondary border-border text-muted-foreground",
    warning:
      "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300",
    info: "bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-300",
  };
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2.5 rounded-[var(--r-sm)] border text-xs leading-relaxed text-left",
        styles[variant as keyof typeof styles]
      )}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
};

interface GeneralTabProps {
  onGeneralSettingsSnapshotReset?: () => void;
}

export function GeneralTab({
  onGeneralSettingsSnapshotReset,
}: GeneralTabProps) {
  const store = useGeneralSettingsStoreClient();
  const telegramWebhookInfo = store?.telegramWebhookInfo ?? null;
  const setTelegramWebhookInfo = store?.setTelegramWebhookInfo;
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingTelegramWebhook, setIsCheckingTelegramWebhook] =
    useState(false);
  const [isSettingTelegramWebhook, setIsSettingTelegramWebhook] =
    useState(false);
  const [localThreshold, setLocalThreshold] = useState("5.0");
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [isDirLoading, setIsDirLoading] = useState(false);
  const [supportsFsApi, setSupportsFsApi] = useState(false);
  const dataSaverThreshold = store?.dataSaverThreshold;

  // Telegram Web OAuth 配置状态
  const [oauthInfo, setOauthInfo] = useState<TelegramOAuthConfigInfo | null>(
    null
  );
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);
  const [isSavingOAuth, setIsSavingOAuth] = useState(false);
  const [oauthEnabled, setOauthEnabled] = useState(true);
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [showOAuthSecret, setShowOAuthSecret] = useState(false);
  const [oauthAllowedUsers, setOauthAllowedUsers] = useState("");
  const [oauthRedirectUri, setOauthRedirectUri] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const applyOAuthInfoToForm = (info: TelegramOAuthConfigInfo) => {
    setOauthInfo(info);
    setOauthEnabled(info.enabled);
    setOauthClientId(info.clientId || "");
    setOauthClientSecret("");
    setOauthAllowedUsers(info.allowedUserIds || "");
    setOauthRedirectUri(
      info.redirectSource === "kv" ? info.redirectUri : ""
    );
  };

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" && "showDirectoryPicker" in window;
    setSupportsFsApi(isSupported);
    if (isSupported) {
      loadDirectoryHandle()
        .then((handle) => setCurrentDir(handle?.name || null))
        .catch(() => setCurrentDir(null));
    }
  }, []);

  const hasCheckedWebhookRef = useRef(false);
  useEffect(() => {
    if (!store || hasCheckedWebhookRef.current) return;
    hasCheckedWebhookRef.current = true;

    const loadTelegramStates = async () => {
      if (telegramWebhookInfo === null) {
        setIsCheckingTelegramWebhook(true);
        try {
          const info = await telegramWebhookApi.getInfo();
          store.setTelegramWebhookInfo(info);
        } catch {
          // ignore
        } finally {
          setIsCheckingTelegramWebhook(false);
        }
      }

      setIsLoadingOAuth(true);
      try {
        const cfg = await telegramOAuthApi.getConfig();
        applyOAuthInfoToForm(cfg);
      } catch {
        // ignore
      } finally {
        setIsLoadingOAuth(false);
      }
    };

    loadTelegramStates();
  }, [store, telegramWebhookInfo]);

  useEffect(() => {
    if (dataSaverThreshold !== undefined) {
      setLocalThreshold(dataSaverThreshold.toString());
    }
  }, [dataSaverThreshold]);

  useEffect(() => {
    if (!store) return;
    const threshold = parseFloat(localThreshold);
    if (
      isNaN(threshold) ||
      threshold < 0 ||
      threshold === store.dataSaverThreshold
    )
      return;

    const timer = setTimeout(() => store.setDataSaverThreshold(threshold), 500);
    return () => clearTimeout(timer);
  }, [
    localThreshold,
    store?.dataSaverThreshold,
    store?.setDataSaverThreshold,
    store,
  ]);

  const withLoading =
    (
      action: () => Promise<any>,
      setLoader: (val: boolean) => void,
      errorMsg?: string
    ) =>
    async () => {
      setLoader(true);
      try {
        return await action();
      } catch (err: any) {
        if (errorMsg) toast.error(err?.message || errorMsg);
      } finally {
        setLoader(false);
      }
    };

  const handleChangeDirectory = withLoading(
    async () => {
      const result = await pickDownloadDirectoryForFirstTime();
      if (result) {
        setCurrentDir(result.dirName);
        toast.success(`已切换到: ${result.dirName}`);
      }
    },
    setIsDirLoading,
    "更换失败"
  );

  const handleClearDirectory = withLoading(
    async () => {
      await clearDirectoryHandleCache();
      setCurrentDir(null);
      toast.success("已清除，下次下载需重新选择目录");
    },
    setIsDirLoading,
    "清除失败"
  );

  const handleManualSync = withLoading(
    async () => {
      if (!store) return;
      await store.syncSettings();
      onGeneralSettingsSnapshotReset?.();
    },
    setIsUploading,
    "保存失败"
  );

  const handleFetchFromCloud = withLoading(
    async () => {
      if (!store) return;
      await store.fetchSettings();
      onGeneralSettingsSnapshotReset?.();
    },
    setIsSyncing,
    "恢复失败"
  );

  const handleCheckTelegramWebhook = withLoading(
    async () => {
      const info = await telegramWebhookApi.getInfo();
      setTelegramWebhookInfo?.(info);
      if (info.configured) {
        toast.success("Telegram Webhook 已绑定");
      } else {
        toast.warning("Telegram Webhook 尚未绑定");
      }
    },
    setIsCheckingTelegramWebhook,
    "检查失败"
  );

  const handleSetupTelegramWebhook = withLoading(
    async () => {
      const result = await telegramWebhookApi.setup();
      setTelegramWebhookInfo?.({
        configured: true,
        url: result.webhookUrl,
      });
      toast.success("Telegram Webhook 已配置");
    },
    setIsSettingTelegramWebhook,
    "配置失败"
  );

  const handleSaveTelegramOAuth = withLoading(
    async () => {
      const updated = await telegramOAuthApi.saveConfig({
        enabled: oauthEnabled,
        clientId: oauthClientId.trim(),
        clientSecret: oauthClientSecret.trim() || undefined,
        allowedUserIds: oauthAllowedUsers.trim(),
        redirectUri: oauthRedirectUri.trim(),
      });
      applyOAuthInfoToForm(updated);
      toast.success(
        updated.configured
          ? "Telegram Web OAuth 配置已生效"
          : "配置已保存（仍缺少必填项，请检查 Client Secret 或用户 ID）"
      );
    },
    setIsSavingOAuth,
    "保存 Telegram OAuth 配置失败"
  );

  const handleResetTelegramOAuth = withLoading(
    async () => {
      const updated = await telegramOAuthApi.resetConfig();
      applyOAuthInfoToForm(updated);
      toast.success("已恢复为环境变量默认配置");
    },
    setIsSavingOAuth,
    "重置失败"
  );

  const copyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopiedField(null), 1800);
  };

  if (!store) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <div>加载设置中...</div>
      </div>
    );
  }

  const resolvedOrigin =
    oauthInfo?.origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const resolvedCallbackUrl =
    oauthInfo?.redirectUri || `${resolvedOrigin}/auth/telegram/callback`;

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6 pr-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="text-left">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            常规设置
          </h2>
          <p className="text-xs text-muted-foreground">
            管理浏览偏好、Telegram Web OAuth 联合登录、频道上传与本地目录
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchFromCloud}
            disabled={isSyncing}
          >
            <CloudSync
              className={cn("h-4 w-4", isSyncing && "animate-spin")}
            />
            <span>从云端恢复</span>
          </Button>
          <Button
            size="sm"
            onClick={handleManualSync}
            disabled={isUploading}
          >
            <CloudUpload
              className={cn("h-4 w-4", isUploading && "animate-spin")}
            />
            <span>保存到云端</span>
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid gap-5">
        {/* 1. Telegram Web OAuth 登录配置 */}
        <SettingCard
          icon={KeyRound}
          iconColor="taste-accent-text"
          title="Telegram Web OAuth 联合登录"
          desc="支持通过 @BotFather Web Login (OpenID Connect + PKCE) 免密登录云盘；可直接使用环境变量或在此加密保存覆盖配置。"
          badge={
            <span
              className={cn(
                "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-mono",
                oauthInfo?.configured
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
              )}
            >
              {isLoadingOAuth
                ? "检测中..."
                : oauthInfo?.configured
                  ? `已就绪 (${oauthInfo.source === "kv" ? "在线配置" : oauthInfo.source === "mixed" ? "混合配置" : "环境变量"})`
                  : "待配置"}
            </span>
          }
        >
          <div className="space-y-4 text-left">
            {/* BotFather Web Login 参数一键复制 */}
            <div className="rounded-[var(--r-sm)] border border-border bg-secondary/60 p-3.5 space-y-2.5">
              <p className="text-xs font-medium text-foreground">
                1. 在 Telegram 打开 <span className="font-mono">@BotFather</span>{" "}
                → 发送 <span className="font-mono">/mybots</span> → 选择你的 Bot
                → <span className="font-mono">Bot Settings</span> →{" "}
                <span className="font-mono">Web Login</span>，填入以下回调参数：
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between gap-2 rounded-[var(--r-sm)] border border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      站点域名 (Origin / Domain)
                    </p>
                    <p className="text-xs font-mono text-foreground truncate">
                      {resolvedOrigin}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyText("origin", resolvedOrigin)}
                    title="复制域名"
                  >
                    {copiedField === "origin" ? (
                      <Check className="h-3.5 w-3.5 taste-accent-text" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-[var(--r-sm)] border border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      回调地址 (Redirect URL)
                    </p>
                    <p className="text-xs font-mono text-foreground truncate">
                      {resolvedCallbackUrl}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyText("callback", resolvedCallbackUrl)}
                    title="复制回调地址"
                  >
                    {copiedField === "callback" ? (
                      <Check className="h-3.5 w-3.5 taste-accent-text" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* OAuth 在线配置表单 */}
            <div className="space-y-3.5">
              <SettingItem
                title="启用 Telegram 账号登录"
                desc="开启后登录页可使用 Sign in with Telegram 一键鉴权"
              >
                <Switch
                  checked={oauthEnabled}
                  onCheckedChange={setOauthEnabled}
                />
              </SettingItem>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">
                      Client ID (Bot ID)
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {oauthInfo?.clientIdSource === "bot_token"
                        ? "已从 TG_BOT_TOKEN 自动提取"
                        : oauthInfo?.clientIdSource === "env"
                          ? "来自环境变量"
                          : oauthInfo?.clientIdSource === "kv"
                            ? "在线配置"
                            : "必填"}
                    </span>
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder={
                      oauthInfo?.envHints?.botTokenClientId ||
                      "纯数字 Bot ID，如 123456789"
                    }
                    className="h-9 font-mono text-xs bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">
                      Client Secret (TG_OIDC_SECRET)
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {oauthInfo?.hasClientSecret
                        ? oauthInfo.secretSource === "kv"
                          ? "已加密保存 (KV)"
                          : "已从环境变量加载"
                        : "未设置密钥"}
                    </span>
                  </div>
                  <div className="relative">
                    <Input
                      type={showOAuthSecret ? "text" : "password"}
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      placeholder={
                        oauthInfo?.hasClientSecret
                          ? "已配置密钥（留空保持不变，输入新值可覆盖）"
                          : "粘贴 BotFather Web Login 生成的 Client Secret"
                      }
                      className="h-9 pr-9 font-mono text-xs bg-background border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOAuthSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={showOAuthSecret ? "隐藏密钥" : "显示密钥"}
                    >
                      {showOAuthSecret ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">
                      允许登录的 Telegram 用户 ID
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {oauthInfo?.allowedUserSource === "chat_id"
                        ? "继承自 TG_CHAT_ID"
                        : oauthInfo?.allowedUserSource === "env"
                          ? "来自环境变量"
                          : oauthInfo?.allowedUserSource === "kv"
                            ? "在线配置"
                            : "必填"}
                    </span>
                  </div>
                  <Input
                    type="text"
                    value={oauthAllowedUsers}
                    onChange={(e) => setOauthAllowedUsers(e.target.value)}
                    placeholder="个人数字 User ID（多个用逗号分隔）"
                    className="h-9 font-mono text-xs bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">
                      自定义 Redirect URI（可选）
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      留空默认当前域名回调
                    </span>
                  </div>
                  <Input
                    type="url"
                    value={oauthRedirectUri}
                    onChange={(e) => setOauthRedirectUri(e.target.value)}
                    placeholder={
                      oauthInfo?.defaultCallbackUri ||
                      `${resolvedOrigin}/auth/telegram/callback`
                    }
                    className="h-9 font-mono text-xs bg-background border-border"
                  />
                </div>
              </div>

              {oauthInfo?.envHints?.chatIdIsChannel &&
                !oauthInfo?.allowedUserIds && (
                  <HintBox icon={ShieldAlert} variant="warning">
                    检测到当前环境变量 <span className="font-mono">TG_CHAT_ID</span>{" "}
                    为负数频道/群组 ID，不可直接作为个人登录 ID。请在上方「允许登录的
                    Telegram 用户 ID」中填入你个人的正整数 Telegram User ID（可通过{" "}
                    <span className="font-mono">@userinfobot</span> 获取）。
                  </HintBox>
                )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveTelegramOAuth}
                    disabled={isSavingOAuth}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {isSavingOAuth ? "保存中..." : "保存 OAuth 配置"}
                    </span>
                  </Button>

                  {oauthInfo?.hasKvOverride && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetTelegramOAuth}
                      disabled={isSavingOAuth}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>恢复环境变量默认</span>
                    </Button>
                  )}
                </div>

                {oauthInfo?.configured && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                  >
                    <a
                      href="/auth/telegram/start"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>测试 OAuth 跳转</span>
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SettingCard>

        {/* 2. 浏览设置 */}
        <SettingCard icon={Eye} iconColor="text-sky-500" title="浏览设置">
          <div className="flex flex-col space-y-4">
            <SettingItem title="安全模式" desc="NSFW 敏感内容显示模糊遮罩">
              <SafeModeToggle />
            </SettingItem>

            <SettingItem title="图片加载模式" desc="控制原图、省流或无图预览策略">
              <ImageLoadModeToggle />
            </SettingItem>

            {store.imageLoadMode === ImageLoadMode.DataSaver && (
              <>
                <SettingItem title="省流模式阈值">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={localThreshold}
                      onChange={(e) => setLocalThreshold(e.target.value)}
                      className="w-24 h-9 text-right font-mono text-xs bg-background border-border"
                    />
                    <span className="text-xs font-mono text-muted-foreground">
                      MB
                    </span>
                  </div>
                </SettingItem>
                <HintBox>省流模式下，超过此大小的图片不自动加载原图预览。</HintBox>
              </>
            )}
          </div>
        </SettingCard>

        {/* 3. 上传与频道Webhook设置 */}
        <SettingCard
          icon={ShieldCheck}
          iconColor="text-emerald-500"
          title="上传与频道同步设置"
        >
          <div className="flex flex-col space-y-4">
            <SettingItem title="NSFW 内容检测" desc="上传前本地检测敏感内容">
              <Switch
                checked={store.nsfwDetection}
                onCheckedChange={store.setNsfwDetection}
              />
            </SettingItem>
            {!store.nsfwDetection && (
              <HintBox icon={ShieldAlert} variant="warning">
                关闭后上传更快，但敏感内容不会自动标记 NSFW。
              </HintBox>
            )}

            <SettingItem title="AI 智能分析" desc="上传后智能识别生成描述">
              <Switch
                checked={store.enableImageAnalysis}
                onCheckedChange={store.setEnableImageAnalysis}
              />
            </SettingItem>
            {!store.enableImageAnalysis && (
              <HintBox icon={Sparkles} variant="info">
                关闭后跳过 AI 分析，可节省一次 KV 写操作。
              </HintBox>
            )}

            <SettingItem title="默认上传标签" desc="上传时自动添加的标签">
              <TagSelector
                tags={store.defaultUploadTags}
                onChange={store.setDefaultUploadTags}
                placeholder="选择默认标签..."
              />
            </SettingItem>

            <div className="rounded-[var(--r-sm)] border border-border bg-secondary/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <Webhook className="h-5 w-5 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">
                      Telegram 频道上传 Webhook
                    </p>
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {telegramWebhookInfo?.url ||
                        (telegramWebhookInfo?.reason === "missing-token"
                          ? "缺少 TG_BOT_TOKEN"
                          : "未检查")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckTelegramWebhook}
                    disabled={
                      isCheckingTelegramWebhook || isSettingTelegramWebhook
                    }
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        isCheckingTelegramWebhook && "animate-spin"
                      )}
                    />
                    <span>检查状态</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSetupTelegramWebhook}
                    disabled={
                      isCheckingTelegramWebhook || isSettingTelegramWebhook
                    }
                  >
                    <CloudUpload
                      className={cn(
                        "h-4 w-4",
                        isSettingTelegramWebhook && "animate-pulse"
                      )}
                    />
                    <span>配置 Webhook</span>
                  </Button>
                </div>
              </div>
              {telegramWebhookInfo?.lastErrorMessage && (
                <p className="mt-3 text-xs text-destructive text-left">
                  {telegramWebhookInfo.lastErrorMessage}
                </p>
              )}
            </div>
          </div>
        </SettingCard>

        {/* 4. 下载管理 */}
        {supportsFsApi ? (
          <SettingCard
            icon={Download}
            iconColor="text-amber-500"
            title="下载管理"
          >
            <div className="flex items-center justify-between p-4 rounded-[var(--r-sm)] bg-secondary/50 border border-border text-left">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-sky-500" />
                <div>
                  <p className="font-medium text-sm text-foreground">
                    大文件/批量下载目录
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {currentDir || "未设置"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleChangeDirectory}
                  disabled={isDirLoading}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isDirLoading && "animate-spin")}
                  />
                  <span>更换目录</span>
                </Button>
                {currentDir && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleClearDirectory}
                    disabled={isDirLoading}
                    title="清除目录"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <HintBox>
              首次保存大文件或批量下载需选择目录。建议提前创建 OtterHub
              文件夹。目录授权失效时会重新提示。
            </HintBox>
          </SettingCard>
        ) : (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-300">
              自定义下载目录不可用
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300/90">
              当前浏览器将使用默认下载方式。移动端批量下载需逐个打开/保存文件。
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
