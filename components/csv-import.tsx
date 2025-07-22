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

  // Split by common separators but be more intelligent about it
  const noteParts = notesText.split(/[,;]|\band\b/).map(part => part.trim()).filter(part => part.length > 0)
  
  noteParts.forEach((part, index) => {
    if (part.length < 5) return // Skip very short parts
    
    let type: "call" | "email" | "note" = "note"
    let text = part
    
    // Determine type based on keywords - be more specific about voicemail
    if (part.toLowerCase().includes("voicemail") || part.toLowerCase().includes("left message")) {
      type = "call" // Voicemail is still a call type
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

// New robust CSV parsing that handles multi-line entries
const parseCSVContent = (content: string): Omit<Lead, "id">[] => {
  const lines = content.split("\n").filter((line) => line.trim())
  
  // Skip header row
  const dataLines = lines.slice(1)
  const leads: Omit<Lead, "id">[] = []
  
  let currentEntry: any = {}
  let entryLines: string[] = []
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]
    
    // Check if this line starts a new entry (has a name pattern)
    const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+/
    const isNewEntry = namePattern.test(line) && line.includes(',')
    
    if (isNewEntry && entryLines.length > 0) {
      // Process the previous entry
      const processedEntry = processEntry(entryLines)
      if (processedEntry) {
        leads.push(processedEntry)
      }
      entryLines = []
    }
    
    entryLines.push(line)
  }
  
  // Process the last entry
  if (entryLines.length > 0) {
    const processedEntry = processEntry(entryLines)
    if (processedEntry) {
      leads.push(processedEntry)
    }
  }
  
  return leads
}

const processEntry = (lines: string[]): Omit<Lead, "id"> | null => {
  // Join all lines for this entry
  const fullEntry = lines.join('\n')
  
  // Split by tabs first, then by commas if needed
  const parts = fullEntry.split('\t').filter(part => part.trim())
  
  if (parts.length === 0) return null
  
  // Extract basic fields
  let name = parts[0] || ""
  let phone = parts[1] || ""
  let email = parts[2] || ""
  let address = parts[3] || ""
  let notesText = parts[4] || ""
  let followUp = parts[5] || ""
  
  // If we have fewer parts than expected, try comma splitting the first part
  if (parts.length < 4 && parts[0]) {
    const firstPart = parts[0]
    const commaParts = firstPart.split(',').map(p => p.trim())
    
    // Try to intelligently parse the first part
    if (commaParts.length >= 2) {
      // Check if second part looks like a company
      const secondPart = commaParts[1]
      const companyKeywords = ["Real Estate", "Realty", "Properties", "Group", "Team", "Associates", "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc", "Partners", "Sotheby's", "Compass", "Keller Williams", "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", "Upside", "Premier", "Edina", "Real Broker", "Keller Williams Realty", "Berkshire Hathaway HomeServices", "Toll Brothers", "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", "Compass Real Estate", "McCann", "The Big Sky Real Estate Co", "Big Sky Sotheby's", "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", "Real Broker Alaska", "The Dow Group", "Upside", "Premier Commercial Realty", "Edina Realty", "Corcoran", "Houlihan Lawrence"]
      
      const isCompany = companyKeywords.some(keyword => 
        secondPart.toLowerCase().includes(keyword.toLowerCase())
      )
      
      if (isCompany) {
        // This is likely a name + company format
        const parsed = parseContactInfo(commaParts[0])
        name = parsed.name || commaParts[0]
        phone = phone || parsed.phone
        email = email || parsed.email
        
        // Extract company from the second part
        const companyParsed = parseContactInfo(commaParts[1])
        const company = companyParsed.company || commaParts[1]
        
        // If we have more parts, they might be address and notes
        if (commaParts.length >= 3) {
          address = address || commaParts[2]
        }
        if (commaParts.length >= 4) {
          notesText = notesText || commaParts.slice(3).join(', ')
        }
      } else {
        // This might be a name + phone format
        const parsed = parseContactInfo(commaParts[0])
        name = parsed.name || commaParts[0]
        phone = phone || parsed.phone || commaParts[1]
        email = email || parsed.email
      }
    }
  }
  
  // Parse contact info from name field if it contains complex data
  if (name && (name.includes("@") || name.includes("(") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(name))) {
    const parsed = parseContactInfo(name)
    name = parsed.name || name
    phone = phone || parsed.phone
    email = email || parsed.email
  }
  
  // Parse any field that might contain contact info
  ;[phone, email, address].forEach((field) => {
    if (field && (field.includes("@") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(field))) {
      const parsed = parseContactInfo(field)
      email = email || parsed.email
      phone = phone || parsed.phone
    }
  })
  
  // Parse notes and extract interaction history
  const notes = parseNotes(notesText)
  
  // Determine status based on notes content
  let status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" = "contacted"
  if (notesText.toLowerCase().includes("interested") || notesText.toLowerCase().includes("wants to see")) {
    status = "interested"
  } else if (notesText.toLowerCase().includes("not interested") || notesText.toLowerCase().includes("said no")) {
    status = "cold"
  } else if (notesText.toLowerCase().includes("closed") || notesText.toLowerCase().includes("sold")) {
    status = "closed"
  } else if (notesText.toLowerCase().includes("voicemail") && !notesText.toLowerCase().includes("talked")) {
    status = "left voicemail"
  }
  
  // Determine priority based on notes and status
  let priority: "high" | "medium" | "low" | "dormant" = "medium"
  if (status === "interested") {
    priority = "high"
  } else if (status === "cold") {
    priority = "low"
  } else if (notesText.toLowerCase().includes("dormant") || notesText.toLowerCase().includes("spring")) {
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
  
  // Validate that we have at least a name
  if (!name || name.trim() === "") {
    return null // Skip entries without names
  }
  
  return {
    name: name || "Unknown Contact",
    phone: phone || "Not provided",
    email: email || "Not provided",
    company: "", // Will be extracted from notes if present
    address: address || "Address not provided",
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

export function CSVImport({ isOpen, onClose, onImport }: CSVImportProps) {
  const [dragActive, setDragActive] = useState(false)
  const [csvData, setCsvData] = useState<Omit<Lead, "id">[] | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [parsingErrors, setParsingErrors] = useState<Array<{ line: string; error: string; suggestedFix?: any }>>([])
  const [showErrorResolution, setShowErrorResolution] = useState(false)

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
        const { leads, errors } = parseCSVContentWithValidation(content)
        
        if (errors.length > 0) {
          setParsingErrors(errors)
          setShowErrorResolution(true)
          setCsvData(leads)
          setMessage({ type: "error", text: `Found ${errors.length} parsing issues. Please review and fix.` })
        } else {
          setCsvData(leads)
          setMessage(null)
        }
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
          setParsingErrors([])
          setShowErrorResolution(false)
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
    setParsingErrors([])
    setShowErrorResolution(false)
  }

  const handleManualOverride = (index: number, override: Partial<Omit<Lead, "id">>) => {
    if (!csvData) return
    
    const updatedData = [...csvData]
    updatedData[index] = { ...updatedData[index], ...override }
    setCsvData(updatedData)
    
    // Remove the error from the list
    const updatedErrors = parsingErrors.filter((_, i) => i !== index)
    setParsingErrors(updatedErrors)
    
    if (updatedErrors.length === 0) {
      setShowErrorResolution(false)
      setMessage({ type: "success", text: "All parsing issues resolved!" })
    }
  }

  const parseCSVContentWithValidation = (content: string): { leads: Omit<Lead, "id">[], errors: Array<{ line: string; error: string; suggestedFix?: any }> } => {
    const lines = content.split("\n").filter((line) => line.trim())
    const dataLines = lines.slice(1)
    const leads: Omit<Lead, "id">[] = []
    const errors: Array<{ line: string; error: string; suggestedFix?: any }> = []
    
    let entryLines: string[] = []
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i]
      
      // Check if this line starts a new entry (has a name pattern)
      const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+/
      const isNewEntry = namePattern.test(line) && line.includes(',')
      
      if (isNewEntry && entryLines.length > 0) {
        // Process the previous entry
        const { entry, error } = processEntryWithValidation(entryLines)
        if (entry) {
          leads.push(entry)
        }
        if (error) {
          errors.push({ line: entryLines.join('\n'), error: error.error, suggestedFix: error.suggestedFix })
        }
        entryLines = []
      }
      
      entryLines.push(line)
    }
    
    // Process the last entry
    if (entryLines.length > 0) {
      const { entry, error } = processEntryWithValidation(entryLines)
      if (entry) {
        leads.push(entry)
      }
      if (error) {
        errors.push({ line: entryLines.join('\n'), error: error.error, suggestedFix: error.suggestedFix })
      }
    }
    
    return { leads, errors }
  }

  const processEntryWithValidation = (lines: string[]): { entry: Omit<Lead, "id"> | null, error: { error: string; suggestedFix?: any } | null } => {
    // Join all lines for this entry
    const fullEntry = lines.join('\n')
    
    // Split by tabs first, then by commas if needed
    const parts = fullEntry.split('\t').filter(part => part.trim())
    
    if (parts.length === 0) {
      return { 
        entry: null, 
        error: { error: "Empty entry - no data found" }
      }
    }
    
    // Extract basic fields
    let name = parts[0] || ""
    let phone = parts[1] || ""
    let email = parts[2] || ""
    let address = parts[3] || ""
    let notesText = parts[4] || ""
    let followUp = parts[5] || ""
    
    // If we have fewer parts than expected, try comma splitting the first part
    if (parts.length < 4 && parts[0]) {
      const firstPart = parts[0]
      const commaParts = firstPart.split(',').map(p => p.trim())
      
      // Try to intelligently parse the first part
      if (commaParts.length >= 2) {
        // Check if second part looks like a company
        const secondPart = commaParts[1]
        const companyKeywords = ["Real Estate", "Realty", "Properties", "Group", "Team", "Associates", "Brokers", "Homes", "Land", "Development", "Investment", "LLC", "Inc", "Partners", "Sotheby's", "Compass", "Keller Williams", "Berkshire Hathaway", "Hall & Hall", "Best Choice", "McCann", "Summit", "PureWest", "ERA", "Corcoran", "Houlihan Lawrence", "The Dow Group", "Upside", "Premier", "Edina", "Real Broker", "Keller Williams Realty", "Berkshire Hathaway HomeServices", "Toll Brothers", "Keystone Construction", "Axis Realty", "Realtypath", "Summit Sotheby's", "Compass Real Estate", "McCann", "The Big Sky Real Estate Co", "Big Sky Sotheby's", "ERA Landmark", "PureWest Real Estate", "Hall & Hall Partners", "Best Choice Realty", "Tom Evans & Ashley DiPrisco Real Estate", "Berkshire Hathaway HomeServices Alaska Realty", "Keller Williams Realty Alaska Group", "Real Broker Alaska", "The Dow Group", "Upside", "Premier Commercial Realty", "Edina Realty", "Corcoran", "Houlihan Lawrence"]
        
        const isCompany = companyKeywords.some(keyword => 
          secondPart.toLowerCase().includes(keyword.toLowerCase())
        )
        
        if (isCompany) {
          // This is likely a name + company format
          const parsed = parseContactInfo(commaParts[0])
          name = parsed.name || commaParts[0]
          phone = phone || parsed.phone
          email = email || parsed.email
          
          // Extract company from the second part
          const companyParsed = parseContactInfo(commaParts[1])
          const company = companyParsed.company || commaParts[1]
          
          // If we have more parts, they might be address and notes
          if (commaParts.length >= 3) {
            address = address || commaParts[2]
          }
          if (commaParts.length >= 4) {
            notesText = notesText || commaParts.slice(3).join(', ')
          }
        } else {
          // This might be a name + phone format
          const parsed = parseContactInfo(commaParts[0])
          name = parsed.name || commaParts[0]
          phone = phone || parsed.phone || commaParts[1]
          email = email || parsed.email
        }
      }
    }
    
    // Parse contact info from name field if it contains complex data
    if (name && (name.includes("@") || name.includes("(") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(name))) {
      const parsed = parseContactInfo(name)
      name = parsed.name || name
      phone = phone || parsed.phone
      email = email || parsed.email
    }
    
    // Parse any field that might contain contact info
    ;[phone, email, address].forEach((field) => {
      if (field && (field.includes("@") || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(field))) {
        const parsed = parseContactInfo(field)
        email = email || parsed.email
        phone = phone || parsed.phone
      }
    })
    
    // Parse notes and extract interaction history
    const notes = parseNotes(notesText)
    
    // Determine status based on notes content
    let status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail" = "contacted"
    if (notesText.toLowerCase().includes("interested") || notesText.toLowerCase().includes("wants to see")) {
      status = "interested"
    } else if (notesText.toLowerCase().includes("not interested") || notesText.toLowerCase().includes("said no")) {
      status = "cold"
    } else if (notesText.toLowerCase().includes("closed") || notesText.toLowerCase().includes("sold")) {
      status = "closed"
    } else if (notesText.toLowerCase().includes("voicemail") && !notesText.toLowerCase().includes("talked")) {
      status = "left voicemail"
    }
    
    // Determine priority based on notes and status
    let priority: "high" | "medium" | "low" | "dormant" = "medium"
    if (status === "interested") {
      priority = "high"
    } else if (status === "cold") {
      priority = "low"
    } else if (notesText.toLowerCase().includes("dormant") || notesText.toLowerCase().includes("spring")) {
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
    
    // Validate that we have at least a name
    if (!name || name.trim() === "") {
      return { 
        entry: null, 
        error: { 
          error: "Missing contact name",
          suggestedFix: { name: "Unknown Contact" }
        }
      }
    }
    
    // Validate that we have at least an address
    if (!address || address.trim() === "") {
      return { 
        entry: null, 
        error: { 
          error: "Missing property address",
          suggestedFix: { address: "Address not provided" }
        }
      }
    }
    
    const entry = {
      name: name || "Unknown Contact",
      phone: phone || "Not provided",
      email: email || "Not provided",
      company: "", // Will be extracted from notes if present
      address: address || "Address not provided",
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
    
    return { entry, error: null }
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
                      <p>"Christopher Corroon 435-901-0444, Axis Realty Group"</p>
                      <p>"Steve Johns (husband), Toll Brothers"</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="text-white font-title">{csvData.length} contacts ready to import</span>
                        {parsingErrors.length > 0 && (
                          <Badge className="bg-red-500/20 text-red-300 rounded-pill">
                            {parsingErrors.length} issues
                          </Badge>
                        )}
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

                    {showErrorResolution && parsingErrors.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-brand p-4">
                        <h4 className="text-red-300 font-title mb-3">Parsing Issues Found</h4>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {parsingErrors.map((error, index) => (
                            <div key={index} className="bg-black/20 rounded-brand p-3">
                              <p className="text-red-300 text-sm mb-2">{error.error}</p>
                              <p className="text-gray-400 text-xs mb-2">Raw data: {error.line.substring(0, 100)}...</p>
                              {error.suggestedFix && (
                                <Button
                                  size="sm"
                                  onClick={() => handleManualOverride(index, error.suggestedFix)}
                                  className="bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-pill text-xs"
                                >
                                  Apply Suggested Fix
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-black/40 rounded-brand p-4 max-h-96 overflow-y-auto">
                      <div className="grid gap-3">
                        {csvData.slice(0, 10).map((lead, index) => (
                          <div key={index} className="bg-white/5 rounded-brand p-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="text-white font-title">{lead.name}</div>
                                <div className="text-gray-400 text-sm">{lead.email}</div>
                                <div className="text-gray-400 text-sm">{lead.phone}</div>
                                <div className="text-gray-400 text-sm">{lead.address}</div>
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
                        disabled={isImporting || parsingErrors.length > 0}
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
