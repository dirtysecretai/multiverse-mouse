"use client"

import { useState, useEffect } from "react"
import { X, AlertTriangle, CheckCircle, Info, Sparkles } from "lucide-react"

interface Notification {
  id: number
  message: string
  type: string
  isActive: boolean
}

const TYPE_CONFIG = {
  info: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    icon: Info
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: AlertTriangle
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: CheckCircle
  },
  update: {
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-400',
    icon: Sparkles
  }
}

export function NotificationBanner() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [dismissed, setDismissed] = useState<number[]>([])

  useEffect(() => {
    fetchNotifications()
    // Check dismissed notifications from localStorage
    const dismissedIds = JSON.parse(localStorage.getItem('dismissed-notifications') || '[]')
    setDismissed(dismissedIds)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleDismiss = (id: number) => {
    const newDismissed = [...dismissed, id]
    setDismissed(newDismissed)
    localStorage.setItem('dismissed-notifications', JSON.stringify(newDismissed))
  }

  const activeNotifications = notifications.filter(
    n => n.isActive && !dismissed.includes(n.id)
  )

  if (activeNotifications.length === 0) return null

  return (
    <div className="w-full space-y-3 mb-4">
      {activeNotifications.map((notification) => {
        const config = TYPE_CONFIG[notification.type as keyof typeof TYPE_CONFIG]
        const Icon = config.icon

        return (
          <div
            key={notification.id}
            className={`w-full p-4 rounded-xl border ${config.border} ${config.bg} backdrop-blur-sm animate-in fade-in slide-in-from-top duration-500`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`${config.text} flex-shrink-0 mt-0.5`} size={20} />
              <p className={`flex-1 text-sm ${config.text} font-medium`}>
                {notification.message}
              </p>
              <button
                onClick={() => handleDismiss(notification.id)}
                className={`${config.text} hover:opacity-70 transition-opacity flex-shrink-0`}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
