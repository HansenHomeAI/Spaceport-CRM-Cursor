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
import { parseContactInfo } from "@/lib/parsing-utils"

interface CSVImportProps {
  isOpen: boolean
  onClose: () => void
  onImport: (leads: Omit<Lead, "id">[]) => Promise<{ success: boolean; message: string }>
}

const parseNotes = (notesText: string): Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> => {
  const notes: Array<{ id: string; text: string; timestamp: string; type: "call" | "email" | "note" }> = []
  
  if (!notesText) return notes

  // Split by periods, but be less aggressive - include shorter sentences
  const sentences = notesText.split(/\.(?=\s|$)/).map(s => s.trim()).filter(s => s.length > 2)
  
  sentences.forEach((sentence, index) => {
    // Look for date patterns - be more precise
    const datePatterns = [
      // Full dates with years - exact patterns
      /\b(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi, // "April 7th 2025"
      /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, // "10/21/24" or "4/3/25"
      
      // Month/day patterns - more precise
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi,
      /\b(\d{1,2}\/\d{1,2})\b/g, // "10/21", "12/6" - but not in words
    ]
    
    let timestamp = new Date("2024-10-01T12:00:00").toISOString() // Default fallback at noon
    let foundValidDate = false
    
    for (const pattern of datePatterns) {
      const matches = sentence.match(pattern)
      if (matches && matches.length > 0) {
        for (const match of matches) {
          try {
            const dateStr = match.trim()
            let parsedDate = null
            
            // Handle different date formats more carefully
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/')
              if (parts.length === 3) {
                // Handle 2-digit years like "4/3/25"
                let year = parseInt(parts[2])
                if (year < 100) {
                  year += 2000 // Convert 25 to 2025
                }
                parsedDate = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]))
              } else if (parts.length === 2) {
                // Handle "10/21" format - infer year
                const month = parseInt(parts[0])
                const day = parseInt(parts[1])
                
                // Determine year based on month
                if (month >= 10) {
                  parsedDate = new Date(2024, month - 1, day) // Oct-Dec 2024
                } else {
                  parsedDate = new Date(2025, month - 1, day) // Jan-Sep 2025
                }
              }
            } else {
              // Handle text dates like "Jun 9th" or "Apr 7th 2025"
              const monthMatch = dateStr.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(\d{4})?\b/i)
              if (monthMatch) {
                const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
                const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase())
                const day = parseInt(monthMatch[2])
                const year = monthMatch[3] ? parseInt(monthMatch[3]) : (monthIndex >= 9 ? 2024 : 2025)
                
                parsedDate = new Date(year, monthIndex, day)
              }
            }
            
            if (parsedDate && !isNaN(parsedDate.getTime())) {
              const year = parsedDate.getFullYear()
              const month = parsedDate.getMonth() + 1
              
              // Validate the date makes sense for our timeframe
              if ((year === 2024 && month >= 10) || (year === 2025 && month <= 8)) {
                timestamp = parsedDate.toISOString()
                foundValidDate = true
                break
              }
            }
          } catch (e) {
            // Continue to next match
          }
        }
        if (foundValidDate) break
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
  // First, let's handle the CSV properly by understanding the structure
  const lines = content.split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  
  const results: Omit<Lead, "id">[] = []
  let currentRow = ""
  let inQuotedField = false
  
  // Process lines, handling multi-line quoted fields
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    currentRow += (currentRow ? "\n" : "") + line
    
    // Count quotes to determine if we're in a multi-line quoted field
    const quoteCount = (currentRow.match(/"/g) || []).length
    inQuotedField = quoteCount % 2 === 1
    
    // If we're not in a quoted field and we have content, process this row
    if (!inQuotedField && currentRow) {
      const parsedRow = parseCSVRow(currentRow, headers)
      if (parsedRow) {
        results.push(parsedRow)
      }
      currentRow = ""
    }
  }
  
  // Process any remaining row
  if (currentRow && !inQuotedField) {
    const parsedRow = parseCSVRow(currentRow, headers)
    if (parsedRow) {
      results.push(parsedRow)
    }
  }
  
  return results
}

const parseCSVRow = (rowText: string, headers: string[]): Omit<Lead, "id"> | null => {
  // Parse the row respecting quotes
  const values: string[] = []
  let current = ""
  let inQuotes = false
  
  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""))
      current = ""
    } else {
      current += char
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""))
  
  // Create row object
  const row: any = {}
  headers.forEach((header, index) => {
    row[header] = values[index] || ""
  })

  // Extract and clean the fields
  let name = row.name || row.contact || row.client || ""
  let phone = row.phone || row.telephone || row.mobile || ""
  let email = row.email || row["email address"] || ""
  let address = row.address || row.location || row.property || ""
  const notesText = row.notes || row.comments || row.interactions || ""

  // Parse the complex name field
  if (name) {
    const parsed = parseContactInfo(name)
    name = parsed.name || "Unknown Contact"
    phone = phone || parsed.phone
    email = email || parsed.email
    
    // Only set company if we don't already have one
    if (!row.company && !row.business && !row.organization) {
      row.company = parsed.company
    }
  }

  // Skip if this looks like a company-only row (no individual name)
  if (!name || name === "Unknown Contact" || name.length < 2) {
    return null
  }

  // Parse notes and extract interaction history
  const notes = parseNotes(notesText)
  
    // Determine status based on notes content
  let status: "Left Voicemail" | "Contacted" | "Interested" | "Not Interested" | "Closed" = "Contacted"
  const lowerNotes = notesText.toLowerCase()

  if (lowerNotes.includes("interested") || lowerNotes.includes("wants to see") || lowerNotes.includes("sounded interested")) {
    status = "Interested"
  } else if (lowerNotes.includes("not interested") || lowerNotes.includes("said no") || lowerNotes.includes("isn't interested")) {
    status = "Not Interested"
  } else if (lowerNotes.includes("follow up") || lowerNotes.includes("callback") || lowerNotes.includes("try again")) {
    status = "Not Interested"
  } else if (lowerNotes.includes("voicemail") && !lowerNotes.includes("talked") && !lowerNotes.includes("picked up")) {
    status = "Left Voicemail"
  }



  // Find the most recent date from notes for lastInteraction (NOT import date!)
  let lastInteraction = "2024-10-01T12:00:00.000Z" // Default to start of our timeframe at noon
  if (notes.length > 0) {
    const dates = notes.map(note => new Date(note.timestamp)).filter(date => !isNaN(date.getTime()))
    if (dates.length > 0) {
      const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())))
              lastInteraction = mostRecentDate.toISOString()
    }
  }

  // Check if this contact needs attention
  const needsAttention = !name.trim() || name === "Unknown Contact" || 
                        !address.trim() || address === "Address not provided"

  return {
    name: name,
    phone: phone || "Not provided",
    email: email || "Not provided",
    company: row.company || row.business || row.organization || "",
    address: address || "Address not provided",
    properties: [{
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      address: address || "Address not provided",
      isSold: false
    }],
    status: status,
    lastInteraction: lastInteraction,
    nextActionDate: new Date().toISOString(),
    needsAttention: needsAttention,
    notes: notes.length > 0 ? notes : [{
      id: Date.now().toString(),
      text: "Imported from CSV - no interaction history",
      timestamp: new Date("2024-10-01T12:00:00").toISOString(),
      type: "note" as const,
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Helper function to detect if a name is likely a company
const isCompanyName = (name: string): boolean => {
  if (!name) return false
  
  const companyIndicators = [
    "real estate", "realty", "properties", "group", "team", "associates", "brokers", 
    "homes", "land", "development", "investment", "llc", "inc", "partners", 
    "sotheby's", "compass", "keller williams", "berkshire hathaway", "hall & hall", 
    "best choice", "mccann", "summit", "purewest", "era", "corcoran", "houlihan lawrence",
    "the dow group", "upside", "premier", "edina", "real broker", "toll brothers",
    "keystone construction", "axis realty", "realtypath", "summit sotheby's", 
    "compass real estate", "the big sky real estate co", "big sky sotheby's", 
    "era landmark", "purewest real estate", "hall & hall partners", "best choice realty",
    "tom evans & ashley diprisco real estate", "berkshire hathaway homeservices alaska realty",
    "keller williams realty alaska group", "real broker alaska", "premier commercial realty",
    "edina realty", "houlihan lawrence", "construction", "builders", "reality", "co"
  ]
  
  const lowerName = name.toLowerCase()
  return companyIndicators.some(indicator => lowerName.includes(indicator))
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
