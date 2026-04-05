import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"

export async function GET() {
  try {
    const user = await getCurrentUser()
    const settings = await prisma.setting.findMany({
      where: { userId: user.id },
      take: 1,
    })

    if (settings.length > 0) {
      redirect("/dashboard")
    }
  } catch {
    redirect(config.auth.loginUrl)
  }

  redirect(config.selfHosted.welcomeUrl!)
}

export const dynamic = "force-dynamic"