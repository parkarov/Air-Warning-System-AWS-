import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  // When set, renders a link to this page instead of a <button>.
  href?: string;
};

export default function Button({
  children,
  className = "",
  href,
  ...props
}: ButtonProps) {
  const styles = `flex h-full flex-1 max-w-64 text-[length:min(3vh,5vw)] items-center justify-center px-3 cursor-pointer hover:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(203,202,202,0.5)_30%,rgba(101,100,100,0.5)_99.99%)] ${className}`;

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button className={styles} {...props}>
      {children}
    </button>
  );
}
