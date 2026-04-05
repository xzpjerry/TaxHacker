import LandingPage from "@/app/landing/landing"
import { getSession } from "@/lib/auth"
import config from "@/lib/config"
import { getSelfHostedUser } from "@/models/users"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getSession()
  if (session) {
    redirect("/dashboard")
  }

  if (config.selfHosted.isEnabled) {
    // Check if admin user exists; if not, go to setup
    const adminUser = await getSelfHostedUser()
    if (!adminUser) {
      redirect(config.selfHosted.welcomeUrl)
    }
    // Admin exists but no session — go to login
    redirect(config.auth.loginUrl)
  }

  return <LandingPage />
}

export const dynamic = "force-dynamic"
