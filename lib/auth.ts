import config from "@/lib/config"
import { getUserByEmail, getUserById, SELF_HOSTED_USER } from "@/models/users"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { User } from "@/prisma/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { emailOTP } from "better-auth/plugins/email-otp"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./db"
import { resend, sendOTPCodeEmail } from "./email"

export type UserProfile = {
  id: string
  name: string
  email: string
  avatar?: string
  membershipPlan: string
  storageUsed: number
  storageLimit: number
  aiBalance: number
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  appName: config.app.title,
  baseURL: config.app.baseURL,
  secret: config.auth.secret,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  email: {
    provider: "resend",
    from: config.email.from,
    resend,
  },
  session: {
    strategy: "jwt",
    expiresIn: 180 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 365 * 24 * 60 * 60, // 365 days
    },
  },
  advanced: {
    cookiePrefix: "taxhacker",
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    emailOTP({
      disableSignUp: config.auth.disableSignup,
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes
      sendVerificationOTP: async ({ email, otp }) => {
        const user = await getUserByEmail(email)
        if (!user) {
          throw new APIError("NOT_FOUND", { message: "User with this email does not exist" })
        }
        await sendOTPCodeEmail({ email, otp })
      },
    }),
    nextCookies(), // make sure this is the last plugin in the array
  ],
})

export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  })
}

export async function getCurrentUser(): Promise<User> {
  // Try to return user from session
  const session = await getSession()
  if (session && session.user) {
    let user = await getUserById(session.user.id)
    if (user) {
      // Ensure user defaults exist (for newly registered users)
      if (await isDatabaseEmpty(user.id)) {
        await createUserDefaults(user.id)
      }
      // In self-hosted mode, ensure all users have unlimited membership
      if (config.selfHosted.isEnabled && user.membershipPlan !== "unlimited") {
        const { updateUser } = await import("@/models/users")
        user = await updateUser(user.id, { membershipPlan: "unlimited" })
      }
      return user
    }
  }

  // No session or user found
  redirect(config.auth.loginUrl)
}

export function isAdmin(user: User) {
  return user.email === config.auth.adminEmail
}

export function isSubscriptionExpired(user: User) {
  if (config.selfHosted.isEnabled) {
    return false
  }
  return user.membershipExpiresAt && user.membershipExpiresAt < new Date()
}

export function isAiBalanceExhausted(user: User) {
  if (config.selfHosted.isEnabled || user.membershipPlan === SELF_HOSTED_USER.membershipPlan) {
    return false
  }
  return user.aiBalance <= 0
}
