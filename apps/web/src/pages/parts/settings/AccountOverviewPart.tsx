import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAsyncFn } from "react-use";

import { getSessions, SessionResponse } from "@/backend/accounts/sessions";
import {
  deactivateUser,
  deleteUser,
  getUser,
} from "@/backend/accounts/user";
import { Button } from "@/components/buttons/Button";
import { Icon, Icons } from "@/components/Icon";
import { Loading } from "@/components/layout/Loading";
import { SettingsCard } from "@/components/layout/SettingsCard";
import { Modal, ModalCard, useModal } from "@/components/overlays/Modal";
import { AuthInputBox } from "@/components/text-inputs/AuthInputBox";
import { SecondaryLabel } from "@/components/text/SecondaryLabel";
import { Heading2, Heading3, Paragraph } from "@/components/utils/Text";
import { useAuth } from "@/hooks/auth/useAuth";
import { useBackendUrl } from "@/hooks/auth/useBackendUrl";
import { AccountWithToken, useAuthStore } from "@/stores/auth";

function formatDateTime(value: string | undefined, locale: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SessionRow(props: {
  name: string;
  accessedAt?: string;
  createdAt?: string;
  isCurrent?: boolean;
  locale: string;
}) {
  const { t } = useTranslation();

  return (
    <SettingsCard
      className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
      paddingClass="px-6 py-4"
    >
      <div className="font-medium min-w-0">
        <SecondaryLabel>
          {t("settings.account.devices.deviceNameLabel")}
          {props.isCurrent
            ? ` · ${t("settings.account.overview.currentSession", "Current")}`
            : ""}
        </SecondaryLabel>
        <p className="text-white truncate">{props.name}</p>
      </div>
      <div className="text-sm text-type-secondary sm:text-right shrink-0">
        <p>
          {t("settings.account.overview.lastActive", "Last active")}
          {": "}
          {formatDateTime(props.accessedAt, props.locale)}
        </p>
        {props.createdAt ? (
          <p className="opacity-80">
            {t("settings.account.overview.signedIn", "Signed in")}
            {": "}
            {formatDateTime(props.createdAt, props.locale)}
          </p>
        ) : null}
      </div>
    </SettingsCard>
  );
}

export function AccountOverviewPart(props: { account: AccountWithToken }) {
  const { t, i18n } = useTranslation();
  const url = useBackendUrl();
  const { logout } = useAuth();
  const account = props.account;
  const currentSessionId = useAuthStore((s) => s.account?.sessionId);
  const deleteModal = useModal("account-delete-confirm");
  const deactivateModal = useModal("account-deactivate-confirm");
  const [email, setEmail] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [sessionsResult, execSessions] = useAsyncFn(async () => {
    if (!url) return [] as SessionResponse[];
    return getSessions(url, account);
  }, [account, url]);

  useEffect(() => {
    execSessions();
  }, [execSessions]);

  useEffect(() => {
    let cancelled = false;
    getUser()
      .then(({ user }) => {
        if (!cancelled) setEmail(user.namespace || null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account.userId]);

  const [deleteResult, deleteExec] = useAsyncFn(async () => {
    if (!account || !url || !email) return;
    setActionError(null);
    try {
      await deleteUser(url, account, confirmEmail.trim());
      deleteModal.hide();
      setConfirmEmail("");
      await logout();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : t(
              "settings.account.actions.delete.error",
              "Could not delete your account. Please try again.",
            ),
      );
    }
  }, [account, url, email, confirmEmail, deleteModal, logout, t]);

  const [deactivateResult, deactivateExec] = useAsyncFn(async () => {
    setActionError(null);
    try {
      await deactivateUser();
      deactivateModal.hide();
      await logout();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : t(
              "settings.account.actions.deactivate.error",
              "Could not deactivate your account. Please try again.",
            ),
      );
    }
  }, [deactivateModal, logout, t]);

  const sessions = sessionsResult.value ?? [];
  const locale = i18n.language || "en";

  const lastLoginAt = useMemo(() => {
    if (sessions.length === 0) return undefined;
    const current = sessions.find((s) => s.id === currentSessionId);
    if (current?.accessedAt) return current.accessedAt;
    return sessions
      .map((s) => s.accessedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [sessions, currentSessionId]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.id === currentSessionId) return -1;
      if (b.id === currentSessionId) return 1;
      return (
        new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
      );
    });
  }, [sessions, currentSessionId]);

  const hasProfilePhoto = Boolean(account.image);
  const emailMatches =
    Boolean(email) &&
    confirmEmail.trim().toLowerCase() === email!.trim().toLowerCase();

  return (
    <div className="space-y-10 mt-6">
      <SettingsCard paddingClass="px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
          {hasProfilePhoto ? (
            <img
              src={account.image!}
              alt=""
              className="h-20 w-20 rounded-full object-cover border border-settings-card-border shrink-0"
            />
          ) : null}
          <div className="min-w-0 space-y-3 flex-1">
            <div>
              <SecondaryLabel>
                {t("settings.account.overview.signedInAs", "Signed in as")}
              </SecondaryLabel>
              <Heading3 className="!mt-1 !mb-0 truncate">
                {account.nickname || t("settings.account.overview.unnamed", "User")}
              </Heading3>
              {email ? (
                <p className="text-type-secondary truncate mt-1">{email}</p>
              ) : null}
            </div>
            <div>
              <SecondaryLabel>
                {t("settings.account.overview.lastLogin", "Last login")}
              </SecondaryLabel>
              <p className="text-white mt-1">
                {formatDateTime(lastLoginAt, locale)}
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      <div>
        <Heading2 border className="mt-0 mb-6">
          {t("settings.account.devices.title")}
        </Heading2>
        {sessionsResult.loading ? (
          <Loading />
        ) : sessionsResult.error && sortedSessions.length === 0 ? (
          <p>{t("settings.account.devices.failed")}</p>
        ) : sortedSessions.length === 0 ? (
          <p className="text-type-secondary">
            {t(
              "settings.account.overview.noSessions",
              "No active sessions found.",
            )}
          </p>
        ) : (
          <div className="space-y-4">
            {sortedSessions.map((session) => (
              <SessionRow
                key={session.id}
                name={
                  session.device ||
                  session.userAgent ||
                  t("settings.account.devices.unknownDevice")
                }
                accessedAt={session.accessedAt}
                createdAt={session.createdAt}
                isCurrent={session.id === currentSessionId}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <Heading2 border className="mt-0 mb-6">
          {t("settings.account.actions.title")}
        </Heading2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            theme="danger"
            onClick={() => {
              setActionError(null);
              deactivateModal.show();
            }}
          >
            {t("settings.account.actions.deactivate.button")}
          </Button>
          <Button
            theme="danger"
            onClick={() => {
              setActionError(null);
              setConfirmEmail("");
              deleteModal.show();
            }}
          >
            {t("settings.account.actions.delete.button")}
          </Button>
        </div>
      </div>

      <Modal id={deleteModal.id}>
        <ModalCard>
          <Heading2 className="!mt-0">
            {t("settings.account.actions.delete.confirmTitle")}
          </Heading2>
          <Paragraph>
            {t("settings.account.actions.delete.confirmDescription")}
          </Paragraph>
          <div className="mt-4 space-y-2">
            <AuthInputBox
              label={t("settings.account.actions.delete.confirmEmailLabel")}
              placeholder={email ?? "you@example.com"}
              value={confirmEmail}
              onChange={setConfirmEmail}
              autoComplete="email"
            />
            <p className="text-sm text-type-secondary">
              {t("settings.account.actions.delete.confirmEmailHint")}
            </p>
          </div>
          {actionError ? (
            <p className="text-sm text-red-400 mt-3 flex items-start gap-2">
              <Icon icon={Icons.WARNING} className="mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </p>
          ) : null}
          <div className="flex gap-4 mt-4 justify-end">
            <Button
              theme="secondary"
              onClick={() => {
                setConfirmEmail("");
                setActionError(null);
                deleteModal.hide();
              }}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              theme="danger"
              loading={deleteResult.loading}
              disabled={!emailMatches}
              onClick={deleteExec}
            >
              {t("settings.account.actions.delete.confirmButton")}
            </Button>
          </div>
        </ModalCard>
      </Modal>

      <Modal id={deactivateModal.id}>
        <ModalCard>
          <Heading2 className="!mt-0">
            {t("settings.account.actions.deactivate.confirmTitle")}
          </Heading2>
          <Paragraph>
            {t("settings.account.actions.deactivate.confirmDescription")}
          </Paragraph>
          {actionError ? (
            <p className="text-sm text-red-400 mt-3 flex items-start gap-2">
              <Icon icon={Icons.WARNING} className="mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </p>
          ) : null}
          <div className="flex gap-4 mt-4 justify-end">
            <Button
              theme="secondary"
              onClick={() => {
                setActionError(null);
                deactivateModal.hide();
              }}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              theme="danger"
              loading={deactivateResult.loading}
              onClick={deactivateExec}
            >
              {t("settings.account.actions.deactivate.confirmButton")}
            </Button>
          </div>
        </ModalCard>
      </Modal>
    </div>
  );
}
