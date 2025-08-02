"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Check, Trash2, Edit3, ClipboardList, User, Phone, Mail, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { apiClient, type Prospect, type Lead } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatTimestamp } from "@/lib/utils"
import { colors } from "@/lib/colors"

// Smart parsing function for contact info (same as add lead modal)
const parseContactInfo = (text: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  // Email regex
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
    text = text.replace(emailMatch[0], "").trim()
  }

  // Improved phone regex - handles parentheses and more formats
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // Address detection (contains numbers and common address words)
  const addressKeywords = [
    "Street", "St", "Avenue", "Ave", "Road", "Rd", "Drive", "Dr", 
    "Lane", "Ln", "Boulevard", "Blvd", "Way", "Circle", "Cir",
  ]
  const addressMatch = addressKeywords.find((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))

  if (addressMatch) {
    const addressRegex = new RegExp(`[^,]*\\d+[^,]*${addressMatch}[^,]*`, "i")
    const match = text.match(addressRegex)
    if (match) {
      result.address = match[0].trim()
      text = text.replace(match[0], "").trim()
    }
  }

  // Enhanced company detection - real estate keywords
  const companyKeywords = [
    "Real Estate", "Realty", "Properties", "Group", "Team", "Associates", 
    "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc",
    "Partners", "HomeServices", "Sotheby's", "Compass", "Keller Williams", 
    "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", 
    "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", 
    "Upside", "Premier", "Edina", "Real Broker", "Toll Brothers", 
    "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", 
    "Compass Real Estate", "The Big Sky Real Estate Co", "Big Sky Sotheby's", 
    "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", 
    "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", 
    "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", 
    "Real Broker Alaska", "Premier Commercial Realty", "Edina Realty", 
    "Corcoran", "Houlihan Lawrence", "Construction", "Builders", "HomeServices"
  ]

  // Look for company names in the text
  for (const keyword of companyKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      // Find the full company name (including variations)
      const companyRegex = new RegExp(`[^,]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,]*`, "i")
      const match = text.match(companyRegex)
      if (match) {
        result.company = match[0].trim()
        text = text.replace(match[0], "").trim()
        break
      }
    }
  }

  // Clean up name - remove parenthetical aliases and extra info
  text = text.replace(/\([^)]*\)/g, "") // Remove (aka Lawrence) type content
  text = text.replace(/,+/g, " ") // Replace commas with spaces
  text = text.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (should be what's left after removing phone, email, company)
  if (text.length > 0) {
    // Remove any remaining non-alphabetic characters at the start/end
    const nameMatch = text.match(/^[^a-zA-Z]*([A-Za-z\s]+?)[^a-zA-Z]*$/)
    if (nameMatch) {
      result.name = nameMatch[1].trim()
    } else {
      result.name = text.trim()
    }
  }

  return result
}

interface ProspectListModalProps {
  isOpen: boolean
  onClose: () => void
  onAddLead?: (lead: Omit<Lead, "id" | "notes" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "lastUpdatedBy" | "lastUpdatedByName">) => void
}

export function ProspectListModal({ isOpen, onClose, onAddLead }: ProspectListModalProps) {
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  const [showAddLeadModal, setShowAddLeadModal] = useState<string | null>(null) // prospect ID
  const [selectedStatus, setSelectedStatus] = useState<Lead["status"]>("Contacted")
  
  const [formData, setFormData] = useState({
    content: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contactCompany: "",
    propertyAddress: "",
  })

  // Load prospects
  useEffect(() => {
    if (isOpen) {
      loadProspects()
    }
  }, [isOpen])

  const loadProspects = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await apiClient.getProspects()
      if (error) {
        console.error("Error loading prospects:", error)
      } else if (data) {
        setProspects(data)
      }
    } catch (error) {
      console.error("Error loading prospects:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted with content:", formData.content)
    
    if (!formData.content.trim()) {
      console.log("Content is empty, not submitting")
      return
    }

    const newProspect: Omit<Prospect, "id" | "createdAt" | "updatedAt"> = {
      content: formData.content,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      contactCompany: formData.contactCompany,
      propertyAddress: formData.propertyAddress,
      isCompleted: false,
      createdBy: user?.id,
      createdByName: user?.name,
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    console.log("Creating prospect:", newProspect)

    try {
      const { data, error } = await apiClient.createProspect(newProspect)
      if (error) {
        console.error("Error creating prospect:", error)
        alert("Failed to create prospect: " + error)
      } else if (data) {
        console.log("Prospect created successfully:", data)
        setProspects(prev => [data, ...prev])
        resetForm()
        setShowAddForm(false)
      }
    } catch (error) {
      console.error("Error creating prospect:", error)
      alert("Failed to create prospect: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  const handleUpdateProspect = async (prospect: Prospect) => {
    try {
      const { data, error } = await apiClient.updateProspect(prospect)
      if (error) {
        console.error("Error updating prospect:", error)
      } else if (data) {
        setProspects(prev => prev.map(p => p.id === data.id ? data : p))
        setEditingProspect(null)
      }
    } catch (error) {
      console.error("Error updating prospect:", error)
    }
  }

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) return

    try {
      const { error } = await apiClient.deleteProspect(id)
      if (error) {
        console.error("Error deleting prospect:", error)
      } else {
        setProspects(prev => prev.filter(p => p.id !== id))
      }
    } catch (error) {
      console.error("Error deleting prospect:", error)
    }
  }

  const handleToggleComplete = (prospect: Prospect) => {
    const updatedProspect = { ...prospect, isCompleted: !prospect.isCompleted }
    handleUpdateProspect(updatedProspect)
  }

  const resetForm = () => {
    setFormData({
      content: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      contactCompany: "",
      propertyAddress: "",
    })
  }

  const startEdit = (prospect: Prospect) => {
    setEditingProspect(prospect)
    setFormData({
      content: prospect.content,
      contactName: prospect.contactName || "",
      contactPhone: prospect.contactPhone || "",
      contactEmail: prospect.contactEmail || "",
      contactCompany: prospect.contactCompany || "",
      propertyAddress: prospect.propertyAddress || "",
    })
  }

  const cancelEdit = () => {
    setEditingProspect(null)
    resetForm()
  }

  const saveEdit = async () => {
    if (!editingProspect) return

    const updatedProspect: Prospect = {
      ...editingProspect,
      content: formData.content,
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      contactEmail: formData.contactEmail,
      contactCompany: formData.contactCompany,
      propertyAddress: formData.propertyAddress,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    await handleUpdateProspect(updatedProspect)
    cancelEdit()
  }

  const handleQuickAddLead = async (prospect: Prospect) => {
    if (!onAddLead) return

    // Validate required fields
    if (!prospect.contactName || !prospect.propertyAddress) {
      alert("Contact name and property address are required to create a lead.")
      return
    }

    // Create lead from prospect data
    const newLead: Omit<Lead, "id" | "notes" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "lastUpdatedBy" | "lastUpdatedByName"> = {
      name: prospect.contactName,
      phone: prospect.contactPhone || "",
      email: prospect.contactEmail || "",
      address: prospect.propertyAddress,
      company: prospect.contactCompany,
      status: selectedStatus,
      lastInteraction: new Date().toISOString(),
      ownerId: user?.id,
      ownerName: user?.name,
      nextActionDate: new Date().toISOString(),
    }

    // Add the lead
    onAddLead(newLead)

    // Mark prospect as completed
    const updatedProspect: Prospect = {
      ...prospect,
      isCompleted: true,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    await handleUpdateProspect(updatedProspect)
    setShowAddLeadModal(null)
    setSelectedStatus("Contacted")
  }

  // Auto-parse content when pasting into the main content field
  const handleContentPaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText.length > 50) { // Only parse if it's substantial content
      const parsed = parseContactInfo(pastedText)
      setFormData(prev => ({
        ...prev,
        contactName: parsed.name || prev.contactName,
        contactPhone: parsed.phone || prev.contactPhone,
        contactEmail: parsed.email || prev.contactEmail,
        contactCompany: parsed.company || prev.contactCompany,
        propertyAddress: parsed.address || prev.propertyAddress,
      }))
    }
  }

  // Check if we can add a lead (has required fields)
  const canAddLead = formData.contactName && formData.propertyAddress



  const activeProspects = prospects.filter(p => !p.isCompleted)
  const completedProspects = prospects.filter(p => p.isCompleted)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 z-50 overflow-hidden"
          >
            <div className="h-full bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-[25px] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <ClipboardList className="h-5 w-5 text-green-400" />
                    </div>
                  <div>
                    <h2 className="text-2xl font-title text-primary-hierarchy">Prospect List</h2>
                    <p className="text-gray-400 font-body text-sm">
                      {activeProspects.length} active, {completedProspects.length} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                                                        className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-[25px]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prospect
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                                                        className="text-medium-hierarchy hover:text-primary-hierarchy hover:bg-white/10 rounded-[25px]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Add/Edit Form */}
                    {(showAddForm || editingProspect) && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white/5 rounded-[25px] p-6 border border-white/10"
                      >
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">
                          {editingProspect ? "Edit Prospect" : "Add New Prospect"}
                        </h3>
                        <form onSubmit={editingProspect ? saveEdit : handleSubmit} className="space-y-4">
                          <div>
                            <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                              Prospect Note *
                            </label>
                            <Textarea
                              value={formData.content}
                              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                              onPaste={handleContentPaste}
                              placeholder="Enter prospect details, property links, contact info, or any notes... (Paste contact info to auto-parse)"
                              className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                              rows={4}
                              required
                            />
                          </div>

                          {/* Contact Information Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block flex items-center gap-2">
                                <User className="h-3 w-3" style={{ color: colors.interaction.call.icon }} />
                                Contact Name *
                              </label>
                              <Input
                                value={formData.contactName}
                                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                                placeholder="Enter contact name"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block flex items-center gap-2">
                                <Phone className="h-3 w-3" style={{ color: colors.interaction.call.icon }} />
                                Phone Number
                              </label>
                              <Input
                                value={formData.contactPhone}
                                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                                placeholder="Enter phone number"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block flex items-center gap-2">
                                <Mail className="h-3 w-3" style={{ color: colors.interaction.email.icon }} />
                                Email Address
                              </label>
                              <Input
                                value={formData.contactEmail}
                                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                                placeholder="Enter email address"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block flex items-center gap-2">
                                <Users className="h-3 w-3" style={{ color: colors.interaction.social.icon }} />
                                Company
                              </label>
                              <Input
                                value={formData.contactCompany}
                                onChange={(e) => setFormData(prev => ({ ...prev, contactCompany: e.target.value }))}
                                placeholder="Enter company name"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block flex items-center gap-2">
                                <MapPin className="h-3 w-3" style={{ color: colors.interaction.note.icon }} />
                                Property Address *
                              </label>
                              <Input
                                value={formData.propertyAddress}
                                onChange={(e) => setFormData(prev => ({ ...prev, propertyAddress: e.target.value }))}
                                placeholder="Enter property address"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-[25px]"
                                required
                              />
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={editingProspect ? cancelEdit : () => setShowAddForm(false)}
                              className="flex-1 border-white/20 text-gray-400 bg-transparent hover:bg-white/10 rounded-[25px] font-body"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={!formData.content.trim()}
                              className="flex-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-[25px] transition-all duration-200 font-body disabled:opacity-50"
                            >
                              {editingProspect ? "Update Prospect" : "Add Prospect"}
                            </Button>
                            {/* Add Lead Button - only show when not editing and has required fields */}
                            {!editingProspect && onAddLead && canAddLead && (
                              <Button
                                type="button"
                                onClick={() => {
                                  const newLead: Omit<Lead, "id" | "notes" | "createdAt" | "updatedAt" | "createdBy" | "createdByName" | "lastUpdatedBy" | "lastUpdatedByName"> = {
                                    name: formData.contactName,
                                    phone: formData.contactPhone,
                                    email: formData.contactEmail,
                                    address: formData.propertyAddress,
                                    company: formData.contactCompany,
                                    status: "Contacted",
                                    lastInteraction: new Date().toISOString(),
                                    ownerId: user?.id,
                                    ownerName: user?.name,
                                    nextActionDate: new Date().toISOString(),
                                  }
                                  onAddLead(newLead)
                                  resetForm()
                                  setShowAddForm(false)
                                }}
                                className="flex-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30 rounded-[25px] transition-all duration-200 font-body"
                              >
                                Add Lead
                              </Button>
                            )}
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {/* Active Prospects */}
                    {activeProspects.length > 0 && (
                      <div>
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">Recommended Contacts</h3>
                        <div className="space-y-3">
                          {activeProspects.map((prospect) => (
                            <motion.div
                              key={prospect.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/5 rounded-[25px] p-4 border border-white/10 hover:bg-white/10 transition-all duration-200"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="mb-3">
                                    <p className="text-primary-hierarchy font-body whitespace-pre-wrap">{prospect.content}</p>
                                  </div>
                                  
                                                                     {/* Contact Information Display */}
                                   {(prospect.contactName || prospect.contactPhone || prospect.contactEmail || prospect.contactCompany || prospect.propertyAddress) && (
                                     <div className="mb-3 p-3 bg-black/20 rounded-[25px] border border-white/5">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                        {prospect.contactName && (
                                          <div className="flex items-center gap-2 text-gray-300">
                                            <User className="h-3 w-3" style={{ color: colors.interaction.call.icon }} />
                                            <span className="font-body">{prospect.contactName}</span>
                                          </div>
                                        )}
                                        {prospect.contactPhone && (
                                          <div className="flex items-center gap-2 text-gray-300">
                                            <Phone className="h-3 w-3" style={{ color: colors.interaction.call.icon }} />
                                            <span className="font-body">{prospect.contactPhone}</span>
                                          </div>
                                        )}
                                        {prospect.contactEmail && (
                                          <div className="flex items-center gap-2 text-gray-300">
                                            <Mail className="h-3 w-3" style={{ color: colors.interaction.email.icon }} />
                                            <span className="font-body">{prospect.contactEmail}</span>
                                          </div>
                                        )}
                                        {prospect.contactCompany && (
                                          <div className="flex items-center gap-2 text-gray-300">
                                            <Users className="h-3 w-3" style={{ color: colors.interaction.social.icon }} />
                                            <span className="font-body">{prospect.contactCompany}</span>
                                          </div>
                                        )}
                                        {prospect.propertyAddress && (
                                          <div className="flex items-center gap-2 text-gray-300 md:col-span-2">
                                            <MapPin className="h-3 w-3" style={{ color: colors.interaction.note.icon }} />
                                            <span className="font-body">{prospect.propertyAddress}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-gray-400">
                                    <span>Added {formatTimestamp(prospect.createdAt)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {/* Quick Add Lead Button */}
                                  {onAddLead && (prospect.contactName || prospect.contactPhone) && (
                                    <Button
                                      size="sm"
                                      onClick={() => setShowAddLeadModal(prospect.id)}
                                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30 rounded-[25px]"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleComplete(prospect)}
                                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-full"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEdit(prospect)}
                                    className="text-white hover:bg-white/10 rounded-[25px]"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteProspect(prospect.id)}
                                    className="text-red-400 hover:bg-red-500/10 rounded-[25px]"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Quick Add Lead Modal */}
                              {showAddLeadModal === prospect.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 p-4 bg-black/30 rounded-[25px] border border-white/10"
                                >
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <Plus className="h-4 w-4 text-blue-400" />
                                      <span className="text-sm font-body text-primary-hierarchy">Add as Lead</span>
                                    </div>
                                    <div>
                                      <label className="text-xs text-medium-hierarchy font-body mb-1 block">
                                        Initial Status
                                      </label>
                                      <Select value={selectedStatus} onValueChange={(value: Lead["status"]) => setSelectedStatus(value)}>
                                        <SelectTrigger className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-[25px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-2">
                                          <SelectItem value="Contacted" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                            Contacted
                                          </SelectItem>
                                          <SelectItem value="Left Voicemail" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                            Left Voicemail
                                          </SelectItem>
                                          <SelectItem value="Interested" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                            Interested
                                          </SelectItem>
                                          <SelectItem value="Not Interested" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                            Not Interested
                                          </SelectItem>
                                          <SelectItem value="Closed" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                            Closed
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex gap-2">
                                                                              <Button
                                          size="sm"
                                          onClick={() => handleQuickAddLead(prospect)}
                                          className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30 rounded-[25px] flex-1"
                                        >
                                          Add Lead
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setShowAddLeadModal(null)}
                                          className="border-white/20 text-gray-400 hover:bg-white/10 rounded-[25px]"
                                        >
                                          Cancel
                                        </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed Prospects */}
                    {completedProspects.length > 0 && (
                      <div>
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">Completed</h3>
                        <div className="space-y-3">
                          {completedProspects.map((prospect) => (
                            <motion.div
                              key={prospect.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/5 rounded-[25px] p-4 border border-white/10 opacity-60"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="mb-2">
                                    <p className="text-primary-hierarchy font-body whitespace-pre-wrap line-through">{prospect.content}</p>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    <span>Completed {formatTimestamp(prospect.updatedAt)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleComplete(prospect)}
                                    className="bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 border-gray-500/30 rounded-[25px]"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteProspect(prospect.id)}
                                    className="text-red-400 hover:bg-red-500/10 rounded-[25px]"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {prospects.length === 0 && !showAddForm && (
                      <div className="text-center py-16">
                        <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ClipboardList className="h-8 w-8 text-green-400" />
                        </div>
                        <h3 className="text-xl font-title text-white mb-2">No prospects yet</h3>
                        <p className="text-gray-400 font-body mb-6">
                          Add your first prospect to start building your pipeline.
                        </p>
                        <Button
                          onClick={() => setShowAddForm(true)}
                          className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-pill px-6"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Prospect
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 