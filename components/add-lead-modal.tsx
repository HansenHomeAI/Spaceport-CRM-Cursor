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

  // Improved phone regex - handles parentheses and more formats
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // Address detection (contains numbers and common address words)
  const addressKeywords = [
    "Street", "St", "Avenue", "Ave", "Road", "Rd", "Drive", "Dr", 
    "Lane", "Ln", "Boulevard", "Blvd", "Way", "Circle", "Cir",
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

  // Enhanced company detection - real estate keywords
  const companyKeywords = [
    "Real Estate", "Realty", "Properties", "Group", "Team", "Associates", 
    "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc",
    "Partners", "HomeServices", "Sotheby's", "Compass", "Keller Williams", 
    "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", 
    "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", 
    "Upside", "Premier", "Edina", "Real Broker", "Toll Brothers", 
    "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", 
    "Compass Real Estate", "The Big Sky Real Estate Co", "Big Sky Sotheby's", 
    "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", 
    "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", 
    "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", 
    "Real Broker Alaska", "Premier Commercial Realty", "Edina Realty", 
    "Corcoran", "Houlihan Lawrence", "Construction", "Builders", "HomeServices"
  ]

  // Look for company names in the text
  for (const keyword of companyKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      // Find the full company name (including variations)
      const companyRegex = new RegExp(`[^,]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,]*`, "i")
      const match = text.match(companyRegex)
      if (match) {
        result.company = match[0].trim()
        text = text.replace(match[0], "").trim()
        break
      }
    }
  }

  // Clean up name - remove parenthetical aliases and extra info
  text = text.replace(/\([^)]*\)/g, "") // Remove (aka Lawrence) type content
  text = text.replace(/,+/g, " ") // Replace commas with spaces
  text = text.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (should be what's left after removing phone, email, company)
  if (text.length > 0) {
    // Remove any remaining non-alphabetic characters at the start/end
    const nameMatch = text.match(/^[^a-zA-Z]*([A-Za-z\s]+?)[^a-zA-Z]*$/)
    if (nameMatch) {
      result.name = nameMatch[1].trim()
    } else {
      result.name = text.trim()
    }
  }

  return result
}

// Special function for parsing listing data
const parseListingData = (text: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  // Look for "Listed by:" pattern
  const listedByMatch = text.match(/Listed by:\s*([^,]+)/i)
  if (listedByMatch) {
    const listedByText = listedByMatch[1].trim()
    
    // Parse the "Listed by" section
    const phoneMatch = listedByText.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
    if (phoneMatch) {
      result.phone = phoneMatch[0]
      const nameText = listedByText.replace(phoneMatch[0], "").trim()
      result.name = nameText
    } else {
      result.name = listedByText
    }
  }

  // Look for company after "Listed by" - more specific pattern
  // Stop at "Source:" to avoid including extra information
  const companyMatch = text.match(/Realtypath LLC[^,]*?(?=Source:|$)/i)
  if (companyMatch) {
    result.company = companyMatch[0].trim()
  }

  return result
}

// Special function for parsing complex real estate data
const parseComplexRealEstate = (text: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  // Extract phone first
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // For cases with ampersand, the pattern is typically: "FirstName LastName CompanyName & CompanyName"
  // We need to extract just the first person's name
  if (text.includes("&")) {
    // Split into words
    const words = text.split(/\s+/)
    
    let nameWords = []
    
    // Find the first person's name (stop when we hit the company part)
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      
      // If we hit "&", we've reached the company part
      if (word === "&") {
        break
      }
      
      // If we hit "Real Estate", we've reached the company part
      if (word.toLowerCase().includes("real") || word.toLowerCase().includes("estate")) {
        break
      }
      
      // Check if this word looks like it could be the start of a company name
      // (i.e., if we have at least 2 words already, and this word is capitalized)
      if (nameWords.length >= 2 && word.charAt(0) === word.charAt(0).toUpperCase()) {
        // This might be the start of the company name
        // Let's check if the next word is also capitalized (indicating a company name)
        if (i + 1 < words.length && words[i + 1].charAt(0) === words[i + 1].charAt(0).toUpperCase()) {
          break
        }
      }
      
      nameWords.push(word)
    }
    
    if (nameWords.length > 0) {
      result.name = nameWords.join(" ").trim()
      // Remove the name from the text
      text = text.replace(result.name, "").trim()
    }

    // Now extract the company - everything that contains "&" and "Real Estate"
    const companyMatch = text.match(/([^,]*&[^,]*Real Estate[^,]*)/i)
    if (companyMatch) {
      result.company = companyMatch[1].trim()
    }
  } else {
    // Fallback to regular parsing
    const nameMatch = text.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)/)
    if (nameMatch) {
      result.name = nameMatch[1].trim()
      text = text.replace(nameMatch[1], "").trim()
    }

    // Now look for company keywords in remaining text
    const companyKeywords = ["Real Estate", "Realty", "Properties", "Group", "Team", "Associates", 
      "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc",
      "Partners", "HomeServices", "Sotheby's", "Compass", "Keller Williams", 
      "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", 
      "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", 
      "Upside", "Premier", "Edina", "Real Broker", "Toll Brothers", 
      "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", 
      "Compass Real Estate", "The Big Sky Real Estate Co", "Big Sky Sotheby's", 
      "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", 
      "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", 
      "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", 
      "Real Broker Alaska", "Premier Commercial Realty", "Edina Realty", 
      "Corcoran", "Houlihan Lawrence", "Construction", "Builders", "HomeServices"]

    for (const keyword of companyKeywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        const companyRegex = new RegExp(`[^,]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,]*`, "i")
        const match = text.match(companyRegex)
        if (match) {
          result.company = match[0].trim()
          break
        }
      }
    }
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
    status: "Left Voicemail" as Lead["status"],
    lastInteraction: new Date().toISOString(),
  })

  const [autoParseFeedback, setAutoParseFeedback] = useState("")
  const [showAutoParseFeedback, setShowAutoParseFeedback] = useState(false)

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
      status: "Left Voicemail",
      lastInteraction: new Date().toISOString(),
    })
    setAutoParseFeedback("")
    setShowAutoParseFeedback(false)
    onClose()
  }

  // Function to detect if content should trigger auto-parse
  const shouldAutoParse = (text: string): boolean => {
    // Trigger auto-parse if content has multiple indicators of contact info
    const hasMultipleInfo = (
      text.includes("@") || // Has email
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text) || // Has phone
      text.includes("Real Estate") || // Has real estate keywords
      text.includes("Listed by:") || // Has listing data
      text.includes("&") || // Has ampersand (company indicator)
      text.split(/\s+/).length > 4 // Has multiple words
    )
    
    return hasMultipleInfo && text.length > 20 // Minimum length threshold
  }

  // Function to auto-parse content
  const autoParseContent = (text: string) => {
    let parsed
    if (text.includes("Listed by:")) {
      parsed = parseListingData(text)
    } else if (text.includes("Real Estate") && text.includes("&")) {
      // Special handling for complex real estate data
      parsed = parseComplexRealEstate(text)
    } else {
      parsed = parseContactInfo(text)
    }

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
      autoParseContent(pastedText)
    }
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
                    <Label htmlFor="address" className="text-white font-body flex items-center gap-2">
                      <MapPin className="h-4 w-4" style={{ color: "#a855f7" }} />
                      Property Address <span className="text-gray-400 text-sm">(optional)</span>
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      onPaste={(e) => handlePaste("address", e)}
                      className="bg-black/20 backdrop-blur-sm border-white/10 text-white font-body placeholder:text-gray-400 rounded-brand"
                      placeholder="Enter property address or paste contact info block"
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
