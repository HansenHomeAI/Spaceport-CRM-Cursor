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

const parseNotes = (notesText: string): Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> => {
  const notes: Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> = []
  
  if (!notesText) return notes

  // Split by common separators but be smarter about it
  const noteParts = notesText.split(/[,;]|\band\b/).map(part => part.trim()).filter(part => part.length > 0)
  
  noteParts.forEach((part, index) => {
    if (part.length < 5) return // Skip very short parts
    
    let type: "call" | "email" | "note" = "note"
    let text = part
    
          // Determine type based on keywords - be more specific about voicemail
      if (part.toLowerCase().includes("voicemail") || part.toLowerCase().includes("left message")) {
        type = "call" // Still a call but we'll mark it as voicemail in status
        // Update the text to be more specific about voicemail
        if (!part.toLowerCase().includes("voicemail")) {
          text = part + " (voicemail)"
        }
      } else if (part.toLowerCase().includes("call") && !part.toLowerCase().includes("voicemail")) {
        type = "call"
      } else if (part.toLowerCase().includes("email") || part.toLowerCase().includes("sent")) {
        type = "email"
      }
    
    // Extract dates from the note - use 2024 as base year for older dates
    const dateMatch = part.match(/(\w+\s+\d{1,2},?\s+\d{4})|(\d{1,2}\/\d{1,2})|(\w+\s+\d{1,2})/)
    let timestamp = new Date().toISOString()
    
    if (dateMatch) {
      try {
        const dateStr = dateMatch[0]
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
    }
    
    notes.push({
      id: Date.now().toString() + index,
      text: text,
      timestamp: timestamp,
      type: type
    })
  })
  
  return notes
}

// New intelligent CSV parsing that handles multi-line data
const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  const leads: Omit<Lead, "id">[] = []
  let currentLead: any = null

  // Process each line after headers
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    
         // Check if this line has a name (starts with a letter and has contact info)
     const hasName = /^[A-Za-z]/.test(line.trim()) && 
                    (line.includes("@") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)) &&
                    line.trim().length > 3 // Ensure it's not just a single word
    
    if (hasName) {
      // This is a new lead - save the previous one if it exists
      if (currentLead && currentLead.name && currentLead.name !== "Unknown Contact") {
        leads.push(currentLead)
      }
      
      // Start parsing a new lead
      currentLead = {
        name: "",
        phone: "",
        email: "",
        company: "",
        address: "",
        status: "contacted" as const,
        lastInteraction: new Date().toISOString().split("T")[0],
        priority: "medium" as const,
        nextActionDate: new Date().toISOString(),
        notes: [],
      }
      
      // Parse the contact info from this line
      const contactInfo = parseContactInfo(line)
      currentLead.name = contactInfo.name || "Unknown Contact"
      currentLead.phone = contactInfo.phone || "Not provided"
      currentLead.email = contactInfo.email || "Not provided"
      currentLead.company = contactInfo.company || ""
      currentLead.address = contactInfo.address || ""
      
      // Look for additional info in subsequent lines that might belong to this contact
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j].trim()
        
        // If next line starts with a name, it's a new contact
        if (/^[A-Za-z]/.test(nextLine) && 
            (nextLine.includes("@") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(nextLine))) {
          break
        }
        
        // If next line is empty, skip it
        if (!nextLine) {
          j++
          continue
        }
        
                 // Check if this line contains additional contact info
         const additionalInfo = parseContactInfo(nextLine)
         if (additionalInfo.name && additionalInfo.name !== currentLead.name) {
           // This might be company info or additional contact
           if (!currentLead.company && additionalInfo.company) {
             currentLead.company = additionalInfo.company
           }
           if (!currentLead.address && additionalInfo.address) {
             currentLead.address = additionalInfo.address
           }
         }
         
         // Also check if this line contains an address (even without a name)
         if (!currentLead.address && (
           nextLine.includes("Rd") || 
           nextLine.includes("St") || 
           nextLine.includes("Ave") || 
           nextLine.includes("Dr") ||
           nextLine.includes("UT") ||
           nextLine.includes("ID") ||
           nextLine.includes("MT") ||
           nextLine.includes("WY") ||
           nextLine.includes("AK") ||
           nextLine.includes("NY") ||
           nextLine.includes("NH") ||
           nextLine.includes("TX") ||
           nextLine.includes("MN") ||
           nextLine.includes("MA") ||
           nextLine.includes("IL") ||
           nextLine.includes("MO") ||
           nextLine.includes("OK") ||
           nextLine.includes("CO")
         )) {
           currentLead.address = nextLine.trim()
         }
        
        // Check if this line contains notes/interactions
        if (nextLine.toLowerCase().includes("call") || 
            nextLine.toLowerCase().includes("email") || 
            nextLine.toLowerCase().includes("voicemail") ||
            nextLine.toLowerCase().includes("sent") ||
            /\d{1,2}\/\d{1,2}/.test(nextLine) ||
            /\w+\s+\d{1,2}/.test(nextLine)) {
          
          // Parse notes from this line
          const notes = parseNotes(nextLine)
          currentLead.notes.push(...notes)
        }
        
        j++
      }
      
             // Determine status based on all collected notes
       const allNotes = currentLead.notes.map((n: any) => n.text).join(" ").toLowerCase()
       if (allNotes.includes("interested") || allNotes.includes("wants to see")) {
         currentLead.status = "interested"
       } else if (allNotes.includes("not interested") || allNotes.includes("said no")) {
         currentLead.status = "cold"
       } else if (allNotes.includes("closed") || allNotes.includes("sold")) {
         currentLead.status = "closed"
       } else if (allNotes.includes("voicemail") && !allNotes.includes("talked") && !allNotes.includes("picked up")) {
         currentLead.status = "left voicemail"
       }

      // Determine priority based on notes and status
      if (currentLead.status === "interested") {
        currentLead.priority = "high"
      } else if (currentLead.status === "cold") {
        currentLead.priority = "low"
      } else if (allNotes.includes("dormant") || allNotes.includes("spring")) {
        currentLead.priority = "dormant"
      } else if (currentLead.status === "left voicemail") {
        // Check if they should be high priority (recent contact but no response)
        const recentNotes = currentLead.notes.filter((note: any) => {
          const noteDate = new Date(note.timestamp)
          const now = new Date()
          const daysDiff = (now.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24)
          return daysDiff <= 14 // Within last 2 weeks
        })
        if (recentNotes.length > 0) {
          currentLead.priority = "high"
        }
      }

      // Find the earliest date from notes for lastInteraction
               if (currentLead.notes.length > 0) {
           const dates = currentLead.notes.map((note: any) => new Date(note.timestamp)).filter((date: Date) => !isNaN(date.getTime()))
           if (dates.length > 0) {
             const earliestDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())))
             currentLead.lastInteraction = earliestDate.toISOString().split("T")[0]
           }
         }

      // Add default note if no notes were found
      if (currentLead.notes.length === 0) {
        currentLead.notes = [{
          id: Date.now().toString(),
          text: "Imported from CSV - no interaction history",
          timestamp: new Date().toISOString(),
          type: "note" as const,
        }]
      }
      
      i = j - 1 // Skip the lines we've already processed
    }
  }
  
  // Don't forget the last lead
  if (currentLead && currentLead.name && currentLead.name !== "Unknown Contact") {
    leads.push(currentLead)
  }

  return leads
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
