"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Check, Trash2, Edit3, ExternalLink, Building, User, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
    title: "",
    details: "",
    propertyLink: "",
    brokerageInfo: "",
    contactInfo: "",
    priority: "medium" as Prospect["priority"],
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
    if (!formData.title.trim()) return

    const newProspect: Omit<Prospect, "id" | "createdAt" | "updatedAt"> = {
      ...formData,
      isCompleted: false,
      createdBy: user?.id,
      createdByName: user?.name,
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    try {
      const { data, error } = await apiClient.createProspect(newProspect)
      if (error) {
        console.error("Error creating prospect:", error)
      } else if (data) {
        setProspects(prev => [data, ...prev])
        resetForm()
        setShowAddForm(false)
      }
    } catch (error) {
      console.error("Error creating prospect:", error)
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
      title: "",
      details: "",
      propertyLink: "",
      brokerageInfo: "",
      contactInfo: "",
      priority: "medium",
    })
  }

  const startEdit = (prospect: Prospect) => {
    setEditingProspect(prospect)
    setFormData({
      title: prospect.title,
      details: prospect.details,
      propertyLink: prospect.propertyLink || "",
      brokerageInfo: prospect.brokerageInfo || "",
      contactInfo: prospect.contactInfo || "",
      priority: prospect.priority,
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
      ...formData,
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: user?.id,
      lastUpdatedByName: user?.name,
    }

    await handleUpdateProspect(updatedProspect)
    cancelEdit()
  }

  const getPriorityColor = (priority: Prospect["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-300 border-red-500/30"
      case "medium":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "low":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
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
                    <AlertCircle className="h-5 w-5 text-green-400" />
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                                Title *
                              </label>
                              <Input
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g., John Smith - 123 Main St"
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                                Priority
                              </label>
                              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as Prospect["priority"] }))}>
                                <SelectTrigger className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
                                  <SelectItem value="low" className="rounded-lg font-body">Low</SelectItem>
                                  <SelectItem value="medium" className="rounded-lg font-body">Medium</SelectItem>
                                  <SelectItem value="high" className="rounded-lg font-body">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                              Details
                            </label>
                            <Textarea
                              value={formData.details}
                              onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
                              placeholder="Notes about this prospect..."
                              className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                              rows={3}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                                Property Link
                              </label>
                              <Input
                                value={formData.propertyLink}
                                onChange={(e) => setFormData(prev => ({ ...prev, propertyLink: e.target.value }))}
                                placeholder="https://..."
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                                Brokerage Info
                              </label>
                              <Input
                                value={formData.brokerageInfo}
                                onChange={(e) => setFormData(prev => ({ ...prev, brokerageInfo: e.target.value }))}
                                placeholder="Company name, agent info..."
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                              />
                            </div>
                            <div>
                              <label className="text-sm text-medium-hierarchy font-body mb-2 block">
                                Contact Info
                              </label>
                              <Input
                                value={formData.contactInfo}
                                onChange={(e) => setFormData(prev => ({ ...prev, contactInfo: e.target.value }))}
                                placeholder="Phone, email, etc."
                                className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body"
                              />
                            </div>
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
                              disabled={!formData.title.trim()}
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
                        <h3 className="text-lg font-title text-primary-hierarchy mb-4">Active Prospects</h3>
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
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-primary-hierarchy font-title">{prospect.title}</h4>
                                    <Badge className={`${getPriorityColor(prospect.priority)} rounded-full px-2 py-0.5 text-xs`}>
                                      {prospect.priority}
                                    </Badge>
                                  </div>
                                  {prospect.details && (
                                    <p className="text-medium-hierarchy font-body text-sm mb-3">{prospect.details}</p>
                                  )}
                                  <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                                    {prospect.propertyLink && (
                                      <div className="flex items-center gap-1">
                                        <ExternalLink className="h-3 w-3" />
                                        <a href={prospect.propertyLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                          Property Link
                                        </a>
                                      </div>
                                    )}
                                    {prospect.brokerageInfo && (
                                      <div className="flex items-center gap-1">
                                        <Building className="h-3 w-3" />
                                        <span>{prospect.brokerageInfo}</span>
                                      </div>
                                    )}
                                    {prospect.contactInfo && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        <span>{prospect.contactInfo}</span>
                                      </div>
                                    )}
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
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-primary-hierarchy font-title line-through">{prospect.title}</h4>
                                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 rounded-full px-2 py-0.5 text-xs">
                                      Completed
                                    </Badge>
                                  </div>
                                  {prospect.details && (
                                    <p className="text-medium-hierarchy font-body text-sm mb-3 line-through">{prospect.details}</p>
                                  )}
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
                          <AlertCircle className="h-8 w-8 text-green-400" />
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