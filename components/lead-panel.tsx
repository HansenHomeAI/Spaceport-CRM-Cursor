"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Video, Users, Check, Share2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import { SALES_CADENCE, calculateCadenceProgress, getProgressColor } from "@/lib/sales-cadence"
import { SalesProgress } from "./sales-progress"
import type { Lead } from "./leads-table"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    if (!lead) return

    // Find the step that was clicked
    const clickedStep = SALES_CADENCE.find(step => step.id === stepId)
    if (!clickedStep) return

    // Add a note indicating manual step completion
    onAddNote(lead.id, {
      text: `Manually marked step complete: ${clickedStep.action}`,
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
        return "bg-green-500/20"
      case "email":
        return "bg-blue-500/20"
      case "note":
        return "bg-purple-500/20"
      case "video":
        return "bg-purple-500/20"
      case "social":
        return "bg-blue-500/20"
      default:
        return "bg-gray-500/20"
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] bg-black/95 backdrop-blur-xl border-l border-system overflow-y-auto">
        <div className="space-y-6">
          {/* Main Info Card - Moved to top */}
          <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-primary-hierarchy font-title text-2xl">{lead?.name}</CardTitle>
                  <p className="text-secondary-hierarchy text-sm mt-1">{lead?.company}</p>
                </div>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={lead?.avatar} alt={lead?.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                    {lead?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-secondary-hierarchy uppercase tracking-wider">Email</label>
                  <p className="text-primary-hierarchy">{lead?.email}</p>
                </div>
                <div>
                  <label className="text-xs text-secondary-hierarchy uppercase tracking-wider">Phone</label>
                  <p className="text-primary-hierarchy">{lead?.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-secondary-hierarchy uppercase tracking-wider">Status</label>
                  <div className="flex items-center gap-2">
                    {isEditingStatus ? (
                      <Select value={lead?.status} onValueChange={(value) => onUpdateLead(lead.id, { status: value })}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-white/10"
                        onClick={() => setIsEditingStatus(true)}
                      >
                        {lead?.status}
                      </Badge>
                    )}
                    {isEditingStatus && (
                      <Button size="sm" onClick={() => setIsEditingStatus(false)} className="h-6 px-2">
                        Done
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-secondary-hierarchy uppercase tracking-wider">Priority</label>
                  <Badge variant="outline" className="text-orange-400 border-orange-400/20">
                    {lead?.priority}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Progress */}
          {progress && currentStep && (
            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
              <CardHeader>
                <CardTitle className="text-primary-hierarchy font-title text-lg">Sales Progress</CardTitle>
                <p className="text-secondary-hierarchy text-sm">Current step: {currentStep.action}</p>
              </CardHeader>
              <CardContent>
                <SalesProgress 
                  progress={progress} 
                  statusColor={getProgressColor(progress, lead?.status || "new")}
                  onStepClick={handleStepClick}
                />
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {currentStep && (
            <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
              <CardHeader>
                <CardTitle className="text-primary-hierarchy font-title text-lg">Quick Actions</CardTitle>
                <p className="text-secondary-hierarchy text-sm">Suggested next steps</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleQuickAction("call", "Made call")}
                    className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-full"
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleQuickAction("email", "Sent email")}
                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full"
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleQuickAction("video", "Sent personalized video")}
                    className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-full"
                  >
                    <Video className="h-3 w-3 mr-1" />
                    Video
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleQuickAction("social", "Social media interaction")}
                    className="bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 rounded-full"
                  >
                    <Share2 className="h-3 w-3 mr-1" />
                    Social
                  </Button>
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

          {/* Interaction History */}
          <Card className="bg-black/20 backdrop-blur-xl border-system rounded-3xl">
            <CardHeader>
              <CardTitle className="text-primary-hierarchy font-title text-lg">Interaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lead?.notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-3 p-3 bg-black/10 rounded-xl">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getNoteTypeColor(note.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primary-hierarchy capitalize">
                          {note.type}
                        </span>
                        <span className="text-xs text-secondary-hierarchy">
                          {new Date(note.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-secondary-hierarchy">{note.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Add Note */}
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
                    className="rounded-full"
                  >
                    {type === "call" && <Phone className="h-3 w-3 mr-1" />}
                    {type === "email" && <Mail className="h-3 w-3 mr-1" />}
                    {type === "note" && <FileText className="h-3 w-3 mr-1" />}
                    {type === "video" && <Video className="h-3 w-3 mr-1" />}
                    {type === "social" && <Share2 className="h-3 w-3 mr-1" />}
                    {type}
                  </Button>
                ))}
              </div>
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="bg-black/20 border-white/10 text-white placeholder:text-gray-400"
                rows={3}
              />
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                Add Note
              </Button>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
