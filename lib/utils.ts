import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format timestamp to show date and time
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    
    // Check if the timestamp includes time information
    const hasTime = timestamp.includes('T') && timestamp.includes(':')
    
    if (hasTime) {
      // Full timestamp with time - show date and time
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } else {
      // Date only - show date with default time
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' at 12:00 PM'
    }
  } catch (error) {
    // Fallback for invalid dates
    return 'Invalid date'
  }
}

// Format timestamp for relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`
    } else {
      return formatTimestamp(timestamp)
    }
  } catch (error) {
    return 'Unknown time'
  }
}

// Check if a string is a valid URL
export function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_) {
    return false
  }
}

// Get Google Maps URL for an address
export function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
