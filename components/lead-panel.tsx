"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import { formatTimestamp } from "@/lib/utils"
import type { Lead } from "./leads-table"

interface LeadPanelProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAddNote: (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social" }) => void
  onUpdateNote: (leadId: string, noteId: string, updates: { text?: string; timestamp?: string }) => void
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void
}

export function LeadPanel({ lead, isOpen, onClose, onAddNote, onUpdateNote, onUpdateLead }: LeadPanelProps) {
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
    if (!lead) return

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
    })

    // Show feedback
    setReminderFeedback(`Reminder set for ${formatTimestamp(reminderDate.toISOString())}`)
    setTimeout(() => setReminderFeedback(null), 3000)

    // Reset custom reminder form
    setShowCustomReminder(false)
    setCustomReminderDate("")
  }

  const handleAddNote = () => {
    if (!lead || !newNote.trim()) return

    onAddNote(lead.id, {
      text: newNote,
      type: noteType,
    })
    setNewNote("")
  }

  const handleStatusChange = (newStatus: Lead["status"]) => {
    if (!lead) return
    onUpdateLead(lead.id, { status: newStatus })
    setIsEditingStatus(false)
  }

  const handleStartEditNote = (note: any) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.text)
    setEditingNoteDate(new Date(note.timestamp).toISOString())
  }

  const handleSaveNoteEdit = () => {
    if (!lead || !editingNoteId) return
    
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
    setEditingField(field)
    setEditingValue(value)
  }

  const handleSaveFieldEdit = () => {
    if (!lead || !editingField) return
    
    const updates: Partial<Lead> = {}
    if (editingField === 'name') updates.name = editingValue
    else if (editingField === 'phone') updates.phone = editingValue
    else if (editingField === 'email') updates.email = editingValue
    else if (editingField === 'address') updates.address = editingValue
    else if (editingField === 'company') updates.company = editingValue
    
    onUpdateLead(lead.id, updates)
    setEditingField(null)
    setEditingValue("")
  }

  const handleCancelFieldEdit = () => {
    setEditingField(null)
    setEditingValue("")
  }

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveFieldEdit()
    } else if (e.key === "Escape") {
      handleCancelFieldEdit()
    }
  }

  if (!isOpen || !lead) return null

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-medium-hierarchy hover:text-primary-hierarchy hover:bg-white/10 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>



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
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      2 Weeks
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSetReminder("1month")}
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      1 Month
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowCustomReminder(!showCustomReminder)}
                      className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
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
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSetReminder("custom")}
                          disabled={!customReminderDate}
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
                          onDoubleClick={() => handleStartEditField('name', lead.name)}
                        >
                          {lead.name}
                          <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditingStatus(true)}
                            className="text-medium-hierarchy hover:text-primary-hierarchy hover:bg-white/10 rounded-full p-1"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Property Address - Inline Editable */}
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl">
                    <MapPin className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Property Address</div>
                      {editingField === 'address' ? (
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
                          className="text-primary-hierarchy font-body leading-tight cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative"
                          onDoubleClick={() => handleStartEditField('address', lead.address)}
                        >
                          {lead.address}
                          <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      )}
                    </div>
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
                          className="text-primary-hierarchy font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative"
                          onDoubleClick={() => handleStartEditField('phone', lead.phone)}
                        >
                          {lead.phone}
                          <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
                          className="text-primary-hierarchy font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative"
                          onDoubleClick={() => handleStartEditField('email', lead.email)}
                        >
                          {lead.email}
                          <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company - Inline Editable (if exists) */}
                  {lead.company && (
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
                            className="text-primary-hierarchy font-body cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all duration-200 group relative"
                            onDoubleClick={() => handleStartEditField('company', lead.company || '')}
                          >
                            {lead.company}
                            <Edit3 className="h-3 w-3 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
                  <CardTitle className="text-primary-hierarchy font-title text-lg">Add Note</CardTitle>
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
                          className={
                            noteType === type
                              ? `bg-gradient-to-r ${colors.primary.gradient} text-white rounded-full font-body`
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
                  />
                  <Button
                    onClick={handleAddNote}
                    className={`w-full bg-gradient-to-r ${colors.primary.gradient} hover:from-purple-700 hover:to-purple-800 text-white rounded-full font-body`}
                    disabled={!newNote.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
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
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs rounded-full">
                                    Reminder
                                  </Badge>
                                  <span className="text-xs text-medium-hierarchy font-body">
                                    {new Date(note.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-primary-hierarchy font-body text-sm leading-relaxed">{note.text}</p>
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
                                    <span className="text-xs text-medium-hierarchy font-body">
                                      {formatTimestamp(note.timestamp)}
                                    </span>
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
                                      className="h-6 w-6 p-0 text-white hover:bg-white/10 rounded-full"
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
