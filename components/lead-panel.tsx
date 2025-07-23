"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check, FileText, MessageCircle, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import { SALES_CADENCE, calculateCadenceProgress, getProgressColor } from "@/lib/sales-cadence"
import { SalesProgress } from "./sales-progress"
import type { Lead } from "./leads-table"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type LeadStatus = Lead["status"]

interface LeadPanelProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAddNote: (leadId: string, note: { text: string; type: "call" | "email" | "note" | "video" | "social" }) => void
  onUpdateNote: (leadId: string, noteId: string, updates: { text: string; timestamp: string }) => void
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

  const handleUpdateNote = () => {
    if (!lead || !editingNoteId) return
    onUpdateNote(lead.id, editingNoteId, {
      text: editingNoteText,
      timestamp: new Date(editingNoteDate).toISOString()
    })
    setEditingNoteId(null)
    setEditingNoteText("")
    setEditingNoteDate("")
  }

  const handleStepAdvance = (stepId: number) => {
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

  if (!lead) return null

  const statusColor = colors.status[lead.status]

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] bg-black/95 backdrop-blur-xl border-l border-system overflow-y-auto">
        <div className="space-y-6">
          {/* Header with close button */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-title text-primary-hierarchy">Lead Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Main Info Section - Moved to top */}
          <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
            <CardHeader>
              <CardTitle className="text-primary-hierarchy font-title text-xl">{lead.name}</CardTitle>
              <CardDescription className="text-white/70">{lead.company || "No company"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-white/50" />
                  <span className="text-white/80">{lead.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-white/50" />
                  <span className="text-white/80">{lead.phone}</span>
                </div>
                {lead.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-white/50" />
                    <span className="text-white/80">{lead.address}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/60">Status:</span>
                {isEditingStatus ? (
                  <select
                    value={lead.status}
                    onChange={(e) => {
                      onUpdateLead(lead.id, { status: e.target.value as LeadStatus })
                      setIsEditingStatus(false)
                    }}
                    className="bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-white text-sm"
                  >
                    <option value="left voicemail">Left Voicemail</option>
                    <option value="cold">Cold</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="closed">Closed</option>
                    <option value="dormant">Dormant</option>
                  </select>
                ) : (
                  <button
                    onClick={() => setIsEditingStatus(true)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      lead.status === "interested"
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : lead.status === "contacted"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : lead.status === "closed"
                        ? "bg-white/20 text-white border border-white/30"
                        : lead.status === "dormant"
                        ? "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                        : lead.status === "left voicemail"
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                        : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                    }`}
                  >
                    {lead.status}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sales Progress - Second */}
          {progress && currentStep && (
            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
              <CardHeader>
                <CardTitle className="text-primary-hierarchy font-title text-lg">Sales Progress</CardTitle>
                <CardDescription className="text-white/70">
                  Current step: {currentStep.action}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SalesProgress 
                  progress={progress} 
                  statusColor={getProgressColor(progress, lead.status)} 
                  onStepClick={handleStepAdvance}
                />
              </CardContent>
            </Card>
          )}

          {/* Contact Reminder - Third */}
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

          {/* Add Note - Fourth */}
          <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
            <CardHeader>
              <CardTitle className="text-primary-hierarchy font-title text-lg">Add Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(["call", "email", "note", "video", "social"] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={noteType === type ? "default" : "outline"}
                    onClick={() => setNoteType(type)}
                    className={`rounded-full ${
                      noteType === type
                        ? "bg-white text-black"
                        : "bg-black/20 text-white/70 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {type === "call" && <Phone className="h-3 w-3 mr-1" />}
                    {type === "email" && <Mail className="h-3 w-3 mr-1" />}
                    {type === "note" && <FileText className="h-3 w-3 mr-1" />}
                    {type === "video" && <Video className="h-3 w-3 mr-1" />}
                    {type === "social" && <MessageCircle className="h-3 w-3 mr-1" />}
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>

              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-white/50 resize-none"
                rows={3}
              />

              <div className="flex gap-2">
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="bg-white text-black hover:bg-white/90 rounded-full disabled:opacity-50"
                >
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Interaction History - Fifth */}
          <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
            <CardHeader>
              <CardTitle className="text-primary-hierarchy font-title text-lg">Interaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lead.notes.length === 0 ? (
                  <p className="text-white/50 text-sm">No interactions yet</p>
                ) : (
                  lead.notes
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((note) => (
                      <div
                        key={note.id}
                        className="bg-black/20 rounded-xl p-3 border border-white/5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                note.text.includes("Set reminder:")
                                  ? "bg-blue-400"
                                  : note.type === "call"
                                  ? "bg-green-400"
                                  : note.type === "email"
                                  ? "bg-blue-400"
                                  : note.type === "video"
                                  ? "bg-purple-400"
                                  : note.type === "social"
                                  ? "bg-indigo-400"
                                  : "bg-white/50"
                              }`}
                            />
                            <span className="text-sm text-white/80">{note.text}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-white/50">
                              {new Date(note.timestamp).toLocaleDateString()}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingNoteId(note.id)
                                setEditingNoteText(note.text)
                                setEditingNoteDate(note.timestamp.split('T')[0])
                              }}
                              className="h-6 w-6 p-0 text-white/50 hover:text-white"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Note Dialog */}
        {editingNoteId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-96">
              <h3 className="text-lg font-title text-primary-hierarchy mb-4">Edit Note</h3>
              <div className="space-y-4">
                <textarea
                  value={editingNoteText}
                  onChange={(e) => setEditingNoteText(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white resize-none"
                  rows={3}
                />
                <input
                  type="date"
                  value={editingNoteDate}
                  onChange={(e) => setEditingNoteDate(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateNote}
                    className="bg-white text-black hover:bg-white/90 rounded-full"
                  >
                    Update
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingNoteId(null)
                      setEditingNoteText("")
                      setEditingNoteDate("")
                    }}
                    className="border-white/10 text-white hover:bg-white/10 rounded-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
