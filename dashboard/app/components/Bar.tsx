import type { ReactNode } from "react";

type BarProps = {
  children?: ReactNode;
  className?: string;
};

export default function Bar({ children, className = "" }: BarProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-0 px-0 py-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#B7B7B7_100%)] ${className}`}
    >
      {children}
    </div>
  );
}
