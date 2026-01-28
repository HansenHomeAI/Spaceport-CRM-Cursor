
const parseContactInfo = (text) => {
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

  // Improved phone regex
  const phoneMatch = text.match(/(?:\(?(\d{3})\)?[-.\s]?)?(\d{3})[-.\s]?(\d{4})/)
  if (phoneMatch) {
    result.phone = phoneMatch[0]
    text = text.replace(phoneMatch[0], "").trim()
  }

  // Address keywords
  const addressKeywords = ["Street", "St", "Avenue", "Ave"]
  const addressMatch = addressKeywords.find((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
  if (addressMatch) {
    const addressRegex = new RegExp(`[^,]*\\d+[^,]*${addressMatch}[^,]*`, "i")
    const match = text.match(addressRegex)
    if (match) {
      result.address = match[0].trim()
      text = text.replace(match[0], "").trim()
    }
  }

  // Clean up name
  text = text.replace(/\([^)]*\)/g, "")
  text = text.replace(/,+/g, " ")
  text = text.replace(/\s+/g, " ").trim()

  if (text.length > 0) {
    const nameMatch = text.match(/^[^a-zA-Z]*([A-Za-z\s]+?)[^a-zA-Z]*$/)
    if (nameMatch) {
      result.name = nameMatch[1].trim()
    } else {
      result.name = text.trim()
    }
  }

  return result
}

const testCases = [
  "John Doe 123-456-7890",
  "Jane Smith jane@example.com",
  "Listed by: John Doe 123-456-7890",
  "John Doe, John Doe 123-456-7890",
  "John Doe\nJohn Doe\n123-456-7890"
]

testCases.forEach(tc => {
  console.log(`Input: "${tc}"`)
  console.log(`Parsed:`, parseContactInfo(tc))
  console.log('---')
})
