"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Phone, Mail, Calendar, Plus, MapPin, Edit3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { colors } from "@/lib/colors"
import type { Lead } from "./leads-table"

interface LeadPanelProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onAddNote: (leadId: string, note: { text: string; type: "call" | "email" | "note" }) => void
  onUpdateNote: (leadId: string, noteId: string, updates: { text?: string; timestamp?: string }) => void
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => void
}

export function LeadPanel({ lead, isOpen, onClose, onAddNote, onUpdateNote, onUpdateLead }: LeadPanelProps) {
  const [newNote, setNewNote] = useState("")
  const [noteType, setNoteType] = useState<"call" | "email" | "note">("note")
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState("")
  const [editingNoteDate, setEditingNoteDate] = useState("")

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
                            <SelectItem value="cold" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${statusColor.bg}`}
                                  style={{ backgroundColor: colors.status.cold.icon }}
                                />
                                Cold
                              </div>
                            </SelectItem>
                            <SelectItem value="contacted" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: colors.status.contacted.icon }}
                                />
                                Contacted
                              </div>
                            </SelectItem>
                            <SelectItem value="interested" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: colors.status.interested.icon }}
                                />
                                Interested
                              </div>
                            </SelectItem>
                            <SelectItem value="closed" className="rounded-full font-body">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: colors.status.closed.icon }}
                                />
                                Closed
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
                    {lead.notes.length === 0 ? (
                      <p className="text-medium-hierarchy font-body text-sm">No interactions yet</p>
                    ) : (
                      lead.notes
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
