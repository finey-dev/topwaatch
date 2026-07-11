import classNames from "classnames";
import { ReactNode, useCallback } from "react";
import { Link } from "react-router-dom";

import { Icon, Icons } from "@/components/Icon";
import { Spinner } from "@/components/layout/Spinner";

interface Props {
  icon?: Icons;
  onClick?: (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement, MouseEvent>,
  ) => void;
  children?: ReactNode;
  theme?: "white" | "purple" | "secondary" | "danger" | "glass";
  padding?: string;
  className?: string;
  href?: string;
  disabled?: boolean;
  download?: string;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}

export function Button(props: Props) {
  const { onClick, href, loading } = props;
  const disabled = Boolean(props.disabled || loading);
  const cb = useCallback(
    (
      event: React.MouseEvent<
        HTMLAnchorElement | HTMLButtonElement,
        MouseEvent
      >,
    ) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      if (href && !onClick && href.includes("http")) {
        event.preventDefault();
        window.open(href, "_blank", "noreferrer");
      } else onClick?.(event);
    },
    [disabled, href, onClick],
  );

  let colorClasses = "bg-white hover:bg-gray-200 text-black";
  if (props.theme === "purple")
    colorClasses =
      "bg-buttons-purple hover:bg-buttons-purpleHover text-white gap-2";
  if (props.theme === "secondary")
    colorClasses =
      "bg-buttons-cancel hover:bg-buttons-cancelHover transition-colors duration-100 text-white gap-2";
  if (props.theme === "danger")
    colorClasses =
      "bg-buttons-danger hover:bg-buttons-dangerHover text-white gap-2";

  let classes = classNames(
    "tabbable cursor-pointer inline-flex items-center justify-center rounded-lg font-medium transition-[transform,background-color] duration-100 active:scale-105 md:px-8",
    props.padding ?? "px-4 py-3",
    props.className,
    colorClasses,
    disabled ? "!cursor-not-allowed bg-opacity-60 text-opacity-60" : null,
  );

  if (disabled)
    classes = classes
      .split(" ")
      .filter(
        (className) =>
          !className.startsWith("hover:") && !className.startsWith("active:"),
      )
      .join(" ");

  const content = (
    <>
      {props.icon && !props.loading ? (
        <span className="mr-3 hidden md:inline-block">
          <Icon icon={props.icon} />
        </span>
      ) : null}
      {props.loading ? (
        <span className="mr-3 inline-flex justify-center items-center">
          <Spinner className="text-lg" />
        </span>
      ) : null}
      {props.children}
    </>
  );

  if (
    props.href &&
    (props.href.startsWith("https://") || props.href?.startsWith("data:"))
  )
    return (
      <a
        className={classes}
        href={props.href}
        target="_blank"
        rel="noreferrer"
        download={props.download}
        onClick={cb}
        aria-disabled={disabled}
      >
        {content}
      </a>
    );

  if (
    props.href &&
    !props.href.includes("http") &&
    !props.href.startsWith("data:")
  )
    return (
      <Link
        className={classes}
        to={props.href}
        onClick={cb}
        aria-disabled={disabled}
      >
        {content}
      </Link>
    );

  return (
    <button
      type={props.type ?? "button"}
      onClick={cb}
      className={classes}
      disabled={disabled}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}

// Sometimes you can't use normal button, due to not having access to a useHistory context
// When that happens, use this!
interface ButtonPlainProps {
  onClick?: () => void;
  children?: ReactNode;
  theme?: "white" | "purple" | "secondary";
  className?: string;
}

export function ButtonPlain(props: ButtonPlainProps) {
  let colorClasses = "bg-white hover:bg-gray-200 text-black";
  if (props.theme === "purple")
    colorClasses = "bg-buttons-purple hover:bg-buttons-purpleHover text-white";
  if (props.theme === "secondary")
    colorClasses =
      "bg-buttons-cancel hover:bg-buttons-cancelHover transition-colors duration-100 text-white";

  const classes = classNames(
    "cursor-pointer inline-flex items-center justify-center rounded-lg font-medium transition-[transform,background-color] duration-100 active:scale-105 md:px-8",
    "px-4 py-3",
    props.className,
    colorClasses,
  );

  return (
    <button type="button" onClick={props.onClick} className={classes}>
      {props.children}
    </button>
  );
}
