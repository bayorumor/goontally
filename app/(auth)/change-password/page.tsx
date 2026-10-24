import { redirect } from "next/navigation";
import { getSession, getViewer } from "@/lib/api";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const [viewer, session] = await Promise.all([getViewer(), getSession()]);
  if (!viewer || !session?.user.email) redirect("/login");

  return (
    <ChangePasswordForm
      email={session.user.email}
      forced={viewer.mustChangePassword}
    />
  );
}
