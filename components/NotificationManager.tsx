"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bell, Plus, Edit, Trash2, Power, PowerOff } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Notification {
  id: number
  message: string
  type: string
  isActive: boolean
  createdAt: string
}

const TYPE_COLORS = {
  info: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', badge: 'bg-cyan-500' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500' },
  success: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', badge: 'bg-green-500' },
  update: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', badge: 'bg-fuchsia-500' }
}

export function NotificationManager() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    message: '',
    type: 'info',
    isActive: true
  })

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?all=true')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingId) {
        // Update existing
        const res = await fetch('/api/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData })
        })
        
        if (res.ok) {
          await fetchNotifications()
          resetForm()
        }
      } else {
        // Create new
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        
        if (res.ok) {
          await fetchNotifications()
          resetForm()
        }
      }
    } catch (error) {
      console.error('Error saving notification:', error)
    }
  }

  const handleEdit = (notification: Notification) => {
    setEditingId(notification.id)
    setFormData({
      message: notification.message,
      type: notification.type,
      isActive: notification.isActive
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this notification?')) return

    try {
      const res = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const handleToggleActive = async (notification: Notification) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notification.id,
          isActive: !notification.isActive
        })
      })
      
      if (res.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error('Error toggling notification:', error)
    }
  }

  const resetForm = () => {
    setFormData({ message: '', type: 'info', isActive: true })
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
          <Bell size={20} /> NOTIFICATIONS
        </h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs h-8"
        >
          <Plus size={14} className="mr-1" /> NEW
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
          <Textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Notification message..."
            className="mb-3 bg-slate-950 border-slate-700 text-white"
            rows={3}
          />

          <div className="flex items-center gap-3 mb-3">
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="w-40 bg-slate-950 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info (Blue)</SelectItem>
                <SelectItem value="warning">Warning (Yellow)</SelectItem>
                <SelectItem value="success">Success (Green)</SelectItem>
                <SelectItem value="update">Update (Purple)</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              Active
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs">
              {editingId ? 'UPDATE' : 'CREATE'}
            </Button>
            <Button
              type="button"
              onClick={resetForm}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs"
            >
              CANCEL
            </Button>
          </div>
        </form>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notification) => {
          const colors = TYPE_COLORS[notification.type as keyof typeof TYPE_COLORS]
          
          return (
            <div
              key={notification.id}
              className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${colors.badge} text-black`}>
                    {notification.type}
                  </span>
                  {!notification.isActive && (
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-slate-700 text-slate-400">
                      INACTIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(notification)}
                    className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                      notification.isActive ? 'text-green-400' : 'text-slate-600'
                    }`}
                  >
                    {notification.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button
                    onClick={() => handleEdit(notification)}
                    className="p-1 rounded hover:bg-slate-800 transition-colors text-cyan-400"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(notification.id)}
                    className="p-1 rounded hover:bg-slate-800 transition-colors text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className={`text-sm ${colors.text}`}>{notification.message}</p>
              <p className="text-[10px] text-slate-600 mt-2">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </div>
          )
        })}

        {notifications.length === 0 && (
          <div className="text-center py-8 text-slate-600">
            No notifications yet. Create one to show on the homepage!
          </div>
        )}
      </div>
    </div>
  )
}
