import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { hashPassword } from "better-auth/crypto"

export async function seedAdminUser() {
  if (!config.selfHosted.isEnabled) {
    return
  }

  const adminEmail = config.selfHosted.admin.email
  const adminPassword = config.selfHosted.admin.password

  if (!adminPassword) {
    console.warn(
      "SELF_HOSTED_ADMIN_PASSWORD is not set. Admin user will not be created. " +
      "Set the env var and restart to create the admin account."
    )
    return
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  if (existingUser) {
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: existingUser.id,
        providerId: "credential",
      },
    })
    if (existingAccount && existingAccount.password) {
      return
    }
    const hashedPassword = await hashPassword(adminPassword)
    await prisma.account.create({
      data: {
        id: `${existingUser.id}-credential-email`,
        accountId: `email-${adminEmail}`,
        providerId: "credential",
        userId: existingUser.id,
        password: hashedPassword,
      },
    })
    return
  }

  const adminName = "Self-Hosted Admin"
  const hashedPassword = await hashPassword(adminPassword)

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      name: adminName,
      emailVerified: true,
      membershipPlan: "unlimited",
    },
  })

  await prisma.account.create({
    data: {
      id: `${user.id}-credential-email`,
      accountId: `email-${adminEmail}`,
      providerId: "credential",
      userId: user.id,
      password: hashedPassword,
    },
  })

  console.log(`Admin user seeded: ${adminEmail}`)
}
