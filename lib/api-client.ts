import { awsConfig } from "./aws-config"

export interface Lead {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  status: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost"
  source?: string
  value?: number
  notes?: string[]
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdByName?: string
  lastUpdatedBy?: string
  lastUpdatedByName?: string
}

export interface Activity {
  id: string
  leadId: string
  type: "note" | "call" | "email" | "meeting" | "task"
  description: string
  timestamp: number
  createdAt: string
  createdBy?: string
  createdByName?: string
}

class ApiClient {
  private baseUrl: string
  private accessToken: string | null = null

  constructor() {
    this.baseUrl = awsConfig.apiUrl || ""
  }

  setAccessToken(token: string | null) {
    this.accessToken = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      }

      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`
      }

      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorJson.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        return { data: null, error: errorMessage }
      }

      if (response.status === 204) {
        return { data: null, error: null }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      console.error("API request failed:", error)
      return {
        data: null,
        error: error instanceof Error ? error.message : "Network error",
      }
    }
  }

  // Leads API
  async getLeads(): Promise<{ data: Lead[] | null; error: string | null }> {
    return this.request<Lead[]>("/leads")
  }

  async getLead(id: string): Promise<{ data: Lead | null; error: string | null }> {
    return this.request<Lead>(`/leads/${id}`)
  }

  async createLead(
    lead: Omit<Lead, "id" | "createdAt" | "updatedAt">,
  ): Promise<{ data: Lead | null; error: string | null }> {
    return this.request<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify(lead),
    })
  }

  async updateLead(lead: Lead): Promise<{ data: Lead | null; error: string | null }> {
    return this.request<Lead>(`/leads/${lead.id}`, {
      method: "PUT",
      body: JSON.stringify(lead),
    })
  }

  async deleteLead(id: string): Promise<{ data: null; error: string | null }> {
    return this.request<null>(`/leads/${id}`, {
      method: "DELETE",
    })
  }

  // Activities API
  async getActivities(leadId?: string): Promise<{ data: Activity[] | null; error: string | null }> {
    const endpoint = leadId ? `/activities?leadId=${leadId}` : "/activities"
    return this.request<Activity[]>(endpoint)
  }

  async createActivity(
    activity: Omit<Activity, "id" | "timestamp" | "createdAt">,
  ): Promise<{ data: Activity | null; error: string | null }> {
    return this.request<Activity>("/activities", {
      method: "POST",
      body: JSON.stringify(activity),
    })
  }

  // Bulk operations
  async createLeads(
    leads: Omit<Lead, "id" | "createdAt" | "updatedAt">[],
  ): Promise<{ data: Lead[] | null; error: string | null }> {
    const results: Lead[] = []
    const errors: string[] = []

    for (const lead of leads) {
      const { data, error } = await this.createLead(lead)
      if (data) {
        results.push(data)
      } else if (error) {
        errors.push(`Failed to create lead ${lead.name}: ${error}`)
      }
    }

    if (errors.length > 0) {
      return {
        data: results.length > 0 ? results : null,
        error: errors.join("; "),
      }
    }

    return { data: results, error: null }
  }
}

export const apiClient = new ApiClient()
