import { auth } from "@/lib/auth"
import { seedAdminUser } from "@/lib/auth/seed-admin"
import { toNextJsHandler } from "better-auth/next-js"

seedAdminUser().catch(console.error)

export const { POST, GET } = toNextJsHandler(auth)
