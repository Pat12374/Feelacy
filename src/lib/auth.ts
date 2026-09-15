import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";
import { authSecret, isProduction } from "@/lib/security/env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      ageVerifiedAt?: string | null;
    };
  }

  interface User {
    role: Role;
    ageVerifiedAt?: Date | string | null;
    sessionVersion?: number;
  }
}

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const DUMMY_PASSWORD_HASH =
  "$2b$12$pSNdqFSjkExzCkpEjC9vlOuAq0GfWFEl//mAXgrb0iwAPpd/NSh86";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  secret: authSecret(),
  trustHost: !isProduction(),
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        const ok = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        if (!user?.passwordHash || !ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          ageVerifiedAt: user.ageVerifiedAt,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.ageVerifiedAt =
          user.ageVerifiedAt instanceof Date
            ? user.ageVerifiedAt.toISOString()
            : (user.ageVerifiedAt ?? null);
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      if (trigger === "update" && session?.ageVerifiedAt) {
        token.ageVerifiedAt = session.ageVerifiedAt;
      }
      // Re-check authorization and revocation state on every authenticated request.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, ageVerifiedAt: true, name: true, sessionVersion: true },
        });
        if (!dbUser || dbUser.sessionVersion !== Number(token.sessionVersion ?? 0)) {
          token.invalidated = true;
        } else {
          token.invalidated = false;
          token.role = dbUser.role as Role;
          token.ageVerifiedAt = dbUser.ageVerifiedAt?.toISOString() ?? null;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.invalidated ? "" : (token.id as string);
        session.user.role = token.role as Role;
        session.user.ageVerifiedAt =
          (token.ageVerifiedAt as string | null) ?? null;
        session.user.name =
          (token.name as string | null | undefined) ?? session.user.name;
      }
      return session;
    },
  },
});
