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

const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  const leads: Omit<Lead, "id">[] = []
  let currentLead: any = null

  // Process lines starting from index 1 (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
    
    // Check if this line has a valid name (first column)
    const nameValue = values[0] || ""
    const hasValidName = nameValue && nameValue.length > 0 && !nameValue.match(/^\s*$/)
    
    // If we have a current lead and this line doesn't have a name, it's likely a continuation
    if (currentLead && !hasValidName) {
      // This is a continuation line - merge with current lead
      currentLead = mergeLeadData(currentLead, values, headers)
    } else {
      // This is a new lead - save previous one and start new
      if (currentLead) {
        const processedLead = processLeadData(currentLead, headers)
        if (processedLead) {
          leads.push(processedLead)
        }
      }
      
      // Start new lead
      currentLead = { values, headers }
    }
  }
  
  // Don't forget the last lead
  if (currentLead) {
    const processedLead = processLeadData(currentLead, headers)
    if (processedLead) {
      leads.push(processedLead)
    }
  }

  return leads
}

// Merge continuation data into current lead
const mergeLeadData = (currentLead: any, newValues: string[], headers: string[]) => {
  const mergedValues = [...currentLead.values]
  
  // Merge non-empty values from continuation line
  newValues.forEach((value, index) => {
    if (value && value.trim() && (!mergedValues[index] || !mergedValues[index].trim())) {
      mergedValues[index] = value
    } else if (value && value.trim() && mergedValues[index] && mergedValues[index].trim()) {
      // If both have values, concatenate them (for notes, etc.)
      mergedValues[index] = mergedValues[index] + " " + value
    }
  })
  
  return { values: mergedValues, headers }
}

// Process a complete lead entry
const processLeadData = (leadData: any, headers: string[]): Omit<Lead, "id"> | null => {
  const values = leadData.values
  const row: any = {}

  headers.forEach((header, index) => {
    row[header] = values[index] || ""
  })

  // Extract and parse the name field (most complex part)
  const nameField = row.name || row.contact || row.client || ""
  const phoneField = row.phone || row.telephone || row.mobile || ""
  const emailField = row.email || row["email address"] || ""
  const companyField = row.company || row.business || row.organization || ""
  const addressField = row.address || row.location || row.property || ""
  const notesField = row.notes || row.comments || row.interactions || ""

  // Parse the name field which may contain multiple pieces of information
  const parsedNameInfo = parseComplexNameField(nameField)
  
  // Parse other fields for additional information
  const parsedPhoneInfo = parsePhoneField(phoneField)
  const parsedEmailInfo = parseEmailField(emailField)
  const parsedCompanyInfo = parseCompanyField(companyField)
  const parsedAddressInfo = parseAddressField(addressField)
  const parsedNotesInfo = parseNotesField(notesField)

  // Combine all parsed information
  const finalData = {
    name: parsedNameInfo.name || "Unknown Contact",
    phone: parsedNameInfo.phone || parsedPhoneInfo.phone || "Not provided",
    email: parsedNameInfo.email || parsedEmailInfo.email || "Not provided",
    company: parsedNameInfo.company || parsedCompanyInfo.company || "",
    address: parsedNameInfo.address || parsedAddressInfo.address || "Address not provided",
    notes: parsedNotesInfo.notes,
    status: determineStatus(parsedNotesInfo.notes, notesField),
    priority: determinePriority(parsedNotesInfo.notes, notesField),
    lastInteraction: parsedNotesInfo.lastInteraction,
  }

  // Validate that we have at least a name and address
  if (!finalData.name || finalData.name === "Unknown Contact" || !finalData.address || finalData.address === "Address not provided") {
    console.warn("Invalid lead data:", finalData)
    return null
  }

  return {
    name: finalData.name,
    phone: finalData.phone,
    email: finalData.email,
    company: finalData.company,
    address: finalData.address,
    status: finalData.status,
    lastInteraction: finalData.lastInteraction,
    priority: finalData.priority,
    nextActionDate: new Date().toISOString(),
    notes: finalData.notes.length > 0 ? finalData.notes : [{
      id: Date.now().toString(),
      text: "Imported from CSV - no interaction history",
      timestamp: new Date().toISOString(),
      type: "note" as const,
    }],
  }
}

// Parse complex name field that may contain name, phone, company, etc.
const parseComplexNameField = (nameField: string) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  if (!nameField) return result

  // Extract email first
  const emailMatch = nameField.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
    nameField = nameField.replace(emailMatch[0], "").trim()
  }

  // Extract phone number (multiple formats)
  const phoneMatch = nameField.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    nameField = nameField.replace(phoneMatch[0], "").trim()
  }

  // Look for company names in the remaining text
  const companyKeywords = [
    "Real Estate", "Realty", "Properties", "Group", "Team", "Associates", "Brokers", 
    "Homes", "Land", "Development", "Investment", "LLC", "Inc", "Partners", 
    "Sotheby's", "Compass", "Keller Williams", "Berkshire Hathaway", "Hall & Hall", 
    "Best Choice", "McCann", "Summit", "PureWest", "ERA", "Corcoran", 
    "Houlihan Lawrence", "The Dow Group", "Upside", "Premier", "Edina", 
    "Real Broker", "Keller Williams Realty", "Berkshire Hathaway HomeServices",
    "Toll Brothers", "Keystone Construction", "Axis Realty", "Realtypath",
    "Summit Sotheby's", "Compass Real Estate", "The Big Sky Real Estate Co",
    "Big Sky Sotheby's", "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners",
    "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate",
    "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group",
    "Real Broker Alaska", "Premier Commercial Realty", "Edina Realty"
  ]

  for (const keyword of companyKeywords) {
    if (nameField.toLowerCase().includes(keyword.toLowerCase())) {
      // Find the full company name
      const companyRegex = new RegExp(`[^,\\n]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,\\n]*`, "i")
      const match = nameField.match(companyRegex)
      if (match) {
        result.company = match[0].trim()
        nameField = nameField.replace(match[0], "").trim()
        break
      }
    }
  }

  // Clean up name - remove parenthetical aliases and extra info
  nameField = nameField.replace(/\([^)]*\)/g, "") // Remove (aka Lawrence) type content
  nameField = nameField.replace(/\s+/g, " ").trim() // Clean up whitespace

  // Extract name (first few words before any remaining punctuation)
  const nameMatch = nameField.match(/^([A-Za-z\s]+)/)
  if (nameMatch) {
    result.name = nameMatch[1].trim()
  }

  return result
}

// Parse phone field
const parsePhoneField = (phoneField: string) => {
  const result = { phone: "" }
  if (!phoneField) return result

  const phoneMatch = phoneField.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
  }

  return result
}

// Parse email field
const parseEmailField = (emailField: string) => {
  const result = { email: "" }
  if (!emailField) return result

  const emailMatch = emailField.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)
  if (emailMatch) {
    result.email = emailMatch[0]
  }

  return result
}

// Parse company field
const parseCompanyField = (companyField: string) => {
  const result = { company: "" }
  if (!companyField) return result

  // Check if it looks like a company name
  if (companyField.length > 2 && !companyField.match(/^\d/)) {
    result.company = companyField.trim()
  }

  return result
}

// Parse address field
const parseAddressField = (addressField: string) => {
  const result = { address: "" }
  if (!addressField) return result

  // Check if it looks like an address (contains numbers and address keywords)
  const addressKeywords = [
    "Street", "St", "Avenue", "Ave", "Road", "Rd", "Drive", "Dr", "Lane", "Ln",
    "Boulevard", "Blvd", "Way", "Circle", "Cir", "Loop", "Trail", "Trl", "Court", "Ct",
    "Place", "Pl", "Terrace", "Ter", "Heights", "Hts", "Ridge", "Rdg", "Point", "Pt"
  ]

  const hasAddressKeyword = addressKeywords.some(keyword => 
    addressField.toLowerCase().includes(keyword.toLowerCase())
  )
  const hasNumbers = /\d/.test(addressField)

  if (hasAddressKeyword || hasNumbers) {
    result.address = addressField.trim()
  }

  return result
}

// Parse notes field and extract interaction history
const parseNotesField = (notesField: string) => {
  const notes: Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> = []
  let lastInteraction = new Date().toISOString().split("T")[0]
  
  if (!notesField) return { notes, lastInteraction }

  // Split by common separators but be more careful
  const noteParts = notesField.split(/[,;]|\band\b/).map(part => part.trim()).filter(part => part.length > 0)
  const allDates: Date[] = []
  
  noteParts.forEach((part, index) => {
    if (part.length < 5) return // Skip very short parts
    
    let type: "call" | "email" | "note" = "note"
    let text = part
    
    // Determine type based on keywords - voicemail overrides call
    if (part.toLowerCase().includes("voicemail")) {
      type = "call" // Keep as call but we'll handle voicemail status separately
    } else if (part.toLowerCase().includes("call")) {
      type = "call"
    } else if (part.toLowerCase().includes("email") || part.toLowerCase().includes("sent")) {
      type = "email"
    }
    
    // Extract dates from the note - multiple date formats
    const dateMatches = part.match(/(\w+\s+\d{1,2},?\s+\d{4})|(\d{1,2}\/\d{1,2})|(\w+\s+\d{1,2})/g)
    let timestamp = new Date().toISOString()
    
    if (dateMatches) {
      dateMatches.forEach(dateStr => {
        try {
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
            allDates.push(parsedDate)
            timestamp = parsedDate.toISOString()
          }
        } catch (e) {
          // Keep current date if parsing fails
        }
      })
    }
    
    notes.push({
      id: Date.now().toString() + index,
      text: text,
      timestamp: timestamp,
      type: type
    })
  })
  
  // Find the most recent date for lastInteraction
  if (allDates.length > 0) {
    const mostRecentDate = new Date(Math.max(...allDates.map(d => d.getTime())))
    lastInteraction = mostRecentDate.toISOString().split("T")[0]
  }
  
  return { notes, lastInteraction }
}

// Determine status based on notes content
const determineStatus = (notes: any[], notesField: string): "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" => {
  const notesText = notesField.toLowerCase()
  
  if (notesText.includes("interested") || notesText.includes("wants to see")) {
    return "interested"
  } else if (notesText.includes("not interested") || notesText.includes("said no")) {
    return "cold"
  } else if (notesText.includes("closed") || notesText.includes("sold")) {
    return "closed"
  } else if (notesText.includes("voicemail") && !notesText.includes("talked")) {
    return "left voicemail"
  }
  
  return "contacted"
}

// Determine priority based on notes and status
const determinePriority = (notes: any[], notesField: string): "high" | "medium" | "low" | "dormant" => {
  const notesText = notesField.toLowerCase()
  
  if (notesText.includes("interested") || notesText.includes("wants to see")) {
    return "high"
  } else if (notesText.includes("not interested") || notesText.includes("said no")) {
    return "low"
  } else if (notesText.includes("dormant") || notesText.includes("spring")) {
    return "dormant"
  } else if (notesText.includes("voicemail")) {
    // Check if they should be high priority (recent contact but no response)
    const recentNotes = notes.filter(note => {
      const noteDate = new Date(note.timestamp)
      const now = new Date()
      const daysDiff = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysDiff <= 14 // Within last 2 weeks
    })
    if (recentNotes.length > 0) {
      return "high"
    }
  }
  
  return "medium"
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
