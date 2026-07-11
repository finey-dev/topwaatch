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

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function RegisterFormPart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect");
  const loginHref = redirect
    ? `/login?redirect=${encodeURIComponent(redirect)}`
    : "/login";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!displayName.trim() || !email.trim() || !password) {
      setError(
        t("auth.registerForm.errorRequired") || "All fields are required",
      );
      return;
    }

    if (password.length < 8) {
      setError(
        t("auth.registerForm.errorPasswordLength") ||
          "Password must be at least 8 characters",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        t("auth.registerForm.errorPasswordMismatch") ||
          "Passwords do not match",
      );
      return;
    }

    setLoading(true);
    try {
      await register({
        email,
        password,
        name: displayName,
      });
      navigate(safeRedirectPath(redirect));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("auth.registerForm.errorGeneric") || "Failed to create account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <LargeCard top={<BrandPill backgroundClass="bg-[#161527]" />}>
      <form onSubmit={handleSubmit}>
        <LargeCardText title={t("auth.registerForm.title")}>
          {t("auth.registerForm.description")}
        </LargeCardText>
        <div className="space-y-4">
          <AuthInputBox
            label={t("auth.registerForm.displayNameLabel")}
            value={displayName}
            name="display-name"
            autoComplete="name"
            onChange={(value) => {
              setDisplayName(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.registerForm.displayNamePlaceholder")}
            disabled={loading}
          />
          <AuthInputBox
            label={t("auth.registerForm.emailLabel")}
            value={email}
            name="email"
            autoComplete="email"
            onChange={(value) => {
              setEmail(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.registerForm.emailPlaceholder")}
            disabled={loading}
          />
          <AuthInputBox
            label={t("auth.registerForm.passwordLabel")}
            value={password}
            name="new-password"
            autoComplete="new-password"
            onChange={(value) => {
              setPassword(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.registerForm.passwordPlaceholder")}
            passwordToggleable
            disabled={loading}
          />
          <AuthInputBox
            label={t("auth.registerForm.confirmPasswordLabel")}
            value={confirmPassword}
            name="confirm-password"
            autoComplete="new-password"
            onChange={(value) => {
              setConfirmPassword(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.registerForm.confirmPasswordPlaceholder")}
            passwordToggleable
            disabled={loading}
          />
          {error ? (
            <p className="text-type-danger text-sm">{error}</p>
          ) : null}
        </div>
        <LargeCardButtons>
          <Button theme="purple" type="submit" loading={loading}>
            {t("auth.registerForm.submit")}
          </Button>
        </LargeCardButtons>
      </form>
      <p className="text-center mt-6">
        <Trans i18nKey="auth.hasAccount">
          <MwLink to={loginHref}>.</MwLink>
        </Trans>
      </p>
    </LargeCard>
  );
}
