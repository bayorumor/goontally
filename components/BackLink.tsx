import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 self-start text-[14px] font-medium text-muted hover:text-text"
    >
      <ArrowLeft size={16} /> {label}
    </Link>
  );
}
