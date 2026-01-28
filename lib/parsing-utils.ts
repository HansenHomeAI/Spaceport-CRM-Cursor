/**
 * Centralized parsing utilities for contact information extraction
 * Handles various formats including listing blocks, complex real estate data, and standard contact info
 */

export interface ParsedContactInfo {
  name: string
  phone: string
  email: string
  company: string
  address: string
}

/**
 * Detects and removes duplicate names (e.g., "John Doe John Doe" -> "John Doe")
 * Also handles cases like "John Doe, John Doe" or "John Doe\nJohn Doe"
 */
function deduplicateName(name: string): string {
  if (!name || name.trim().length === 0) return name

  // Normalize whitespace first
  const normalized = name.replace(/\s+/g, " ").trim()

  // First, check if the name is duplicated as a whole phrase (e.g., "John Doe John Doe")
  // This handles cases where duplicates are separated by single spaces after normalization
  const words = normalized.split(/\s+/)
  if (words.length >= 4 && words.length % 2 === 0) {
    const halfLength = words.length / 2
    const firstHalf = words.slice(0, halfLength).join(" ")
    const secondHalf = words.slice(halfLength).join(" ")

    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      // Found a duplicate - recursively check the first half in case of triple+ duplicates
      return deduplicateName(firstHalf)
    }
  }

  // Also check for triple+ duplicates (e.g., "John Doe John Doe John Doe")
  // Try dividing into 3 equal parts
  if (words.length >= 6 && words.length % 3 === 0) {
    const thirdLength = words.length / 3
    const firstThird = words.slice(0, thirdLength).join(" ")
    const secondThird = words.slice(thirdLength, thirdLength * 2).join(" ")
    const thirdThird = words.slice(thirdLength * 2).join(" ")

    if (firstThird.toLowerCase() === secondThird.toLowerCase() && 
        secondThird.toLowerCase() === thirdThird.toLowerCase()) {
      return deduplicateName(firstThird)
    }
  }

  // Split by common separators (comma, newline, or double+ spaces) BEFORE normalization
  // This handles cases like "John Doe, John Doe" or "John Doe\nJohn Doe"
  const parts = name.split(/[,\n]|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0)

  // If we have multiple parts, check if they're duplicates
  if (parts.length >= 2) {
    // Check if all parts are identical
    const firstPart = parts[0]
    const allSame = parts.every(part => part.toLowerCase() === firstPart.toLowerCase())

    if (allSame) {
      return firstPart
    }
  }

  return normalized
}

/**
 * Smart parsing function for contact info
 * Extracts name, phone, email, company, and address from unstructured text
 */
export function parseContactInfo(text: string): ParsedContactInfo {
  const result: ParsedContactInfo = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  if (!text) return result

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
      result.name = deduplicateName(nameMatch[1].trim())
    } else {
      result.name = deduplicateName(text.trim())
    }
  }

  return result
}

/**
 * Special function for parsing listing data (e.g., "Listed by: John Doe 123-456-7890")
 */
export function parseListingData(text: string): ParsedContactInfo {
  const result: ParsedContactInfo = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  if (!text) return result

  // Look for "Listed by:" pattern
  const listedByMatch = text.match(/Listed by:\s*([^,]+)/i)
  if (listedByMatch) {
    const listedByText = listedByMatch[1].trim()

    // Parse the "Listed by" section
    const phoneMatch = listedByText.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
    if (phoneMatch) {
      result.phone = phoneMatch[0]
      const nameText = listedByText.replace(phoneMatch[0], "").trim()
      result.name = deduplicateName(nameText)
    } else {
      result.name = deduplicateName(listedByText)
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

/**
 * Special function for parsing complex real estate data
 * Handles cases with ampersands and multiple names
 */
export function parseComplexRealEstate(text: string): ParsedContactInfo {
  const result: ParsedContactInfo = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  if (!text) return result

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

    let nameWords: string[] = []

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
      result.name = deduplicateName(nameWords.join(" ").trim())
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
      result.name = deduplicateName(nameMatch[1].trim())
      text = text.replace(nameMatch[1], "").trim()
    }

    // Now look for company keywords in remaining text
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

/**
 * Determines if content should trigger auto-parsing
 */
export function shouldAutoParse(text: string): boolean {
  if (!text || text.length < 20) return false

  // Trigger auto-parse if content has multiple indicators of contact info
  const hasMultipleInfo = (
    text.includes("@") || // Has email
    /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text) || // Has phone
    text.includes("Real Estate") || // Has real estate keywords
    text.includes("Listed by:") || // Has listing data
    text.includes("&") || // Has ampersand (company indicator)
    text.split(/\s+/).length > 4 // Has multiple words
  )

  return hasMultipleInfo
}

/**
 * Auto-parses content and chooses the best parsing strategy based on input
 */
export function autoParseContent(text: string): ParsedContactInfo {
  if (text.includes("Listed by:")) {
    return parseListingData(text)
  } else if (text.includes("Real Estate") && text.includes("&")) {
    // Special handling for complex real estate data
    return parseComplexRealEstate(text)
  } else {
    return parseContactInfo(text)
  }
}
