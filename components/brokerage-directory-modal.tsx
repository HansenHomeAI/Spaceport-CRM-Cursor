"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Plus, Building2, Mail, Phone, Globe, MapPin, Trash2, Edit3, ChevronDown, ChevronRight, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { Brokerage, Lead } from "@/lib/crm-types"

interface BrokerageDirectoryModalProps {
  isOpen: boolean
  onClose: () => void
  brokerages: Brokerage[]
  leads: Lead[]
  onCreateBrokerage: (brokerage: Omit<Brokerage, "id" | "createdAt" | "updatedAt">) => void
  onUpdateBrokerage: (brokerageId: string, updates: Partial<Brokerage>) => void
  onDeleteBrokerage: (brokerageId: string) => void
  onSelectLead?: (lead: Lead) => void
}

export function BrokerageDirectoryModal({
  isOpen,
  onClose,
  brokerages,
  leads,
  onCreateBrokerage,
  onUpdateBrokerage,
  onDeleteBrokerage,
  onSelectLead,
}: BrokerageDirectoryModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    notes: "",
  })
  const [editingBrokerageId, setEditingBrokerageId] = useState<string | null>(null)
  const [editingData, setEditingData] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    notes: "",
  })
  const [expandedBrokerageId, setExpandedBrokerageId] = useState<string | null>(null)

  const sortedBrokerages = useMemo(() => {
    return [...brokerages].sort((a, b) => a.name.localeCompare(b.name))
  }, [brokerages])

  const handleCreateBrokerage = () => {
    if (!formData.name.trim()) return
    onCreateBrokerage({
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      website: formData.website.trim() || undefined,
      address: formData.address.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    })
    setFormData({
      name: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      notes: "",
    })
  }

  const handleStartEditing = (brokerage: Brokerage) => {
    setEditingBrokerageId(brokerage.id)
    setEditingData({
      name: brokerage.name || "",
      phone: brokerage.phone || "",
      email: brokerage.email || "",
      website: brokerage.website || "",
      address: brokerage.address || "",
      notes: brokerage.notes || "",
    })
  }

  const handleSaveEditing = () => {
    if (!editingBrokerageId) return
    if (!editingData.name.trim()) return

    onUpdateBrokerage(editingBrokerageId, {
      name: editingData.name.trim(),
      phone: editingData.phone.trim() || undefined,
      email: editingData.email.trim() || undefined,
      website: editingData.website.trim() || undefined,
      address: editingData.address.trim() || undefined,
      notes: editingData.notes.trim() || undefined,
    })
    setEditingBrokerageId(null)
  }

  const handleCancelEditing = () => {
    setEditingBrokerageId(null)
  }

  const toggleExpanded = (brokerageId: string) => {
    setExpandedBrokerageId(expandedBrokerageId === brokerageId ? null : brokerageId)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-4xl bg-black/90 border-system rounded-3xl shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white font-title flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-400" />
                    Brokerage Directory
                  </CardTitle>
                  <p className="text-sm text-gray-400 font-body mt-1">
                    Add brokerage firms and see linked agents in one place.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-gray-300 font-body mb-3 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-green-400" />
                    New Brokerage
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Brokerage name"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                    />
                    <Input
                      value={formData.website}
                      onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                      placeholder="Website"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                    />
                    <Input
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                    />
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                    />
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Address"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl md:col-span-2"
                    />
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      className="bg-black/40 border-white/10 text-white font-body rounded-xl md:col-span-2"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button
                      onClick={handleCreateBrokerage}
                      disabled={!formData.name.trim()}
                      className="bg-white text-black hover:bg-gray-100 rounded-pill px-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Brokerage
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {sortedBrokerages.length === 0 ? (
                    <div className="text-center text-gray-500 font-body py-6">
                      No brokerages yet. Add your first brokerage above.
                    </div>
                  ) : (
                    sortedBrokerages.map((brokerage) => {
                      const brokerageLeads = leads.filter(
                        (lead) => lead.brokerageId === brokerage.id && !lead.deletedAt
                      )
                      const isEditing = editingBrokerageId === brokerage.id
                      const isExpanded = expandedBrokerageId === brokerage.id

                      return (
                        <div key={brokerage.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              {isEditing ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <Input
                                    value={editingData.name}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, name: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                                  />
                                  <Input
                                    value={editingData.website}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, website: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                                  />
                                  <Input
                                    value={editingData.email}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, email: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                                  />
                                  <Input
                                    value={editingData.phone}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, phone: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl"
                                  />
                                  <Input
                                    value={editingData.address}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, address: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl md:col-span-2"
                                  />
                                  <Textarea
                                    value={editingData.notes}
                                    onChange={(e) => setEditingData((prev) => ({ ...prev, notes: e.target.value }))}
                                    className="bg-black/40 border-white/10 text-white font-body rounded-xl md:col-span-2"
                                    rows={2}
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-white font-title text-lg">{brokerage.name}</h3>
                                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 rounded-full text-xs">
                                      {brokerageLeads.length} agent{brokerageLeads.length === 1 ? "" : "s"}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400 font-body">
                                    {brokerage.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5 text-orange-300" />
                                        {brokerage.email}
                                      </div>
                                    )}
                                    {brokerage.phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 text-green-300" />
                                        {brokerage.phone}
                                      </div>
                                    )}
                                    {brokerage.website && (
                                      <div className="flex items-center gap-2">
                                        <Globe className="h-3.5 w-3.5 text-blue-300" />
                                        {brokerage.website}
                                      </div>
                                    )}
                                    {brokerage.address && (
                                      <div className="flex items-center gap-2 md:col-span-2">
                                        <MapPin className="h-3.5 w-3.5 text-purple-300" />
                                        {brokerage.address}
                                      </div>
                                    )}
                                  </div>
                                  {brokerage.notes && (
                                    <p className="text-sm text-gray-400 font-body leading-relaxed">
                                      {brokerage.notes}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={handleSaveEditing}
                                    className="bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded-full"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEditing}
                                    className="border-white/10 text-gray-300 hover:bg-white/10 rounded-full"
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleExpanded(brokerage.id)}
                                    className="text-gray-300 hover:text-white hover:bg-white/10 rounded-full"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStartEditing(brokerage)}
                                    className="text-gray-300 hover:text-white hover:bg-white/10 rounded-full"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-gray-300 hover:text-red-400 hover:bg-red-500/10 rounded-full"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-black/90 backdrop-blur-xl border-system rounded-xl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-white font-title">Delete Brokerage?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-gray-400 font-body">
                                          Delete <span className="text-white font-bold">{brokerage.name}</span>? Linked agents will be unassigned.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 rounded-full font-body">
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => onDeleteBrokerage(brokerage.id)}
                                          className="bg-red-600 text-white hover:bg-red-700 rounded-full font-body border-none"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <div className="flex items-center gap-2 text-xs text-gray-400 font-body mb-3">
                                <Users className="h-3.5 w-3.5 text-blue-300" />
                                Linked Agents
                              </div>
                              {brokerageLeads.length === 0 ? (
                                <div className="text-xs text-gray-500 font-body">
                                  No agents linked yet.
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {brokerageLeads.map((lead) => (
                                    <button
                                      key={lead.id}
                                      onClick={() => onSelectLead?.(lead)}
                                      className="text-xs bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-1 transition-all"
                                    >
                                      {lead.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
