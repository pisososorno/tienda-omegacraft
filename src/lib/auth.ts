import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
          include: { sellerProfile: { select: { id: true, status: true } } },
        });

        if (!admin) return null;
        if (admin.disabledAt) return null;

        const valid = await compare(credentials.password, admin.passwordHash);
        if (!valid) return null;

        // Update last login
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          sellerId: admin.sellerProfile?.id || null,
          sellerStatus: admin.sellerProfile?.status || null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        (token as Record<string, unknown>).role = (user as unknown as Record<string, unknown>).role;
        (token as Record<string, unknown>).sellerId = (user as unknown as Record<string, unknown>).sellerId;
        (token as Record<string, unknown>).sellerStatus = (user as unknown as Record<string, unknown>).sellerStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const u = session.user as Record<string, unknown>;
        u.id = token.id;
        u.role = (token as Record<string, unknown>).role;
        u.sellerId = (token as Record<string, unknown>).sellerId;
        u.sellerStatus = (token as Record<string, unknown>).sellerStatus;
      }
      return session;
    },
  },
};
