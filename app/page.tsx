"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    console.log("🔍 HomePage: Auth check - loading:", loading, "user:", user)
    
    if (!loading) {
      if (user) {
        console.log("🔍 HomePage: User found, redirecting to dashboard...")
        // Use window.location for static export compatibility
        if (process.env.NODE_ENV === 'production') {
          console.log("🔍 HomePage: Redirecting to production dashboard...")
          window.location.href = '/dashboard/'
        } else {
          console.log("🔍 HomePage: Redirecting to development dashboard...")
          router.push("/dashboard")
        }
      } else {
        console.log("🔍 HomePage: No user found, redirecting to login...")
        // Use window.location for static export compatibility
        if (process.env.NODE_ENV === 'production') {
          console.log("🔍 HomePage: Redirecting to production login...")
          window.location.href = '/login/'
        } else {
          console.log("🔍 HomePage: Redirecting to development login...")
          router.push("/login")
        }
      }
    } else {
      console.log("🔍 HomePage: Still loading...")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return null
}
