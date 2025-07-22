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

  // Split by common separators
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
        // Try to parse various date formats
        let parsedDate = new Date(dateStr)
        if (isNaN(parsedDate.getTime())) {
          // Try alternative formats
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

const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

  return lines.slice(1).map((line, lineIndex) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
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

    // Parse notes and extract interaction history
    const notes = parseNotes(notesText)
    
    // Determine status based on notes content
    let status: "cold" | "contacted" | "interested" | "closed" | "dormant" = "contacted"
    if (notesText.toLowerCase().includes("interested") || notesText.toLowerCase().includes("wants to see")) {
      status = "interested"
    } else if (notesText.toLowerCase().includes("not interested") || notesText.toLowerCase().includes("said no")) {
      status = "cold"
    } else if (notesText.toLowerCase().includes("closed") || notesText.toLowerCase().includes("sold")) {
      status = "closed"
    }

    // Determine priority based on notes and status
    let priority: "high" | "medium" | "low" | "dormant" = "medium"
    if (status === "interested") {
      priority = "high"
    } else if (status === "cold") {
      priority = "low"
    } else if (notesText.toLowerCase().includes("dormant") || notesText.toLowerCase().includes("spring")) {
      priority = "dormant"
    }

    // Find the earliest date from notes for lastInteraction
    let lastInteraction = new Date().toISOString().split("T")[0]
    if (notes.length > 0) {
      const dates = notes.map(note => new Date(note.timestamp)).filter(date => !isNaN(date.getTime()))
      if (dates.length > 0) {
        const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())))
        lastInteraction = earliestDate.toISOString().split("T")[0]
      }
    }

    return {
      name: name || "Unknown Contact",
      phone: phone || "Not provided",
      email: email || "Not provided",
      company: company || "",
      address: address || "Address not provided",
      status: status,
      lastInteraction: lastInteraction,
      priority: priority,
      nextActionDate: new Date().toISOString(),
      notes: notes.length > 0 ? notes : [{
        id: Date.now().toString(),
        text: "Initial contact made - imported from CSV",
        timestamp: new Date().toISOString(),
        type: "call" as const,
      }],
    }
  })
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
