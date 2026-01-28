/**
 * Test script to verify the name deduplication fix
 * This tests the logic that should be in lib/parsing-utils.ts
 */

// Deduplication function (matches the one in parsing-utils.ts)
function deduplicateName(name) {
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

// Simplified parsing functions with deduplication
const parseContactInfo = (text) => {
  const result = {
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

  // Phone regex
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // Clean up name
  text = text.replace(/\([^)]*\)/g, "")
  text = text.replace(/,+/g, " ")
  text = text.replace(/\s+/g, " ").trim()

  // Extract name and deduplicate
  if (text.length > 0) {
    const nameMatch = text.match(/^[^a-zA-Z]*([A-Za-z\s]+?)[^a-zA-Z]*$/)
    if (nameMatch) {
      result.name = deduplicateName(nameMatch[1].trim())
    } else {
      result.name = deduplicateName(text.trim())
    }
  }

  return result
}

const parseListingData = (text) => {
  const result = {
    name: "",
    phone: "",
    email: "",
    company: "",
    address: "",
  }

  if (!text) return result

  const listedByMatch = text.match(/Listed by:\s*([^,]+)/i)
  if (listedByMatch) {
    const listedByText = listedByMatch[1].trim()
    const phoneMatch = listedByText.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
    if (phoneMatch) {
      result.phone = phoneMatch[0]
      const nameText = listedByText.replace(phoneMatch[0], "").trim()
      result.name = deduplicateName(nameText)
    } else {
      result.name = deduplicateName(listedByText)
    }
  }

  return result
}

// Test cases
const testCases = [
  {
    name: "Duplicate Name (newlines)",
    input: "John Doe\nJohn Doe\n123-456-7890",
    fn: parseContactInfo,
    expectedName: "John Doe"
  },
  {
    name: "Duplicate Name (comma)",
    input: "John Doe, John Doe 123-456-7890",
    fn: parseContactInfo,
    expectedName: "John Doe"
  },
  {
    name: "Duplicate Name (whole phrase)",
    input: "John Doe John Doe 123-456-7890",
    fn: parseContactInfo,
    expectedName: "John Doe"
  },
  {
    name: "Listing Data Duplicate Name",
    input: "Listed by: John Doe John Doe 123-456-7890",
    fn: parseListingData,
    expectedName: "John Doe"
  },
  {
    name: "Listing Data Duplicate Name (comma)",
    input: "Listed by: John Doe, John Doe 123-456-7890",
    fn: parseListingData,
    expectedName: "John Doe"
  },
  {
    name: "Normal name (no duplication)",
    input: "John Doe 123-456-7890",
    fn: parseContactInfo,
    expectedName: "John Doe"
  },
  {
    name: "Triple duplicate",
    input: "John Doe John Doe John Doe 123-456-7890",
    fn: parseContactInfo,
    expectedName: "John Doe"
  }
]

console.log("Testing name deduplication fix...\n")

let passed = 0
let failed = 0

testCases.forEach(tc => {
  const result = tc.fn(tc.input)
  const nameMatches = result.name === tc.expectedName
  
  if (nameMatches) {
    console.log(`✅ PASSED: ${tc.name}`)
    console.log(`   Input: "${tc.input}"`)
    console.log(`   Parsed name: "${result.name}"`)
    passed++
  } else {
    console.log(`❌ FAILED: ${tc.name}`)
    console.log(`   Input: "${tc.input}"`)
    console.log(`   Expected name: "${tc.expectedName}"`)
    console.log(`   Got name: "${result.name}"`)
    console.log(`   Full result:`, result)
    failed++
  }
  console.log()
})

console.log(`\nResults: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log("\n❌ Some tests failed - deduplication may not be working correctly")
  process.exit(1)
} else {
  console.log("\n✅ All tests passed! Name deduplication is working correctly.")
}
