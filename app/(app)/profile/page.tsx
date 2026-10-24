import Link from "next/link";
import {
  ChartNoAxesColumn,
  ChevronRight,
  History,
  KeyRound,
} from "lucide-react";
import { requireUserId } from "@/lib/api";
import { getUser } from "@/lib/queries";
import { SQUARE_ASPECT } from "@/lib/image";
import Avatar from "@/components/ui/Avatar";
import PhotoUploader from "@/components/PhotoUploader";
import LogoutButton from "@/components/LogoutButton";

export default async function ProfilePage() {
  const userId = await requireUserId();
  const user = await getUser(userId);
  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="relative">
          <Avatar src={user.avatar} name={user.username} size={112} />
          <PhotoUploader
            endpoint="/api/profile"
            field="avatar"
            aspect={SQUARE_ASPECT}
            title="Change avatar"
          />
        </div>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">
            {user.username}
          </h1>
          <p className="text-[14px] text-muted">{user.email}</p>
        </div>
      </div>

      <nav className="card divide-y divide-border overflow-hidden">
        {[
          { href: "/insights", label: "Insights", icon: ChartNoAxesColumn },
          { href: "/history", label: "History", icon: History },
          {
            href: "/change-password",
            label: "Change password",
            icon: KeyRound,
          },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2"
          >
            <Icon size={18} className="text-muted" />
            <span className="flex-1 text-[15px] font-medium">{label}</span>
            <ChevronRight size={18} className="text-subtle" />
          </Link>
        ))}
      </nav>

      <LogoutButton />
    </div>
  );
}
