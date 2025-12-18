"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Plus, Filter, Upload, LogOut, Loader2, Clock, Info, Eye, EyeOff, AlertTriangle, ArrowUpDown, RefreshCw, X, ClipboardList, Download } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context"
import { LeadsTable, type Lead } from "@/components/leads-table"
import { LeadPanel } from "@/components/lead-panel"
import { AddLeadModal } from "@/components/add-lead-modal"
import { CSVImport } from "@/components/csv-import"
import { FollowUpPriority } from "@/components/follow-up-priority"
import { ProspectListModal } from "@/components/prospect-list-modal"
import { apiClient } from "@/lib/api-client"
import { awsConfig } from "@/lib/aws-config"
import { useActivityRefresh } from "@/hooks/use-activity-refresh"
import { useIsMobile } from "@/hooks/use-mobile"
import Image from "next/image"

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const isMobile = useIsMobile()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    field: 'name' | 'status' | 'lastContact' | 'dateAdded' | 'interestLevel'
    direction: 'asc' | 'desc'
  }>({ field: 'lastContact', direction: 'desc' })
  // Add new state for database connection status
  const [databaseConnectionStatus, setDatabaseConnectionStatus] = useState<'connected' | 'fallback' | 'error' | 'unknown'>('unknown')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [prospects, setProspects] = useState<any[]>([])
  const [isProspectModalOpen, setIsProspectModalOpen] = useState(false)

  // Extract unique users from leads for ownership assignment
  const availableUsers = useMemo(() => {
    const userMap = new Map<string, string>()
    
    // Add current user
    if (user) {
      userMap.set(user.id, user.name)
    }
    
    // Extract from leads
    leads.forEach(lead => {
      if (lead.ownerId && lead.ownerName) {
        userMap.set(lead.ownerId, lead.ownerName)
      }
      if (lead.createdBy && lead.createdByName) {
        userMap.set(lead.createdBy, lead.createdByName)
      }
      if (lead.lastUpdatedBy && lead.lastUpdatedByName) {
        userMap.set(lead.lastUpdatedBy, lead.lastUpdatedByName)
      }
    })
    
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }))
  }, [leads, user])

  // Helper function to migrate old status values to new ones
  const migrateLeadStatuses = useCallback(async () => {
    const statusMap: Record<string, string> = {
      "cold": "Not Interested",
      "contacted": "Contacted", 
      "interested": "Interested",
      "closed": "Closed",
      "dormant": "Not Interested",
      "left voicemail": "Left Voicemail"
    }

    console.log(`🔍 Checking ${leads.length} leads for status migration...`)

    const leadsToUpdate = leads.filter(lead => {
      const newStatus = statusMap[lead.status]
      return newStatus && newStatus !== lead.status
    })

    if (leadsToUpdate.length === 0) {
      console.log("✅ All leads are already using the new status format!")
      return
    }

    console.log(`🔄 Found ${leadsToUpdate.length} leads that need migration:`)
    leadsToUpdate.forEach(lead => {
      console.log(`  • ${lead.name}: "${lead.status}" → "${statusMap[lead.status]}"`)
    })

    let successCount = 0
    let errorCount = 0

    for (const lead of leadsToUpdate) {
      try {
        await handleLeadUpdate(lead.id, { status: statusMap[lead.status] as Lead["status"] })
        successCount++
        console.log(`✅ Updated ${lead.name}`)
      } catch (error) {
        errorCount++
        console.error(`❌ Failed to update ${lead.name}:`, error)
      }
    }

    if (errorCount === 0) {
      console.log(`🎉 Migration complete! Successfully updated ${successCount} leads.`)
    } else {
      console.log(`⚠️ Migration completed with issues: ${successCount} successful, ${errorCount} failed.`)
    }
  }, [leads])

  // Helper function to check migration status
  const checkMigrationStatus = useCallback(() => {
    const statusMap: Record<string, string> = {
      "cold": "Not Interested",
      "contacted": "Contacted", 
      "interested": "Interested",
      "closed": "Closed",
      "dormant": "Not Interested",
      "left voicemail": "Left Voicemail"
    }

    const oldStatusLeads = leads.filter(lead => statusMap[lead.status])
    const newStatusLeads = leads.filter(lead => !statusMap[lead.status])

    console.log("📊 Migration Status Report:")
    console.log(`  • Total leads: ${leads.length}`)
    console.log(`  • Using new status format: ${newStatusLeads.length}`)
    console.log(`  • Using old status format: ${oldStatusLeads.length}`)
    
    if (oldStatusLeads.length > 0) {
      console.log("  • Leads needing migration:")
      oldStatusLeads.forEach(lead => {
        console.log(`    - ${lead.name}: "${lead.status}"`)
      })
    }

    return {
      total: leads.length,
      migrated: newStatusLeads.length,
      needsMigration: oldStatusLeads.length
    }
  }, [leads])

  // Expose migration functions for development/troubleshooting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).migrateLeadStatuses = migrateLeadStatuses
      (window as any).checkMigrationStatus = checkMigrationStatus
      console.log("🛠️ Migration tools available:")
      console.log("  • migrateLeadStatuses() - Update all leads to new status format")
      console.log("  • checkMigrationStatus() - Check how many leads need migration")
    }
  }, [migrateLeadStatuses, checkMigrationStatus])

  // Check if we're in production mode (explicitly set or have AWS config)
  const isProductionMode = useMemo(() => {
    return process.env.NODE_ENV === 'production' || 
           process.env.NEXT_PUBLIC_DEV_MODE === 'false' ||
           (awsConfig.region && awsConfig.userPoolId && awsConfig.userPoolClientId)
  }, [])

  // Background refresh function for activity-triggered updates
  const handleBackgroundRefresh = useCallback(async () => {
    if (!user || !isProductionMode) return

    setIsBackgroundRefreshing(true)
    try {
      console.log("🔄 Performing background refresh...")
      const { data, error } = await apiClient.getLeads()
      if (error) {
        console.warn("Background refresh failed:", error)
        // Don't update connection status for background failures
      } else if (data) {
        console.log(`✅ Background refresh loaded ${data.length} leads`)
        setLeads(data)
        setDatabaseConnectionStatus('connected')
        setConnectionError(null)
      }
    } catch (error) {
      console.warn("Background refresh error:", error)
    } finally {
      setIsBackgroundRefreshing(false)
    }
  }, [user, isProductionMode])

  // Activity refresh hook - triggers refresh on user activity after 15 minutes
  const { markAsRefreshed } = useActivityRefresh({
    refreshThresholdMs: 15 * 60 * 1000, // 15 minutes
    onRefresh: handleBackgroundRefresh,
    isEnabled: Boolean(isProductionMode && databaseConnectionStatus === 'connected')
  })

  // Load leads and prospects from API on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      
      setDataLoading(true)
      setConnectionError(null)
      
      try {
        if (isProductionMode) {
          // Production mode - load from API
          console.log("🔍 Dashboard: Loading data from API...")
          const [leadsResult, prospectsResult] = await Promise.all([
            apiClient.getLeads(),
            apiClient.getProspects()
          ])
          
          if (leadsResult.error) {
            console.error("🔍 Dashboard: Error loading leads:", leadsResult.error)
            setConnectionError(leadsResult.error)
            
            // Check if it's an authentication error
            if (leadsResult.error.includes('Unauthorized') || leadsResult.error.includes('authentication') || leadsResult.error.includes('token')) {
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
          } else if (leadsResult.data) {
            console.log("🔍 Dashboard: Loaded leads from API:", leadsResult.data.length)
            
            // Migrate leads with properties array if needed
            const migratedLeads = leadsResult.data.map(lead => {
              if (!lead.properties && lead.address) {
                return {
                  ...lead,
                  properties: [{
                    id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    address: lead.address,
                    isSold: false
                  }]
                }
              }
              return lead
            })
            
            setDatabaseConnectionStatus('connected')
            setLeads(migratedLeads)
            markAsRefreshed() // Mark initial load as refresh time
          }
          
          if (prospectsResult.data) {
            setProspects(prospectsResult.data)
          }
        } else {
          // Development mode - load from localStorage
          console.log("🔍 Dashboard: Loading data from localStorage...")
          setDatabaseConnectionStatus('fallback')
          const savedLeads = localStorage.getItem("spaceport_leads")
          const savedProspects = localStorage.getItem("spaceport_prospects")
          if (savedLeads) {
            const parsedLeads = JSON.parse(savedLeads) as Lead[]
            // Migrate leads with properties array if needed
            const migratedLeads = parsedLeads.map(lead => {
              if (!lead.properties && lead.address) {
                return {
                  ...lead,
                  properties: [{
                    id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    address: lead.address,
                    isSold: false
                  }]
                }
              }
              return lead
            })
            setLeads(migratedLeads)
          }
          if (savedProspects) {
            setProspects(JSON.parse(savedProspects))
          }
        }
      } catch (error) {
        console.error("🔍 Dashboard: Error loading data:", error)
        setConnectionError(error instanceof Error ? error.message : "Network error")
        setDatabaseConnectionStatus('error')
      } finally {
        setDataLoading(false)
      }
    }

    if (!loading && user) {
      loadData()
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
  const responsesReceived = leads.filter((lead) => lead.status === "Interested").length
  const myLeads = leads.filter((lead) => lead.ownerId === user?.id).length
  const unclaimedLeads = leads.filter((lead) => !lead.ownerId).length
  const interestedLeads = leads.filter((lead) => lead.status === "Interested").length
  const contactedLeads = leads.filter((lead) => lead.status === "Contacted").length
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
          const interestOrder: Record<string, number> = { 
            "Interested": 5, 
            "Contacted": 4, 
            "Left Voicemail": 3, 
            "Closed": 2, 
            "Not Interested": 1 
          }
          // Helper function to normalize status values
          const normalizeStatus = (status: string): string => {
            const statusMap: Record<string, string> = {
              "cold": "Not Interested",
              "contacted": "Contacted", 
              "interested": "Interested",
              "closed": "Closed",
              "dormant": "Not Interested",
              "left voicemail": "Left Voicemail",
              "Left Voicemail": "Left Voicemail",
              "Contacted": "Contacted",
              "Interested": "Interested", 
              "Not Interested": "Not Interested",
              "Closed": "Closed"
            }
            return statusMap[status] || "Left Voicemail"
          }
          aValue = interestOrder[normalizeStatus(a.status)] || 1
          bValue = interestOrder[normalizeStatus(b.status)] || 1
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
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name
    }
    
    // Update local state immediately for UI responsiveness (optimistic update)
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updatedLead : lead)))

    // Update selected lead if it's the same one
    if (selectedLead?.id === leadId) {
      setSelectedLead(updatedLead)
    }

    // Create activity for status changes
    if (updates.status && updates.status !== existingLead.status) {
      const statusActivity = {
        leadId,
        type: "note" as "note" | "call" | "email" | "meeting" | "task",
        description: `Status changed from "${existingLead.status}" to "${updates.status}"`,
      }
      
      if (isProductionMode) {
        try {
          const { error } = await apiClient.createActivity(statusActivity)
          if (error) {
            console.error("Error creating status change activity:", error)
          }
        } catch (error) {
          console.error("Error creating status change activity:", error)
        }
      }
    }

    // Auto-save to API in production mode (immediate save, no manual save required)
    if (isProductionMode) {
      try {
        console.log(`💾 Auto-saving lead update for ${updatedLead.name}...`)
        const { error } = await apiClient.updateLead(updatedLead)
        if (error) {
          console.error("❌ Auto-save failed:", error)
          // Revert local state on error
          setLeads((prev) => prev.map((lead) => (lead.id === leadId ? existingLead : lead)))
          if (selectedLead?.id === leadId) {
            setSelectedLead(existingLead)
          }
          // Could show a toast notification here for user feedback
        } else {
          console.log(`✅ Auto-saved changes for ${updatedLead.name}`)
        }
      } catch (error) {
        console.error("❌ Auto-save network error:", error)
        // Revert on network error
        setLeads((prev) => prev.map((lead) => (lead.id === leadId ? existingLead : lead)))
        if (selectedLead?.id === leadId) {
          setSelectedLead(existingLead)
        }
      }
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    // Determine if we should delete from local state or API
    const leadToDelete = leads.find(l => l.id === leadId)
    if (!leadToDelete) return

    // Optimistically update local state
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId))
    if (selectedLead?.id === leadId) {
      setSelectedLead(null)
      setIsPanelOpen(false)
    }

    if (isProductionMode) {
      try {
        const { error } = await apiClient.deleteLead(leadId)
        if (error) {
          console.error("Error deleting lead:", error)
          // Revert on error
          setLeads((prev) => [...prev, leadToDelete])
          alert(`Failed to delete lead: ${error}`)
        } else {
          console.log(`✅ Successfully deleted lead ${leadId}`)
        }
      } catch (error) {
        console.error("Error deleting lead:", error)
        // Revert on error
        setLeads((prev) => [...prev, leadToDelete])
        alert("Failed to delete lead due to network error")
      }
    }
  }

  const handleLeadSelect = (lead: Lead) => {
    setSelectedLead(lead)
    setIsPanelOpen(true)
  }

  const handleMetricCardClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType)
  }

  const getFilteredLeads = () => {
    if (!activeFilter) return sortedLeads
    
    switch (activeFilter) {
      case 'interested':
        return sortedLeads.filter(lead => lead.status === "Interested")
      case 'my-leads':
        return sortedLeads.filter(lead => lead.ownerId === user?.id)
      case 'needs-attention':
        return sortedLeads.filter(lead => lead.needsAttention)
      case 'total':
        return sortedLeads
      default:
        return sortedLeads
    }
  }

  const handleAddNote = async (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social"; timestamp?: string }) => {
    const newNote = {
      id: Date.now().toString(),
      ...note,
      timestamp: note.timestamp || new Date().toISOString(),
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
        console.log(`Creating activity for lead ${leadId}:`, activity)
        const { error } = await apiClient.createActivity(activity)
        if (error) {
          console.error("Error creating activity:", error)
        } else {
          console.log(`✅ Successfully created activity for lead ${leadId}`)
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

  const handleCSVExport = () => {
    // Convert leads to CSV format matching the import format
    // Format: Name,Phone,Email,Property,Notes,,
    const csvRows: string[] = []
    
    // Add header row
    csvRows.push("Name,Phone,Email,Property,Notes,,")
    
    // Process each lead
    leads.forEach((lead) => {
      // Build name field - include company if available (matching import format)
      let nameField = lead.name
      if (lead.company) {
        nameField = `${lead.name}\n${lead.company}`
      }
      
      // Get phone and email
      const phone = lead.phone || ""
      const email = lead.email || ""
      
      // Get property - use first property from properties array, or fall back to address
      let property = ""
      if (lead.properties && lead.properties.length > 0) {
        property = lead.properties[0].address
        // If there are multiple properties, mention them in notes
        if (lead.properties.length > 1) {
          const additionalProps = lead.properties.slice(1).map(p => p.address).join("; ")
          if (lead.notes.length > 0 || additionalProps) {
            // Will be added to notes below
          }
        }
      } else {
        property = lead.address || ""
      }
      
      // Combine notes into a single text field
      // Format notes with timestamps if available
      let notesText = ""
      if (lead.notes && lead.notes.length > 0) {
        const noteTexts = lead.notes.map((note) => {
          const date = new Date(note.timestamp)
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
          const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          
          let notePrefix = ""
          if (note.type === "call") {
            notePrefix = "Called"
          } else if (note.type === "email") {
            notePrefix = "Emailed"
          } else if (note.type === "video") {
            notePrefix = "Video"
          } else if (note.type === "social") {
            notePrefix = "Social"
          }
          
          return `${notePrefix ? notePrefix + ", " : ""}${dateStr}${timeStr ? " " + timeStr : ""}: ${note.text}`
        })
        notesText = noteTexts.join(". ")
        
        // Add additional properties info if there are multiple
        if (lead.properties && lead.properties.length > 1) {
          const additionalProps = lead.properties.slice(1).map((p, idx) => {
            let propText = p.address
            if (p.isSold) {
              propText += " (Sold" + (p.soldDate ? ` ${new Date(p.soldDate).toLocaleDateString()}` : "") + ")"
            }
            return propText
          }).join("; ")
          if (additionalProps) {
            notesText += (notesText ? ". " : "") + `Additional properties: ${additionalProps}`
          }
        }
      } else if (lead.properties && lead.properties.length > 1) {
        // No notes but multiple properties
        const additionalProps = lead.properties.slice(1).map((p) => {
          let propText = p.address
          if (p.isSold) {
            propText += " (Sold" + (p.soldDate ? ` ${new Date(p.soldDate).toLocaleDateString()}` : "") + ")"
          }
          return propText
        }).join("; ")
        notesText = `Additional properties: ${additionalProps}`
      }
      
      // Escape CSV values (handle quotes and commas)
      const escapeCSV = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }
      
      // Build CSV row
      const row = [
        escapeCSV(nameField),
        escapeCSV(phone),
        escapeCSV(email),
        escapeCSV(property),
        escapeCSV(notesText),
        "", // Empty column
        ""  // Empty column
      ].join(",")
      
      csvRows.push(row)
    })
    
    // Create CSV content
    const csvContent = csvRows.join("\n")
    
    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `spaceport-crm-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
        const { data: createdLead, error } = await apiClient.createLead(apiLeadData)
        if (error) {
          console.error("Error creating lead:", error)
          // Remove from local state on error
          setLeads((prev) => prev.filter(lead => lead.id !== newLead.id))
        } else {
          // Create initial activity for new lead using the API-returned lead ID
          const actualLeadId = createdLead?.id || newLead.id
          console.log(`Creating initial activity for lead ${actualLeadId} with status: ${newLead.status}`)
          
          const initialActivity = {
            leadId: actualLeadId,
            type: "note" as "note" | "call" | "email" | "meeting" | "task",
            description: `Lead created with status: ${newLead.status}`,
          }
          
          try {
            const { error: activityError } = await apiClient.createActivity(initialActivity)
            if (activityError) {
              console.error("Error creating initial activity:", activityError)
            } else {
              console.log(`✅ Successfully created initial activity for lead ${actualLeadId}`)
            }
          } catch (activityError) {
            console.error("Error creating initial activity:", activityError)
          }
        }
      } catch (error) {
        console.error("Error creating lead:", error)
        // Remove from local state on error
        setLeads((prev) => prev.filter(lead => lead.id !== newLead.id))
      }
    }
  }

  const handleResetDatabase = async () => {
    if (!confirm("⚠️ WARNING: This will delete ALL contacts and activities from the database. This action cannot be undone. Are you sure you want to reset the database?")) {
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
        
        // Reset both leads and activities
        const [leadsResetResult, activitiesResetResult] = await Promise.all([
          apiClient.resetDatabase(),
          apiClient.resetActivities()
        ])
        
        if (leadsResetResult.error) {
          console.error("Error resetting leads database:", leadsResetResult.error)
          if (leadsResetResult.error.includes('Unauthorized') || leadsResetResult.error.includes('authentication') || leadsResetResult.error.includes('token')) {
            alert("❌ Failed to reset leads database: Authentication required. Please sign out and sign back in with a valid account.")
          } else {
            alert(`❌ Failed to reset leads database: ${leadsResetResult.error}`)
          }
          return
        }
        
        if (activitiesResetResult.error) {
          console.error("Error resetting activities database:", activitiesResetResult.error)
          if (activitiesResetResult.error.includes('schema') || activitiesResetResult.error.includes('key')) {
            alert("❌ Failed to reset activities database: Database schema mismatch. This may be due to recent changes. Please try again or contact support.")
          } else {
            alert(`❌ Failed to reset activities database: ${activitiesResetResult.error}`)
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
      
      alert("✅ Database reset successfully! All leads and activities have been cleared.")
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
          {/* Header with responsive layout for mobile */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-start justify-between mb-16 pt-12"
          >
            <div className={`flex items-start gap-6 ${isMobile ? 'flex-col' : ''}`}>
              <div className="flex-shrink-0">
                <Image src={process.env.NODE_ENV === 'production' ? '/logo-icon.svg' : '/logo-icon.svg'} alt="Company Logo" width={48} height={48} className="w-12 h-12" />
              </div>
              <div className="flex flex-col">
                <h1 className={`font-title text-primary-hierarchy mb-3 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>Welcome back, {user?.name}</h1>
                <p className={`text-gray-400 font-body ${isMobile ? 'text-base' : 'text-lg'}`}>
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
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 w-fit flex items-center gap-1">
                      Database Connected
                      {isBackgroundRefreshing && <RefreshCw className="h-3 w-3 animate-spin" />}
                    </Badge>
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
            <Card 
              className={`bg-black/20 backdrop-blur-xl border-system rounded-brand cursor-pointer transition-all duration-300 hover:bg-black/30 ${
                activeFilter === 'total' ? 'ring-2 ring-white/20 bg-black/30' : ''
              }`}
              onClick={() => handleMetricCardClick('total')}
            >
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

            <Card 
              className={`bg-black/20 backdrop-blur-xl border-system rounded-brand cursor-pointer transition-all duration-300 hover:bg-black/30 ${
                activeFilter === 'interested' ? 'ring-2 ring-green-500/20 bg-green-500/10' : ''
              }`}
              onClick={() => handleMetricCardClick('interested')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 font-body text-sm">Interested Leads</p>
                    <p className="text-3xl font-title text-primary-hierarchy">{interestedLeads}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Clock className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`bg-black/20 backdrop-blur-xl border-system rounded-brand cursor-pointer transition-all duration-300 hover:bg-black/30 ${
                activeFilter === 'my-leads' ? 'ring-2 ring-blue-500/20 bg-blue-500/10' : ''
              }`}
              onClick={() => handleMetricCardClick('my-leads')}
            >
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

            <Card 
              className={`bg-black/20 backdrop-blur-xl border-system rounded-brand cursor-pointer transition-all duration-300 hover:bg-black/30 ${
                activeFilter === 'needs-attention' ? 'ring-2 ring-red-500/20 bg-red-500/10' : ''
              }`}
              onClick={() => handleMetricCardClick('needs-attention')}
            >
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
                    onClick={handleCSVExport}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-pill px-6"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-pill px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                  <Button
                    onClick={() => setIsProspectModalOpen(true)}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-pill px-6 relative"
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Prospect List
                    {prospects.filter(p => !p.isCompleted).length > 0 && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">
                          {prospects.filter(p => !p.isCompleted).length}
                        </span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-3">
                  <Button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-white text-black hover:bg-gray-100 rounded-pill px-6 transition-all duration-200 font-body"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                  <Button
                    onClick={() => setIsProspectModalOpen(true)}
                    variant="outline"
                    className="border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body relative"
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Prospect List
                    {prospects.filter(p => !p.isCompleted).length > 0 && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">
                          {prospects.filter(p => !p.isCompleted).length}
                        </span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>

              <FollowUpPriority leads={getFilteredLeads()} onLeadSelect={handleLeadSelect} />

              {/* Leads Table Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-title text-primary-hierarchy">Leads Table</h2>
                  {activeFilter && (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/10 text-white border-white/20 rounded-full px-3 py-1">
                        {activeFilter === 'interested' && 'Interested Leads'}
                        {activeFilter === 'my-leads' && 'My Leads'}
                        {activeFilter === 'needs-attention' && 'Needs Attention'}
                        {activeFilter === 'total' && 'All Leads'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveFilter(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <LeadsTable
                  leads={getFilteredLeads()}
                  onLeadUpdate={handleLeadUpdate}
                  onLeadSelect={handleLeadSelect}
                  sortConfig={sortConfig}
                  onSortChange={setSortConfig}
                  users={availableUsers}
                  onDeleteLead={handleDeleteLead}
                />
              </div>

              {/* Bottom Action Buttons */}
              <div className={`flex justify-center gap-4 mt-12 mb-8 ${isMobile ? 'flex-col items-center' : ''}`}>
                <Button
                  onClick={() => setIsImportOpen(true)}
                  variant="outline"
                  className="border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button
                  onClick={handleCSVExport}
                  variant="outline"
                  className="border-white/20 text-gray-400 hover:bg-white/10 rounded-pill px-6 backdrop-blur-sm font-body"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
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
            users={availableUsers}
            onDeleteLead={handleDeleteLead}
          />

          <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddLead={handleAddLead} />

          <CSVImport isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleCSVImport} />

          <ProspectListModal
            isOpen={isProspectModalOpen}
            onClose={() => setIsProspectModalOpen(false)}
            onAddLead={handleAddLead}
          />
        </div>
      </div>
    </div>
  )
}
