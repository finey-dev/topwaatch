import classNames from "classnames";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Icon, Icons } from "@/components/Icon";
import { Transition } from "@/components/utils/Transition";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  getUserInitialFaceAvatarUrl,
  isUserLoggedIn,
} from "@/mocks/userProfile";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";

function Divider() {
  return <hr className="border-0 w-full h-px bg-dropdown-border" />;
}

function GoToLink(props: {
  children: React.ReactNode;
  href?: string;
  className?: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();

  const goTo = (href: string) => {
    if (href.startsWith("http")) {
      window.open(href, "_blank");
    } else {
      window.scrollTo(0, 0);
      navigate(href);
    }
  };

  return (
    <a
      tabIndex={0}
      href={props.href}
      onClick={(evt) => {
        evt.preventDefault();
        if (props.href) goTo(props.href);
        else props.onClick?.();
      }}
      className={props.className}
    >
      {props.children}
    </a>
  );
}

function DropdownLink(props: {
  children: React.ReactNode;
  href?: string;
  icon?: Icons;
  highlight?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <GoToLink
      onClick={props.onClick}
      href={props.href}
      className={classNames(
        "tabbable cursor-pointer flex gap-3 items-center m-3 p-1 rounded font-medium transition-colors duration-100",
        props.highlight
          ? "text-dropdown-highlight hover:text-dropdown-highlightHover"
          : "text-dropdown-text hover:text-white",
        props.className,
      )}
    >
      {props.icon ? <Icon icon={props.icon} className="text-xl" /> : null}
      {props.children}
    </GoToLink>
  );
}

function MenuUserSection(props: { isLoggedIn: boolean }) {
  const { t } = useTranslation();
  const account = useAuthStore((s) => s.account);
  const displayName = account?.nickname || "User";
  const photoUrl = account?.image?.trim() || null;
  const avatarUrl =
    photoUrl || getUserInitialFaceAvatarUrl(displayName);

  if (!props.isLoggedIn) {
    return (
      <DropdownLink href="/login" icon={Icons.RISING_STAR} highlight>
        {t("navigation.menu.login")}
      </DropdownLink>
    );
  }

  return (
    <GoToLink
      href="/settings"
      className="tabbable cursor-pointer block m-3 p-3 rounded-lg bg-dropdown-contentBackground transition-colors duration-100 hover:bg-opacity-80"
    >
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl}
          alt=""
          className="w-12 h-12 rounded-full shrink-0 object-cover bg-dropdown-altBackground"
        />
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{displayName}</p>
          <p className="text-dropdown-text text-sm truncate">
            {t("navigation.menu.settings")}
          </p>
        </div>
      </div>
    </GoToLink>
  );
}

export function LinksDropdown(props: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const account = useAuthStore((s) => s.account);
  const isLoggedIn = isUserLoggedIn(!!account);
  const { logout } = useAuth();

  useEffect(() => {
    function onWindowClick(evt: MouseEvent) {
      if ((evt.target as HTMLElement).closest(".is-dropdown")) return;
      setOpen(false);
    }

    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((s) => !s);
  }, []);

  const enableLowPerformanceMode = usePreferencesStore(
    (s) => s.enableLowPerformanceMode,
  );

  return (
    <div className="relative is-dropdown">
      <div
        className={classNames(
          "cursor-pointer tabbable rounded-full flex gap-2 text-white items-center py-2 px-3 bg-pill-background hover:bg-pill-backgroundHover backdrop-blur-lg transition-all duration-100 hover:scale-105",
          open ? "bg-opacity-100" : "bg-opacity-50",
        )}
        tabIndex={0}
        onClick={toggleOpen}
        onKeyUp={(evt) => evt.key === "Enter" && toggleOpen()}
      >
        {props.children}
        <Icon
          className={classNames(
            "text-xl transition-transform duration-100",
            open ? "rotate-180" : "",
          )}
          icon={Icons.CHEVRON_DOWN}
        />
      </div>
      <Transition animation="slide-down" show={open}>
        <div className="rounded-xl absolute w-64 bg-dropdown-altBackground top-full mt-3 right-0">
          <MenuUserSection isLoggedIn={isLoggedIn} />
          <Divider />
          {isLoggedIn ? (
            <DropdownLink href="/settings" icon={Icons.SETTINGS}>
              {t("navigation.menu.settings")}
            </DropdownLink>
          ) : null}
          <DropdownLink href="/about" icon={Icons.CIRCLE_QUESTION}>
            {t("navigation.menu.about")}
          </DropdownLink>
          {!enableLowPerformanceMode && (
            <DropdownLink href="/discover" icon={Icons.RISING_STAR}>
              {t("navigation.menu.discover")}
            </DropdownLink>
          )}
          {isLoggedIn ? (
            <>
              <Divider />
              <div className="px-3 pb-4 pt-1">
                <button
                  type="button"
                  className="tabbable w-full flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 font-medium text-type-danger bg-dropdown-contentBackground hover:bg-opacity-80 transition-colors duration-100"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                >
                  <Icon icon={Icons.LOGOUT} className="text-lg" />
                  {t("navigation.menu.logout")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Transition>
    </div>
  );
}
