"use server"

import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { hashPassword } from "better-auth/crypto"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

function assertAdmin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (user.email !== config.selfHosted.admin.email) {
    throw new Error("You are not authorized to manage users")
  }
}

export async function getUsersAction() {
  const user = await getCurrentUser()
  assertAdmin(user)

  return await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      membershipPlan: true,
    },
    orderBy: { createdAt: "asc" },
  })
}

export async function createUserAction({
  name,
  email,
  password,
}: {
  name: string
  email: string
  password: string
}) {
  const user = await getCurrentUser()
  assertAdmin(user)

  const normalizedEmail = email.toLowerCase()

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    throw new Error("A user with this email already exists")
  }

  const hashedPassword = await hashPassword(password)

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      emailVerified: true,
      membershipPlan: "unlimited",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: `email-${normalizedEmail}`,
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
  })

  revalidatePath("/settings/admin")
}

export async function deleteUserAction({ userId }: { userId: string }) {
  const user = await getCurrentUser()
  assertAdmin(user)

  if (userId === user.id) {
    throw new Error("You cannot delete your own account")
  }

  await prisma.user.delete({ where: { id: userId } })

  revalidatePath("/settings/admin")
}

export async function resetUserPasswordAction({
  userId,
  newPassword,
}: {
  userId: string
  newPassword: string
}) {
  const user = await getCurrentUser()
  assertAdmin(user)

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    throw new Error("User not found")
  }

  const hashedPassword = await hashPassword(newPassword)

  const existingAccount = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential",
    },
  })

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    })
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: `email-${targetUser.email}`,
        providerId: "credential",
        userId,
        password: hashedPassword,
      },
    })
  }

  revalidatePath("/settings/admin")
}
