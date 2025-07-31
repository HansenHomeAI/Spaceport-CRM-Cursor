"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Check, Trash2, Edit3, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { apiClient, type Prospect } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { formatTimestamp } from "@/lib/utils"

interface ProspectListModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProspectListModal({ isOpen, onClose }: ProspectListModalProps) {
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null)
  
  const [formData, setFormData] = useState({
    content: "",
  })

  // Load prospects
  useEffect(() => {
    if (isOpen) {
      loadProspects()
    }
  }, [isOpen])

  const loadProspects = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await apiClient.getProspects()
      if (error) {
        console.error("Error loading prospects:", error)
      } else if (data) {
        setProspects(data)
      }
    } catch (error) {
      console.error("Error loading prospects:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted with content:", formData.content)
    
    if (!formData.content.trim()) {
      console.log("Content is empty, not submitting")
      return
    }

    const newProspect: Omit<Prospect, "id" | "createdAt" | "updatedAt"> = {
      content: formData.content,
      isCompleted: false,
      createdBy: user?.id,
      createdByName: user?.name,
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    console.log("Creating prospect:", newProspect)

    try {
      const { data, error } = await apiClient.createProspect(newProspect)
      if (error) {
        console.error("Error creating prospect:", error)
        alert("Failed to create prospect: " + error)
      } else if (data) {
        console.log("Prospect created successfully:", data)
        setProspects(prev => [data, ...prev])
        resetForm()
        setShowAddForm(false)
      }
    } catch (error) {
      console.error("Error creating prospect:", error)
      alert("Failed to create prospect: " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  const handleUpdateProspect = async (prospect: Prospect) => {
    try {
      const { data, error } = await apiClient.updateProspect(prospect)
      if (error) {
        console.error("Error updating prospect:", error)
      } else if (data) {
        setProspects(prev => prev.map(p => p.id === data.id ? data : p))
        setEditingProspect(null)
      }
    } catch (error) {
      console.error("Error updating prospect:", error)
    }
  }

  const handleDeleteProspect = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) return

    try {
      const { error } = await apiClient.deleteProspect(id)
      if (error) {
        console.error("Error deleting prospect:", error)
      } else {
        setProspects(prev => prev.filter(p => p.id !== id))
      }
    } catch (error) {
      console.error("Error deleting prospect:", error)
    }
  }

  const handleToggleComplete = (prospect: Prospect) => {
    const updatedProspect = { ...prospect, isCompleted: !prospect.isCompleted }
    handleUpdateProspect(updatedProspect)
  }

  const resetForm = () => {
    setFormData({
      content: "",
    })
  }

  const startEdit = (prospect: Prospect) => {
    setEditingProspect(prospect)
    setFormData({
      content: prospect.content,
    })
  }

  const cancelEdit = () => {
    setEditingProspect(null)
    resetForm()
  }

  const saveEdit = async () => {
    if (!editingProspect) return

    const updatedProspect: Prospect = {
      ...editingProspect,
      content: formData.content,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    await handleUpdateProspect(updatedProspect)
    cancelEdit()
  }



  const activeProspects = prospects.filter(p => !p.isCompleted)
  const completedProspects = prospects.filter(p => p.isCompleted)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 z-50 overflow-hidden"
          >
            <div className="h-full bg-black/90 backdrop-blur-xl border-2 border-white/10 rounded-3xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <ClipboardList className="h-5 w-5 text-green-400" />
                    </div>
                  <div>
                    <h2 className="text-2xl font-title text-primary-hierarchy">Prospect List</h2>
                    <p className="text-gray-400 font-body text-sm">
                      {activeProspects.length} active, {completedProspects.length} completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prospect
                  </Button>
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

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Add/Edit Form */}
                    {(showAddForm || editingProspect) && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white/5 rounded-2xl p-6 border border-white/10"
                      >
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">
                          {editingProspect ? "Edit Prospect" : "Add New Prospect"}
                        </h3>
                        <form onSubmit={editingProspect ? saveEdit : handleSubmit} className="space-y-4">
                          <div>
                            <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                              Prospect Note *
                            </label>
                            <Textarea
                              value={formData.content}
                              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                              placeholder="Enter prospect details, property links, contact info, or any notes..."
                              className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                              rows={4}
                              required
                            />
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={editingProspect ? cancelEdit : () => setShowAddForm(false)}
                              className="flex-1 border-white/20 text-gray-400 bg-transparent hover:bg-white/10 rounded-pill font-body"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={!formData.content.trim()}
                              className="flex-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-pill transition-all duration-200 font-body disabled:opacity-50"
                            >
                              {editingProspect ? "Update Prospect" : "Add Prospect"}
                            </Button>
                          </div>
                        </form>
                      </motion.div>
                    )}

                    {/* Active Prospects */}
                    {activeProspects.length > 0 && (
                      <div>
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">Recommended Contacts</h3>
                        <div className="space-y-3">
                          {activeProspects.map((prospect) => (
                            <motion.div
                              key={prospect.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/5 rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-200"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="mb-2">
                                    <p className="text-primary-hierarchy font-body whitespace-pre-wrap">{prospect.content}</p>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    <span>Added {formatTimestamp(prospect.createdAt)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleComplete(prospect)}
                                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-full"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEdit(prospect)}
                                    className="text-white hover:bg-white/10 rounded-full"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteProspect(prospect.id)}
                                    className="text-red-400 hover:bg-red-500/10 rounded-full"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed Prospects */}
                    {completedProspects.length > 0 && (
                      <div>
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">Completed</h3>
                        <div className="space-y-3">
                          {completedProspects.map((prospect) => (
                            <motion.div
                              key={prospect.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white/5 rounded-2xl p-4 border border-white/10 opacity-60"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="mb-2">
                                    <p className="text-primary-hierarchy font-body whitespace-pre-wrap line-through">{prospect.content}</p>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    <span>Completed {formatTimestamp(prospect.updatedAt)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Button
                                    size="sm"
                                    onClick={() => handleToggleComplete(prospect)}
                                    className="bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 border-gray-500/30 rounded-full"
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteProspect(prospect.id)}
                                    className="text-red-400 hover:bg-red-500/10 rounded-full"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty State */}
                    {prospects.length === 0 && !showAddForm && (
                      <div className="text-center py-16">
                        <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <ClipboardList className="h-8 w-8 text-green-400" />
                        </div>
                        <h3 className="text-xl font-title text-white mb-2">No prospects yet</h3>
                        <p className="text-gray-400 font-body mb-6">
                          Add your first prospect to start building your pipeline.
                        </p>
                        <Button
                          onClick={() => setShowAddForm(true)}
                          className="bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30 rounded-pill px-6"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Prospect
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 