"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      className="btn btn-secondary btn-block"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut size={17} /> Log out
    </button>
  );
}
