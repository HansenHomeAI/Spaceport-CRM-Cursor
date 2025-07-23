"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check, FileText, Building, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import { SALES_CADENCE, calculateCadenceProgress, getProgressColor } from "@/lib/sales-cadence"
import { SalesProgress } from "./sales-progress"
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

  const progress = useMemo(() => {
    if (!lead) return null
    return calculateCadenceProgress(lead.notes)
  }, [lead?.notes])

  const currentStep = useMemo(() => {
    if (!progress || progress.isDormant) return null
    return SALES_CADENCE.find(step => step.id === progress.currentStep)
  }, [progress])

  const handleQuickAction = (type: "call" | "email" | "video" | "social" | "note", description: string) => {
    if (!lead || !currentStep) return

    onAddNote(lead.id, {
      text: `${currentStep.action}: ${description}`,
      type: type === "social" ? "note" : type,
    })
  }

  const handleStepClick = (stepId: number) => {
    if (!lead || !currentStep) return

    // Find the step that was clicked
    const clickedStep = SALES_CADENCE.find(step => step.id === stepId)
    if (!clickedStep) return

    // Add a note indicating this step was manually completed
    onAddNote(lead.id, {
      text: `Manually completed: ${clickedStep.action}`,
      type: "note",
    })
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

  const handleStatusChange = (newStatus: Lead["status"]) => {
    if (!lead) return
    onUpdateLead(lead.id, { status: newStatus })
    setIsEditingStatus(false)
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

  if (!lead) return null

  const statusColor = colors.status[lead.status]

  const getNoteTypeColor = (type: "call" | "email" | "note" | "video" | "social") => {
    switch (type) {
      case "call":
        return "bg-green-500/20 text-green-300"
      case "email":
        return "bg-blue-500/20 text-blue-300"
      case "note":
        return "bg-purple-500/20 text-purple-300"
      case "video":
        return "bg-orange-500/20 text-orange-300"
      case "social":
        return "bg-purple-500/20 text-purple-300"
      default:
        return "bg-gray-500/20 text-gray-300"
    }
  }

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

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Lead Information - Name and Address */}
                <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-primary-hierarchy font-title text-xl">{lead.name}</CardTitle>
                    <CardDescription className="text-secondary-hierarchy">
                      {lead.email} • {lead.phone}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-secondary-hierarchy" />
                        <span className="text-secondary-hierarchy">{lead.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-secondary-hierarchy" />
                        <span className="text-secondary-hierarchy">{lead.company}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Sales Progress */}
                {progress && !progress.isDormant && currentStep && (
                  <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
                    <CardHeader>
                      <CardTitle className="text-primary-hierarchy font-title text-lg">Sales Progress</CardTitle>
                      <CardDescription className="text-secondary-hierarchy">
                        Current step: {currentStep.action}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SalesProgress 
                        progress={progress} 
                        statusColor={statusColor.icon} 
                        onStepClick={handleStepClick}
                      />
                      
                      {/* Quick Actions */}
                      <div className="mt-6 space-y-3">
                        <h4 className="text-sm font-semibold text-primary-hierarchy">Quick Actions</h4>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleQuickAction("call", "Made call")}
                            className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full"
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Call
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQuickAction("call", "Left voicemail")}
                            className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            Voicemail
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQuickAction("email", "Sent email")}
                            className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-full"
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleQuickAction("video", "Sent personalized video")}
                            className="bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 rounded-full"
                          >
                            <Video className="h-3 w-3 mr-1" />
                            Video
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3. Contact Reminder */}
                <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
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

                {/* 4. Add Note */}
                <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-primary-hierarchy font-title text-lg">Add Note</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      {(["note", "call", "email", "video", "social"] as const).map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant={noteType === type ? "default" : "outline"}
                          onClick={() => setNoteType(type)}
                          className={`rounded-full ${
                            noteType === type
                              ? "bg-primary text-primary-foreground"
                              : "bg-black/20 text-secondary-hierarchy border-white/10 hover:bg-black/30"
                          }`}
                        >
                          {type === "note" && <FileText className="h-3 w-3 mr-1" />}
                          {type === "call" && <Phone className="h-3 w-3 mr-1" />}
                          {type === "email" && <Mail className="h-3 w-3 mr-1" />}
                          {type === "video" && <Video className="h-3 w-3 mr-1" />}
                          {type === "social" && <Share2 className="h-3 w-3 mr-1" />}
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="bg-black/20 border-white/10 text-white placeholder:text-secondary-hierarchy rounded-xl"
                      rows={3}
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl disabled:opacity-50"
                    >
                      Add Note
                    </Button>
                  </CardContent>
                </Card>

                {/* 5. Interaction History */}
                <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
                  <CardHeader>
                    <CardTitle className="text-primary-hierarchy font-title text-lg">Interaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {lead.notes.length === 0 ? (
                        <p className="text-secondary-hierarchy text-center py-4">No interactions yet</p>
                      ) : (
                        lead.notes
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .map((note) => (
                            <div key={note.id} className="flex items-start gap-3 p-3 bg-black/10 rounded-xl">
                              <div className={`p-2 rounded-lg ${getNoteTypeColor(note.type)}`}>
                                {note.type === "note" && <FileText className="h-4 w-4" />}
                                {note.type === "call" && <Phone className="h-4 w-4" />}
                                {note.type === "email" && <Mail className="h-4 w-4" />}
                                {note.type === "video" && <Video className="h-4 w-4" />}
                                {note.type === "social" && <Share2 className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-primary-hierarchy">
                                    {note.type.charAt(0).toUpperCase() + note.type.slice(1)}
                                  </span>
                                  <span className="text-xs text-secondary-hierarchy">
                                    {new Date(note.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-sm text-secondary-hierarchy">{note.text}</p>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
