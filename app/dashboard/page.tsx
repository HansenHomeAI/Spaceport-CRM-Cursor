"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Plus, Filter, Upload, LogOut, Loader2, Clock, Info, Eye, EyeOff, AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { LeadsTable, type Lead } from "@/components/leads-table"
import { LeadPanel } from "@/components/lead-panel"
import { AddLeadModal } from "@/components/add-lead-modal"
import { CSVImport } from "@/components/csv-import"
import { FollowUpPriority } from "@/components/follow-up-priority"
import Image from "next/image"

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([]) // Start with empty array
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [sortByRecent, setSortByRecent] = useState(false)
  const [showDormant, setShowDormant] = useState(false)
  const [showNeedsAttention, setShowNeedsAttention] = useState(false)
  const [filterByOwnership, setFilterByOwnership] = useState<"all" | "mine" | "unclaimed">("all")

  // Redirect if not authenticated (only after loading is complete)
  useEffect(() => {
    console.log("🔍 Dashboard: Auth check - loading:", loading, "user:", user)
    
    if (!loading && !user) {
      console.log("🔍 Dashboard: No user found, redirecting to login...")
      // Use window.location for static export compatibility
      if (process.env.NODE_ENV === 'production') {
        console.log("🔍 Dashboard: Redirecting to production login...")
        window.location.href = '/Spaceport-CRM-Cursor/login/'
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

  // Filter leads based on ownership and attention needs
  const filteredLeads = leads.filter((lead) => {
    // Filter by ownership
    if (filterByOwnership === "mine") {
      if (!lead.ownerId || lead.ownerId !== user?.id) return false
    } else if (filterByOwnership === "unclaimed") {
      if (lead.ownerId) return false
    }
    
    // Filter by attention needs
    if (showNeedsAttention && !lead.needsAttention) return false
    
    return true
  })

  const handleLeadUpdate = (leadId: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, ...updates } : lead)))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }

  const handleLeadSelect = (lead: Lead) => {
    setSelectedLead(lead)
    setIsPanelOpen(true)
  }

  const handleAddNote = (leadId: string, note: { text: string; type: "call" | "email" | "note" }) => {
    const newNote = {
      id: Date.now().toString(),
      ...note,
      timestamp: new Date().toISOString(),
    }

    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, notes: [...lead.notes, newNote] } : lead)))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes: [...prev.notes, newNote] } : null))
    }
  }

  const handleCSVImport = async (importedLeads: Omit<Lead, "id">[]) => {
    const leadsWithIds: Lead[] = importedLeads.map((lead) => ({
      ...lead,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      ownerId: user?.id, // Assign imported leads to current user
      ownerName: user?.name,
    }))

    setLeads((prev) => [...prev, ...leadsWithIds])
    return { success: true, message: `Successfully imported ${leadsWithIds.length} leads!` }
  }

  const handleAddLead = (leadData: Omit<Lead, "id" | "notes">) => {
    const newLead: Lead = {
      ...leadData,
      id: Date.now().toString(),
      ownerId: user?.id, // Assign new leads to current user
      ownerName: user?.name,
      notes: [],
    }
    setLeads((prev) => [...prev, newLead])
  }

  const handleSignOut = () => {
    signOut()
    // Use window.location for static export compatibility
    if (process.env.NODE_ENV === 'production') {
      window.location.href = '/Spaceport-CRM-Cursor/login/'
    } else {
      router.push("/login")
    }
  }

  if (loading) {
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
      {/* Subtle gradient background - made more visible */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-600/30 via-blue-500/20 to-orange-500/15 rounded-full blur-3xl"></div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-bl from-purple-500/25 via-blue-400/15 to-orange-400/12 rounded-full blur-2xl"></div>
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-gradient-to-tr from-purple-500/20 via-blue-400/10 to-orange-400/8 rounded-full blur-2xl"></div>
      </div>
      
      <div className="relative z-10 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with aligned vertical margins */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between mb-16 pt-12"
          >
            <div className="flex items-center gap-6">
              <div className="pt-2">
                <Image src={process.env.NODE_ENV === 'production' ? '/Spaceport-CRM-Cursor/logo-icon.svg' : '/logo-icon.svg'} alt="Company Logo" width={48} height={48} className="w-12 h-12" />
              </div>
              <div className="pt-2">
                <h1 className="text-4xl font-title text-primary-hierarchy mb-3">Welcome back, {user?.name}</h1>
                <p className="text-gray-400 font-body text-lg">
                  {leads.length === 0
                    ? "Get started by importing your CSV file or adding your first lead."
                    : "Here's what's happening with your leads today."}
                </p>
                {user?.isDemo && (
                  <Badge className="mt-3 bg-[#CD70E4]/20 text-[#CD70E4] border-[#CD70E4]/30">Demo Mode</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2">
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setSortByRecent(!sortByRecent)}
                          variant="outline"
                          className={`border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body ${
                            sortByRecent ? "bg-white/10 text-white" : ""
                          }`}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {sortByRecent ? "Recent First" : "Sort by Recent"}
                          <Info className="h-3 w-3 ml-1 opacity-50" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-2xl">
                        <p className="font-body">Toggle to show most recently contacted leads first</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    onClick={() =>
                      setFilterByOwnership(
                        filterByOwnership === "all" ? "mine" : filterByOwnership === "mine" ? "unclaimed" : "all",
                      )
                    }
                    variant="outline"
                    className={`border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body ${
                      filterByOwnership !== "all" ? "bg-white/10 text-white" : ""
                    }`}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {filterByOwnership === "all" ? "All Leads" : filterByOwnership === "mine" ? "My Leads" : "Unclaimed"}
                  </Button>

                  <Button
                    onClick={() => setShowDormant(!showDormant)}
                    variant="outline"
                    className={`border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body ${
                      showDormant ? "bg-white/10 text-white" : ""
                    }`}
                  >
                    {showDormant ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                    {showDormant ? "Hide Dormant" : "Show Dormant"}
                  </Button>

                  <Button
                    onClick={() => setShowNeedsAttention(!showNeedsAttention)}
                    variant="outline"
                    className={`border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body ${
                      showNeedsAttention ? "bg-red-500/20 text-red-300 border-red-500/30" : ""
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {showNeedsAttention ? "Hide Issues" : "Show Issues"}
                  </Button>
                </div>

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

              <FollowUpPriority leads={filteredLeads} onLeadSelect={handleLeadSelect} />

              <LeadsTable
                leads={filteredLeads}
                onLeadUpdate={handleLeadUpdate}
                onLeadSelect={handleLeadSelect}
                sortByRecent={sortByRecent}
                showDormant={showDormant}
              />
            </>
          )}

          <LeadPanel
            lead={selectedLead}
            isOpen={isPanelOpen}
            onClose={() => setIsPanelOpen(false)}
            onAddNote={handleAddNote}
            onUpdateLead={handleLeadUpdate}
          />

          <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddLead={handleAddLead} />

          <CSVImport isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleCSVImport} />
        </div>
      </div>
    </div>
  )
}
