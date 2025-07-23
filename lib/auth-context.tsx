"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { cognitoAuth, type AuthUser } from "./cognito-auth"
import { awsConfig } from "./aws-config"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; message: string }>
  signInDemo: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Demo accounts for development
const demoAccounts = [
  { id: "demo-1", email: "demo@spaceport.com", password: "demo123", name: "Demo User" },
  { id: "demo-2", email: "sarah@spaceport.com", password: "demo123", name: "Sarah Johnson" },
  { id: "demo-3", email: "mike@spaceport.com", password: "demo123", name: "Mike Davis" },
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    console.log("🔍 AuthProvider: Checking for existing session...")
    
    // Check if we have AWS config (production mode)
    const hasAwsConfig = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    if (hasAwsConfig) {
      // Production mode - use Cognito
      console.log("🔍 AuthProvider: Using Cognito authentication")
      const currentUser = cognitoAuth.getCurrentUser()
      if (currentUser) {
        console.log("🔍 AuthProvider: Found Cognito user:", currentUser)
        setUser(currentUser)
      }
    } else {
      // Development mode - use localStorage fallback
      console.log("🔍 AuthProvider: Using development mode authentication")
      const savedUser = localStorage.getItem("spaceport_user")
      console.log("🔍 AuthProvider: savedUser from localStorage:", savedUser)
      
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser)
          console.log("🔍 AuthProvider: Setting user from localStorage:", parsedUser)
          setUser(parsedUser)
        } catch (error) {
          console.error("🔍 AuthProvider: Error parsing saved user:", error)
          localStorage.removeItem("spaceport_user")
        }
      } else {
        console.log("🔍 AuthProvider: No saved user found")
      }
    }
    
    console.log("🔍 AuthProvider: Setting loading to false")
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    // Check if we have AWS config (production mode)
    const hasAwsConfig = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    if (hasAwsConfig) {
      // Production mode - use Cognito ONLY
      console.log("🔍 AuthProvider: Using Cognito sign in (Production Mode)")
      
      // In production mode, demo accounts are not allowed
      const demoAccount = demoAccounts.find((acc) => acc.email === email && acc.password === password)
      if (demoAccount) {
        return { success: false, message: "Demo accounts are not available in production mode. Please use a real account." }
      }
      
      const result = await cognitoAuth.signIn(email, password)
      if (result.success && result.user) {
        setUser(result.user)
      }
      return result
    } else {
      // Development mode - use demo accounts
      console.log("🔍 AuthProvider: Using development mode sign in")
      
      // Check demo accounts first
      const demoAccount = demoAccounts.find((acc) => acc.email === email && acc.password === password)
      if (demoAccount) {
        const user: AuthUser = {
          id: demoAccount.id,
          name: demoAccount.name,
          email: demoAccount.email,
          accessToken: "demo-token",
          refreshToken: "demo-refresh",
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
        const user: AuthUser = {
          id: account.id,
          name: account.name,
          email: account.email,
          accessToken: "dev-token",
          refreshToken: "dev-refresh",
          isDemo: false,
        }
        setUser(user)
        localStorage.setItem("spaceport_user", JSON.stringify(user))
        return { success: true, message: "Signed in successfully!" }
      }

      return { success: false, message: "Invalid email or password" }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    name: string,
  ): Promise<{ success: boolean; message: string }> => {
    // Check if we have AWS config (production mode)
    const hasAwsConfig = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    if (hasAwsConfig) {
      // Production mode - use Cognito
      console.log("🔍 AuthProvider: Using Cognito sign up")
      return await cognitoAuth.signUp(email, password, name)
    } else {
      // Development mode - use localStorage
      console.log("🔍 AuthProvider: Using development mode sign up")
      
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
      const user: AuthUser = {
        id: newAccount.id,
        name: newAccount.name,
        email: newAccount.email,
        accessToken: "dev-token",
        refreshToken: "dev-refresh",
        isDemo: false,
      }
      setUser(user)
      localStorage.setItem("spaceport_user", JSON.stringify(user))

      return { success: true, message: "Account created successfully!" }
    }
  }

  const signInDemo = () => {
    // Check if we're in production mode
    const hasAwsConfig = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    if (hasAwsConfig) {
      console.log("🔍 signInDemo: Demo sign in not available in production mode")
      alert("Demo accounts are not available in production mode. Please use a real account.")
      return
    }
    
    console.log("🔍 signInDemo: Starting demo sign in...")
    const demoUser: AuthUser = {
      id: "demo-1",
      name: "Demo User",
      email: "demo@spaceport.com",
      accessToken: "demo-token",
      refreshToken: "demo-refresh",
      isDemo: true,
    }
    console.log("🔍 signInDemo: Setting user:", demoUser)
    setUser(demoUser)
    localStorage.setItem("spaceport_user", JSON.stringify(demoUser))
    console.log("🔍 signInDemo: User saved to localStorage")
  }

  const signOut = () => {
    // Check if we have AWS config (production mode)
    const hasAwsConfig = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    if (hasAwsConfig) {
      // Production mode - use Cognito
      cognitoAuth.signOut()
    } else {
      // Development mode - clear localStorage
      localStorage.removeItem("spaceport_user")
    }
    
    setUser(null)
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
