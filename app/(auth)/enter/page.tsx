import { PasswordLoginForm } from "@/components/auth/password-login-form"
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
