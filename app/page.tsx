"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      // Use window.location for static export compatibility
      if (process.env.NODE_ENV === 'production') {
        window.location.href = '/Spaceport-CRM-Cursor/dashboard/'
      } else {
        router.push("/dashboard")
      }
    } else {
      // Use window.location for static export compatibility
      if (process.env.NODE_ENV === 'production') {
        window.location.href = '/Spaceport-CRM-Cursor/login/'
      } else {
        router.push("/login")
      }
    }
  }, [user, router])

  return null
}
