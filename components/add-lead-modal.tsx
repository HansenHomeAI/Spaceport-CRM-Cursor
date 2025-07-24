"use client"

import type React from "react"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Sparkles, User, Mail, Phone, Building, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { Lead } from "./leads-table"

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onAddLead: (lead: Omit<Lead, "id" | "notes">) => void
}

// Smart parsing function for contact info
const parseContactInfo = (text: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  // Email regex
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
    text = text.replace(emailMatch[0], "").trim()
  }

  // Phone regex - multiple formats
  const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\$?([0-9]{3})\$?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // Address detection (contains numbers and common address words)
  const addressKeywords = [
    "Street",
    "St",
    "Avenue",
    "Ave",
    "Road",
    "Rd",
    "Drive",
    "Dr",
    "Lane",
    "Ln",
    "Boulevard",
    "Blvd",
    "Way",
    "Circle",
    "Cir",
  ]
  const addressMatch = addressKeywords.find((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))

  if (addressMatch) {
    const addressRegex = new RegExp(`[^,]*\\d+[^,]*${addressMatch}[^,]*`, "i")
    const match = text.match(addressRegex)
    if (match) {
      result.address = match[0].trim()
      text = text.replace(match[0], "").trim()
    }
  }

  // Company detection - real estate keywords
  const companyKeywords = [
    "Real Estate",
    "Realty",
    "Properties",
    "Group",
    "Team",
    "Associates",
    "Brokers",
    "Homes",
    "Land",
    "Development",
    "Investment",
    "LLC",
    "Inc",
  ]

  const companyMatch = companyKeywords.find((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))

  if (companyMatch) {
    const companyRegex = new RegExp(`[^,]*${companyMatch}[^,]*`, "i")
    const match = text.match(companyRegex)
    if (match) {
      result.company = match[0].trim()
      text = text.replace(match[0], "").trim()
    }
  }

  // Clean up name - remove parenthetical aliases and extra info
  text = text.replace(/\$[^)]*\$/g, "") // Remove (aka Lawrence) type content
  text = text.replace(/,.*$/, "") // Remove everything after first comma
  text = text.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (first few words before any remaining punctuation)
  const nameMatch = text.match(/^([A-Za-z\s]+)/)
  if (nameMatch) {
    result.name = nameMatch[1].trim()
  }

  return result
}

export function AddLeadModal({ isOpen, onClose, onAddLead }: AddLeadModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    company: "",
    status: "Contacted" as Lead["status"],
    lastInteraction: new Date().toISOString().split("T")[0],
  })

  const [smartParseText, setSmartParseText] = useState("")
  const [showSmartParse, setShowSmartParse] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Only require name - everything else is optional
    if (!formData.name.trim()) return

    onAddLead({
      ...formData,
      // Provide defaults for empty fields
      phone: formData.phone || "Not provided",
      email: formData.email || "Not provided",
      address: formData.address || "Address not provided",
      company: formData.company || "",
      nextActionDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Reset form
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      company: "",
      status: "Contacted",
      lastInteraction: new Date().toISOString().split("T")[0],
    })
    setSmartParseText("")
    setShowSmartParse(false)
    onClose()
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Auto-parse if the input looks like it contains multiple pieces of info
    if (
      (field === "name" || field === "phone" || field === "email") &&
      (value.includes("@") || value.includes("(") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(value))
    ) {
      const parsed = parseContactInfo(value)

      setFormData((prev) => ({
        ...prev,
        name: parsed.name || prev.name,
        phone: parsed.phone || prev.phone,
        email: parsed.email || prev.email,
        company: parsed.company || prev.company,
        address: parsed.address || prev.address,
      }))
    }
  }

  const handleSmartParse = () => {
    if (!smartParseText.trim()) return

    const parsed = parseContactInfo(smartParseText)
    setFormData((prev) => ({
      ...prev,
      name: parsed.name || prev.name,
      phone: parsed.phone || prev.phone,
      email: parsed.email || prev.email,
      company: parsed.company || prev.company,
      address: parsed.address || prev.address,
    }))

    setSmartParseText("")
    setShowSmartParse(false)
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
                {/* Smart Parse Section */}
                {!showSmartParse ? (
                  <div className="mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSmartParse(true)}
                      className="w-full border-[#CD70E4]/30 text-[#CD70E4] hover:bg-[#CD70E4]/10 rounded-pill font-body"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Smart Parse Contact Info
                    </Button>
                  </div>
                ) : (
                  <div className="mb-4 space-y-3">
                    <Label className="text-white font-body">Paste contact info block</Label>
                    <Textarea
                      value={smartParseText}
                      onChange={(e) => setSmartParseText(e.target.value)}
                      placeholder="Paste: Mary Wheeler 406-539-1745, PureWest Real Estate, 123 Main St..."
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleSmartParse}
                        size="sm"
                        className="bg-[#CD70E4] hover:bg-[#CD70E4]/80 text-white rounded-pill font-body"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Parse
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowSmartParse(false)}
                        size="sm"
                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill font-body"
                      >
                        Cancel
                      </Button>
                    </div>
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
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter contact name"
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
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter email address"
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
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter phone number"
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
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-white font-body flex items-center gap-2">
                      <MapPin className="h-4 w-4" style={{ color: "#a855f7" }} />
                      Property Address <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter property address"
                    />
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
                        <SelectItem value="cold" className="rounded-lg font-body">
                          Cold
                        </SelectItem>
                        <SelectItem value="contacted" className="rounded-lg font-body">
                          Contacted
                        </SelectItem>
                        <SelectItem value="interested" className="rounded-lg font-body">
                          Interested
                        </SelectItem>
                        <SelectItem value="closed" className="rounded-lg font-body">
                          Closed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
