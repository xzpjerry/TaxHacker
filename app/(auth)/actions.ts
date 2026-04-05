"use server"

import config from "@/lib/config"
import { auth } from "@/lib/auth"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { updateSettings } from "@/models/settings"
import { getSelfHostedUser, getOrCreateSelfHostedUser, SELF_HOSTED_USER } from "@/models/users"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function selfHostedGetStartedAction(formData: FormData) {
  let user = await getSelfHostedUser()

  if (!user) {
    // Create admin user via better-auth so Account record with hashed password is created
    try {
      await auth.api.signUpEmail({
        body: {
          name: SELF_HOSTED_USER.name,
          email: SELF_HOSTED_USER.email,
          password: config.auth.adminPassword,
        },
      })
    } catch {
      // User may already exist if there was a partial setup, fall back to direct creation
    }

    // Ensure the user record exists and has the right membership
    user = await getOrCreateSelfHostedUser()
  }

  if (await isDatabaseEmpty(user.id)) {
    await createUserDefaults(user.id)
  }

  const apiKeys = [
    "openai_api_key",
    "google_api_key",
    "mistral_api_key",
    "openai_compatible_api_key",
    "openai_compatible_base_url",
  ]

  for (const key of apiKeys) {
    const value = formData.get(key)
    if (value) {
      await updateSettings(user.id, key, value as string)
    }
  }

  const defaultCurrency = formData.get("default_currency")
  if (defaultCurrency) {
    await updateSettings(user.id, "default_currency", defaultCurrency as string)
  }

  revalidatePath("/enter")
  redirect("/enter")
}
