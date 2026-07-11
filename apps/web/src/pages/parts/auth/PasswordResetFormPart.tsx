import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/buttons/Button";
import { BrandPill } from "@/components/layout/BrandPill";
import {
  LargeCard,
  LargeCardButtons,
  LargeCardText,
} from "@/components/layout/LargeCard";
import { MwLink } from "@/components/text/Link";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { authClient } from "@/lib/auth-client";
import { PageTitle } from "@/pages/parts/util/PageTitle";

interface PasswordResetFormPartProps {
  onBack: () => void;
}

export function PasswordResetFormPart({ onBack }: PasswordResetFormPartProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError(
        t("auth.resetPassword.errorRequired") || "Email is required",
      );
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/login`,
      });

      if (result.error) {
        throw new Error(
          result.error.message ||
            t("auth.resetPassword.errorGeneric") ||
            "Failed to request password reset",
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("auth.resetPassword.errorGeneric") ||
              "Failed to request password reset",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageTitle subpage k="global.pages.passwordReset" />
      <LargeCard top={<BrandPill backgroundClass="bg-[#161527]" />}>
      <form onSubmit={handleSubmit}>
        <LargeCardText title={t("auth.resetPassword.title")}>
          {t("auth.resetPassword.description")}
        </LargeCardText>
        <div className="space-y-4">
          <AuthInputBox
            label={t("auth.resetPassword.emailLabel")}
            value={email}
            name="email"
            autoComplete="email"
            onChange={(value) => {
              setEmail(value);
              if (error) setError(null);
            }}
            placeholder={t("auth.resetPassword.emailPlaceholder")}
            disabled={loading}
          />
          {error ? (
            <p className="text-type-danger text-sm">{error}</p>
          ) : null}
          {success ? (
            <p className="text-type-success text-sm">
              {t("auth.resetPassword.success") ||
                "If an account exists for that email, a reset link has been sent."}
            </p>
          ) : null}
        </div>
        <LargeCardButtons>
          <Button theme="purple" type="submit" loading={loading}>
            {t("auth.resetPassword.submit")}
          </Button>
        </LargeCardButtons>
      </form>
      <p className="text-center mt-6">
        <MwLink onClick={onBack}>{t("auth.resetPassword.backToLogin")}</MwLink>
      </p>
    </LargeCard>
    </>
  );
}
