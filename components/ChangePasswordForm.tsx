"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/constants";

interface Props {
  email: string;
  // True when the account still has a password someone else set.
  forced: boolean;
}

export default function ChangePasswordForm({ email, forced }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement).value;
    const currentPassword = value("current");
    const newPassword = value("new");

    if (newPassword.length < PASSWORD_MIN) {
      setError(`Use at least ${PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword !== value("confirm")) {
      setError("The new passwords don't match");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || `Couldn't change it (${res.status})`);
        return;
      }
      // The change signs out every session, this one included; sign straight
      // back in with the new password.
      const again = await signIn("credentials", {
        email,
        password: newPassword,
        redirect: false,
      });
      if (again?.error) {
        router.push("/login");
        return;
      }
      router.push(forced ? "/" : "/profile");
      router.refresh();
    } catch {
      setError("Couldn't change it. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="card flex flex-col gap-6 p-6">
        <div className="text-center">
          <h1 className="text-[26px] font-bold tracking-tight">
            {forced ? "Pick your password" : "Change password"}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {forced
              ? "You signed in with a temporary password. Choose your own to continue."
              : "You'll stay signed in here; other devices are signed out."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-[14px] text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-col">
            <label className="label" htmlFor="current">
              {forced ? "Temporary password" : "Current password"}
            </label>
            <input
              className="input"
              id="current"
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="flex flex-col">
            <label className="label" htmlFor="new">
              New password
            </label>
            <input
              className="input"
              id="new"
              name="new"
              type="password"
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              autoComplete="new-password"
            />
            <p className="mt-1.5 text-[12px] text-muted">
              At least {PASSWORD_MIN} characters.
            </p>
          </div>

          <div className="flex flex-col">
            <label className="label" htmlFor="confirm">
              Repeat new password
            </label>
            <input
              className="input"
              id="confirm"
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block mt-2"
            disabled={saving}
          >
            {saving ? "Saving…" : forced ? "Save and continue" : "Save"}
          </button>
        </form>

        {forced ? (
          <button
            className="text-center text-[14px] text-muted hover:text-text"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Log out
          </button>
        ) : (
          <Link
            href="/profile"
            className="text-center text-[14px] text-muted hover:text-text"
          >
            Cancel
          </Link>
        )}
      </div>
    </div>
  );
}
