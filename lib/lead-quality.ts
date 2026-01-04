import type { Lead } from "@/lib/crm-types"

const PLACEHOLDER_VALUES = new Set(["Not provided", "Address not provided"])

const isBlank = (value?: string) => {
  if (!value) return true
  const trimmed = value.trim()
  return trimmed.length === 0 || PLACEHOLDER_VALUES.has(trimmed)
}

export const getMissingLeadFields = (lead: Pick<Lead, "name" | "phone" | "email" | "address" | "properties">) => {
  const missing: string[] = []

  if (isBlank(lead.name)) missing.push("Name")

  const hasPhone = !isBlank(lead.phone)
  const hasEmail = !isBlank(lead.email)
  if (!hasPhone && !hasEmail) {
    missing.push("Phone or email")
  }

  const propertyAddresses = (lead.properties || [])
    .map((property) => property.address)
    .filter((address) => !isBlank(address))

  const hasProperty = propertyAddresses.length > 0 || !isBlank(lead.address)
  if (!hasProperty) {
    missing.push("Property address")
  }

  return missing
}

export const getNeedsAttention = (lead: Pick<Lead, "name" | "phone" | "email" | "address" | "properties">) => {
  return getMissingLeadFields(lead).length > 0
}
