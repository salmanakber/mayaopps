"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import AdminLayout from "@/components/AdminLayout"
import Link from "next/link"
import { 
  Plus, 
  Search, 
  Calendar, 
  Filter, 
  LayoutList, 
  Grid, 
  MoreVertical, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle2, 
  AlertCircle,
  X,
  ChevronRight,
  Repeat,
  Loader2,
  ArrowRight
} from "lucide-react"

// --- Types ---
interface Task {
  id: number
  title: string
  description?: string
  status: string
  scheduledDate?: string
  startedAt?: string
  completedAt?: string
  isRecurring: boolean
  recurringPattern?: string
  property: {
    id: number
    address: string
    postcode?: string
  }
  assignedUser?: {
    id: number
    firstName?: string
    lastName?: string
    email: string
  }
  company?: {
    id: number
    name: string
  }
  _count?: {
    photos: number
    notes: number
  }
}

interface Property {
  id: number
  address: string
}

interface User {
  id: number
  email: string
  firstName?: string
  lastName?: string
  role?: string
  isActive?: boolean
}

// --- Constants ---
const STATUS_ORDER = [
  "DRAFT", "PLANNED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "QA_REVIEW", "APPROVED", "REJECTED"
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  // UI State
  const [viewMode, setViewMode] = useState<"list" | "board">("list")
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [propertyFilter, setPropertyFilter] = useState("all")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
      const [tasksRes, propsRes, usersRes] = await Promise.all([
        axios.get("/api/tasks", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/properties", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      ])

      if (tasksRes.data.success) setTasks(tasksRes.data.data.tasks)
      if (propsRes.data.success) setProperties(propsRes.data.data.properties)
      if (usersRes.data.success) {
        // Filter for cleaners
        const allUsers = Array.isArray(usersRes.data.data) ? usersRes.data.data : (usersRes.data.data.users || [])
        setUsers(allUsers.filter((u: User) => (u.role?.toUpperCase() === "CLEANER") && u.isActive !== false))
      }
    } catch (error) {
      console.error("Data load failed", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (taskId: number) => {
    if (!confirm("Delete this task permanently?")) return
    try {
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
      await axios.delete(`/api/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } })
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e) {
      alert("Failed to delete task")
    }
  }

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
      await axios.patch(`/api/tasks/${taskId}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } })
    } catch (e) {
      loadData() // Revert on error
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          task.property.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || task.status === statusFilter
    const matchesProperty = propertyFilter === "all" || task.property.id.toString() === propertyFilter
    return matchesSearch && matchesStatus && matchesProperty
  })

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto h-[calc(100vh-theme(spacing.24))] flex flex-col">
        
        {/* Header & Toolbar */}
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tasks</h1>
              <p className="text-sm text-gray-500 mt-1">Manage cleaning schedules and assignments.</p>
            </div>
            <button
              onClick={() => { setSelectedTask(null); setIsDrawerOpen(true) }}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              New Task
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search tasks or properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">All Statuses</option>
                {STATUS_ORDER.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
              
              <select 
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none max-w-[200px]"
              >
                <option value="all">All Properties</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
              </select>
            </div>

            <div className="w-px h-6 bg-gray-200 hidden md:block" />

            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <LayoutList size={18} />
              </button>
              <button
                onClick={() => setViewMode("board")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "board" ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                <Grid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : viewMode === "list" ? (
            <TaskListView 
              tasks={filteredTasks} 
              onEdit={(t) => { setSelectedTask(t); setIsDrawerOpen(true) }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <TaskBoardView 
              tasks={filteredTasks}
              onEdit={(t) => { setSelectedTask(t); setIsDrawerOpen(true) }}
            />
          )}
        </div>
      </div>

      {/* Task Drawer (Create/Edit) */}
      <TaskDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        task={selectedTask}
        properties={properties}
        users={users}
        onSave={() => { setIsDrawerOpen(false); loadData() }}
      />
    </AdminLayout>
  )
}

// --- List View Component ---
function TaskListView({ tasks, onEdit, onDelete, onStatusChange }: any) {
  if (tasks.length === 0) return <EmptyState />

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Task Details</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Property</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assignee</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tasks.map((task: Task) => (
              <tr key={task.id} className="group hover:bg-gray-50/80 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{task.title}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {task.isRecurring && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                          <Repeat size={10} /> {task.recurringPattern}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                         <Calendar size={12} />
                         {task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : 'Unscheduled'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={16} className="text-gray-400" />
                    {task.property.address}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {task.assignedUser ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                        {task.assignedUser.firstName?.[0] || task.assignedUser.email[0]}
                      </div>
                      <span className="text-sm text-gray-700">{task.assignedUser.firstName || "User"}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Unassigned</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-6 py-4 text-right">
                   <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(task)} className="text-gray-400 hover:text-indigo-600 p-1">Edit</button>
                      <button onClick={() => onDelete(task.id)} className="text-gray-400 hover:text-red-600 p-1">Delete</button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Board View Component ---
function TaskBoardView({ tasks, onEdit }: any) {
  const columns = ["DRAFT", "PLANNED", "ASSIGNED", "IN_PROGRESS", "APPROVED"];
  
  return (
    <div className="h-full overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max h-full">
        {columns.map(status => {
           const columnTasks = tasks.filter((t: Task) => t.status === status);
           return (
             <div key={status} className="w-72 flex flex-col h-full bg-gray-50/50 rounded-xl border border-gray-200">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gray-50/50 backdrop-blur-sm rounded-t-xl">
                   <span className="text-xs font-bold text-gray-500 uppercase">{status.replace("_", " ")}</span>
                   <span className="bg-white px-2 py-0.5 rounded text-xs text-gray-600 border border-gray-200 shadow-sm">{columnTasks.length}</span>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                   {columnTasks.map((task: Task) => (
                     <div 
                        key={task.id} 
                        onClick={() => onEdit(task)}
                        className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all"
                     >
                        <div className="flex justify-between items-start mb-2">
                           <span className="text-sm font-medium text-gray-900 line-clamp-2">{task.title}</span>
                           {task.isRecurring && <Repeat size={12} className="text-blue-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                           <MapPin size={12} />
                           <span className="truncate">{task.property.address}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                           <span className="text-[10px] text-gray-400">
                             {task.scheduledDate ? new Date(task.scheduledDate).toLocaleDateString() : 'No date'}
                           </span>
                           {task.assignedUser && (
                              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                 {task.assignedUser.firstName?.[0]}
                              </div>
                           )}
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )
        })}
      </div>
    </div>
  )
}

// --- Task Drawer (Slide-over) ---
function TaskDrawer({ isOpen, onClose, task, properties, users, onSave }: any) {
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (task) {
        setFormData({
            title: task.title,
            description: task.description || "",
            propertyId: task.property.id,
            assignedUserId: task.assignedUser?.id || "",
            status: task.status,
            scheduledDate: task.scheduledDate ? new Date(task.scheduledDate).toISOString().slice(0, 16) : "",
            isRecurring: task.isRecurring,
            recurringPattern: task.recurringPattern || "weekly"
        })
    } else {
        setFormData({ 
            title: "", propertyId: "", status: "DRAFT", isRecurring: false, recurringPattern: "weekly" 
        })
    }
  }, [task, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
        const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
        const payload = {
            ...formData,
            propertyId: parseInt(formData.propertyId),
            assignedUserId: formData.assignedUserId ? parseInt(formData.assignedUserId) : undefined,
            scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate).toISOString() : undefined,
        }

        if (task) {
            await axios.patch(`/api/tasks/${task.id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        } else {
            await axios.post("/api/tasks", payload, { headers: { Authorization: `Bearer ${token}` } })
        }
        onSave()
    } catch (e) {
        alert("Operation failed")
    } finally {
        setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
        <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">{task ? "Edit Task" : "Create New Task"}</h2>
                <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X size={20} /></button>
            </div>

            {/* Drawer Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. End of Tenancy Clean" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none">
                            {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                        <input type="datetime-local" value={formData.scheduledDate} onChange={e => setFormData({...formData, scheduledDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                     </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                    <select required value={formData.propertyId} onChange={e => setFormData({...formData, propertyId: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none">
                        <option value="">Select Property</option>
                        {properties.map((p: any) => <option key={p.id} value={p.id}>{p.address}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign Cleaner</label>
                    <select value={formData.assignedUserId} onChange={e => setFormData({...formData, assignedUserId: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none">
                        <option value="">Unassigned</option>
                        {users.map((u: any) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                    </select>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded" />
                        <span className="text-sm font-medium text-gray-700">Make this a recurring task</span>
                    </label>
                    {formData.isRecurring && (
                         <select value={formData.recurringPattern} onChange={e => setFormData({...formData, recurringPattern: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                             <option value="daily">Daily</option>
                             <option value="weekly">Weekly</option>
                             <option value="monthly">Monthly</option>
                         </select>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none resize-none" />
                </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50">
                 <button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                 >
                    {loading && <Loader2 className="animate-spin" size={18} />}
                    {task ? "Save Changes" : "Create Task"}
                 </button>
            </div>
        </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
       <div className="bg-gray-100 p-4 rounded-full mb-4">
           <LayoutList size={32} className="text-gray-400" />
       </div>
       <h3 className="text-lg font-medium text-gray-900">No tasks found</h3>
       <p className="text-sm text-gray-500 mt-1 max-w-sm">
         No tasks match your current filters. Try adjusting them or create a new task.
       </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toUpperCase()
    let color = "bg-gray-100 text-gray-700 border-gray-200"
    
    if (s === 'PLANNED') color = "bg-blue-50 text-blue-700 border-blue-200"
    else if (s === 'ASSIGNED') color = "bg-purple-50 text-purple-700 border-purple-200"
    else if (s === 'IN_PROGRESS') color = "bg-amber-50 text-amber-700 border-amber-200"
    else if (s === 'APPROVED') color = "bg-green-50 text-green-700 border-green-200"
    else if (s === 'REJECTED') color = "bg-red-50 text-red-700 border-red-200"

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
            {status.replace("_", " ")}
        </span>
    )
}