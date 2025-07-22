"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import type { Lead } from "./leads-table"

interface CSVImportProps {
  isOpen: boolean
  onClose: () => void
  onImport: (leads: Omit<Lead, "id">[]) => Promise<{ success: boolean; message: string }>
}

// Enhanced parsing functions for complex data
const parseContactInfo = (text: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
  }

  if (!text) return result

  // Email regex
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
    text = text.replace(emailMatch[0], "").trim()
  }

  // Phone regex - ONLY proper phone formats (no dates!)
  // Accepts: 000-000-0000, 0(000)-000-0000, 000.000.0000, 000 000 0000
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    const phoneStr = phoneMatch[0]
    // Double-check this isn't a date by ensuring it doesn't match date patterns
    const isDatePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(phoneStr) || 
                         /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(phoneStr)
    
    if (!isDatePattern) {
      result.phone = phoneStr
      text = text.replace(phoneStr, "").trim()
    }
  }

  // Company detection - real estate keywords
  const companyKeywords = [
    "Real Estate", "Realty", "Properties", "Group", "Team", "Associates", "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc", "Partners", "Sotheby's", "Compass", "Keller Williams", "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", "Upside", "Premier", "Edina", "Real Broker", "Keller Williams Realty", "Berkshire Hathaway HomeServices", "Toll Brothers", "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", "Compass Real Estate", "The Big Sky Real Estate Co", "Big Sky Sotheby's", "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", "Real Broker Alaska", "Premier Commercial Realty", "Edina Realty", "Corcoran", "Houlihan Lawrence",
  ]

  // Look for company names in the text
  for (const keyword of companyKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      // Find the full company name (including variations)
      const companyRegex = new RegExp(`[^,\\n]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,\\n]*`, "i")
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
  text = text.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (first few words before any remaining punctuation)
  const nameMatch = text.match(/^([A-Za-z\s]+)/)
  if (nameMatch) {
    result.name = nameMatch[1].trim()
  }

  return result
}

// Helper function to detect if a line contains a date (indicating notes/interactions)
const hasDatePattern = (text: string): boolean => {
  const datePatterns = [
    /(\w+\s+\d{1,2},?\s+\d{4})/g, // "October 21, 2024"
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g, // "10/21/24" or "10/21/2024"
    /(\w+\s+\d{1,2})/g, // "Oct 21" or "10/21"
    /(\d{1,2}\/\d{1,2})/g, // "10/21"
    /(\w+\s+\d{1,2}st|\w+\s+\d{1,2}nd|\w+\s+\d{1,2}rd|\w+\s+\d{1,2}th)/g, // "Jun 9th"
  ]
  
  return datePatterns.some(pattern => pattern.test(text))
}

// Helper function to detect if a line looks like a new contact (name + phone/email)
const looksLikeNewContact = (text: string): boolean => {
  if (!text.trim()) return false
  
  // Check if it starts with a name pattern (capital letters)
  const namePattern = /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*/
  if (!namePattern.test(text)) return false
  
  // Check if it contains phone or email
  const hasPhone = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)
  
  return hasPhone || hasEmail
}

const parseNotes = (notesText: string): Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> => {
  const notes: Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> = []
  
  if (!notesText) return notes

  // Split by periods and look for date patterns
  const sentences = notesText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
  
  sentences.forEach((sentence, index) => {
    if (sentence.length < 5) return // Skip very short sentences
    
    // Look for date patterns in the sentence
    const datePatterns = [
      /(\w+\s+\d{1,2},?\s+\d{4})/g, // "October 21, 2024"
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g, // "10/21/24" or "10/21/2024"
      /(\w+\s+\d{1,2})/g, // "Oct 21" or "10/21"
      /(\d{1,2}\/\d{1,2})/g, // "10/21"
      /(\w+\s+\d{1,2}st|\w+\s+\d{1,2}nd|\w+\s+\d{1,2}rd|\w+\s+\d{1,2}th)/g, // "Jun 9th"
    ]
    
    let foundDate = false
    let timestamp = new Date().toISOString()
    
    for (const pattern of datePatterns) {
      const matches = sentence.match(pattern)
      if (matches) {
        try {
          const dateStr = matches[0]
          let parsedDate = new Date(dateStr)
          
          if (isNaN(parsedDate.getTime())) {
            // Try with 2024 as base year for older dates (Oct-Dec 2024)
            parsedDate = new Date(dateStr + ", 2024")
          }
          if (isNaN(parsedDate.getTime())) {
            // Try with 2025 as base year for recent dates (Jan-Aug 2025)
            parsedDate = new Date(dateStr + ", 2025")
          }
          
          if (!isNaN(parsedDate.getTime())) {
            // Validate the year makes sense for our timeframe
            const year = parsedDate.getFullYear()
            const month = parsedDate.getMonth() + 1 // 0-indexed to 1-indexed
            
            // If it's 2024, should be Oct-Dec (months 10-12)
            // If it's 2025, should be Jan-Aug (months 1-8)
            if ((year === 2024 && month >= 10) || (year === 2025 && month <= 8)) {
              timestamp = parsedDate.toISOString()
              foundDate = true
              break
            }
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }
    
    // Determine type based on keywords in the sentence
    let type: "call" | "email" | "note" = "note"
    const lowerSentence = sentence.toLowerCase()
    
    // Check for voicemail patterns first
    if (lowerSentence.includes("voicemail") || lowerSentence.includes("left message") || 
        (lowerSentence.includes("called") && lowerSentence.includes("voicemail")) ||
        lowerSentence.includes("left voicemail")) {
      type = "call"
    } else if (lowerSentence.includes("called") || lowerSentence.includes("phone") || 
               lowerSentence.includes("picked up") || lowerSentence.includes("talked")) {
      type = "call"
    } else if (lowerSentence.includes("email") || lowerSentence.includes("sent") || 
               lowerSentence.includes("emailed") || lowerSentence.includes("follow up email")) {
      type = "email"
    }
    
    notes.push({
      id: Date.now().toString() + index,
      text: sentence,
      timestamp: timestamp,
      type: type
    })
  })
  
  return notes
}

const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  const contacts: Omit<Lead, "id">[] = []
  let currentContact: any = null
  let currentNotes = ""

  // Process each line to group multi-line contacts
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    
    // Split by comma but respect quotes
    const values: string[] = []
    let current = ""
    let inQuotes = false
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    values.push(current.trim())
    
    const row: any = {}
    headers.forEach((header, index) => {
      row[header] = (values[index] || "").replace(/"/g, "")
    })

    // Check if this line contains notes (has a date pattern)
    const hasNotes = hasDatePattern(line)
    
    // Check if this looks like a new contact
    const isNewContact = looksLikeNewContact(row.name || row.contact || row.client || "")
    
    // If we have a current contact and this line has notes, add to current contact
    if (currentContact && hasNotes) {
      currentNotes += " " + (row.notes || row.comments || row.interactions || line)
    }
    // If this looks like a new contact, save the previous one and start a new one
    else if (isNewContact) {
      // Save the previous contact if we have one
      if (currentContact) {
        // Parse the accumulated notes
        const notes = parseNotes(currentNotes)
        
        // Determine status and priority
        let status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" = "contacted"
        const lowerNotes = currentNotes.toLowerCase()
        
        if (lowerNotes.includes("interested") || lowerNotes.includes("wants to see") || lowerNotes.includes("sounded interested")) {
          status = "interested"
        } else if (lowerNotes.includes("not interested") || lowerNotes.includes("said no") || lowerNotes.includes("isn't interested")) {
          status = "cold"
        } else if (lowerNotes.includes("closed") || lowerNotes.includes("sold")) {
          status = "closed"
        } else if (lowerNotes.includes("voicemail") && !lowerNotes.includes("talked") && !lowerNotes.includes("picked up")) {
          status = "left voicemail"
        }

        let priority: "high" | "medium" | "low" | "dormant" = "medium"
        if (status === "interested") {
          priority = "high"
        } else if (status === "cold") {
          priority = "low"
        } else if (lowerNotes.includes("dormant") || lowerNotes.includes("spring")) {
          priority = "dormant"
        } else if (status === "left voicemail") {
          const recentNotes = notes.filter(note => {
            const noteDate = new Date(note.timestamp)
            const now = new Date()
            const daysDiff = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24)
            return daysDiff <= 14
          })
          if (recentNotes.length > 0) {
            priority = "high"
          }
        }

        // Find the most recent date from notes
        let lastInteraction = new Date().toISOString().split("T")[0]
        if (notes.length > 0) {
          const dates = notes.map(note => new Date(note.timestamp)).filter(date => !isNaN(date.getTime()))
          if (dates.length > 0) {
            const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())))
            lastInteraction = mostRecentDate.toISOString().split("T")[0]
          }
        }

        const needsAttention = !currentContact.name.trim() || currentContact.name === "Unknown Contact" || 
                              !currentContact.address.trim() || currentContact.address === "Address not provided"

        contacts.push({
          name: currentContact.name || "Unknown Contact",
          phone: currentContact.phone || "Not provided",
          email: currentContact.email || "Not provided",
          company: currentContact.company || "",
          address: currentContact.address || "Address not provided",
          status: status,
          lastInteraction: lastInteraction,
          priority: priority,
          nextActionDate: new Date().toISOString(),
          needsAttention: needsAttention,
          notes: notes.length > 0 ? notes : [{
            id: Date.now().toString(),
            text: "Imported from CSV - no interaction history",
            timestamp: new Date().toISOString(),
            type: "note" as const,
          }],
        })
      }
      
      // Start a new contact
      currentContact = {
        name: row.name || row.contact || row.client || "",
        phone: row.phone || row.telephone || row.mobile || "",
        email: row.email || row["email address"] || "",
        company: row.company || row.business || row.organization || "",
        address: row.address || row.location || row.property || "",
      }
      
      // Parse complex name field
      if (currentContact.name) {
        const parsed = parseContactInfo(currentContact.name)
        currentContact.name = parsed.name || currentContact.name
        currentContact.phone = currentContact.phone || parsed.phone
        currentContact.email = currentContact.email || parsed.email
        currentContact.company = currentContact.company || parsed.company
      }
      
      currentNotes = row.notes || row.comments || row.interactions || ""
    }
    // If this line doesn't have notes and doesn't look like a new contact, it might be additional info for current contact
    else if (currentContact && !hasNotes && !isNewContact) {
      // This might be additional company info, phone, email, etc.
      const additionalInfo = line.trim()
      if (additionalInfo) {
        const parsed = parseContactInfo(additionalInfo)
        currentContact.phone = currentContact.phone || parsed.phone
        currentContact.email = currentContact.email || parsed.email
        currentContact.company = currentContact.company || parsed.company
      }
    }
  }
  
  // Don't forget the last contact
  if (currentContact) {
    const notes = parseNotes(currentNotes)
    
    let status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" = "contacted"
    const lowerNotes = currentNotes.toLowerCase()
    
    if (lowerNotes.includes("interested") || lowerNotes.includes("wants to see") || lowerNotes.includes("sounded interested")) {
      status = "interested"
    } else if (lowerNotes.includes("not interested") || lowerNotes.includes("said no") || lowerNotes.includes("isn't interested")) {
      status = "cold"
    } else if (lowerNotes.includes("closed") || lowerNotes.includes("sold")) {
      status = "closed"
    } else if (lowerNotes.includes("voicemail") && !lowerNotes.includes("talked") && !lowerNotes.includes("picked up")) {
      status = "left voicemail"
    }

    let priority: "high" | "medium" | "low" | "dormant" = "medium"
    if (status === "interested") {
      priority = "high"
    } else if (status === "cold") {
      priority = "low"
    } else if (lowerNotes.includes("dormant") || lowerNotes.includes("spring")) {
      priority = "dormant"
    } else if (status === "left voicemail") {
      const recentNotes = notes.filter(note => {
        const noteDate = new Date(note.timestamp)
        const now = new Date()
        const daysDiff = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff <= 14
      })
      if (recentNotes.length > 0) {
        priority = "high"
      }
    }

    let lastInteraction = new Date().toISOString().split("T")[0]
    if (notes.length > 0) {
      const dates = notes.map(note => new Date(note.timestamp)).filter(date => !isNaN(date.getTime()))
      if (dates.length > 0) {
        const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())))
        lastInteraction = mostRecentDate.toISOString().split("T")[0]
      }
    }

    const needsAttention = !currentContact.name.trim() || currentContact.name === "Unknown Contact" || 
                          !currentContact.address.trim() || currentContact.address === "Address not provided"

    contacts.push({
      name: currentContact.name || "Unknown Contact",
      phone: currentContact.phone || "Not provided",
      email: currentContact.email || "Not provided",
      company: currentContact.company || "",
      address: currentContact.address || "Address not provided",
      status: status,
      lastInteraction: lastInteraction,
      priority: priority,
      nextActionDate: new Date().toISOString(),
      needsAttention: needsAttention,
      notes: notes.length > 0 ? notes : [{
        id: Date.now().toString(),
        text: "Imported from CSV - no interaction history",
        timestamp: new Date().toISOString(),
        type: "note" as const,
      }],
    })
  }
  
  return contacts
}

export function CSVImport({ isOpen, onClose, onImport }: CSVImportProps) {
  const [dragActive, setDragActive] = useState(false)
  const [csvData, setCsvData] = useState<Omit<Lead, "id">[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setMessage({ type: "error", text: "Please select a CSV file" })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = parseCSVContent(content)
        
        // Check for missing required fields but allow import
        const missingFields = parsed.filter(lead => 
          !lead.name.trim() || lead.name === "Unknown Contact" || 
          !lead.address.trim() || lead.address === "Address not provided"
        )
        
        if (missingFields.length > 0) {
          setMessage({ 
            type: "error", 
            text: `${missingFields.length} contacts are missing required fields and will be flagged for attention.` 
          })
        } else {
          setMessage(null)
        }
        
        setCsvData(parsed)
      } catch (error) {
        setMessage({ type: "error", text: "Error parsing CSV file" })
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!csvData) return

    setIsImporting(true)
    try {
      const result = await onImport(csvData)
      if (result.success) {
        setMessage({ type: "success", text: result.message })
        setTimeout(() => {
          onClose()
          setCsvData(null)
          setMessage(null)
        }, 2000)
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Import failed" })
    } finally {
      setIsImporting(false)
    }
  }

  const resetImport = () => {
    setCsvData(null)
    setMessage(null)
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
            <Card className="w-full max-w-4xl bg-black/90 backdrop-blur-xl border-white/10 rounded-xl max-h-[90vh] overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white font-title text-xl">Import CSV Data</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                                          className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="overflow-y-auto">
                {!csvData ? (
                  <div
                                  className={`border-2 border-dashed rounded-brand p-8 text-center transition-colors ${
                dragActive ? "border-[#CD70E4] bg-[#CD70E4]/5" : "border-white/20 hover:border-white/40"
              }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-title text-white mb-2">Upload CSV File</h3>
                    <p className="text-gray-400 font-body mb-4">Drag and drop your CSV file here, or click to browse</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload">
                      <Button
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10 rounded-pill cursor-pointer bg-transparent"
                        asChild
                      >
                        <span>
                          <FileText className="h-4 w-4 mr-2" />
                          Choose File
                        </span>
                      </Button>
                    </label>
                    <div className="mt-4 text-xs text-gray-500">
                      <p>Supports complex name formats like:</p>
                      <p>"Mary Wheeler 406-539-1745,PureWest Real Estate"</p>
                      <p>"Larry (aka Lawrence) Havens 845-453-5679"</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="text-white font-title">{csvData.length} contacts ready to import</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetImport}
                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-pill"
                      >
                        Choose Different File
                      </Button>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 max-h-96 overflow-y-auto">
                      <div className="grid gap-3">
                        {csvData.slice(0, 10).map((lead, index) => (
                          <div key={index} className="bg-white/5 rounded-brand p-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="text-white font-title">{lead.name}</div>
                                <div className="text-gray-400 text-sm">{lead.email}</div>
                                <div className="text-gray-400 text-sm">{lead.phone}</div>
                                {lead.company && (
                                  <Badge className="bg-blue-500/20 text-blue-300 text-xs rounded-pill">{lead.company}</Badge>
                                )}
                              </div>
                              <Badge className="bg-green-500/20 text-green-300 rounded-pill">{lead.status}</Badge>
                            </div>
                          </div>
                        ))}
                        {csvData.length > 10 && (
                          <div className="text-center text-gray-400 text-sm">
                            ... and {csvData.length - 10} more contacts
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleImport}
                        disabled={isImporting}
                        className="flex-1 bg-white text-black hover:bg-gray-100 rounded-pill font-body"
                      >
                        {isImporting ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                              className="mr-2"
                            >
                              <Upload className="h-4 w-4" />
                            </motion.div>
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Import {csvData.length} Contacts
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={onClose}
                        className="border-white/20 text-white hover:bg-white/10 rounded-pill font-body bg-transparent"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {message && (
                  <Alert
                    className={`mt-4 ${
                      message.type === "error" ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
                    }`}
                  >
                    {message.type === "error" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <AlertDescription className={message.type === "error" ? "text-red-800" : "text-green-800"}>
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
