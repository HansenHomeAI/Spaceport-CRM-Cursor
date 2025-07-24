import { useEffect, useRef, useCallback } from 'react'

interface UseActivityRefreshOptions {
  refreshThresholdMs?: number // Default 15 minutes
  onRefresh: () => Promise<void>
  isEnabled?: boolean
}

export function useActivityRefresh({
  refreshThresholdMs = 15 * 60 * 1000, // 15 minutes
  onRefresh,
  isEnabled = true
}: UseActivityRefreshOptions) {
  const lastRefreshTime = useRef<number>(Date.now())
  const isRefreshing = useRef<boolean>(false)

  const handleActivity = useCallback(async () => {
    if (!isEnabled || isRefreshing.current) {
      return
    }

    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshTime.current

    if (timeSinceLastRefresh >= refreshThresholdMs) {
      console.log(`🔄 Activity detected after ${Math.round(timeSinceLastRefresh / 1000 / 60)} minutes. Refreshing data...`)
      
      isRefreshing.current = true
      try {
        await onRefresh()
        lastRefreshTime.current = now
        console.log('✅ Background refresh completed')
      } catch (error) {
        console.error('❌ Background refresh failed:', error)
      } finally {
        isRefreshing.current = false
      }
    }
  }, [refreshThresholdMs, onRefresh, isEnabled])

  // Update last refresh time when explicitly called (e.g., on initial load)
  const markAsRefreshed = useCallback(() => {
    lastRefreshTime.current = Date.now()
  }, [])

  useEffect(() => {
    if (!isEnabled) return

    // Activity events to listen for
    const events = [
      'scroll',
      'click', 
      'keydown',
      'mousemove',
      'touchstart'
    ]

    // Throttle activity detection to avoid excessive calls
    let throttleTimeout: NodeJS.Timeout | null = null
    
    const throttledHandleActivity = () => {
      if (throttleTimeout) return
      
      throttleTimeout = setTimeout(() => {
        handleActivity()
        throttleTimeout = null
      }, 1000) // Throttle to max once per second
    }

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, { passive: true })
    })

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandleActivity)
      })
      if (throttleTimeout) {
        clearTimeout(throttleTimeout)
      }
    }
  }, [handleActivity, isEnabled])

  return {
    markAsRefreshed,
    getTimeSinceLastRefresh: () => Date.now() - lastRefreshTime.current
  }
} 