export interface LeadNote {
  id: string
  text: string
  timestamp: string
  type: "call" | "email" | "note" | "video" | "social"
  createdBy?: string
  createdByName?: string
}

export interface LeadProperty {
  id: string
  address: string
  isSold: boolean
  soldDate?: string
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  address: string
  properties?: LeadProperty[]
  company?: string
  brokerageId?: string | null
  brokerageName?: string | null
  status: "Left Voicemail" | "Contacted" | "Interested" | "Not Interested" | "Closed"
  lastInteraction: string
  ownerId?: string
  ownerName?: string
  nextActionDate: string
  needsAttention?: boolean
  notes: LeadNote[]
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdByName?: string
  lastUpdatedBy?: string
  lastUpdatedByName?: string
  deletedAt?: string | null
  deletedBy?: string | null
  deletedByName?: string | null
}

export interface Brokerage {
  id: string
  name: string
  website?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdByName?: string
  lastUpdatedBy?: string
  lastUpdatedByName?: string
}

export type NewLeadPayload = Omit<
  Lead,
  | "id"
  | "notes"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "createdByName"
  | "lastUpdatedBy"
  | "lastUpdatedByName"
  | "deletedAt"
  | "deletedBy"
  | "deletedByName"
> & {
  initialNote?: string
}
