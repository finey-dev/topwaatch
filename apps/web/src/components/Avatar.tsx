import classNames from "classnames";
import { useTranslation } from "react-i18next";

import { Icon, Icons } from "@/components/Icon";
import { UserIcon } from "@/components/UserIcon";
import { AccountProfile } from "@/pages/parts/auth/AccountCreatePart";
import { getUserInitialFaceAvatarUrl } from "@/mocks/userProfile";
import { useAuthStore } from "@/stores/auth";

export interface AvatarProps {
  profile: AccountProfile["profile"];
  sizeClass?: string;
  iconClass?: string;
  bottom?: React.ReactNode;
}

/** Gradient + icon avatar used in account creation / settings previews */
export function Avatar(props: AvatarProps) {
  return (
    <div className="relative inline-block">
      <div
        className={classNames(
          props.sizeClass,
          "rounded-full overflow-hidden flex items-center justify-center text-white",
        )}
        style={{
          background: `linear-gradient(to bottom right, ${props.profile.colorA}, ${props.profile.colorB})`,
        }}
      >
        <UserIcon
          className={props.iconClass}
          icon={props.profile.icon as any}
        />
      </div>
      {props.bottom ? (
        <div className="absolute bottom-0 left-1/2 transform translate-y-1/2 -translate-x-1/2">
          {props.bottom}
        </div>
      ) : null}
    </div>
  );
}

export function UserAvatar(props: {
  sizeClass?: string;
  iconClass?: string;
  bottom?: React.ReactNode;
  withName?: boolean;
}) {
  const auth = useAuthStore();
  const { t } = useTranslation();

  if (!auth.account) return null;

  const displayName =
    auth.account.nickname ||
    auth.account.deviceName ||
    t("settings.account.devices.unknownDevice");

  const photoUrl = auth.account.image?.trim() || null;
  const avatarUrl = photoUrl || getUserInitialFaceAvatarUrl(displayName);
  const sizeClass =
    props.sizeClass ?? "w-[1.5rem] h-[1.5rem] ssm:w-[2rem] ssm:h-[2rem]";

  return (
    <>
      <div className="relative inline-block">
        <img
          src={avatarUrl}
          alt=""
          className={classNames(
            sizeClass,
            "rounded-full object-cover bg-pill-background",
          )}
        />
        {props.bottom ? (
          <div className="absolute bottom-0 left-1/2 transform translate-y-1/2 -translate-x-1/2">
            {props.bottom}
          </div>
        ) : null}
      </div>
      {props.withName ? (
        <span className="hidden md:inline-block">
          {displayName.length >= 20
            ? `${displayName.slice(0, 20 - 1)}…`
            : displayName}
        </span>
      ) : null}
    </>
  );
}

export function NoUserAvatar(props: { iconClass?: string }) {
  return (
    <div className="relative inline-block p-1 text-type-dimmed">
      <Icon
        className={props.iconClass ?? "text-base ssm:text-xl"}
        icon={Icons.MENU}
      />
    </div>
  );
}
