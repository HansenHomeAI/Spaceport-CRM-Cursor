"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, MessageSquare, Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [editingNoteDate, setEditingNoteDate] = useState("")

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

  const handleQuickAction = (action: StatusAction, actionText: string) => {
    if (!lead || !progress) return

    onAddNote(lead.id, {
      text: `${action.action}: ${actionText}`,
      type: action.type === "text" ? "note" : action.type,
    })

    // Handle simple status transitions
    if (actionText.includes("Phone Answered") && currentStatus === "VOICEMAIL") {
      onUpdateLead(lead.id, { status: "CONTACTED" as any })
    } else if (actionText.includes("Showed Interest") && currentStatus === "CONTACTED") {
      onUpdateLead(lead.id, { status: "INTERESTED" as any })
    } else if (actionText.includes("Closed") && currentStatus === "INTERESTED") {
      onUpdateLead(lead.id, { status: "CLOSED" as any })
    } else if (actionText.includes("Not Interested")) {
      onUpdateLead(lead.id, { status: "NOT INTERESTED" as any })
    }
  }

  const handleStatusTransition = (newStatus: LeadStatus) => {
    if (!lead) return
    onUpdateLead(lead.id, { status: newStatus as any })
    setIsEditingStatus(false)
  }

  const handleAddNote = () => {
    if (!lead || !newNote.trim()) return
    onAddNote(lead.id, {
      text: newNote,
      type: "note",
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
  const nextAction = progress?.availableActions[0] // Only show the most important action

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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-black/90 backdrop-blur-xl border-l border-gray-800 z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{lead.name}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Sales Progress */}
              {progress && (
                <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                  <CardContent className="p-4">
                    <SalesProgress progress={progress} statusColor={statusColor} />
                  </CardContent>
                </Card>
              )}

              {/* Next Action - Simple and Clean */}
              {nextAction && (
                <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white">Next Action</h3>
                      {nextAction.priority === "high" && (
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-gray-300">{nextAction.action}</p>
                      <p className="text-xs text-gray-400">{nextAction.description}</p>
                    </div>

                    {/* Simple action buttons */}
                    <div className="flex gap-2">
                      {nextAction.quickActions?.slice(0, 2).map((quickAction) => (
                        <Button
                          key={quickAction}
                          size="sm"
                          onClick={() => handleQuickAction(nextAction, quickAction)}
                          className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700 rounded-lg text-xs"
                        >
                          {nextAction.type === "call" && <Phone className="h-3 w-3 mr-1" />}
                          {nextAction.type === "email" && <Mail className="h-3 w-3 mr-1" />}
                          {nextAction.type === "text" && <MessageSquare className="h-3 w-3 mr-1" />}
                          {quickAction}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status */}
              <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="text-sm text-white">{currentStatus}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStatus(!isEditingStatus)}
                      className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg h-6 w-6 p-0"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>

                  {isEditingStatus && (
                    <div className="mt-3">
                      <Select value={currentStatus} onValueChange={(value) => handleStatusTransition(value as LeadStatus)}>
                        <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 rounded-lg">
                          {Object.keys(STATUS_WORKFLOWS).map((status) => (
                            <SelectItem key={status} value={status} className="text-white hover:bg-gray-700">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getStatusColor(status as LeadStatus) }}
                                />
                                {status}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-300">{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-300">{lead.email}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{lead.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Note */}
              <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-medium text-white">Add Note</h3>
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note..."
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400 rounded-lg"
                    rows={3}
                  />
                  <Button
                    onClick={handleAddNote}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
                    disabled={!newNote.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </CardContent>
              </Card>

              {/* Notes History */}
              <Card className="bg-gray-900/50 backdrop-blur border-gray-800 rounded-lg">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Recent Activity</h3>
                  <div className="space-y-3">
                    {lead.notes.length === 0 ? (
                      <p className="text-sm text-gray-400">No activity yet</p>
                    ) : (
                      lead.notes
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .slice(0, 5) // Only show last 5 notes
                        .map((note) => {
                          const isEditing = editingNoteId === note.id
                          
                          return (
                            <div
                              key={note.id}
                              className="p-3 bg-gray-800/50 rounded-lg border-l-2"
                              style={{ borderLeftColor: statusColor }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 capitalize">{note.type}</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(note.timestamp).toLocaleDateString()}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditNote(note)}
                                  className="text-gray-400 hover:text-white hover:bg-gray-700 rounded h-6 w-6 p-0"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </div>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingNoteText}
                                    onChange={(e) => setEditingNoteText(e.target.value)}
                                    className="bg-gray-800 border-gray-700 text-white rounded-lg text-sm"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={handleSaveNoteEdit}
                                      className="bg-green-600 hover:bg-green-700 text-white rounded h-6 px-2 text-xs"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelNoteEdit}
                                      className="border-gray-600 text-gray-300 hover:bg-gray-700 rounded h-6 px-2 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-300">{note.text}</p>
                              )}
                            </div>
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
