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
    address: "",
  }

  // Email regex
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
    text = text.replace(emailMatch[0], "").trim()
  }

  // Phone regex - multiple formats including parentheses
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
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
    "Partners",
    "Sotheby's",
    "Compass",
    "Keller Williams",
    "Berkshire Hathaway",
    "Hall & Hall",
    "Best Choice",
    "McCann",
    "Summit",
    "PureWest",
    "ERA",
    "Corcoran",
    "Houlihan Lawrence",
    "The Dow Group",
    "Upside",
    "Premier",
    "Edina",
    "Real Broker",
    "Keller Williams Realty",
    "Berkshire Hathaway HomeServices",
    "Toll Brothers",
    "Keystone Construction",
    "Axis Realty",
    "Realtypath",
    "Summit Sotheby's",
    "Compass Real Estate",
    "McCann",
    "The Big Sky Real Estate Co",
    "Big Sky Sotheby's",
    "ERA Landmark",
    "PureWest Real Estate",
    "Hall & Hall Partners",
    "Best Choice Realty",
    "Tom Evans & Ashley DiPrisco Real Estate",
    "Berkshire Hathaway HomeServices Alaska Realty",
    "Keller Williams Realty Alaska Group",
    "Real Broker Alaska",
    "The Dow Group",
    "Upside",
    "Premier Commercial Realty",
    "Edina Realty",
    "Corcoran",
    "Houlihan Lawrence",
  ]

  // Look for company names in the text - but be more careful about separation
  let companyFound = false
  for (const keyword of companyKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      // Find the full company name (including variations)
      const companyRegex = new RegExp(`[^,\\n]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,\\n]*`, "i")
      const match = text.match(companyRegex)
      if (match) {
        // Only extract company if it's clearly separate from the name
        // Check if there's a clear separator (comma, newline, or significant spacing)
        const companyText = match[0].trim()
        const beforeCompany = text.substring(0, text.indexOf(companyText)).trim()
        const afterCompany = text.substring(text.indexOf(companyText) + companyText.length).trim()
        
        // If company appears after a comma or newline, it's likely separate
        if (text.includes(',') || text.includes('\n') || beforeCompany.length > 20) {
          result.company = companyText
          text = text.replace(companyText, "").trim()
          companyFound = true
          break
        }
      }
    }
  }

  // Address detection (contains numbers and common address words)
  const addressKeywords = [
    "Street", "St", "Avenue", "Ave", "Road", "Rd", "Drive", "Dr", "Lane", "Ln",
    "Boulevard", "Blvd", "Way", "Circle", "Cir", "Loop", "Trail", "Trl", "Court", "Ct",
    "Place", "Pl", "Terrace", "Ter", "Heights", "Hts", "Ridge", "Rdg", "Point", "Pt"
  ]
  
  for (const keyword of addressKeywords) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      const addressRegex = new RegExp(`[^,\\n]*\\d+[^,\\n]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,\\n]*`, "i")
      const match = text.match(addressRegex)
      if (match) {
        result.address = match[0].trim()
        text = text.replace(match[0], "").trim()
        break
      }
    }
  }

  // Clean up name - remove parenthetical aliases and extra info
  text = text.replace(/\([^)]*\)/g, "") // Remove (aka Lawrence) type content
  text = text.replace(/,.*$/, "") // Remove everything after first comma
  text = text.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (first few words before any remaining punctuation)
  const nameMatch = text.match(/^([A-Za-z\s]+)/)
  if (nameMatch) {
    result.name = nameMatch[1].trim()
  }

  return result
}

const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  
  const leads: Omit<Lead, "id">[] = []
  let currentLead: Record<string, any> = {}
  let currentRowIndex = 1

  // Process lines starting from the second line (after headers)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
    
    // Check if this looks like a new lead entry (has a name or contact info)
    const hasName = values[0] && values[0].match(/[A-Za-z]/)
    const hasPhone = values.some(v => /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(v))
    const hasEmail = values.some(v => v.includes("@"))
    
    // If we have a previous lead and this line has contact info, save the previous lead
    if (Object.keys(currentLead).length > 0 && (hasName || hasPhone || hasEmail)) {
      leads.push(processLeadData(currentLead, currentRowIndex))
      currentLead = {}
      currentRowIndex = i + 1
    }

    // Parse the current line
    const parsedData = parseLineData(values, headers, i)
    
    // Merge with current lead data
    Object.keys(parsedData).forEach(key => {
      if (parsedData[key as keyof typeof parsedData] && parsedData[key as keyof typeof parsedData] !== "Not provided") {
        if (!currentLead[key] || currentLead[key] === "Not provided") {
          currentLead[key] = parsedData[key as keyof typeof parsedData]
        } else if (key === "notes") {
          // Append notes
          currentLead[key] = currentLead[key] + " " + parsedData[key as keyof typeof parsedData]
        }
      }
    })
  }

  // Don't forget the last lead
  if (Object.keys(currentLead).length > 0) {
    leads.push(processLeadData(currentLead, currentRowIndex))
  }

  return leads
}

const parseLineData = (values: string[], headers: string[], lineIndex: number) => {
  const row: any = {}

  headers.forEach((header, index) => {
    row[header] = values[index] || ""
  })

  // Smart parsing for messy data
  let name = row.name || row.contact || row.client || ""
  let phone = row.phone || row.telephone || row.mobile || ""
  let email = row.email || row["email address"] || ""
  let company = row.company || row.business || row.organization || ""
  let address = row.address || row.location || row.property || ""
  const notesText = row.notes || row.comments || row.interactions || ""

  // If name field contains complex data, parse it
  if (name && (name.includes("@") || name.includes("(") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(name))) {
    const parsed = parseContactInfo(name)
    name = parsed.name || name
    phone = phone || parsed.phone
    email = email || parsed.email
    company = company || parsed.company
    address = address || parsed.address
  }

  // Parse any field that might contain contact info
  ;[phone, email, company, address].forEach((field) => {
    if (field && (field.includes("@") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(field))) {
      const parsed = parseContactInfo(field)
      email = email || parsed.email
      phone = phone || parsed.phone
      company = company || parsed.company
      address = address || parsed.address
    }
  })

  return {
    name: name || "Unknown Contact",
    phone: phone || "Not provided",
    email: email || "Not provided",
    company: company || "",
    address: address || "Address not provided",
    notes: notesText || ""
  }
}

const processLeadData = (leadData: Record<string, any>, rowIndex: number): Omit<Lead, "id"> => {
  // Parse notes and extract interaction history
  const notes = parseNotes(leadData.notes)
  
  // Determine status based on notes content
  let status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" = "contacted"
  if (leadData.notes.toLowerCase().includes("interested") || leadData.notes.toLowerCase().includes("wants to see")) {
    status = "interested"
  } else if (leadData.notes.toLowerCase().includes("not interested") || leadData.notes.toLowerCase().includes("said no")) {
    status = "cold"
  } else if (leadData.notes.toLowerCase().includes("closed") || leadData.notes.toLowerCase().includes("sold")) {
    status = "closed"
  } else if (leadData.notes.toLowerCase().includes("voicemail") && !leadData.notes.toLowerCase().includes("talked")) {
    status = "left voicemail"
  }

  // Determine priority based on notes and status
  let priority: "high" | "medium" | "low" | "dormant" = "medium"
  if (status === "interested") {
    priority = "high"
  } else if (status === "cold") {
    priority = "low"
  } else if (leadData.notes.toLowerCase().includes("dormant") || leadData.notes.toLowerCase().includes("spring")) {
    priority = "dormant"
  } else if (status === "left voicemail") {
    // Check if they should be high priority (recent contact but no response)
    const recentNotes = notes.filter(note => {
      const noteDate = new Date(note.timestamp)
      const now = new Date()
      const daysDiff = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff <= 14 // Within last 2 weeks
    })
    if (recentNotes.length > 0) {
      priority = "high"
    }
  }

  // Find the most recent date from notes for lastInteraction
  let lastInteraction = new Date().toISOString().split("T")[0]
  if (notes.length > 0) {
    const dates = notes.map(note => new Date(note.timestamp)).filter(date => !isNaN(date.getTime()))
    if (dates.length > 0) {
      const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())))
      lastInteraction = mostRecentDate.toISOString().split("T")[0]
    }
  }

  // Validate that we have at least a name and address
  if (!leadData.name || leadData.name === "Unknown Contact") {
    console.warn(`Row ${rowIndex}: Missing or invalid name for lead`)
  }
  if (!leadData.address || leadData.address === "Address not provided") {
    console.warn(`Row ${rowIndex}: Missing or invalid address for lead`)
  }

  return {
    name: leadData.name || "Unknown Contact",
    phone: leadData.phone || "Not provided",
    email: leadData.email || "Not provided",
    company: leadData.company || "",
    address: leadData.address || "Address not provided",
    status: status,
    lastInteraction: lastInteraction,
    priority: priority,
    nextActionDate: new Date().toISOString(),
    notes: notes.length > 0 ? notes : [{
      id: Date.now().toString(),
      text: "Imported from CSV - no interaction history",
      timestamp: new Date().toISOString(),
      type: "note" as const,
    }],
  }
}

const parseNotes = (notesText: string): Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> => {
  const notes: Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> = []
  
  if (!notesText) return notes

  // More intelligent parsing - look for patterns like "Called, voicemail 10/23. Called, voicemail 10/28. Called 12/6"
  const interactionPatterns = [
    // Pattern: "Called, voicemail 10/23"
    /(called|voicemail|emailed|sent)\s*(?:,?\s*(voicemail|email|text))?\s*(\d{1,2}\/\d{1,2})/gi,
    // Pattern: "Called 12/6, going to meet"
    /(called|voicemail|emailed|sent)\s+(\d{1,2}\/\d{1,2})/gi,
    // Pattern: "Called me evening of April 7th"
    /(called|voicemail|emailed|sent).*?(april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
    // Pattern: "10/21, called"
    /(\d{1,2}\/\d{1,2}),?\s*(called|voicemail|emailed|sent)/gi,
  ]

  let processedText = notesText
  const foundInteractions: Array<{ text: string; date: string; type: "call" | "email" | "note" }> = []

  // Extract interactions with dates
  interactionPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(notesText)) !== null) {
      const fullMatch = match[0]
      let type: "call" | "email" | "note" = "note"
      let dateStr = ""
      
      if (match[1] && match[1].toLowerCase().includes("call")) {
        type = "call"
      } else if (match[1] && (match[1].toLowerCase().includes("email") || match[1].toLowerCase().includes("sent"))) {
        type = "email"
      }
      
      // Extract date
      if (match[2] && /\d{1,2}\/\d{1,2}/.test(match[2])) {
        dateStr = match[2]
      } else if (match[3] && /\d{1,2}\/\d{1,2}/.test(match[3])) {
        dateStr = match[3]
      } else if (match[2] && match[3]) {
        // Month and day format
        dateStr = `${match[2]} ${match[3]}`
      }
      
      if (dateStr) {
        foundInteractions.push({
          text: fullMatch,
          date: dateStr,
          type: type
        })
      }
    }
  })

  // Process found interactions
  foundInteractions.forEach((interaction, index) => {
    let timestamp = new Date().toISOString()
    
    try {
      const dateStr = interaction.date
      // Try to parse various date formats
      let parsedDate = new Date(dateStr)
      if (isNaN(parsedDate.getTime())) {
        // Try with 2024 as base year for older dates
        parsedDate = new Date(dateStr + ", 2024")
      }
      if (isNaN(parsedDate.getTime())) {
        // Try with 2025 as base year for recent dates
        parsedDate = new Date(dateStr + ", 2025")
      }
      if (!isNaN(parsedDate.getTime())) {
        timestamp = parsedDate.toISOString()
      }
    } catch (e) {
      // Keep current date if parsing fails
    }
    
    notes.push({
      id: Date.now().toString() + index,
      text: interaction.text,
      timestamp: timestamp,
      type: interaction.type
    })
  })

  // If no structured interactions found, fall back to simple parsing
  if (notes.length === 0) {
    const noteParts = notesText.split(/[,;]|\band\b/).map(part => part.trim()).filter(part => part.length > 0)
    
    noteParts.forEach((part, index) => {
      if (part.length < 5) return // Skip very short parts
      
      let type: "call" | "email" | "note" = "note"
      let text = part
      
      // Determine type based on keywords
      if (part.toLowerCase().includes("call") || part.toLowerCase().includes("voicemail")) {
        type = "call"
      } else if (part.toLowerCase().includes("email") || part.toLowerCase().includes("sent")) {
        type = "email"
      }
      
      // Extract dates from the note
      const dateMatch = part.match(/(\w+\s+\d{1,2},?\s+\d{4})|(\d{1,2}\/\d{1,2})|(\w+\s+\d{1,2})/)
      let timestamp = new Date().toISOString()
      
      if (dateMatch) {
        try {
          const dateStr = dateMatch[0]
          let parsedDate = new Date(dateStr)
          if (isNaN(parsedDate.getTime())) {
            parsedDate = new Date(dateStr + ", 2024")
          }
          if (isNaN(parsedDate.getTime())) {
            parsedDate = new Date(dateStr + ", 2025")
          }
          if (!isNaN(parsedDate.getTime())) {
            timestamp = parsedDate.toISOString()
          }
        } catch (e) {
          // Keep current date if parsing fails
        }
      }
      
      notes.push({
        id: Date.now().toString() + index,
        text: text,
        timestamp: timestamp,
        type: type
      })
    })
  }
  
  return notes
}

export function CSVImport({ isOpen, onClose, onImport }: CSVImportProps) {
  const [dragActive, setDragActive] = useState(false)
  const [csvData, setCsvData] = useState<Omit<Lead, "id">[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

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
        
        // Check for warnings
        const warnings: string[] = []
        parsed.forEach((lead, index) => {
          if (!lead.name || lead.name === "Unknown Contact") {
            warnings.push(`Row ${index + 1}: Missing or invalid name`)
          }
          if (!lead.address || lead.address === "Address not provided") {
            warnings.push(`Row ${index + 1}: Missing or invalid address`)
          }
        })
        
        setWarnings(warnings)
        setCsvData(parsed)
        setMessage(null)
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
    setWarnings([])
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

                    {warnings.length > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-brand p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-yellow-400" />
                          <span className="text-yellow-400 font-title text-sm">Data Quality Warnings</span>
                        </div>
                        <div className="text-yellow-300 text-xs space-y-1">
                          {warnings.slice(0, 5).map((warning, index) => (
                            <div key={index}>• {warning}</div>
                          ))}
                          {warnings.length > 5 && (
                            <div>• ... and {warnings.length - 5} more warnings</div>
                          )}
                        </div>
                      </div>
                    )}

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
