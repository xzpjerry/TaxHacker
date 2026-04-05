# Self-Hosted Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the zero-auth self-hosted mode with proper password-based authentication and admin-managed user accounts.

**Architecture:** Add better-auth's email-password plugin for self-hosted login. Admin user is seeded on startup from env vars. Admin creates/manages other users via a settings page. Cloud mode's OTP flow is untouched.

**Tech Stack:** Next.js 15 (App Router), better-auth, React 19, Prisma, shadcn/ui, server actions

---

### Task 1: Add env variables

**Files:**
- Modify: `.env.example`
- Modify: `lib/config.ts`

- [ ] **Step 1: Update `.env.example`**

Add these two lines after the existing `SELF_HOSTED_MODE=true` block:
```
# Self-Hosted Admin User (required when SELF_HOSTED_MODE=true)
SELF_HOSTED_ADMIN_EMAIL="taxhacker@localhost"
SELF_HOSTED_ADMIN_PASSWORD=""  # "your-secure-password"
```

- [ ] **Step 2: Update `lib/config.ts`**

Add to the `envSchema`:
```typescript
SELF_HOSTED_ADMIN_EMAIL: z.string().default("taxhacker@localhost"),
SELF_HOSTED_ADMIN_PASSWORD: z.string().default(""),
```

Add to the `config.selfHosted` section:
```typescript
admin: {
  email: env.SELF_HOSTED_ADMIN_EMAIL,
  password: env.SELF_HOSTED_ADMIN_PASSWORD,
},
```

- [ ] **Step 3: Commit**

```bash
git add .env.example lib/config.ts
git commit -m "feat: add self-hosted admin env variables"
```

---

### Task 2: Add email-password auth client plugin

**Files:**
- Modify: `lib/auth-client.ts`

- [ ] **Step 1: Replace the contents of `lib/auth-client.ts`**

```typescript
import { createAuthClient } from "better-auth/client"
import { emailOTPClient, emailPasswordClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    emailPasswordClient(),
  ],
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth-client.ts
git commit -m "feat: add email-password auth client plugin"
```

---

### Task 3: Update auth backend with email-password plugin and seeded admin user

**Files:**
- Modify: `lib/auth.ts`
- Create: `lib/auth/seed-admin.ts`
- Modify: `app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create `lib/auth/seed-admin.ts`**

Uses better-auth's `hashPassword` internally to store the password in the Account table.

```typescript
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
    // User exists, ensure account with password also exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: existingUser.id,
        providerId: "credential",
      },
    })
    if (existingAccount && existingAccount.password) {
      return
    }
    // User was created via email OTP or other means — add credential account
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
```

- [ ] **Step 2: Update `lib/auth.ts`**

Add import:
```typescript
import { emailAndPassword } from "better-auth/plugins"
```

Update the plugins array — add `emailAndPassword()` between `emailOTP` and `nextCookies`:

```typescript
plugins: [
  emailOTP({
    disableSignUp: config.auth.disableSignup,
    otpLength: 6,
    expiresIn: 10 * 60,
    sendVerificationOTP: async ({ email, otp }) => {
      const user = await getUserByEmail(email)
      if (!user) {
        throw new APIError("NOT_FOUND", { message: "User with this email does not exist" })
      }
      await sendOTPCodeEmail({ email, otp })
    },
  }),
  emailAndPassword({
    requireEmailVerification: false,
    allowSignUp: !config.auth.disableSignup,
  }),
  nextCookies(),
],
```

Replace `getSession()` — remove the self-hosted bypass:
```typescript
export async function getSession() {
  return await auth.api.getSession({
    headers: await headers(),
  })
}
```

Replace `getCurrentUser()` — same logic for both modes now:
```typescript
export async function getCurrentUser(): Promise<User> {
  const session = await getSession()
  if (session && session.user) {
    const user = await getUserById(session.user.id)
    if (user) {
      return user
    }
  }

  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.redirectUrl)
  }

  redirect(config.auth.loginUrl)
}
```

Remove unused imports at the top: `getSelfHostedUser`, `SELF_HOSTED_USER` (no longer needed since `getSession` doesn't reference them). Also remove the `getSelfHostedUser` from the imports list since it's still exported from users.ts but not used in auth.ts anymore.

The imports at the top of `lib/auth.ts` become:
```typescript
import config from "@/lib/config"
import { getUserByEmail, getUserById } from "@/models/users"
import { User } from "@/prisma/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { emailOTP } from "better-auth/plugins/email-otp"
import { emailAndPassword } from "better-auth/plugins"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./db"
import { resend, sendOTPCodeEmail } from "./email"
```

- [ ] **Step 3: Update auth route handler**

Update `app/api/auth/[...all]/route.ts` to call `seedAdminUser()` on each startup (Next.js dev server will call the GET handler).

```typescript
import { auth } from "@/lib/auth"
import { seedAdminUser } from "@/lib/auth/seed-admin"
import { toNextJsHandler } from "better-auth/next-js"

let seeded = false
seedAdminUser().then(() => { seeded = true })

export const { POST, GET } = toNextJsHandler(auth)
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts lib/auth/seed-admin.ts app/api/auth/\[...all\]/route.ts
git commit -m "feat: add email-password plugin and admin user seeding"
```

---

### Task 4: Update middleware to check session in self-hosted mode

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update `middleware.ts`**

Remove the self-hosted bypass. The entire file becomes:

```typescript
import { default as globalConfig } from "@/lib/config"
import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

export default async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request, { cookiePrefix: "taxhacker" })
  if (!sessionCookie) {
    return NextResponse.redirect(new URL(globalConfig.auth.loginUrl, request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/transactions/:path*",
    "/settings/:path*",
    "/export/:path*",
    "/import/:path*",
    "/unsorted/:path*",
    "/files/:path*",
    "/dashboard/:path*",
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: enable session check for self-hosted mode"
```

---

### Task 5: Create password login form and update login page

**Files:**
- Create: `components/auth/password-login-form.tsx`
- Modify: `app/(auth)/enter/page.tsx`

- [ ] **Step 1: Create `components/auth/password-login-form.tsx`**

```typescript
"use client"

import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function PasswordLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })
      if (result.error) {
        setError("Invalid email or password")
        return
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <FormInput
        title="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <FormInput
        title="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
      {error && <FormError className="text-center">{error}</FormError>}
    </form>
  )
}
```

- [ ] **Step 2: Update `app/(auth)/enter/page.tsx`**

Full replacement:

```typescript
import PasswordLoginForm from "@/components/auth/password-login-form"
import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import Image from "next/image"

export default async function LoginPage() {
  const edition = config.selfHosted.isEnabled ? "Self" : "Cloud"

  return (
    <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
      <Image src="/logo/512.png" alt="Logo" width={144} height={144} className="w-36 h-36" />
      <CardTitle className="text-3xl font-bold">
        <ColoredText>TaxHacker: {edition}-Hosted Edition</ColoredText>
      </CardTitle>
      <CardContent className="w-full">
        {config.selfHosted.isEnabled ? <PasswordLoginForm /> : <LoginForm />}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/auth/password-login-form.tsx app/\(auth\)/enter/page.tsx
git commit -m "feat: add password login form for self-hosted mode"
```

---

### Task 6: Update self-hosted setup pages

**Files:**
- Modify: `app/(auth)/self-hosted/page.tsx`
- Modify: `app/(auth)/self-hosted/redirect/route.ts`

- [ ] **Step 1: Update `app/(auth)/self-hosted/redirect/route.ts`**

Now uses `getCurrentUser()` (session-based) and queries settings via Prisma directly:

```typescript
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
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
```

- [ ] **Step 2: Update `app/(auth)/self-hosted/page.tsx`**

Same pattern — query settings via Prisma:

```typescript
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { PROVIDERS } from "@/lib/llm-providers"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ShieldAlert } from "lucide-react"
import Image from "next/image"
import { redirect } from "next/navigation"
import SelfHostedSetupFormClient from "./setup-form-client"

export default async function SelfHostedWelcomePage() {
  if (!config.selfHosted.isEnabled) {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <span>Self-Hosted Mode is not enabled</span>
        </CardTitle>
        <CardDescription className="text-center text-lg flex flex-col gap-2">
          <p>
            To use TaxHacker in self-hosted mode, please set <code className="font-bold">SELF_HOSTED_MODE=true</code> in
            your environment.
          </p>
          <p>In self-hosted mode you can use your own ChatGPT API key and store your data on your own server.</p>
        </CardDescription>
      </Card>
    )
  }

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

  const defaultProvider = PROVIDERS[0].key
  const defaultApiKeys: Record<string, string> = {
    openai: config.ai.openaiApiKey ?? "",
    google: config.ai.googleApiKey ?? "",
    mistral: config.ai.mistralApiKey ?? "",
  }

  return (
    <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
      <Image src="/logo/512.png" alt="Logo" width={144} height={144} className="w-36 h-36" />
      <CardTitle className="text-3xl font-bold ">
        <ColoredText>TaxHacker: Self-Hosted Edition</ColoredText>
      </CardTitle>
      <CardDescription className="flex flex-col gap-4 text-center text-lg">
        <p>Welcome to your own instance of TaxHacker. Let&apos;s set up a couple of settings to get started.</p>
        <SelfHostedSetupFormClient defaultProvider={defaultProvider} defaultApiKeys={defaultApiKeys} />
      </CardDescription>
    </Card>
  )
}

export const dynamic = "force-dynamic"
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/self-hosted/page.tsx app/\(auth\)/self-hosted/redirect/route.ts
git commit -m "refactor: update self-hosted setup flow for password auth"
```

---

### Task 7: Show logout button in self-hosted mode

**Files:**
- Modify: `components/sidebar/sidebar-user.tsx`

- [ ] **Step 1: Make logout visible in self-hosted mode**

Remove the `!isSelfHosted` wrapper. The section from lines 90-100:

```typescript
{!isSelfHosted && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <span onClick={signOut} className="flex items-center gap-2 text-red-600 cursor-pointer">
        <LogOut className="h-4 w-4" />
        Log out
      </span>
    </DropdownMenuItem>
  </>
)}
```

Becomes:
```typescript
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
  <span onClick={signOut} className="flex items-center gap-2 text-red-600 cursor-pointer">
    <LogOut className="h-4 w-4" />
    Log out
  </span>
</DropdownMenuItem>
```

- [ ] **Step 2: Commit**

```bash
git add components/sidebar/sidebar-user.tsx
git commit -m "feat: show logout button in self-hosted mode"
```

---

### Task 8: Create admin user management settings page

**Files:**
- Create: `app/(app)/settings/admin/page.tsx`
- Create: `components/admin/user-management.tsx`
- Create: `app/(app)/settings/admin/actions.ts`
- Modify: `app/(app)/settings/layout.tsx`

- [ ] **Step 1: Create server actions `app/(app)/settings/admin/actions.ts`**

```typescript
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

  const newUser = await prisma.user.create({
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
```

- [ ] **Step 2: Create `components/admin/user-management.tsx`**

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormInput } from "@/components/forms/simple"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserPlus, Trash2, KeyRound } from "lucide-react"
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
} from "@/app/(app)/settings/admin/actions"

export type UserRecord = {
  id: string
  email: string
  name: string
  createdAt: Date
  membershipPlan: string | null
}

export function UserManagement({ users }: { users: UserRecord[] }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await createUserAction({ name, email, password })
      setShowCreateDialog(false)
      setName("")
      setEmail("")
      setPassword("")
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? All their data will be permanently deleted.")) {
      return
    }
    try {
      await deleteUserAction({ userId })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user")
    }
  }

  const handleResetPassword = async (userId: string, newPassword: string) => {
    try {
      await resetUserPasswordAction({ userId, newPassword })
      setShowPasswordDialog(false)
      setResetUserId(null)
      setPassword("")
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Create, manage, and delete user accounts.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetUserId(user.id)
                    setShowPasswordDialog(true)
                    setPassword("")
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(user.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with a name, email, and password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormInput
              title="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FormInput
              title="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FormInput
              title="Password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setOpen => {
        setShowPasswordDialog(setOpen)
        if (!setOpen) setResetUserId(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new password for this user.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (resetUserId) {
              handleResetPassword(resetUserId, password)
            }
          }} className="space-y-4">
            <FormInput
              title="New Password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowPasswordDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(app)/settings/admin/page.tsx`**

```typescript
import UserManagement from "@/components/admin/user-management"

export default async function AdminSettingsPage() {
  const { getUsersAction } = await import("./actions")
  const users = await getUsersAction()

  return (
    <div className="w-full">
      <UserManagement users={users} />
    </div>
  )
}
```

- [ ] **Step 4: Add "Admin" to settings navigation in `app/(app)/settings/layout.tsx`**

Add import:
```typescript
import config from "@/lib/config"
```

Append to `settingsCategories` array:
```typescript
if (config.selfHosted.isEnabled) {
  settingsCategories.push({ title: "Admin", href: "/settings/admin" })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/settings/admin/page.tsx app/\(app\)/settings/admin/actions.ts components/admin/user-management.tsx app/\(app\)/settings/layout.tsx
git commit -m "feat: add admin user management page"
```

---
