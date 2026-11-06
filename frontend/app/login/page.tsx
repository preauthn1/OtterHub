"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { login } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Film,
  HardDrive,
  Lock,
  Loader2,
  Music,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { APP_NAME } from "@/lib/ui-text";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

type LoginFormValues = {
  password: string;
};

function DrawnArrow() {
  return (
    <svg
      className="m-arrow h-4 w-4 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8H13M13 8L9 4M13 8L9 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramGlyph() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="11" fill="#2AABEE" />
      <path
        d="M17.2 7.4L5.9 11.8C5.2 12.1 5.2 12.5 5.8 12.7L8.7 13.6L15.4 9.4C15.7 9.2 16 9.3 15.8 9.5L10.3 14.4L10.1 17.4C10.4 17.4 10.6 17.3 10.8 17.1L12.3 15.6L15.3 17.8C15.9 18.1 16.3 17.9 16.4 17.3L18.3 8.3C18.5 7.5 17.9 7.1 17.2 7.4Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function LoginHeroSection() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tgError = searchParams.get("tg_error");
    if (!tgError) return;
    if (tgError === "not_configured") {
      toast.error(
        "尚未完成 Telegram Web OAuth 配置：请先使用访问密码登录，在「系统设置 → 常规设置」中填写 Client Secret 与允许的用户 ID"
      );
    } else if (tgError === "disabled") {
      toast.info("Telegram Web OAuth 登录已在系统设置中关闭");
    } else if (tgError === "cancelled") {
      toast.info("已取消 Telegram 授权登录");
    }
  }, [searchParams]);

  const getRedirectUrl = () => {
    const redirect = searchParams.get("redirect");
    if (
      redirect &&
      (redirect.startsWith("/") || redirect.startsWith(window.location.origin))
    ) {
      return redirect;
    }
    return "/";
  };

  const form = useForm<LoginFormValues>({
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    if (loading) return;
    const rawPassword =
      values.password || passwordInputRef.current?.value || "";
    setLoading(true);
    try {
      const success = await login(rawPassword);
      if (!success) {
        throw new Error("访问密码不正确");
      }
      toast.success("欢迎回到 OtterHub");
      const redirectUrl = getRedirectUrl();
      router.push(redirectUrl);
    } catch (err: any) {
      console.error("Login failed:", err);
      toast.error(err.message || "登录失败，请检查访问密码");
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = form.handleSubmit(onSubmit);

  return (
    <>
      <header className="nav">
        <div className="wrap flex items-center justify-between gap-4">
          <a
            href="#workspace"
            className="taste-link inline-flex items-center gap-2.5 text-sm font-semibold text-foreground"
          >
            <BrandLogo size="sm" />
            <span>{APP_NAME}</span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/preauthn1/OtterHub"
              target="_blank"
              rel="noopener noreferrer"
              className="taste-link hidden sm:inline text-sm"
            >
              GitHub
            </a>
            <ThemeToggle />
            <Button
              type="button"
              size="default"
              onClick={() => passwordInputRef.current?.focus()}
            >
              <span>Start cloud drive</span>
              <DrawnArrow />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="taste-hero"
          id="workspace"
          style={{ "--h": 1 } as React.CSSProperties}
        >
          <div className="wrap h-full">
            <div className="hero-text flex h-full flex-col justify-between gap-4">
              {/* 12-column split with exact 24px gap (SR-8 k=5 split line at x=623) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Category Headline, Fact, Real Auth Form */}
                <div className="lg:col-span-5 flex flex-col items-start text-left">
                  <p className="text-xs sm:text-sm text-muted-foreground font-mono tabular-nums mb-2 sm:mb-3">
                    Cloudflare Edge · 1.95{"\u00A0"}GB max · 20{"\u00A0"}MB chunks
                  </p>

                  <h1 className="taste-h1 mb-2.5 sm:mb-4">
                    Personal cloud drive for large file transfers
                  </h1>

                  <p className="taste-lead text-sm sm:text-base mb-4 sm:mb-6">
                    私人边缘云盘与大文件传输工作台。基于 Cloudflare Workers 与
                    Telegram 存储构建，支持并发分片直传、断点秒续与外链分享。
                  </p>

                  <Form {...form}>
                    <form
                      action="/auth/login"
                      method="post"
                      onSubmit={submitLogin}
                      className="w-full space-y-2.5 sm:space-y-3"
                    >
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem className="space-y-1 text-left">
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                <Input
                                  {...field}
                                  ref={(el) => {
                                    field.ref(el);
                                    passwordInputRef.current = el;
                                  }}
                                  type={showPassword ? "text" : "password"}
                                  placeholder="输入访问密码解锁工作台"
                                  className="h-10 sm:h-11 pl-10 pr-10 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-[var(--r-btn)]"
                                  disabled={loading}
                                  onKeyDown={(event) => {
                                    if (
                                      event.key !== "Enter" ||
                                      event.nativeEvent.isComposing ||
                                      loading
                                    ) {
                                      return;
                                    }
                                    event.preventDefault();
                                    submitLogin();
                                  }}
                                />
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => setShowPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  aria-label={
                                    showPassword ? "隐藏密码" : "显示密码"
                                  }
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-left text-xs" />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <Button
                          type="submit"
                          size="default"
                          className="w-full font-medium"
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>正在验证...</span>
                            </>
                          ) : (
                            <>
                              <span>Start cloud drive</span>
                              <DrawnArrow />
                            </>
                          )}
                        </Button>

                        <Button
                          asChild
                          variant="outline"
                          size="default"
                          className="w-full font-medium"
                        >
                          <a href="/auth/telegram/start">
                            <TelegramGlyph />
                            <span>Sign in with Telegram</span>
                          </a>
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>

                {/* Right Column: Lit Panel + Live HTML Product UI Frame (>=26% section coverage) */}
                <div
                  className="lg:col-span-7 w-full taste-panel lg:p-6"
                  data-visual="otterhub-workbench"
                >
                  <div
                    className="app-frame p-3.5 sm:p-5 lg:p-6 space-y-3 sm:space-y-4"
                    data-ui="otterhub-live-preview"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 taste-accent-text shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">
                          边缘传输与档案库
                        </span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        243{"\u00A0"}files · 18.4{"\u00A0"}GB
                      </span>
                    </div>

                    <div className="rounded-[var(--r-sm)] border border-border bg-secondary/60 p-3 sm:p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 taste-accent-text shrink-0" />
                          <span className="font-mono font-medium text-foreground">
                            backup-2026.tar.zst
                          </span>
                        </div>
                        <span className="font-mono text-foreground tabular-nums">
                          74/74 · 31.8{"\u00A0"}MB/s
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-[3px] bg-background overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: "92%" }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground tabular-nums">
                        <span>1.48{"\u00A0"}GB / 1.60{"\u00A0"}GB</span>
                        <span>SHA-256 原子合并</span>
                      </div>
                    </div>

                    <div className="divide-y divide-border border border-border rounded-[var(--r-sm)] bg-background">
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Film className="h-4 w-4 text-sky-500 shrink-0" />
                          <span className="font-medium text-foreground">
                            reel-4k.mp4
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          412.6{"\u00A0"}MB
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="font-medium text-foreground">
                            storage-spec.pdf
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          14.2{"\u00A0"}MB
                        </span>
                      </div>

                      <div className="hidden sm:flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-medium text-foreground">
                            session-96k.flac
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          86.4{"\u00A0"}MB
                        </span>
                      </div>

                      <div className="hidden lg:flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Archive className="h-4 w-4 text-teal-500 shrink-0" />
                          <span className="font-medium text-foreground">
                            release-bundle-v4.zip
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          264.0{"\u00A0"}MB
                        </span>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 taste-accent-text" />
                        HttpOnly JWE PKCE 会话保护
                      </span>
                      <span>R2 + Telegram 存储通道</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>OtterHub Cloud Drive</span>
                <a
                  href="https://github.com/preauthn1/OtterHub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="taste-link"
                >
                  GitHub Repository
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main>
          <section className="taste-hero">
            <div className="wrap flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          </section>
        </main>
      }
    >
      <LoginHeroSection />
    </Suspense>
  );
}
