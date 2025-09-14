import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthProvider'
import { notificationService } from '../services/notificationService'

export const useUnreadNotifications = (pollingInterval: number = 5000) => {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      const count = await notificationService.getUnreadCount(user.id)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error fetching unread count:', error)
      // Don't update count on error to avoid flickering
    } finally {
      setLoading(false)
    }
  }

  const refreshUnreadCount = () => {
    fetchUnreadCount()
  }

  const markAsRead = () => {
    // Immediately update the count for better UX
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = () => {
    setUnreadCount(0)
  }

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      setLoading(false)
      return
    }

    // Initial fetch
    fetchUnreadCount()

    // Set up polling
    intervalRef.current = setInterval(fetchUnreadCount, pollingInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, pollingInterval])

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    unreadCount,
    loading,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead
  }
}