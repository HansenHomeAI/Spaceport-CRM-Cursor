"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check, MessageSquare, Clock, Zap, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import { 
  STATUS_WORKFLOWS, 
  calculateStatusProgress, 
  getStatusColor,
  type LeadStatus,
  type StatusProgress,
  type StatusAction
} from "@/lib/sales-cadence"
import { SalesProgress } from "./sales-progress"
import type { Lead } from "./leads-table"

interface LeadPanelProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAddNote: (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social" | "text" }) => void
  onUpdateNote: (leadId: string, noteId: string, updates: { text?: string; timestamp?: string }) => void
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void
}

export function LeadPanel({ lead, isOpen, onClose, onAddNote, onUpdateNote, onUpdateLead }: LeadPanelProps) {
  const [newNote, setNewNote] = useState("")
  const [noteType, setNoteType] = useState<"call" | "email" | "note" | "video" | "social" | "text">("note")
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [editingNoteDate, setEditingNoteDate] = useState("")
  const [showCustomReminder, setShowCustomReminder] = useState(false)
  const [customReminderDate, setCustomReminderDate] = useState("")
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null)
  const [showQuickNoteInput, setShowQuickNoteInput] = useState<string | null>(null)
  const [quickNoteText, setQuickNoteText] = useState("")

  // Convert old status to new status
  const normalizeStatus = (status: string): LeadStatus => {
    const statusMap: Record<string, LeadStatus> = {
      "cold": "NOT INTERESTED",
      "contacted": "CONTACTED", 
      "interested": "INTERESTED",
      "closed": "CLOSED",
      "dormant": "VOICEMAIL",
      "left voicemail": "VOICEMAIL",
      "Left Voicemail": "VOICEMAIL",
      "Contacted": "CONTACTED",
      "Interested": "INTERESTED", 
      "Not Interested": "NOT INTERESTED",
      "Needs Follow-Up": "VOICEMAIL",
      "VOICEMAIL": "VOICEMAIL",
      "CONTACTED": "CONTACTED",
      "INTERESTED": "INTERESTED",
      "NOT INTERESTED": "NOT INTERESTED",
      "CLOSED": "CLOSED"
    }
    
    return statusMap[status] || "CONTACTED"
  }

  // Auto-migrate status if it's in old format when panel opens
  useEffect(() => {
    if (lead && isOpen) {
      const normalizedStatus = normalizeStatus(lead.status as string)
      if (normalizedStatus !== (lead.status as string)) {
        console.log(`🔄 Auto-migrating status for ${lead.name}: "${lead.status}" → "${normalizedStatus}"`)
        onUpdateLead(lead.id, { status: normalizedStatus as any })
      }
    }
  }, [lead, isOpen, onUpdateLead])

  const currentStatus = useMemo(() => {
    if (!lead) return "CONTACTED"
    return normalizeStatus(lead.status as string)
  }, [lead?.status])

  const progress = useMemo((): StatusProgress | null => {
    if (!lead) return null
    return calculateStatusProgress(currentStatus, lead.notes)
  }, [lead?.notes, currentStatus])

  const handleQuickAction = (action: StatusAction, quickActionText: string, includeNote: boolean = false) => {
    if (!lead || !progress) return

    let noteText = `${action.action}: ${quickActionText}`
    if (includeNote && quickNoteText.trim()) {
      noteText += ` - ${quickNoteText}`
    }

    // Determine note type based on action
    let noteTypeToUse: "call" | "email" | "note" | "video" | "social" | "text" = action.type === "text" ? "note" : action.type

    onAddNote(lead.id, {
      text: noteText,
      type: noteTypeToUse,
    })

    // Handle status transitions
    if (action.autoTransition) {
      onUpdateLead(lead.id, { status: action.autoTransition as any })
    } else {
      // Special handling for transitions based on action result
      if (quickActionText.includes("Phone Answered") && currentStatus === "VOICEMAIL") {
        onUpdateLead(lead.id, { status: "CONTACTED" as any })
      } else if (quickActionText.includes("Interested") && currentStatus === "CONTACTED") {
        onUpdateLead(lead.id, { status: "INTERESTED" as any })
      } else if (quickActionText.includes("Not Interested")) {
        onUpdateLead(lead.id, { status: "NOT INTERESTED" as any })
      } else if (quickActionText.includes("Closed Deal")) {
        onUpdateLead(lead.id, { status: "CLOSED" as any })
      }
    }

    // Clear quick note
    setQuickNoteText("")
    setShowQuickNoteInput(null)
  }

  const handleStatusTransition = (newStatus: LeadStatus) => {
    if (!lead) return
    
    // Add a note about the status change
    onAddNote(lead.id, {
      text: `Status changed from ${currentStatus} to ${newStatus}`,
      type: "note",
    })
    
    onUpdateLead(lead.id, { status: newStatus as any })
    setIsEditingStatus(false)
  }

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
        reminderText = `Set reminder: Follow up on ${new Date(customReminderDate).toLocaleDateString()}`
        break
      default:
        return
    }

    onAddNote(lead.id, {
      text: reminderText,
      type: "note",
    })

    // Show feedback
    setReminderFeedback(`Reminder set for ${reminderDate.toLocaleDateString()}`)
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

  const handleStartEditNote = (note: any) => {
    setEditingNoteId(note.id)
    setEditingNoteText(note.text)
    setEditingNoteDate(new Date(note.timestamp).toISOString().split('T')[0])
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

  if (!isOpen || !lead) return null

  const statusColor = getStatusColor(currentStatus)
  const workflow = STATUS_WORKFLOWS[currentStatus]

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

              {/* Sales Progress */}
              {progress && (
                <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl overflow-hidden">
                  <CardContent className="p-6 pt-8">
                    <SalesProgress
                      progress={progress}
                      statusColor={statusColor}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Dynamic Action Buttons */}
              {progress && progress.availableActions.length > 0 && (
                <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" style={{ color: statusColor }} />
                      <CardTitle className="text-primary-hierarchy font-title text-lg">
                        Action Required
                      </CardTitle>
                      {progress.availableActions.some(a => a.priority === "high") && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs animate-pulse">
                          High Priority
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {progress.availableActions.map((action) => (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl border"
                        style={{
                          backgroundColor: `${statusColor}10`,
                          borderColor: action.priority === "high" ? "#ef4444" : `${statusColor}30`
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-title text-primary-hierarchy text-sm">{action.action}</h4>
                            <p className="text-xs text-medium-hierarchy">{action.description}</p>
                          </div>
                          <Badge 
                            className="text-xs"
                            style={{
                              backgroundColor: action.priority === "high" ? "#ef444420" : `${statusColor}20`,
                              color: action.priority === "high" ? "#ef4444" : statusColor,
                              borderColor: action.priority === "high" ? "#ef4444" : statusColor
                            }}
                          >
                            {action.priority} priority
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          {action.quickActions?.map((quickAction) => (
                            <Button
                              key={quickAction}
                              size="sm"
                              onClick={() => handleQuickAction(action, quickAction)}
                              className="rounded-full font-body text-xs"
                              style={{
                                backgroundColor: `${statusColor}20`,
                                color: statusColor,
                                borderColor: `${statusColor}40`
                              }}
                            >
                              {action.type === "call" && <Phone className="h-3 w-3 mr-1" />}
                              {action.type === "email" && <Mail className="h-3 w-3 mr-1" />}
                              {action.type === "text" && <MessageSquare className="h-3 w-3 mr-1" />}
                              {action.type === "video" && <Video className="h-3 w-3 mr-1" />}
                              {action.type === "social" && <Users className="h-3 w-3 mr-1" />}
                              {quickAction}
                            </Button>
                          ))}
                        </div>

                        {/* Quick note input */}
                        <AnimatePresence>
                          {showQuickNoteInput === action.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-2"
                            >
                              <Textarea
                                value={quickNoteText}
                                onChange={(e) => setQuickNoteText(e.target.value)}
                                placeholder="Add a quick note about this action..."
                                className="bg-black/20 backdrop-blur-sm border-system text-primary-hierarchy font-body placeholder:text-medium-hierarchy rounded-xl text-sm"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (action.quickActions?.[0]) {
                                      handleQuickAction(action, action.quickActions[0], true)
                                    }
                                  }}
                                  className="rounded-full text-xs"
                                  style={{
                                    backgroundColor: statusColor,
                                    color: "white"
                                  }}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Complete with Note
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setShowQuickNoteInput(null)
                                    setQuickNoteText("")
                                  }}
                                  className="rounded-full text-xs border-white/20 text-white hover:bg-white/10"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </motion.div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowQuickNoteInput(action.id)}
                              className="w-full rounded-full text-xs border-white/20 text-medium-hierarchy hover:bg-white/10"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add note with action
                            </Button>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}

                    {/* Status transition buttons */}
                    <div className="pt-4 border-t border-white/10">
                      <div className="text-xs text-medium-hierarchy mb-3 flex items-center gap-2">
                        <ArrowRight className="h-3 w-3" />
                        Quick Status Changes
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentStatus === "VOICEMAIL" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusTransition("CONTACTED")}
                            className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full text-xs"
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Answered Call
                          </Button>
                        )}
                        {currentStatus === "CONTACTED" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusTransition("INTERESTED")}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Showed Interest
                          </Button>
                        )}
                        {currentStatus === "INTERESTED" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusTransition("CLOSED")}
                            className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-full text-xs"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Closed Deal
                          </Button>
                        )}
                        {currentStatus !== "NOT INTERESTED" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusTransition("NOT INTERESTED")}
                            className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-full text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Not Interested
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                          type="date"
                          value={customReminderDate}
                          onChange={(e) => setCustomReminderDate(e.target.value)}
                          className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                          min={new Date().toISOString().split('T')[0]}
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
                    <CardTitle className="text-primary-hierarchy font-title">{lead.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      {isEditingStatus ? (
                        <Select value={currentStatus} onValueChange={(value) => handleStatusTransition(value as LeadStatus)}>
                          <SelectTrigger className="w-40 bg-black/20 backdrop-blur-sm border-system rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-2xl p-2">
                            {Object.keys(STATUS_WORKFLOWS).map((status) => (
                              <SelectItem key={status} value={status} className="rounded-xl font-body hover:bg-white/10 focus:bg-white/10 data-[highlighted]:bg-white/10 px-3 py-2.5 cursor-pointer">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: getStatusColor(status as LeadStatus) }}
                                  />
                                  <span className="text-white font-body">{status}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge
                            className="bg-black/20 text-white border-2 border-white/10 rounded-full px-4 py-1.5 font-body flex items-center gap-2"
                          >
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: statusColor }}
                            />
                            {currentStatus}
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
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl">
                    <MapPin className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-medium-hierarchy font-body mb-1">Property Address</div>
                      <div className="text-primary-hierarchy font-body leading-tight">{lead.address}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-primary-hierarchy font-body">
                    <Phone className="h-4 w-4" style={{ color: colors.interaction.call.icon }} />
                    <span>{lead.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-primary-hierarchy font-body">
                    <Mail className="h-4 w-4" style={{ color: colors.interaction.email.icon }} />
                    <span>{lead.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-primary-hierarchy font-body">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    <span>Last interaction: {lead.lastInteraction}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/20 backdrop-blur-xl border-system mb-6 rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-primary-hierarchy font-title text-lg">Add Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    {(["note", "call", "email", "text"] as const).map((type) => {
                      const typeColor = (type === "text" ? colors.interaction.note : colors.interaction[type as keyof typeof colors.interaction]) || colors.interaction.note
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
                          const noteColor = colors.interaction[note.type as keyof typeof colors.interaction] || colors.interaction.note
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
                                      type="date"
                                      value={editingNoteDate}
                                      onChange={(e) => setEditingNoteDate(e.target.value)}
                                      className="text-xs text-medium-hierarchy font-body bg-black/20 border border-white/10 rounded px-2 py-1"
                                    />
                                  ) : (
                                    <span className="text-xs text-medium-hierarchy font-body">
                                      {new Date(note.timestamp).toLocaleDateString()}
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
