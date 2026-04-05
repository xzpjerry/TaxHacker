import config from "@/lib/config"
import { getSession } from "@/lib/auth"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { getSelfHostedUser } from "@/models/users"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function GET() {
  if (!config.selfHosted.isEnabled) {
    redirect(config.auth.loginUrl)
  }

  const user = await getSelfHostedUser()
  if (!user) {
    redirect(config.selfHosted.welcomeUrl)
  }

  // Check if the user has an active session
  const session = await getSession()
  if (!session) {
    redirect(config.auth.loginUrl)
  }

  if (await isDatabaseEmpty(user.id)) {
    await createUserDefaults(user.id)
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
