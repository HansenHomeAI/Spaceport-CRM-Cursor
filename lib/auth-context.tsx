"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  name: string
  email: string
  isDemo?: boolean
  accessToken?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string }>
  signInDemo: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Demo accounts
const demoAccounts = [
  { id: "demo-1", email: "demo@spaceport.com", password: "demo123", name: "Demo User" },
  { id: "demo-2", email: "sarah@spaceport.com", password: "demo123", name: "Sarah Johnson" },
  { id: "demo-3", email: "mike@spaceport.com", password: "demo123", name: "Mike Davis" },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("spaceport_user")
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        localStorage.removeItem("spaceport_user")
      }
    }
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    // Check demo accounts first
    const demoAccount = demoAccounts.find((acc) => acc.email === email && acc.password === password)
    if (demoAccount) {
      const user: User = {
        id: demoAccount.id,
        name: demoAccount.name,
        email: demoAccount.email,
        isDemo: true,
      }
      setUser(user)
      localStorage.setItem("spaceport_user", JSON.stringify(user))
      return { success: true, message: "Signed in successfully!" }
    }

    // Check real accounts from localStorage (in production, this would be a real API call)
    const accounts = JSON.parse(localStorage.getItem("spaceport_accounts") || "[]")
    const account = accounts.find((acc: any) => acc.email === email && acc.password === password)

    if (account) {
      const user: User = {
        id: account.id,
        name: account.name,
        email: account.email,
        isDemo: false,
      }
      setUser(user)
      localStorage.setItem("spaceport_user", JSON.stringify(user))
      return { success: true, message: "Signed in successfully!" }
    }

    return { success: false, message: "Invalid email or password" }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
  ): Promise<{ success: boolean; message: string }> => {
    // Check if email already exists
    const accounts = JSON.parse(localStorage.getItem("spaceport_accounts") || "[]")
    const existingAccount = accounts.find((acc: any) => acc.email === email)
    const existingDemo = demoAccounts.find((acc) => acc.email === email)

    if (existingAccount || existingDemo) {
      return { success: false, message: "An account with this email already exists" }
    }

    // Create new account
    const newAccount = {
      id: Date.now().toString(),
      email,
      password,
      name,
      createdAt: new Date().toISOString(),
    }

    accounts.push(newAccount)
    localStorage.setItem("spaceport_accounts", JSON.stringify(accounts))

    // Sign in the new user
    const user: User = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      isDemo: false,
    }
    setUser(user)
    localStorage.setItem("spaceport_user", JSON.stringify(user))

    return { success: true, message: "Account created successfully!" }
  }

  const signInDemo = () => {
    const demoUser: User = {
      id: "demo-1",
      name: "Demo User",
      email: "demo@spaceport.com",
      isDemo: true,
    }
    setUser(demoUser)
    localStorage.setItem("spaceport_user", JSON.stringify(demoUser))
  }

  const signOut = () => {
    setUser(null)
    localStorage.removeItem("spaceport_user")
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signInDemo, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
