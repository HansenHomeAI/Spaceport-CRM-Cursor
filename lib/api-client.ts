import { awsConfig } from "./aws-config"
import { cognitoAuth } from "./cognito-auth"

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  address: string
  company?: string
  status: "cold" | "contacted" | "interested" | "closed" | "dormant" | "left voicemail"
  lastInteraction: string
  ownerId?: string
  ownerName?: string
  nextActionDate: string
  needsAttention?: boolean
  notes: Array<{
    id: string
    text: string
    timestamp: string
    type: "call" | "email" | "note" | "video" | "social"
  }>
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

  constructor() {
    this.baseUrl = awsConfig.apiUrl || ""
  }

  private async getAuthToken(): Promise<string | null> {
    // Get ID token from Cognito auth (CRITICAL FIX - use ID token not access token)
    const token = cognitoAuth.getIdToken()
    
    // Check if we're in production mode
    const isProductionMode = process.env.NEXT_PUBLIC_DEV_MODE === 'false' || (awsConfig.userPoolId && awsConfig.userPoolClientId && awsConfig.apiUrl)
    
    // If we're in production mode, we need a real token
    if (isProductionMode) {
      if (!token || token === 'demo-token' || token === 'dev-token') {
        console.warn('Production mode requires real authentication token')
        return null
      }
      return token
    }
    
    // In development mode, allow demo tokens
    if (!token || token === 'demo-token' || token === 'dev-token') {
      return null
    }
    
    return token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<{ data: T | null; error: string | null }> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
      }

      // Get authentication token
      const token = await this.getAuthToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(url, {
        ...options,
        headers: headers as HeadersInit,
      })

      // Handle token refresh if needed
      if (response.status === 401 && token) {
        console.log("Token expired, attempting refresh...")
        const currentUser = cognitoAuth.getCurrentUser()
        if (currentUser?.refreshToken) {
          const refreshResult = await cognitoAuth.refreshToken(currentUser.refreshToken)
          if (refreshResult.success && refreshResult.user) {
            // Retry the request with new ID token (CRITICAL FIX)
            headers.Authorization = `Bearer ${refreshResult.user.idToken}`
            const retryResponse = await fetch(url, {
              ...options,
              headers: headers as HeadersInit,
            })
            
            if (!retryResponse.ok) {
              const errorText = await retryResponse.text()
              let errorMessage = `HTTP ${retryResponse.status}`
              try {
                const errorJson = JSON.parse(errorText)
                errorMessage = errorJson.message || errorJson.error || errorMessage
              } catch {
                errorMessage = errorText || errorMessage
              }
              return { data: null, error: errorMessage }
            }
            
            if (retryResponse.status === 204) {
              return { data: null, error: null }
            }
            
            const data = await retryResponse.json()
            return { data, error: null }
          }
        }
      }

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

  async resetDatabase(): Promise<{ data: { message: string } | null; error: string | null }> {
    return this.request<{ message: string }>("/leads/reset", {
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
