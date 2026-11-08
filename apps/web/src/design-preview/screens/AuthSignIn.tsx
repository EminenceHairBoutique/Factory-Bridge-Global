"use client";

/**
 * Sign-in (B-05 design): email one-time code first, password second, forgot-password without account enumeration.
 * Bilingual copy (EN / 中文) because suppliers sign in here too. Nothing is submitted; states are local.
 */
import Link from "next/link";
import { useState } from "react";
import { validateEmailAddress, validateOtp, validatePassword } from "../auth-demo";
import { AuthFrame } from "../ui/AuthFrame";
import { Icon } from "../ui/icons";
import {
  Button,
  Field,
  Notice,
  SegmentedControl,
  TextInput,
  buttonClasses,
  cx,
} from "../ui/primitives";

type Lang = "en-US" | "zh-CN";
type Step = "email" | "code" | "password" | "forgot" | "forgot_sent" | "done";

const T: Record<Lang, Record<string, string>> = {
  "en-US": {
    title: "Sign in",
    lead: "We email you a one-time code. No password needed unless you prefer one.",
    email: "Work email",
    continue: "Email me a code",
    usePassword: "Use a password instead",
    codeTitle: "Check your email",
    codeLead: "We sent a 6-digit code to {email}. It expires in 10 minutes.",
    code: "6-digit code",
    verify: "Sign in",
    resend: "Send a new code",
    changeEmail: "Use a different email",
    passwordTitle: "Sign in with a password",
    password: "Password",
    forgot: "Forgot your password?",
    useCode: "Email me a code instead",
    forgotTitle: "Reset your password",
    forgotLead:
      "Enter your work email. If an account exists, we send a reset link valid for 15 minutes.",
    sendReset: "Send reset link",
    forgotSentTitle: "If that address has an account, the link is on its way",
    forgotSentLead:
      "The link expires in 15 minutes. We say the same thing whether or not the address exists, so nobody can test addresses here.",
    back: "Back to sign in",
    doneTitle: "Signed in",
    doneLead:
      "Your organization membership is checked on every request, so a role change takes effect immediately.",
    goBuyer: "Open the buyer workspace",
    goSupplier: "打开供应商工作台",
    noAccount: "Buyers: your organization owner invites you. Suppliers: 供应商申请.",
    demo: "Prototype: no code is sent. Any 6 digits continue.",
    invalidCode: "That code is not valid or has expired.",
  },
  "zh-CN": {
    title: "登录",
    lead: "我们会向您的邮箱发送一次性验证码；如您更习惯使用密码，也可以选择密码登录。",
    email: "工作邮箱",
    continue: "发送验证码",
    usePassword: "改用密码登录",
    codeTitle: "请查收邮件",
    codeLead: "我们已向 {email} 发送 6 位验证码，10 分钟内有效。",
    code: "6 位验证码",
    verify: "登录",
    resend: "重新发送验证码",
    changeEmail: "更换邮箱",
    passwordTitle: "使用密码登录",
    password: "密码",
    forgot: "忘记密码？",
    useCode: "改用验证码登录",
    forgotTitle: "重置密码",
    forgotLead: "请输入工作邮箱。如该邮箱已注册，我们将发送 15 分钟内有效的重置链接。",
    sendReset: "发送重置链接",
    forgotSentTitle: "如该邮箱已注册，重置链接已发出",
    forgotSentLead:
      "链接 15 分钟内有效。无论邮箱是否存在，我们都会显示相同提示，以防止他人探测账户。",
    back: "返回登录",
    doneTitle: "登录成功",
    doneLead: "每次请求都会实时核对您的企业成员身份，角色变更立即生效。",
    goBuyer: "Open the buyer workspace",
    goSupplier: "打开供应商工作台",
    noAccount: "买家：由企业管理员邀请加入。供应商：请通过“供应商申请”。",
    demo: "原型：不会真正发送验证码；输入任意 6 位数字即可继续。",
    invalidCode: "验证码无效或已过期。",
  },
};

export function AuthSignIn() {
  const [lang, setLang] = useState<Lang>("en-US");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const t = (k: string) => (T[lang][k] ?? k).replace("{email}", email);

  const langToggle = (
    <SegmentedControl
      label="Language"
      size="sm"
      value={lang}
      onChange={(v) => {
        setLang(v);
        setError(null);
      }}
      options={[
        { value: "en-US", label: "EN" },
        { value: "zh-CN", label: "中文" },
      ]}
    />
  );

  const emailStep = () => {
    const e = validateEmailAddress(email);
    setError(e ? (lang === "zh-CN" ? "请填写有效的工作邮箱。" : e) : null);
    return !e;
  };

  const titles: Record<Step, string> = {
    email: t("title"),
    code: t("codeTitle"),
    password: t("passwordTitle"),
    forgot: t("forgotTitle"),
    forgot_sent: t("forgotSentTitle"),
    done: t("doneTitle"),
  };
  const leads: Record<Step, string> = {
    email: t("lead"),
    code: t("codeLead"),
    password: "",
    forgot: t("forgotLead"),
    forgot_sent: t("forgotSentLead"),
    done: t("doneLead"),
  };

  return (
    <AuthFrame
      lang={lang}
      title={
        <span className="flex items-start justify-between gap-3">
          {titles[step]}
          {langToggle}
        </span>
      }
      lead={leads[step] || undefined}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link href="/design-preview/auth/invite" className="text-(--fbg-link) underline">
            {lang === "zh-CN" ? "查看邀请页面" : "See the invitation page"}
          </Link>
        </span>
      }
    >
      {step === "email" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (emailStep()) setStep("code");
          }}
        >
          <Field
            label={t("email")}
            htmlFor="email"
            required
            optionalText=""
            error={error ?? undefined}
          >
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            {t("continue")}
          </Button>
          <button
            type="button"
            className="text-sm text-(--fbg-link) underline"
            onClick={() => emailStep() && setStep("password")}
          >
            {t("usePassword")}
          </button>
          <Notice tone="neutral">{t("demo")}</Notice>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateOtp(code);
            if (v) {
              setAttempts((n) => n + 1);
              setError(lang === "zh-CN" ? t("invalidCode") : v);
              return;
            }
            setError(null);
            setStep("done");
          }}
        >
          <Field
            label={t("code")}
            htmlFor="code"
            required
            optionalText=""
            error={error ?? undefined}
          >
            <TextInput
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="fbg-num text-center text-2xl tracking-[0.3em]"
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          {attempts >= 3 ? (
            <Notice tone="warn">
              {lang === "zh-CN"
                ? "多次输入错误后，验证码将失效，请重新发送。"
                : "After several wrong attempts the code is invalidated; request a new one."}
            </Notice>
          ) : null}
          <Button type="submit" variant="primary" size="lg" className="w-full">
            {t("verify")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              className="text-(--fbg-link) underline"
              onClick={() => {
                setCode("");
                setAttempts(0);
                setError(null);
              }}
            >
              {t("resend")}
            </button>
            <button
              type="button"
              className="text-(--fbg-text-secondary) underline"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              {t("changeEmail")}
            </button>
          </div>
        </form>
      ) : null}

      {step === "password" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validatePassword(password);
            setError(v);
            if (!v) setStep("done");
          }}
        >
          <Field label={t("email")} htmlFor="email2" required optionalText="">
            <TextInput
              id="email2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field
            label={t("password")}
            htmlFor="password"
            required
            optionalText=""
            error={error ?? undefined}
          >
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            {t("verify")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              className="text-(--fbg-link) underline"
              onClick={() => {
                setError(null);
                setStep("forgot");
              }}
            >
              {t("forgot")}
            </button>
            <button
              type="button"
              className="text-(--fbg-text-secondary) underline"
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              {t("useCode")}
            </button>
          </div>
        </form>
      ) : null}

      {step === "forgot" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (emailStep()) setStep("forgot_sent");
          }}
        >
          <Field
            label={t("email")}
            htmlFor="email3"
            required
            optionalText=""
            error={error ?? undefined}
          >
            <TextInput
              id="email3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full">
            {t("sendReset")}
          </Button>
          <button
            type="button"
            className="text-sm text-(--fbg-text-secondary) underline"
            onClick={() => setStep("password")}
          >
            {t("back")}
          </button>
        </form>
      ) : null}

      {step === "forgot_sent" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-(--fbg-radius-control) border border-(--fbg-border-subtle) bg-(--fbg-bg-canvas) p-3 text-sm">
            <Icon name="message" size={18} className="text-(--fbg-action-primary)" />
            <span className="fbg-num">{email}</span>
          </div>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setStep("email")}>
            {t("back")}
          </Button>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-(--fbg-radius-control) border border-(--fbg-status-success)/35 bg-(--fbg-status-success-fill) p-3 text-sm text-(--fbg-text-primary)">
            <Icon name="check" size={18} className="text-(--fbg-status-success)" />
            <span className="fbg-num">{email}</span>
          </div>
          <Link
            href="/design-preview/buyer/dashboard"
            className={cx(buttonClasses("primary", "lg"), "w-full")}
          >
            {t("goBuyer")}
          </Link>
          <Link
            href="/design-preview/supplier/dashboard"
            className={cx(buttonClasses("secondary", "lg"), "w-full")}
            lang="zh-CN"
          >
            {t("goSupplier")}
          </Link>
          <p className="text-xs text-(--fbg-text-secondary)">
            {lang === "zh-CN"
              ? "正式系统会根据您所属企业的类型自动进入对应工作台。"
              : "The real flow routes you by your organization type; a buyer cannot open the supplier or operations workspace."}
          </p>
        </div>
      ) : null}
    </AuthFrame>
  );
}
