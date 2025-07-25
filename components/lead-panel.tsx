"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3, Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

  const handleQuickAction = (actionText: string, type: "call" | "email" | "note" = "note") => {
    if (!lead) return

    onAddNote(lead.id, {
      text: actionText,
      type: type,
    })
  }

  const handleStatusTransition = (newStatus: LeadStatus) => {
    if (!lead) return
    
    onAddNote(lead.id, {
      text: `Status changed to ${newStatus}`,
      type: "note",
    })
    
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
  const nextAction = progress?.nextAction

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{lead.name}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                {isEditingStatus ? (
                  <Select value={currentStatus} onValueChange={(value) => handleStatusTransition(value as LeadStatus)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(STATUS_WORKFLOWS).map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: getStatusColor(status as LeadStatus) }}
                            />
                            {status.replace("_", " ")}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {currentStatus.replace("_", " ")}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingStatus(true)}
                      className="text-gray-400 hover:text-gray-600 p-1"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Sales Progress */}
              {progress && (
                <Card className="border border-gray-200 dark:border-gray-800">
                  <SalesProgress progress={progress} statusColor={statusColor} />
                </Card>
              )}

              {/* Quick Actions */}
              {nextAction && progress?.availableActions.length > 0 && (
                <Card className="border border-gray-200 dark:border-gray-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Next Action
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {nextAction.description}
                    </div>
                    <div className="flex gap-2">
                      {nextAction.quickActions?.slice(0, 2).map((quickAction) => (
                        <Button
                          key={quickAction}
                          size="sm"
                          onClick={() => {
                            const type = nextAction.type === "call" ? "call" : 
                                        nextAction.type === "email" ? "email" : "note"
                            handleQuickAction(`${nextAction.action}: ${quickAction}`, type)
                          }}
                          className="flex-1"
                        >
                          {nextAction.type === "call" && <Phone className="h-3 w-3 mr-1" />}
                          {nextAction.type === "email" && <Mail className="h-3 w-3 mr-1" />}
                          {quickAction}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Info */}
              <Card className="border border-gray-200 dark:border-gray-800">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{lead.address}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{lead.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">{lead.email}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Add Note */}
              <Card className="border border-gray-200 dark:border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Add Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Enter your note..."
                    className="resize-none"
                    rows={3}
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Notes */}
              {lead.notes.length > 0 && (
                <Card className="border border-gray-200 dark:border-gray-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {lead.notes
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 5)
                      .map((note) => {
                        const isEditing = editingNoteId === note.id
                        
                        return (
                          <div
                            key={note.id}
                            className="border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-2"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {note.type}
                                </Badge>
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={editingNoteDate}
                                    onChange={(e) => setEditingNoteDate(e.target.value)}
                                    className="text-xs text-gray-500 bg-transparent border border-gray-300 rounded px-1"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-500">
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
                                      className="h-6 px-2 text-xs"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelNoteEdit}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStartEditNote(note)}
                                    className="h-6 w-6 p-0"
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
                                className="text-sm resize-none"
                                rows={2}
                              />
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                {note.text}
                              </p>
                            )}
                          </div>
                        )
                      })}
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
