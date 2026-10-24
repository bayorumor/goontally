import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { equalsIgnoringCase } from "./match";

const MAX_FAILED_LOGINS = 5;
// Compared against when the email is unknown, so a miss takes as long as a
// wrong password and response times don't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);
const LOCKOUT_MS = 15 * 60 * 1000;

// Checks a password against the account, sharing one lockout between
// sign-in and "change password": too many misses in a row lock the account
// for a while, which keeps password guessing slow.
export async function checkPassword(
  user: {
    id: number;
    password: string;
    failedLogins: number;
    lockedUntil: Date | null;
  },
  password: string,
) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    // Same work as a real check, so a locked account doesn't answer faster.
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }

  if (!(await bcrypt.compare(password, user.password))) {
    const { failedLogins } = await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    if (failedLogins >= MAX_FAILED_LOGINS)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: 0,
          lockedUntil: new Date(Date.now() + LOCKOUT_MS),
        },
      });
    return false;
  }

  if (user.failedLogins || user.lockedUntil)
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  return true;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Both must be non-empty text: a JSON body could send objects.
        if (
          typeof credentials?.email !== "string" ||
          typeof credentials.password !== "string" ||
          !credentials.email ||
          !credentials.password
        )
          return null;

        const user = await prisma.user.findFirst({
          where: {
            email: equalsIgnoringCase(credentials.email.trim()),
          },
        });

        if (!user) {
          await bcrypt.compare(credentials.password, DUMMY_HASH);
          return null;
        }
        if (!(await checkPassword(user, credentials.password))) return null;
        // An unused temporary password expires; `npm run reset-password`
        // issues a fresh one.
        if (
          user.mustChangePassword &&
          user.passwordExpiresAt &&
          user.passwordExpiresAt < new Date()
        )
          return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.username,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.name = token.name;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
