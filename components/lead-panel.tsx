"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Users, Check, ExternalLink, ChevronDown, User, UserX, Trash2, Home, CheckCircle, Building2, AlertTriangle, RotateCcw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { colors } from "@/lib/colors"
import { formatTimestamp, isValidUrl, getGoogleMapsUrl } from "@/lib/utils"
import type { Lead, Brokerage, Contact } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth-context"
import { getMissingLeadFields } from "@/lib/lead-quality"

interface LeadPanelProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAddNote: (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social"; timestamp?: string }) => void
  onUpdateNote: (leadId: string, noteId: string, updates: { text?: string; timestamp?: string }) => void
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void
  users?: Array<{ id: string; name: string }>
  onDeleteLead?: (leadId: string) => void
  onRestoreLead?: (leadId: string) => void
  onPermanentDeleteLead?: (leadId: string) => void
  brokerages?: Brokerage[]
  onManageBrokerages?: () => void
}

export function LeadPanel({
  lead,
  isOpen,
  onClose,
  onAddNote,
  onUpdateNote,
  onUpdateLead,
  users = [],
  onDeleteLead,
  onRestoreLead,
  onPermanentDeleteLead,
  brokerages = [],
  onManageBrokerages,
}: LeadPanelProps) {
  const { user } = useAuth()
  const [newNote, setNewNote] = useState("")
  const [noteType, setNoteType] = useState<"call" | "email" | "note" | "video" | "social">("note")
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [editingNoteDate, setEditingNoteDate] = useState("")
  const [showCustomReminder, setShowCustomReminder] = useState(false)
  const [customReminderDate, setCustomReminderDate] = useState("")
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null)
  
  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editingContact, setEditingContact] = useState<Contact>({
    id: "",
    name: "",
    role: "",
    email: "",
    phone: "",
  })

  // Helper function to normalize old status values
  const normalizeStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      "cold": "Not Interested",
      "contacted": "Contacted", 
      "interested": "Interested",
      "closed": "Closed",
      "dormant": "Not Interested",
      "left voicemail": "Left Voicemail",
      "needs follow-up": "Not Interested",
      // New statuses (already correct)
      "Left Voicemail": "Left Voicemail",
      "Contacted": "Contacted",
      "Interested": "Interested", 
      "Not Interested": "Not Interested",
      "Closed": "Closed"
    }
    
    return statusMap[status] || "Left Voicemail"
  }

  // Auto-migrate status if it's in old format when panel opens
  useEffect(() => {
    if (lead && isOpen) {
      const normalizedStatus = normalizeStatus(lead.status)
      if (normalizedStatus !== lead.status) {
        console.log(`🔄 Auto-migrating status for ${lead.name}: "${lead.status}" → "${normalizedStatus}"`)
        onUpdateLead(lead.id, { status: normalizedStatus as Lead["status"] })
      }
    }
  }, [lead, isOpen, onUpdateLead])



  const handleSetReminder = (timeframe: string) => {
    if (!lead || isReadOnly) return

    let reminderDate: Date
    let reminderText: string

    switch (timeframe) {
      case "2weeks":
        reminderDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        reminderText = "Set reminder: Follow up in 2 weeks"
        break
      case "1month":
        reminderDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        reminderText = "Set reminder: Follow up in 1 month"
        break
      case "custom":
        if (!customReminderDate) return
        reminderDate = new Date(customReminderDate)
        reminderText = `Set reminder: Follow up on ${formatTimestamp(customReminderDate)}`
        break
      default:
        return
    }

    onAddNote(lead.id, {
      text: reminderText,
      type: "note",
      timestamp: reminderDate.toISOString(),
    })

    // Show feedback
    setReminderFeedback(`Reminder set for ${formatTimestamp(reminderDate.toISOString())}`)
    setTimeout(() => setReminderFeedback(null), 3000)

    // Reset custom reminder form
    setShowCustomReminder(false)
    setCustomReminderDate("")
  }

  const handleAddNote = () => {
    if (!lead || isReadOnly || !newNote.trim()) return

    onAddNote(lead.id, {
      text: newNote,
      type: noteType,
    })
    setNewNote("")
  }

  const handleStatusChange = (newStatus: Lead["status"]) => {
    if (!lead || isReadOnly) return
    onUpdateLead(lead.id, { status: newStatus })
    setIsEditingStatus(false)
  }

  const handleStartEditNote = (note: any) => {
    if (isReadOnly) return
    setEditingNoteId(note.id)
    setEditingNoteText(note.text)
    setEditingNoteDate(new Date(note.timestamp).toISOString())
  }

  const handleSaveNoteEdit = () => {
    if (!lead || isReadOnly || !editingNoteId) return
    
    onUpdateNote(lead.id, editingNoteId, {
      text: editingNoteText,
      timestamp: new Date(editingNoteDate).toISOString()
    })
    
    setEditingNoteId(null)
    setEditingNoteText("")
    setEditingNoteDate("")
  }

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null)
    setEditingNoteText("")
    setEditingNoteDate("")
  }

  // Inline editing handlers
  const handleStartEditField = (field: string, value: string) => {
    if (isReadOnly) return
    setEditingField(field)
    setEditingValue(value)
  }

  const handleSaveFieldEdit = () => {
    if (!lead || isReadOnly || !editingField) return
    
    const updates: Partial<Lead> = {}
    if (editingField === 'name') updates.name = editingValue
    else if (editingField === 'phone') updates.phone = editingValue
    else if (editingField === 'email') updates.email = editingValue
    else if (editingField === 'company') updates.company = editingValue
    
    onUpdateLead(lead.id, updates)
    setEditingField(null)
    setEditingValue("")
  }

  // Properties handlers
  const handleAddProperty = () => {
    if (!lead || isReadOnly) return
    const newProperty = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      address: "New Property Address",
      isSold: false
    }
    const updatedProperties = [...(lead.properties || []), newProperty]
    onUpdateLead(lead.id, { properties: updatedProperties })
    // Automatically start editing the new property
    handleStartEditProperty(newProperty.id, newProperty.address)
  }

  const handleUpdateProperty = (propertyId: string, updates: Partial<{ address: string; isSold: boolean }>) => {
    if (!lead || isReadOnly) return
    const updatedProperties = (lead.properties || []).map(p => 
      p.id === propertyId ? { ...p, ...updates } : p
    )
    onUpdateLead(lead.id, { properties: updatedProperties })
  }

  const handleDeleteProperty = (propertyId: string) => {
    if (!lead || isReadOnly) return
    const updatedProperties = (lead.properties || []).filter(p => p.id !== propertyId)
    onUpdateLead(lead.id, { properties: updatedProperties })
  }

  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null)
  const isReadOnly = Boolean(lead?.deletedAt)
  
  const handleStartEditProperty = (propertyId: string, address: string) => {
    if (isReadOnly) return
    setEditingPropertyId(propertyId)
    setEditingValue(address)
  }

  const handleSavePropertyEdit = () => {
    if (!lead || isReadOnly || !editingPropertyId) return
    handleUpdateProperty(editingPropertyId, { address: editingValue })
    setEditingPropertyId(null)
    setEditingValue("")
  }

  const handleCancelPropertyEdit = () => {
    setEditingPropertyId(null)
    setEditingValue("")
  }

  const handleCancelFieldEdit = () => {
    setEditingField(null)
    setEditingValue("")
  }

  const handleStartEditContact = (contact: Contact) => {
    if (isReadOnly) return
    setEditingContactId(contact.id)
    setEditingContact({
      id: contact.id,
      name: contact.name || "",
      role: contact.role || "",
      email: contact.email || "",
      phone: contact.phone || "",
    })
  }

  const handleSaveContactEdit = () => {
    if (!lead || isReadOnly || !editingContactId) return
    const updatedContacts = (lead.additionalContacts || []).map((contact) =>
      contact.id === editingContactId
        ? {
            ...contact,
            name: editingContact.name.trim() || "New Contact",
            role: editingContact.role?.trim() || "",
            email: editingContact.email?.trim() || "",
            phone: editingContact.phone?.trim() || "",
          }
        : contact,
    )
    onUpdateLead(lead.id, { additionalContacts: updatedContacts })
    setEditingContactId(null)
    setEditingContact({
      id: "",
      name: "",
      role: "",
      email: "",
      phone: "",
    })
  }

  const handleCancelContactEdit = () => {
    setEditingContactId(null)
    setEditingContact({
      id: "",
      name: "",
      role: "",
      email: "",
      phone: "",
    })
  }

  const handleAddContact = () => {
    if (!lead || isReadOnly) return
    const newContact: Contact = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: "New Contact",
      role: "",
      email: "",
      phone: "",
    }
    const updatedContacts = [...(lead.additionalContacts || []), newContact]
    onUpdateLead(lead.id, { additionalContacts: updatedContacts })
    handleStartEditContact(newContact)
  }

  const handleDeleteContact = (contactId: string) => {
    if (!lead || isReadOnly) return
    const updatedContacts = (lead.additionalContacts || []).filter((contact) => contact.id !== contactId)
    onUpdateLead(lead.id, { additionalContacts: updatedContacts })
    if (editingContactId === contactId) {
      handleCancelContactEdit()
    }
  }

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveFieldEdit()
    } else if (e.key === "Escape") {
      handleCancelFieldEdit()
    }
  }

  if (!isOpen || !lead) return null

  const missingFields = getMissingLeadFields(lead)
  const phoneDisplay = lead.phone && lead.phone !== "Not provided" ? lead.phone : "Add phone number"
  const emailDisplay = lead.email && lead.email !== "Not provided" ? lead.email : "Add email address"
  const companyDisplay = lead.company && lead.company.trim() ? lead.company : "Add company"
  const phoneIsMissing = phoneDisplay === "Add phone number"
  const emailIsMissing = emailDisplay === "Add email address"
  const companyIsMissing = companyDisplay === "Add company"

  // Get colors for the normalized status
  const normalizedStatus = normalizeStatus(lead.status)
  const statusColor = colors.status[normalizedStatus as keyof typeof colors.status] || colors.status["Contacted"]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-black/90 backdrop-blur-xl border-l border-system z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-title text-primary-hierarchy">Lead Details</h2>
                <div className="flex items-center gap-2">
                  {onDeleteLead && !lead.deletedAt && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white font-title">Move to Trash?</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-400 font-body">
                            Move <span className="text-white font-bold">{lead.name}</span> to the trash? You can restore it later.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => onDeleteLead(lead.id)}
                            className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                          >
                            Move to Trash
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-medium-hierarchy hover:text-primary-hierarchy hover:bg-white/10 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {lead.deletedAt && (
                <div className="mb-6 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-orange-200 font-body">
                        <AlertTriangle className="h-4 w-4" />
                        This lead is in the trash
                      </div>
                      <div className="text-xs text-orange-300 font-body mt-1">
                        Deleted {formatTimestamp(lead.deletedAt)}{lead.deletedByName ? ` by ${lead.deletedByName}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onRestoreLead && (
                        <Button
                          size="sm"
                          onClick={() => onRestoreLead(lead.id)}
                          className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      )}
                      {onPermanentDeleteLead && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-full"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete Forever
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white font-title">Delete Permanently?</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400 font-body">
                                Permanently delete <span className="text-white font-bold">{lead.name}</span>? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onPermanentDeleteLead(lead.id)}
                                className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                              >
                                Delete Forever
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              )}



              {/* Contact Reminder */}
              <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-primary-hierarchy font-title text-lg">Contact Reminder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reminderFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-green-500/20 text-green-300 border border-green-500/30 rounded-xl p-3 text-sm"
                    >
                      ✓ {reminderFeedback}
                    </motion.div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSetReminder("2weeks")}
                      disabled={isReadOnly}
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full disabled:opacity-40"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      2 Weeks
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSetReminder("1month")}
                      disabled={isReadOnly}
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full disabled:opacity-40"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      1 Month
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCustomReminder(!showCustomReminder)}
                      disabled={isReadOnly}
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full disabled:opacity-40"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Custom
                    </Button>
                  </div>

                  {showCustomReminder && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 pt-3 border-t border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={customReminderDate.slice(0, 16)}
                          onChange={(e) => setCustomReminderDate(e.target.value + ':00.000Z')}
                          disabled={isReadOnly}
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSetReminder("custom")}
                          disabled={!customReminderDate || isReadOnly}
                          className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full disabled:opacity-50"
                        >
                          Set
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Existing lead details card */}
              <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {editingField === 'name' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveFieldEdit}
                            onKeyDown={handleFieldKeyDown}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-title text-xl rounded-lg flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveFieldEdit}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full p-1"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCancelFieldEdit}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <CardTitle 
                          className="text-primary-hierarchy font-title cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative"
                          onClick={() => handleStartEditField('name', lead.name)}
                        >
                          {lead.name}
                          {!isReadOnly && (
                            <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          )}
                        </CardTitle>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditingStatus ? (
                        <Select value={lead.status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="w-32 bg-black/20 backdrop-blur-sm border-system rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-2">
                            <SelectItem value="Left Voicemail" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: colors.status["Left Voicemail"].icon }}
                                />
                                <span className="text-white font-body">Left Voicemail</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Contacted" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: colors.status["Contacted"].icon }}
                                />
                                <span className="text-white font-body">Contacted</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Interested" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: colors.status["Interested"].icon }}
                                />
                                <span className="text-white font-body">Interested</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Not Interested" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: colors.status["Not Interested"].icon }}
                                />
                                <span className="text-white font-body">Not Interested</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Closed" className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: colors.status["Closed"].icon }}
                                />
                                <span className="text-white font-body">Closed</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge
                            className="bg-black/20 text-white border-2 border-white/10 rounded-full px-4 py-1.5 font-body flex items-center gap-2"
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: statusColor.icon }}
                            />
                            {normalizedStatus}
                          </Badge>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsEditingStatus(true)}
                              className="text-medium-hierarchy hover:text-primary-hierarchy hover:bg-white/10 rounded-full p-1"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {missingFields.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3">
                      <div className="flex items-center gap-2 text-red-300 text-sm font-body">
                        <AlertTriangle className="h-4 w-4" />
                        Missing {missingFields.join(", ")}
                      </div>
                    </div>
                  )}

                  {/* Properties List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-medium-hierarchy font-body">Properties</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAddProperty}
                        disabled={isReadOnly}
                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-full disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Property
                      </Button>
                    </div>
                    
                    {(lead.properties || []).length === 0 && (
                      <div className="text-sm text-gray-500 italic p-3 bg-white/5 rounded-2xl text-center">
                        No properties listed
                      </div>
                    )}

                  {(lead.properties || []).map((property) => (
                    <div 
                      key={property.id} 
                      className={`flex items-start gap-3 p-3 bg-white/5 rounded-2xl group ${property.isSold ? 'opacity-70' : ''}`}
                    >
                        <div className="mt-0.5">
                          {property.isSold ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Home className="h-5 w-5 text-purple-400" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {editingPropertyId === property.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onBlur={handleSavePropertyEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePropertyEdit()
                                  if (e.key === 'Escape') handleCancelPropertyEdit()
                                }}
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1 h-8"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={handleSavePropertyEdit}
                                className="h-7 w-7 bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full p-0"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleCancelPropertyEdit}
                                className="h-7 w-7 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {isValidUrl(property.address) ? (
                                  <a 
                                    href={property.address} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={`text-sm ${property.isSold ? 'text-gray-400 line-through' : 'text-blue-400 hover:text-blue-300 hover:underline'} block truncate`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {property.address}
                                    <ExternalLink className="h-3 w-3 inline ml-1" />
                                  </a>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span 
                                      className={`text-sm font-body ${property.isSold ? 'text-gray-400 line-through' : 'text-white'} truncate cursor-pointer hover:bg-white/5 rounded px-1 -ml-1 transition-colors`}
                                      onDoubleClick={() => handleStartEditProperty(property.id, property.address)}
                                    >
                                      {property.address}
                                    </span>
                                    <a 
                                      href={getGoogleMapsUrl(property.address)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 w-fit"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View on Map <ExternalLink className="h-2 w-2" />
                                    </a>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-2 mr-2">
                                  <span className="text-xs text-gray-500 font-body">Sold</span>
                                  <Switch
                                    checked={property.isSold}
                                    onCheckedChange={(checked) => handleUpdateProperty(property.id, { isSold: checked })}
                                    disabled={isReadOnly}
                                    className="scale-75 data-[state=checked]:bg-green-500"
                                  />
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditProperty(property.id, property.address)}
                                  disabled={isReadOnly}
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-40"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isReadOnly}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full disabled:opacity-40"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-white font-title">Delete Property?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-gray-400 font-body">
                                        Are you sure you want to delete this property?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteProperty(property.id)}
                                        className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Additional Contacts */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-medium-hierarchy font-body">Additional Contacts</div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAddContact}
                        disabled={isReadOnly}
                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-full disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Contact
                      </Button>
                    </div>

                    {(lead.additionalContacts || []).length === 0 && (
                      <div className="text-sm text-gray-500 italic p-3 bg-white/5 rounded-2xl text-center">
                        No additional contacts
                      </div>
                    )}

                    {(lead.additionalContacts || []).map((contact) => {
                      const isEditingContact = editingContactId === contact.id
                      return (
                        <div key={contact.id} className="p-3 bg-white/5 rounded-2xl">
                          {isEditingContact ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  value={editingContact.name}
                                  onChange={(e) => setEditingContact((prev) => ({ ...prev, name: e.target.value }))}
                                  className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                                  placeholder="Name"
                                  autoFocus
                                />
                                <Input
                                  value={editingContact.role || ""}
                                  onChange={(e) => setEditingContact((prev) => ({ ...prev, role: e.target.value }))}
                                  className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                                  placeholder="Role"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  value={editingContact.email || ""}
                                  onChange={(e) => setEditingContact((prev) => ({ ...prev, email: e.target.value }))}
                                  className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                                  placeholder="Email"
                                  type="email"
                                />
                                <Input
                                  value={editingContact.phone || ""}
                                  onChange={(e) => setEditingContact((prev) => ({ ...prev, phone: e.target.value }))}
                                  className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                                  placeholder="Phone"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveContactEdit}
                                  className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full px-3"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelContactEdit}
                                  className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full px-3"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-body text-sm truncate">{contact.name}</div>
                                {contact.role && (
                                  <div className="text-xs text-gray-500 font-body truncate">{contact.role}</div>
                                )}
                                <div className="text-xs text-gray-400 font-body mt-1 space-y-1">
                                  {contact.email && <div>{contact.email}</div>}
                                  {contact.phone && <div>{contact.phone}</div>}
                                  {!contact.email && !contact.phone && (
                                    <div className="text-gray-500 italic">No contact details</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditContact(contact)}
                                  disabled={isReadOnly}
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-full disabled:opacity-40"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isReadOnly}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full disabled:opacity-40"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-white font-title">Delete Contact?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-gray-400 font-body">
                                        Are you sure you want to delete {contact.name || "this contact"}?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteContact(contact.id)}
                                        className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Phone Number - Inline Editable */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <Phone className="h-4 w-4 flex-shrink-0" style={{ color: colors.interaction.call.icon }} />
                    <div className="flex-1">
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Phone Number</div>
                      {editingField === 'phone' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveFieldEdit}
                            onKeyDown={handleFieldKeyDown}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveFieldEdit}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full p-1"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCancelFieldEdit}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative ${
                            phoneIsMissing ? 'text-gray-500 italic' : 'text-primary-hierarchy'
                          }`}
                          onClick={() => handleStartEditField('phone', phoneIsMissing ? "" : lead.phone)}
                        >
                          {phoneDisplay}
                          {!isReadOnly && (
                            <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email - Inline Editable */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <Mail className="h-4 w-4 flex-shrink-0" style={{ color: colors.interaction.email.icon }} />
                    <div className="flex-1">
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Email Address</div>
                      {editingField === 'email' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveFieldEdit}
                            onKeyDown={handleFieldKeyDown}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveFieldEdit}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full p-1"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCancelFieldEdit}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative ${
                            emailIsMissing ? 'text-gray-500 italic' : 'text-primary-hierarchy'
                          }`}
                          onClick={() => handleStartEditField('email', emailIsMissing ? "" : lead.email)}
                        >
                          {emailDisplay}
                          {!isReadOnly && (
                            <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company - Inline Editable */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <Users className="h-4 w-4 flex-shrink-0 text-blue-400" />
                    <div className="flex-1">
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Company</div>
                      {editingField === 'company' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveFieldEdit}
                            onKeyDown={handleFieldKeyDown}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body text-sm rounded-lg flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleSaveFieldEdit}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full p-1"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleCancelFieldEdit}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full p-1"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={`font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative ${
                            companyIsMissing ? 'text-gray-500 italic' : 'text-primary-hierarchy'
                          }`}
                          onClick={() => handleStartEditField('company', companyIsMissing ? "" : lead.company || '')}
                        >
                          {companyDisplay}
                          {!isReadOnly && (
                            <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Brokerage */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <Building2 className="h-4 w-4 flex-shrink-0 text-blue-400" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-medium-hierarchy font-body">Brokerage</div>
                        {onManageBrokerages && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onManageBrokerages}
                            className="text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-full px-2 py-1"
                          >
                            Manage
                          </Button>
                        )}
                      </div>
                      {brokerages.length > 0 ? (
                        <Select
                          value={lead.brokerageId || "none"}
                          onValueChange={(value) => {
                            if (value === "none") {
                              onUpdateLead(lead.id, { brokerageId: null, brokerageName: null })
                              return
                            }
                            const brokerage = brokerages.find((item) => item.id === value)
                            onUpdateLead(lead.id, {
                              brokerageId: value,
                              brokerageName: brokerage?.name,
                            })
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="w-full bg-black/20 backdrop-blur-sm border-system rounded-lg text-sm">
                            <SelectValue placeholder="Select brokerage" />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-2">
                            <SelectItem value="none" className="rounded-xl font-body hover:bg-white/10">
                              No brokerage
                            </SelectItem>
                            {brokerages.map((brokerage) => (
                              <SelectItem
                                key={brokerage.id}
                                value={brokerage.id}
                                className="rounded-xl font-body hover:bg-white/10"
                              >
                                {brokerage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-sm text-gray-500 font-body italic">
                          No brokerages yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lead Ownership */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <User className="h-4 w-4 flex-shrink-0 text-blue-400" />
                    <div className="flex-1">
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Lead Owner</div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isReadOnly}
                            className={`w-full justify-between ${
                              lead.ownerName
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                                : "text-gray-400 hover:text-white hover:bg-white/10"
                            } rounded-lg px-3 py-2 font-body text-sm h-auto`}
                          >
                            {lead.ownerName || "Unclaimed"}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 bg-black/90 backdrop-blur-xl border-system rounded-xl shadow-2xl p-1" align="start">
                          <div className="text-xs text-gray-400 font-body px-2 py-1.5">Assign to...</div>
                          
                          {/* Current User (Quick Action) */}
                          {user && (
                            <DropdownMenuItem
                              onClick={() => onUpdateLead(lead.id, { ownerId: user.id, ownerName: user.name })}
                              className="text-white hover:bg-white/10 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                            >
                              <User className="h-3 w-3 mr-2 text-blue-400" />
                              Me ({user.name})
                              {lead.ownerId === user.id && <Check className="h-3 w-3 ml-auto text-green-400" />}
                            </DropdownMenuItem>
                          )}
                          
                          <div className="h-px bg-white/10 my-1" />
                          
                          {/* Other Users */}
                          {users.filter(u => u.id !== user?.id).map((u) => (
                            <DropdownMenuItem
                              key={u.id}
                              onClick={() => onUpdateLead(lead.id, { ownerId: u.id, ownerName: u.name })}
                              className="text-white hover:bg-white/10 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                            >
                              <span className="w-5" />
                              {u.name}
                              {lead.ownerId === u.id && <Check className="h-3 w-3 ml-auto text-green-400" />}
                            </DropdownMenuItem>
                          ))}
                          
                          {/* Unassign */}
                          {lead.ownerId && (
                            <>
                              <div className="h-px bg-white/10 my-1" />
                              <DropdownMenuItem
                                onClick={() => onUpdateLead(lead.id, { ownerId: undefined, ownerName: undefined })}
                                className="text-red-300 hover:bg-red-500/20 rounded-lg px-2 py-1.5 cursor-pointer text-sm font-body"
                              >
                                <UserX className="h-3 w-3 mr-2" />
                                Unassign
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Last Interaction - Read Only */}
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
                    <Calendar className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Last Interaction</div>
                      <div className="text-primary-hierarchy font-body">
                        {lead.lastInteraction}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-primary-hierarchy font-title text-lg">Add Event</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {(["note", "call", "email"] as const).map((type) => {
                      const typeColor = colors.interaction[type]
                      return (
                        <Button
                          key={type}
                          variant={noteType === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNoteType(type)}
                          disabled={isReadOnly}
                          className={
                            noteType === type
                              ? `bg-gradient-to-r ${colors.primary.gradient} text-white rounded-full font-body shadow-lg ring-2 ring-white/20`
                              : `bg-black/20 ${typeColor.text} border-system hover:bg-white/10 rounded-full font-body`
                          }
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      )
                    })}
                  </div>
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note..."
                    className="bg-black/20 backdrop-blur-sm border-system text-primary-hierarchy font-body placeholder:text-medium-hierarchy rounded-2xl"
                    rows={3}
                    disabled={isReadOnly}
                  />
                  <Button
                    onClick={handleAddNote}
                    className={`w-full bg-gradient-to-r ${colors.primary.gradient} hover:from-purple-700 hover:to-purple-800 text-white rounded-full font-body`}
                    disabled={isReadOnly || !newNote.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-primary-hierarchy font-title text-lg">Interaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Upcoming Reminders */}
                    {lead.notes.filter(note => note.text.includes("Set reminder:")).length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-primary-hierarchy font-title text-sm mb-3">Upcoming Reminders</h4>
                        <div className="space-y-2">
                          {lead.notes
                            .filter(note => note.text.includes("Set reminder:"))
                            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                            .map((note) => (
                              <motion.div
                                key={note.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="border-l-2 pl-4 py-3 bg-blue-500/5 rounded-r-2xl"
                                style={{ borderLeftColor: colors.interaction.note.icon }}
                              >
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs rounded-full">
                                    Reminder
                                  </Badge>
                                  <span className="text-xs text-medium-hierarchy font-body">
                                    {new Date(note.timestamp).toLocaleDateString()}
                                  </span>
                                  {note.createdByName && (
                                    <span className="text-xs text-gray-500 font-body">by {note.createdByName}</span>
                                  )}
                                </div>
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-primary-hierarchy font-body text-sm leading-relaxed flex-1">{note.text}</p>
                                  {!emailIsMissing && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-white/10 text-white hover:bg-white/10 rounded-full text-xs px-3"
                                      asChild
                                    >
                                      <a href={`mailto:${lead.email}?subject=Follow%20up%20for%20${encodeURIComponent(lead.name)}`}>
                                        Email
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Past Interactions */}
                    {lead.notes.filter(note => !note.text.includes("Set reminder:")).length === 0 ? (
                      <p className="text-medium-hierarchy font-body text-sm">No interactions yet</p>
                    ) : (
                      lead.notes
                        .filter(note => !note.text.includes("Set reminder:"))
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((note) => {
                          const noteColor = colors.interaction[note.type]
                          const isEditing = editingNoteId === note.id
                          
                          return (
                            <motion.div
                              key={note.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="border-l-2 pl-4 py-3 bg-white/5 rounded-r-2xl"
                              style={{ borderLeftColor: noteColor.icon }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`${noteColor.bg} ${noteColor.text} ${noteColor.border} text-xs rounded-full font-body`}
                                  >
                                    {note.type}
                                  </Badge>
                                  {isEditing ? (
                                    <input
                                      type="datetime-local"
                                      value={editingNoteDate.slice(0, 16)}
                                      onChange={(e) => setEditingNoteDate(e.target.value + ':00.000Z')}
                                      className="text-xs text-medium-hierarchy font-body bg-black/20 border border-white/10 rounded px-2 py-1"
                                    />
                                  ) : (
                                    <>
                                      <span className="text-xs text-medium-hierarchy font-body">
                                        {formatTimestamp(note.timestamp)}
                                      </span>
                                      {note.createdByName && (
                                        <span className="text-xs text-gray-500 font-body">by {note.createdByName}</span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={handleSaveNoteEdit}
                                        className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 rounded-full"
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelNoteEdit}
                                        className="h-6 px-2 text-xs border-white/20 text-white hover:bg-white/10 rounded-full"
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEditNote(note)}
                                      disabled={isReadOnly}
                                      className="h-6 w-6 p-0 text-white hover:bg-white/10 rounded-full disabled:opacity-40"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {isEditing ? (
                                <Textarea
                                  value={editingNoteText}
                                  onChange={(e) => setEditingNoteText(e.target.value)}
                                  className="bg-black/20 backdrop-blur-sm border-system text-primary-hierarchy font-body placeholder:text-medium-hierarchy rounded-xl text-sm"
                                  rows={2}
                                />
                              ) : (
                                <p className="text-primary-hierarchy font-body text-sm leading-relaxed">{note.text}</p>
                              )}
                            </motion.div>
                          )
                        })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
