"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Sparkles, User, Mail, Phone, Building, MapPin, Trash2, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { Lead, Brokerage, NewLeadPayload, Contact } from "@/lib/crm-types"
import { getMissingLeadFields } from "@/lib/lead-quality"
import { shouldAutoParse, autoParseContent } from "@/lib/parsing-utils"

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onAddLead: (lead: NewLeadPayload) => void
  brokerages?: Brokerage[]
}

export function AddLeadModal({ isOpen, onClose, onAddLead, brokerages = [] }: AddLeadModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    properties: [] as string[],
    additionalContacts: [] as Contact[],
    company: "",
    brokerageId: "",
    status: "Left Voicemail" as Lead["status"],
    lastInteraction: new Date().toISOString(),
    initialNote: "",
  })

  const [autoParseFeedback, setAutoParseFeedback] = useState("")
  const [showAutoParseFeedback, setShowAutoParseFeedback] = useState(false)
  const missingFields = getMissingLeadFields({
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
    address: formData.address,
    properties: formData.properties.map((address, index) => ({
      id: `temp_${index}`,
      address,
      isSold: false,
    })),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Only require name - everything else is optional
    if (!formData.name.trim()) return

    const allProperties = []
    if (formData.address) allProperties.push(formData.address)
    allProperties.push(...formData.properties)
    
    // Filter out empty properties
    const validProperties = allProperties.filter(p => p.trim())

    const selectedBrokerage = brokerages.find((brokerage) => brokerage.id === formData.brokerageId)

    const validAdditionalContacts = formData.additionalContacts
      .map((contact) => ({
        ...contact,
        name: contact.name.trim(),
        role: contact.role?.trim() || "",
        email: contact.email?.trim() || "",
        phone: contact.phone?.trim() || "",
      }))
      .filter((contact) => contact.name || contact.role || contact.email || contact.phone)

    onAddLead({
      ...formData,
      // Provide defaults for empty fields
      phone: formData.phone || "Not provided",
      email: formData.email || "Not provided",
      address: validProperties[0] || "Address not provided", // Primary address
      properties: validProperties.map(addr => ({
        id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        address: addr,
        isSold: false
      })),
      additionalContacts: validAdditionalContacts.length > 0 ? validAdditionalContacts : undefined,
      company: formData.company || "",
      brokerageId: selectedBrokerage?.id || undefined,
      brokerageName: selectedBrokerage?.name || undefined,
      nextActionDate: new Date().toISOString(),
    })

    // Reset form
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      properties: [],
      additionalContacts: [],
      company: "",
      brokerageId: "",
      status: "Left Voicemail",
      lastInteraction: new Date().toISOString(),
      initialNote: "",
    })
    setAutoParseFeedback("")
    setShowAutoParseFeedback(false)
    onClose()
  }

  // Function to auto-parse content and update form state
  const handleAutoParse = (text: string) => {
    const parsed = autoParseContent(text)

    setFormData((prev) => ({
      ...prev,
      name: parsed.name || prev.name,
      phone: parsed.phone || prev.phone,
      email: parsed.email || prev.email,
      company: parsed.company || prev.company,
      address: parsed.address || prev.address,
    }))

    // Show feedback
    setAutoParseFeedback("Contact info automatically parsed! ✨")
    setShowAutoParseFeedback(true)
    setTimeout(() => setShowAutoParseFeedback(false), 3000)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Handle paste events for auto-parsing
  const handlePaste = (field: string, e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    
    if (shouldAutoParse(pastedText)) {
      e.preventDefault() // Prevent default paste
      handleAutoParse(pastedText)
    }
  }

  const handleAddPropertyField = () => {
    setFormData(prev => ({
      ...prev,
      properties: [...prev.properties, ""]
    }))
  }

  const handlePropertyChange = (index: number, value: string) => {
    const newProperties = [...formData.properties]
    newProperties[index] = value
    setFormData(prev => ({
      ...prev,
      properties: newProperties
    }))
  }

  const handleRemoveProperty = (index: number) => {
    const newProperties = [...formData.properties]
    newProperties.splice(index, 1)
    setFormData(prev => ({
      ...prev,
      properties: newProperties
    }))
  }

  const handleAddContactField = () => {
    setFormData(prev => ({
      ...prev,
      additionalContacts: [
        ...prev.additionalContacts,
        {
          id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: "",
          role: "",
          email: "",
          phone: "",
        },
      ],
    }))
  }

  const handleContactChange = (index: number, field: keyof Contact, value: string) => {
    const updatedContacts = [...formData.additionalContacts]
    updatedContacts[index] = { ...updatedContacts[index], [field]: value }
    setFormData(prev => ({
      ...prev,
      additionalContacts: updatedContacts
    }))
  }

  const handleRemoveContact = (index: number) => {
    const updatedContacts = [...formData.additionalContacts]
    updatedContacts.splice(index, 1)
    setFormData(prev => ({
      ...prev,
      additionalContacts: updatedContacts
    }))
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-md bg-black/90 backdrop-blur-xl border-white/10 rounded-xl max-h-[90vh] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white font-title text-xl">Add New Lead</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Auto-parse feedback */}
                {showAutoParseFeedback && (
                  <div className="mb-4 p-3 bg-[#CD70E4]/10 border border-[#CD70E4]/30 rounded-lg">
                    <p className="text-[#CD70E4] text-sm font-body flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {autoParseFeedback}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white font-body flex items-center gap-2">
                      <User className="h-4 w-4" style={{ color: "#a855f7" }} />
                      Contact Name <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      onPaste={(e) => handlePaste("name", e)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter contact name or paste contact info block"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-body flex items-center gap-2">
                      <Mail className="h-4 w-4" style={{ color: "#f97316" }} />
                      Email <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      onPaste={(e) => handlePaste("email", e)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter email address or paste contact info block"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white font-body flex items-center gap-2">
                      <Phone className="h-4 w-4" style={{ color: "#22c55e" }} />
                      Phone <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      onPaste={(e) => handlePaste("phone", e)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter phone number or paste contact info block"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-white font-body flex items-center gap-2">
                      <Building className="h-4 w-4" style={{ color: "#3b82f6" }} />
                      Company <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange("company", e.target.value)}
                      onPaste={(e) => handlePaste("company", e)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter company name or paste contact info block"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white font-body flex items-center gap-2">
                      <Home className="h-4 w-4" style={{ color: "#22c55e" }} />
                      Brokerage <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    {brokerages.length > 0 ? (
                      <Select
                        value={formData.brokerageId || "none"}
                        onValueChange={(value) => handleInputChange("brokerageId", value === "none" ? "" : value)}
                      >
                        <SelectTrigger className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-brand">
                          <SelectValue placeholder="Select brokerage" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
                          <SelectItem value="none" className="rounded-lg font-body">
                            No brokerage
                          </SelectItem>
                          {brokerages.map((brokerage) => (
                            <SelectItem key={brokerage.id} value={brokerage.id} className="rounded-lg font-body">
                              {brokerage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-xs text-gray-500 font-body">
                        No brokerages yet. Add one from the Brokerages menu.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white font-body flex items-center gap-2">
                      <MapPin className="h-4 w-4" style={{ color: "#a855f7" }} />
                      Property Addresses <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    
                    {/* Primary Address */}
                    <div className="relative">
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        onPaste={(e) => handlePaste("address", e)}
                        className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand pr-10"
                        placeholder="Enter primary property address"
                      />
                    </div>

                    {/* Additional Properties */}
                    {formData.properties.map((prop, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={prop}
                          onChange={(e) => handlePropertyChange(index, e.target.value)}
                          className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand flex-1"
                          placeholder="Enter additional property address"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProperty(index)}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddPropertyField}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs font-body"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Another Property
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white font-body flex items-center gap-2">
                      <User className="h-4 w-4" style={{ color: "#3b82f6" }} />
                      Additional Contacts <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>

                    {formData.additionalContacts.length === 0 && (
                      <div className="text-xs text-gray-500 font-body italic">
                        No additional contacts added
                      </div>
                    )}

                    {formData.additionalContacts.map((contact, index) => (
                      <div key={contact.id} className="space-y-2 p-3 bg-white/5 rounded-xl">
                        <div className="flex gap-2">
                          <Input
                            value={contact.name}
                            onChange={(e) => handleContactChange(index, "name", e.target.value)}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand flex-1"
                            placeholder="Contact name"
                          />
                          <Input
                            value={contact.role || ""}
                            onChange={(e) => handleContactChange(index, "role", e.target.value)}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand flex-1"
                            placeholder="Role"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveContact(index)}
                            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={contact.email || ""}
                            onChange={(e) => handleContactChange(index, "email", e.target.value)}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand flex-1"
                            placeholder="Email"
                            type="email"
                          />
                          <Input
                            value={contact.phone || ""}
                            onChange={(e) => handleContactChange(index, "phone", e.target.value)}
                            className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand flex-1"
                            placeholder="Phone"
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddContactField}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 text-xs font-body"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Contact
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-white font-body">
                      Initial Status
                    </Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body rounded-brand">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-black/90 backdrop-blur-xl border-white/10 rounded-xl">
                        <SelectItem value="Left Voicemail" className="rounded-lg font-body">
                          Left Voicemail
                        </SelectItem>
                        <SelectItem value="Contacted" className="rounded-lg font-body">
                          Contacted
                        </SelectItem>
                        <SelectItem value="Interested" className="rounded-lg font-body">
                          Interested
                        </SelectItem>
                        <SelectItem value="Not Interested" className="rounded-lg font-body">
                          Not Interested
                        </SelectItem>
                        <SelectItem value="Closed" className="rounded-lg font-body">
                          Closed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="initialNote" className="text-white font-body flex items-center gap-2">
                      <Sparkles className="h-4 w-4" style={{ color: "#CD70E4" }} />
                      Add Note <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Textarea
                      id="initialNote"
                      value={formData.initialNote}
                      onChange={(e) => handleInputChange("initialNote", e.target.value)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Write a quick note for future reference"
                      rows={3}
                    />
                  </div>

                  {missingFields.length > 0 && formData.name.trim() && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 font-body">
                      Missing {missingFields.join(", ")}. You can save now and fill in later.
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 border-white/20 text-gray-400 bg-transparent hover:bg-white/10 rounded-pill font-body"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!formData.name.trim()}
                      className="flex-1 bg-white text-black hover:bg-gray-100 rounded-pill transition-all duration-200 font-body disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
