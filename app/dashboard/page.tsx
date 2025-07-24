"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Plus, Filter, Upload, LogOut, Loader2, Clock, Info, Eye, EyeOff, AlertTriangle, ArrowUpDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { LeadsTable, type Lead } from "@/components/leads-table"
import { LeadPanel } from "@/components/lead-panel"
import { AddLeadModal } from "@/components/add-lead-modal"
import { CSVImport } from "@/components/csv-import"
import { FollowUpPriority } from "@/components/follow-up-priority"
import { apiClient } from "@/lib/api-client"
import { awsConfig } from "@/lib/aws-config"
import Image from "next/image"

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([]) // Start with empty array
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    field: 'name' | 'status' | 'priority' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }>({ field: 'lastContact', direction: 'desc' })
  // Add new state for database connection status
  const [databaseConnectionStatus, setDatabaseConnectionStatus] = useState<'connected' | 'fallback' | 'error' | 'unknown'>('unknown')
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Check if we're in production mode (explicitly set or have AWS config)
  const isProductionMode = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)

  // Load leads from API on mount
  useEffect(() => {
    const loadLeads = async () => {
      if (!user) return
      
      setDataLoading(true)
      setConnectionError(null)
      
      try {
        if (isProductionMode) {
          // Production mode - load from API
          console.log("🔍 Dashboard: Loading leads from API...")
          const { data, error } = await apiClient.getLeads()
          if (error) {
            console.error("🔍 Dashboard: Error loading leads:", error)
            setConnectionError(error)
            
            // Check if it's an authentication error
            if (error.includes('Unauthorized') || error.includes('authentication') || error.includes('token')) {
              setDatabaseConnectionStatus('error')
              // Don't fall back for auth errors - show the user they need to sign in properly
              setLeads([])
            } else {
              // For other errors, fall back to localStorage but inform the user
              setDatabaseConnectionStatus('fallback')
              const savedLeads = localStorage.getItem("spaceport_leads")
              if (savedLeads) {
                setLeads(JSON.parse(savedLeads))
              }
            }
          } else if (data) {
            console.log("🔍 Dashboard: Loaded leads from API:", data.length)
            setDatabaseConnectionStatus('connected')
            setLeads(data)
          }
        } else {
          // Development mode - load from localStorage
          console.log("🔍 Dashboard: Loading leads from localStorage...")
          setDatabaseConnectionStatus('fallback')
          const savedLeads = localStorage.getItem("spaceport_leads")
          if (savedLeads) {
            setLeads(JSON.parse(savedLeads))
          }
        }
      } catch (error) {
        console.error("🔍 Dashboard: Error loading leads:", error)
        setConnectionError(error instanceof Error ? error.message : "Network error")
        setDatabaseConnectionStatus('error')
      } finally {
        setDataLoading(false)
      }
    }

    if (!loading && user) {
      loadLeads()
    }
  }, [user, loading, isProductionMode])

  // Save leads to localStorage when they change (development mode)
  useEffect(() => {
    if (!isProductionMode && !dataLoading) {
      localStorage.setItem("spaceport_leads", JSON.stringify(leads))
    }
  }, [leads, isProductionMode, dataLoading])

  // Redirect if not authenticated (only after loading is complete)
  useEffect(() => {
    console.log("🔍 Dashboard: Auth check - loading:", loading, "user:", user)
    
    if (!loading && !user) {
      console.log("🔍 Dashboard: No user found, redirecting to login...")
      // Use window.location for static export compatibility
      if (process.env.NODE_ENV === 'production') {
        console.log("🔍 Dashboard: Redirecting to production login...")
        window.location.href = '/login/'
      } else {
        console.log("🔍 Dashboard: Redirecting to development login...")
        router.push("/login")
      }
    } else if (!loading && user) {
      console.log("🔍 Dashboard: User authenticated:", user)
    }
  }, [user, loading, router])

  // Calculate metrics
  const callsMade = leads.reduce((acc, lead) => acc + lead.notes.filter((note) => note.type === "call").length, 0)
  const responsesReceived = leads.filter((lead) => lead.status === "interested" || lead.status === "closed").length
  const myLeads = leads.filter((lead) => lead.ownerId === user?.id).length
  const unclaimedLeads = leads.filter((lead) => !lead.ownerId).length
  const dormantLeads = leads.filter((lead) => lead.priority === "dormant").length
  const highPriorityLeads = leads.filter((lead) => lead.priority === "high").length
  const needsAttentionLeads = leads.filter((lead) => lead.needsAttention).length

  // Sort leads based on current configuration
  const sortedLeads = useMemo(() => {
    const sorted = [...leads].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.field) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'priority':
          const priorityOrder = { high: 4, medium: 3, low: 2, dormant: 1 }
          aValue = priorityOrder[a.priority]
          bValue = priorityOrder[b.priority]
          break
        case 'lastContact':
          const aLastNote = a.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
          const bLastNote = b.notes.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0]
          aValue = aLastNote ? new Date(aLastNote.timestamp).getTime() : 0
          bValue = bLastNote ? new Date(bLastNote.timestamp).getTime() : 0
          break
        case 'dateAdded':
          // Using id as proxy for date added since it's timestamp-based
          aValue = parseInt(a.id)
          bValue = parseInt(b.id)
          break
        case 'interestLevel':
          const interestOrder = { interested: 4, contacted: 3, 'left voicemail': 2, cold: 1, dormant: 0, closed: 5 }
          aValue = interestOrder[a.status]
          bValue = interestOrder[b.status]
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [leads, sortConfig])

  const handleLeadUpdate = async (leadId: string, updates: Partial<Lead>) => {
    const existingLead = leads.find(lead => lead.id === leadId)
    if (!existingLead) return
    
    const updatedLead = { 
      ...existingLead, 
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    // Update local state immediately for UI responsiveness
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updatedLead : lead)))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead(updatedLead)
    }

    // Save to API in production mode
    if (isProductionMode) {
      try {
        const { error } = await apiClient.updateLead(updatedLead)
        if (error) {
          console.error("Error updating lead:", error)
          // Revert local state on error
          setLeads((prev) => prev.map((lead) => (lead.id === leadId ? existingLead : lead)))
          if (selectedLead?.id === leadId) {
            setSelectedLead(existingLead)
          }
        }
      } catch (error) {
        console.error("Error updating lead:", error)
      }
    }
  }

  const handleLeadSelect = (lead: Lead) => {
    setSelectedLead(lead)
    setIsPanelOpen(true)
  }

  const handleAddNote = async (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social" }) => {
    const newNote = {
      id: Date.now().toString(),
      ...note,
      timestamp: new Date().toISOString(),
    }

    // Update local state immediately
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, notes: [...lead.notes, newNote] } : lead)))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: [...prev.notes, newNote] } : null))
    }

    // Save activity to API in production mode
    if (isProductionMode) {
      try {
        const activity = {
          leadId,
          type: note.type as "note" | "call" | "email" | "meeting" | "task",
          description: note.text,
        }
        const { error } = await apiClient.createActivity(activity)
        if (error) {
          console.error("Error creating activity:", error)
        }
      } catch (error) {
        console.error("Error creating activity:", error)
      }
    }
  }

  const handleUpdateNote = async (leadId: string, noteId: string, updates: { text?: string; timestamp?: string }) => {
    // Update local state immediately
    setLeads((prev) => prev.map((lead) => 
      lead.id === leadId 
        ? { 
            ...lead, 
            notes: lead.notes.map((note) => 
              note.id === noteId ? { ...note, ...updates } : note
            )
          }
        : lead
    ))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? {
        ...prev,
        notes: prev.notes.map((note) => 
          note.id === noteId ? { ...note, ...updates } : note
        )
      } : null)
    }

    // In production mode, we'd need to update the activity in the API
    // For now, we'll rely on the lead update to sync the notes
    if (isProductionMode) {
      const lead = leads.find(l => l.id === leadId)
      if (lead) {
        const updatedLead = {
          ...lead,
          notes: lead.notes.map((note) => 
            note.id === noteId ? { ...note, ...updates } : note
          )
        }
        try {
          const { error } = await apiClient.updateLead(updatedLead)
          if (error) {
            console.error("Error updating note:", error)
          }
        } catch (error) {
          console.error("Error updating note:", error)
        }
      }
    }
  }

  const handleCSVImport = async (importedLeads: Omit<Lead, "id">[]) => {
    const leadsWithIds: Lead[] = importedLeads.map((lead) => ({
      ...lead,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ownerId: user?.id, // Assign imported leads to current user
      ownerName: user?.name,
    }))

    // Update local state immediately
    setLeads((prev) => [...prev, ...leadsWithIds])

    // Save to API in production mode
    if (isProductionMode) {
      try {
        const { data, error } = await apiClient.createLeads(importedLeads)
        if (error) {
          console.error("Error importing leads:", error)
          return { success: false, message: `Import failed: ${error}` }
        }
        return { success: true, message: `Successfully imported ${data?.length || leadsWithIds.length} leads!` }
      } catch (error) {
        console.error("Error importing leads:", error)
        return { success: false, message: "Import failed due to network error" }
      }
    }

    return { success: true, message: `Successfully imported ${leadsWithIds.length} leads!` }
  }

  const handleAddLead = async (leadData: Omit<Lead, "id" | "notes" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "lastUpdatedBy" | "lastUpdatedByName">) => {
    const newLead: Lead = {
      ...leadData,
      id: Date.now().toString(),
      ownerId: user?.id, // Assign new leads to current user
      ownerName: user?.name,
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user?.id,
      createdByName: user?.name,
    }
    
    // Update local state immediately
    setLeads((prev) => [...prev, newLead])

    // Save to API in production mode
    if (isProductionMode) {
      try {
        const apiLeadData = {
          ...leadData,
          notes: [],
        }
        const { error } = await apiClient.createLead(apiLeadData)
        if (error) {
          console.error("Error creating lead:", error)
          // Remove from local state on error
          setLeads((prev) => prev.filter(lead => lead.id !== newLead.id))
        }
      } catch (error) {
        console.error("Error creating lead:", error)
        // Remove from local state on error
        setLeads((prev) => prev.filter(lead => lead.id !== newLead.id))
      }
    }
  }

  const handleResetDatabase = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL contacts from the database. This action cannot be undone. Are you sure you want to reset the database?")) {
      return
    }

    try {
      if (isProductionMode) {
        // Check database connection status first
        if (databaseConnectionStatus === 'error') {
          alert("❌ Cannot reset database: Not connected to database. Please check your authentication and try again.")
          return
        }
        
        if (databaseConnectionStatus === 'fallback') {
          alert("❌ Cannot reset database: Currently in offline mode. Please reconnect to the database first.")
          return
        }
        
        const { error } = await apiClient.resetDatabase()
        if (error) {
          console.error("Error resetting database:", error)
          if (error.includes('Unauthorized') || error.includes('authentication') || error.includes('token')) {
            alert("❌ Failed to reset database: Authentication required. Please sign out and sign back in with a valid account.")
          } else {
            alert(`❌ Failed to reset database: ${error}`)
          }
          return
        }
        
        // If successful, also reload the leads to confirm the reset worked
        const { data: updatedLeads, error: loadError } = await apiClient.getLeads()
        if (!loadError && updatedLeads) {
          setLeads(updatedLeads)
          setDatabaseConnectionStatus('connected')
        }
      }
      
      // Clear local state
      setLeads([])
      setSelectedLead(null)
      setIsPanelOpen(false)
      
      alert("✅ Database reset successfully!")
    } catch (error) {
      console.error("Error resetting database:", error)
      alert("❌ Failed to reset database: Network error occurred")
    }
  }

  const handleSignOut = () => {
    signOut()
    // Use window.location for static export compatibility
    if (process.env.NODE_ENV === 'production') {
      window.location.href = '/login/'
    } else {
      router.push("/login")
    }
  }

  if (loading || dataLoading) {
    console.log("🔍 Dashboard: Still loading, showing spinner...")
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  if (!user) {
    console.log("🔍 Dashboard: No user, returning null (will redirect)...")
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Individual gradient splotches */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-600/30 via-blue-500/20 to-orange-500/15 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-bl from-purple-500/25 via-blue-400/15 to-orange-400/12 rounded-full blur-2xl"></div>
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-gradient-to-tr from-purple-500/20 via-blue-400/10 to-orange-400/8 rounded-full blur-2xl"></div>
        <div className="absolute top-40 right-1/3 w-48 h-48 bg-gradient-to-br from-orange-500/18 via-pink-500/12 to-purple-500/8 rounded-full blur-xl"></div>
        <div className="absolute top-60 left-1/3 w-32 h-32 bg-gradient-to-bl from-blue-500/15 to-purple-500/10 rounded-full blur-lg"></div>
      </div>
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}></div>
      </div>
      
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with consistent vertical alignment */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-start justify-between mb-16 pt-12"
          >
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <Image src={process.env.NODE_ENV === 'production' ? '/logo-icon.svg' : '/logo-icon.svg'} alt="Company Logo" width={48} height={48} className="w-12 h-12" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-4xl font-title text-primary-hierarchy mb-3">Welcome back, {user?.name}</h1>
                <p className="text-gray-400 font-body text-lg">
                  {leads.length === 0
                    ? "Get started by importing your CSV file or adding your first lead."
                    : "Here's what's happening with your leads today."}
                </p>
                <div className="flex gap-2 mt-3">
                  {user?.isDemo && (
                    <Badge className="bg-[#CD70E4]/20 text-[#CD70E4] border-[#CD70E4]/30 w-fit">Demo Mode</Badge>
                  )}
                  {!isProductionMode && (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 w-fit">Development Mode</Badge>
                  )}
                  {/* Database connection status indicator */}
                  {databaseConnectionStatus === 'connected' && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 w-fit">Database Connected</Badge>
                  )}
                  {databaseConnectionStatus === 'fallback' && (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 w-fit">Offline Mode</Badge>
                  )}
                  {databaseConnectionStatus === 'error' && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 w-fit">Database Error</Badge>
                  )}
                </div>
                {/* Show connection error message */}
                {connectionError && databaseConnectionStatus === 'error' && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-300 text-sm font-body">
                      <strong>Database Connection Error:</strong> {connectionError}
                    </p>
                    <p className="text-red-400 text-xs mt-1">
                      {connectionError.includes('Unauthorized') || connectionError.includes('authentication') || connectionError.includes('token') 
                        ? "Please sign out and sign back in with a valid account to access the database."
                        : "You're currently working offline. Changes will not be saved to the database."}
                    </p>
                  </div>
                )}
                {databaseConnectionStatus === 'fallback' && isProductionMode && (
                  <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-300 text-sm font-body">
                      <strong>Working Offline:</strong> Cannot connect to database. Changes are only saved locally.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="/placeholder-user.jpg" alt={user.name} />
                      <AvatarFallback className="bg-white/10 text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-black/90 backdrop-blur-xl border-system rounded-brand" align="end" forceMount>
                  <DropdownMenuItem onClick={handleSignOut} className="text-white hover:bg-white/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>

          {/* Enhanced Metrics - removed unclaimed card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-brand">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 font-body text-sm">Total Leads</p>
                    <p className="text-3xl font-title text-primary-hierarchy">{leads.length}</p>
                  </div>
                  <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center">
                    <Search className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-brand">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 font-body text-sm">High Priority</p>
                    <p className="text-3xl font-title text-primary-hierarchy">{highPriorityLeads}</p>
                  </div>
                  <div className="h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-brand">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 font-body text-sm">My Leads</p>
                    <p className="text-3xl font-title text-primary-hierarchy">{myLeads}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-brand">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 font-body text-sm">Need Attention</p>
                    <p className="text-3xl font-title text-primary-hierarchy">{needsAttentionLeads}</p>
                  </div>
                  <div className="h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {leads.length === 0 ? (
            // Empty state
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center py-16"
            >
              <div className="max-w-md mx-auto">
                <div className="h-24 w-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="h-12 w-12 text-white" />
                </div>
                <h3 className="text-xl font-title text-white mb-2">No leads yet</h3>
                <p className="text-gray-400 font-body mb-6">
                  Get started by importing your CSV file with contact data, or add your first lead manually.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => setIsImportOpen(true)}
                    className="bg-white text-black hover:bg-gray-100 rounded-pill px-6"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-pill px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-3">
                  <Button
                    onClick={() => setIsImportOpen(true)}
                    variant="outline"
                    className="border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-white text-black hover:bg-gray-100 rounded-pill px-6 transition-all duration-200 font-body"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </div>
              </div>

              <FollowUpPriority leads={leads} onLeadSelect={handleLeadSelect} />

              {/* Leads Table Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-title text-primary-hierarchy mb-6">Leads Table</h2>
                <LeadsTable
                  leads={sortedLeads}
                  onLeadUpdate={handleLeadUpdate}
                  onLeadSelect={handleLeadSelect}
                  sortConfig={sortConfig}
                  onSortChange={setSortConfig}
                />
              </div>

              {/* Reset Database Button - Bottom of page */}
              <div className="flex justify-center mt-12 mb-8">
                <Button
                  onClick={() => {
                    if (confirm("⚠️ WARNING: This will delete ALL contacts from the database. This action cannot be undone. Are you sure you want to reset the database?")) {
                      handleResetDatabase()
                    }
                  }}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-pill px-6 backdrop-blur-sm font-body"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Reset Database
                </Button>
              </div>
            </>
          )}

          <LeadPanel
            lead={selectedLead}
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onUpdateLead={handleLeadUpdate}
          />

          <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddLead={handleAddLead} />

          <CSVImport isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleCSVImport} />
        </div>
      </div>
    </div>
  )
}
