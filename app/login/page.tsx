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
import { Separator } from "@/components/ui/separator"
import { Loader2, Play } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, signUp, signInDemo } = useAuth()

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
          window.location.href = '/Spaceport-CRM-Cursor/dashboard/'
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
          window.location.href = '/Spaceport-CRM-Cursor/dashboard/'
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

  const handleDemoSignIn = () => {
    console.log("🔍 handleDemoSignIn: Starting demo sign in...")
    signInDemo()
    console.log("🔍 handleDemoSignIn: signInDemo completed, about to navigate...")
    
    // Use window.location for static export compatibility
    if (process.env.NODE_ENV === 'production') {
      console.log("🔍 handleDemoSignIn: Navigating to production dashboard...")
      window.location.href = '/Spaceport-CRM-Cursor/dashboard/'
    } else {
      console.log("🔍 handleDemoSignIn: Navigating to development dashboard...")
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <Image src={process.env.NODE_ENV === 'production' ? '/Spaceport-CRM-Cursor/logo-icon.svg' : '/logo-icon.svg'} alt="Company Logo" width={64} height={64} className="w-full h-full" />
          </div>
                      <CardTitle className="text-primary-hierarchy text-2xl font-title">Welcome</CardTitle>
          <CardDescription className="text-gray-400">Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demo Account Button */}
          <Button
            onClick={handleDemoSignIn}
            className="w-full bg-white text-black hover:bg-gray-100 rounded-lg font-body"
          >
            <Play className="mr-2 h-4 w-4" />
            Try Demo Account
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full bg-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-black px-2 text-gray-400">Or continue with</span>
            </div>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white/10 hover:bg-white/20 text-white rounded-pill border-system"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>

              <div className="mt-4 text-xs text-gray-500">
                <strong>Demo accounts:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• demo@spaceport.com / demo123</li>
                  <li>• sarah@spaceport.com / demo123</li>
                  <li>• mike@spaceport.com / demo123</li>
                </ul>
              </div>
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
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
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-brand"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white/10 hover:bg-white/20 text-white rounded-pill border-system"
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
