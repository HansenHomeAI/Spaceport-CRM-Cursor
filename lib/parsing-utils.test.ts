/**
 * Test suite for parsing utilities
 * Verifies that name deduplication and parsing work correctly
 */

import { parseContactInfo, parseListingData, parseComplexRealEstate, autoParseContent } from './parsing-utils'

// Note: deduplicateName is tested indirectly through the parsing functions

interface TestCase {
  name: string
  input: string
  expected: {
    name: string
    phone?: string
    email?: string
    company?: string
    address?: string
  }
  parser: (text: string) => ReturnType<typeof parseContactInfo>
}

const testCases: TestCase[] = [
  // Duplicate name tests - the main bug fix
  {
    name: "Duplicate name with newlines",
    input: "John Doe\nJohn Doe\n123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseContactInfo,
  },
  {
    name: "Duplicate name with comma",
    input: "John Doe, John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseContactInfo,
  },
  {
    name: "Duplicate name as whole phrase",
    input: "John Doe John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseContactInfo,
  },
  {
    name: "Listing data with duplicate name",
    input: "Listed by: John Doe John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseListingData,
  },
  {
    name: "Listing data with duplicate name and comma",
    input: "Listed by: John Doe, John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseListingData,
  },
  // Standard parsing tests
  {
    name: "Standard contact info",
    input: "John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseContactInfo,
  },
  {
    name: "Contact with email",
    input: "Jane Smith jane@example.com",
    expected: {
      name: "Jane Smith",
      email: "jane@example.com",
    },
    parser: parseContactInfo,
  },
  {
    name: "Contact with all fields",
    input: "John Doe 123-456-7890 john@example.com PureWest Real Estate 123 Main St",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
      email: "john@example.com",
      company: "PureWest Real Estate",
      address: "123 Main St",
    },
    parser: parseContactInfo,
  },
  // Listing data tests
  {
    name: "Standard listing data",
    input: "Listed by: John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseListingData,
  },
  {
    name: "Listing data with company",
    input: "Listed by: John Doe 123-456-7890 Realtypath LLC Source: MLS",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
      company: "Realtypath LLC",
    },
    parser: parseListingData,
  },
  // Complex real estate tests
  {
    name: "Complex real estate with ampersand",
    input: "John Smith 123-456-7890 Hall & Hall Real Estate",
    expected: {
      name: "John Smith",
      phone: "123-456-7890",
      company: "Hall & Hall Real Estate",
    },
    parser: parseComplexRealEstate,
  },
  // Edge cases
  {
    name: "Name with parenthetical alias",
    input: "Larry (aka Lawrence) Havens 845-453-5679",
    expected: {
      name: "Larry Havens",
      phone: "845-453-5679",
    },
    parser: parseContactInfo,
  },
  {
    name: "Triple duplicate name",
    input: "John Doe John Doe John Doe 123-456-7890",
    expected: {
      name: "John Doe",
      phone: "123-456-7890",
    },
    parser: parseContactInfo,
  },
]

// Run tests
let passed = 0
let failed = 0

console.log("Running parsing utility tests...\n")

testCases.forEach((testCase) => {
  try {
    const result = testCase.parser(testCase.input)

    // Check each expected field
    const errors: string[] = []
    
    if (testCase.expected.name && result.name !== testCase.expected.name) {
      errors.push(`Expected name "${testCase.expected.name}", got "${result.name}"`)
    }
    
    if (testCase.expected.phone && result.phone !== testCase.expected.phone) {
      errors.push(`Expected phone "${testCase.expected.phone}", got "${result.phone}"`)
    }
    
    if (testCase.expected.email && result.email !== testCase.expected.email) {
      errors.push(`Expected email "${testCase.expected.email}", got "${result.email}"`)
    }
    
    if (testCase.expected.company && result.company !== testCase.expected.company) {
      errors.push(`Expected company "${testCase.expected.company}", got "${result.company}"`)
    }
    
    if (testCase.expected.address && result.address !== testCase.expected.address) {
      errors.push(`Expected address "${testCase.expected.address}", got "${result.address}"`)
    }

    if (errors.length > 0) {
      console.log(`❌ FAILED: ${testCase.name}`)
      console.log(`   Input: "${testCase.input}"`)
      errors.forEach(error => console.log(`   ${error}`))
      console.log(`   Full result:`, result)
      console.log()
      failed++
    } else {
      console.log(`✅ PASSED: ${testCase.name}`)
      passed++
    }
  } catch (error) {
    console.log(`❌ ERROR: ${testCase.name}`)
    console.log(`   Input: "${testCase.input}"`)
    console.log(`   Error:`, error)
    console.log()
    failed++
  }
})

console.log(`\nTest Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log("All tests passed! 🎉")
}
