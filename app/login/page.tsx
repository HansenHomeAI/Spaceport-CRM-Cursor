"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signUp } = useAuth()

  // Debug: Check localStorage on component mount
  useEffect(() => {
    console.log("🔍 LoginPage: Component mounted")
    console.log("🔍 LoginPage: localStorage spaceport_user:", localStorage.getItem("spaceport_user"))
    console.log("🔍 LoginPage: NODE_ENV:", process.env.NODE_ENV)
  }, [])

  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [signInForm, setSignInForm] = useState({
    email: "",
    password: "",
  })

  const [signUpForm, setSignUpForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const result = await signIn(signInForm.email, signInForm.password)

      if (result.success) {
        setMessage({ type: "success", text: result.message })
        // Use window.location for static export compatibility
        if (process.env.NODE_ENV === 'production') {
          console.log("🔍 LoginPage: Redirecting to production dashboard...")
          window.location.href = '/dashboard/'
        } else {
          router.push("/dashboard")
        }
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    if (signUpForm.password !== signUpForm.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" })
      setIsLoading(false)
      return
    }

    if (signUpForm.password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters long" })
      setIsLoading(false)
      return
    }

    try {
      const result = await signUp(signUpForm.email, signUpForm.password, signUpForm.name)

      if (result.success) {
        setMessage({ type: "success", text: result.message })
        // Use window.location for static export compatibility
        if (process.env.NODE_ENV === 'production') {
          console.log("🔍 LoginPage: Redirecting to production dashboard...")
          window.location.href = '/dashboard/'
        } else {
          router.push("/dashboard")
        }
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred" })
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Off-center background glow effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-2/5 left-2/5 w-[28rem] h-[28rem] bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-3/5 right-1/3 w-[24rem] h-[24rem] bg-blue-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute top-1/3 left-3/5 w-[20rem] h-[20rem] bg-orange-500/6 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>
      
      {/* Noise overlay */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-noise opacity-30"></div>
      </div>
      
      <Card className="w-full max-w-md bg-black/90 backdrop-blur-xl border-2.5 border-white/10 rounded-2xl relative z-10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Image src={process.env.NODE_ENV === 'production' ? '/logo-icon.svg' : '/logo-icon.svg'} alt="Company Logo" width={64} height={64} className="w-full h-full" />
          </div>
                      <CardTitle className="text-primary-hierarchy text-2xl font-title">Welcome</CardTitle>
          <CardDescription className="text-gray-400">Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-2xl">
              <TabsTrigger value="signin" className="text-gray-300 data-[state=active]:text-white">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-gray-300 data-[state=active]:text-white">
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-white">
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signInForm.email}
                    onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-white">
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={signInForm.password}
                    onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white/10 hover:bg-white/20 text-white rounded-2xl border-system transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-white">
                    Full Name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={signUpForm.name}
                    onChange={(e) => setSignUpForm({ ...signUpForm, name: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-white">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signUpForm.email}
                    onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-white">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Enter your password (min 6 characters)"
                    value={signUpForm.password}
                    onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password" className="text-white">
                    Confirm Password
                  </Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={signUpForm.confirmPassword}
                    onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-2xl"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white/10 hover:bg-white/20 text-white rounded-2xl border-system transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {message && (
            <Alert className={message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
