import { FormEvent, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/buttons/Button";
import { BrandPill } from "@/components/layout/BrandPill";
import {
  LargeCard,
  LargeCardButtons,
  LargeCardText,
} from "@/components/layout/LargeCard";
import { MwLink } from "@/components/text/Link";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { useAuth } from "@/hooks/auth/useAuth";

import { PasswordResetFormPart } from "./PasswordResetFormPart";

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function LoginFormPart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [view, setView] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (view === "reset") {
    return <PasswordResetFormPart onBack={() => setView("login")} />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError(t("auth.loginForm.errorRequired") || "Email and password are required");
      return;
    }

    setLoading(true);
    try {
      await login({ email, password });
      navigate(safeRedirectPath(searchParams.get("redirect")));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("auth.loginForm.errorGeneric") || "Failed to sign in",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LargeCard top={<BrandPill backgroundClass="bg-[#161527]" />}>
      <form onSubmit={handleSubmit}>
        <LargeCardText title={t("auth.loginForm.title")}>
          {t("auth.loginForm.description")}
        </LargeCardText>
        <div className="space-y-4">
          <AuthInputBox
            label={t("auth.loginForm.emailLabel")}
            value={email}
            name="email"
            autoComplete="email"
            onChange={(value) => {
              setEmail(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.loginForm.emailPlaceholder")}
            disabled={loading}
          />
          <AuthInputBox
            label={t("auth.loginForm.passwordLabel")}
            value={password}
            name="password"
            autoComplete="current-password"
            onChange={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.loginForm.passwordPlaceholder")}
            passwordToggleable
            disabled={loading}
          />
          {error === "ACCOUNT_DEACTIVATED" ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-type-danger space-y-2">
              <p className="font-medium">
                {t("auth.loginForm.deactivatedTitle")}
              </p>
              <p>{t("auth.loginForm.deactivatedBody")}</p>
              <a
                href="mailto:topwaatch@gmail.com"
                className="inline-flex font-bold text-type-link hover:text-type-linkHover"
              >
                topwaatch@gmail.com
              </a>
            </div>
          ) : error ? (
            <p className="text-type-danger text-sm">{error}</p>
          ) : null}
          <p className="text-right">
            <MwLink onClick={() => !loading && setView("reset")}>
              {t("auth.loginForm.forgotPassword")}
            </MwLink>
          </p>
        </div>
        <LargeCardButtons>
          <Button theme="purple" type="submit" loading={loading}>
            {t("auth.loginForm.submit")}
          </Button>
        </LargeCardButtons>
      </form>
      <p className="text-center mt-6">
        <Trans i18nKey="auth.createAccount">
          <MwLink
            to={
              searchParams.get("redirect")
                ? `/register?redirect=${encodeURIComponent(searchParams.get("redirect")!)}`
                : "/register"
            }
          >
            .
          </MwLink>
        </Trans>
      </p>
    </LargeCard>
  );
}
