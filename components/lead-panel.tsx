"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
                      statusColor={getProgressColor(progress, lead.status)}
                    />
                    
                    {currentStep && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-primary-hierarchy font-title text-sm">Current Step: {currentStep.action}</h3>
                          <Badge className={`${statusColor.bg} ${statusColor.text} ${statusColor.border} rounded-full px-2 py-0.5 text-xs`}>
                            Day {currentStep.day}
                          </Badge>
                        </div>
                        <p className="text-medium-hierarchy font-body text-sm mb-4">{currentStep.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {currentStep.type === "call" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleQuickAction("call", "Made call")}
                                className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full"
                              >
                                <Phone className="h-3 w-3 mr-1" />
                                Made Call
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleQuickAction("call", "Left voicemail")}
                                className="bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 rounded-full"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Left Voicemail
                              </Button>
                            </>
                          )}
                          {currentStep.type === "email" && (
                            <Button
                              size="sm"
                              onClick={() => handleQuickAction("email", "Sent follow-up email")}
                              className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              Sent Email
                            </Button>
                          )}
                          {currentStep.type === "video" && (
                            <Button
                              size="sm"
                              onClick={() => handleQuickAction("video", "Sent video message")}
                              className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-full"
                            >
                              <Video className="h-3 w-3 mr-1" />
                              Sent Video
                            </Button>
                          )}
                          {currentStep.type === "social" && (
                            <Button
                              size="sm"
                              onClick={() => handleQuickAction("social", "Connected on LinkedIn")}
                              className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                            >
                              <Users className="h-3 w-3 mr-1" />
                              Connected
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
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
                        <Select value={lead.status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="w-32 bg-black/20 backdrop-blur-sm border-system rounded-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-black/90 backdrop-blur-xl border-system rounded-3xl">
                            <SelectItem value="Left Voicemail" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full bg-orange-500"
                                />
                                Left Voicemail
                              </div>
                            </SelectItem>
                            <SelectItem value="Contacted" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full bg-blue-500"
                                />
                                Contacted
                              </div>
                            </SelectItem>
                            <SelectItem value="Interested" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full bg-green-500"
                                />
                                Interested
                              </div>
                            </SelectItem>
                            <SelectItem value="Not Interested" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full bg-red-500"
                                />
                                Not Interested
                              </div>
                            </SelectItem>
                            <SelectItem value="Needs Follow-Up" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full bg-yellow-500"
                                />
                                Needs Follow-Up
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${statusColor.bg} ${statusColor.text} ${statusColor.border} rounded-full px-4 py-1.5 font-body`}
                          >
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
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
