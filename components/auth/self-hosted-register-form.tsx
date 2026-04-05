"use client"

import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FormError } from "@/components/forms/error"

export function SelfHostedRegisterForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      })
      if (result.error) {
        setError(result.error.message || "Failed to create account")
        return
      }

      // Sign in after successful registration
      const signInResult = await authClient.signIn.email({
        email,
        password,
      })
      if (signInResult.error) {
        setError("Account created but failed to sign in. Please go back to login.")
        return
      }

      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleRegister} className="flex flex-col gap-4 w-full">
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
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />

      <FormInput
        title="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={8}
      />

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Creating account..." : "Create Account"}
      </Button>

      {error && <FormError className="text-center">{error}</FormError>}
    </form>
  )
}
