import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookTemplate, BookOpen, Users,
  ShieldCheck, LogOut, Bell, Plus, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import api from '../../api'
import { Quote, Notification } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [expanded, setExpanded] = useState({ today: true, week: true, month: false, older: false })

  useEffect(() => {
    api.get('/quotes').then((r) => setQuotes(r.data)).catch(() => {})
    api.get('/notifications').then((r) => setNotifications(r.data)).catch(() => {})
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const unread = notifications.filter((n) => !n.read).length

  const now = new Date()
  const grouped = {
    today: quotes.filter((q) => {
      const d = new Date(q.updated_at || q.created_at || '')
      return d.toDateString() === now.toDateString()
    }),
    week: quotes.filter((q) => {
      const d = new Date(q.updated_at || q.created_at || '')
      const diff = (now.getTime() - d.getTime()) / 86400000
      return diff > 0 && diff <= 7
    }),
    month: quotes.filter((q) => {
      const d = new Date(q.updated_at || q.created_at || '')
      const diff = (now.getTime() - d.getTime()) / 86400000
      return diff > 7 && diff <= 30
    }),
    older: quotes.filter((q) => {
      const d = new Date(q.updated_at || q.created_at || '')
      return (now.getTime() - d.getTime()) / 86400000 > 30
    }),
  }

  const navItem = (to: string, icon: React.ReactNode, label: string) => {
    const active = location.pathname.startsWith(to)
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-maji-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {icon}
        {label}
      </Link>
    )
  }

  const statusBadge: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    submitted: 'bg-yellow-100 text-yellow-700',
    validated: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    refused: 'bg-red-100 text-red-700',
    refused_client: 'bg-red-100 text-red-700',
  }

  const QuoteGroup = ({ title, items, key: k }: { title: string; items: Quote[]; key: string }) => {
    if (!items.length) return null
    const open = expanded[k as keyof typeof expanded]
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => ({ ...e, [k]: !e[k as keyof typeof expanded] }))}
          className="flex items-center gap-1 w-full px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
        </button>
        {open && (
          <div className="space-y-0.5">
            {items.map((q) => (
              <Link
                key={q.id}
                to={`/quotes/${q.id}`}
                className={`block px-3 py-2 rounded-lg mx-1 text-sm hover:bg-gray-100 ${
                  location.pathname === `/quotes/${q.id}` ? 'bg-maji-50 text-maji-700' : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">{q.reference}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge[q.status] || 'bg-gray-100'}`}>
                    {q.status === 'draft' ? 'brouillon' : q.status === 'submitted' ? 'soumis' : q.status}
                  </span>
                </div>
                <div className="text-xs text-gray-400 truncate">{q.client_name || '—'}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex flex-col gap-0.5">
          <img src="/logo-maji.png" alt="Maji" className="h-7 w-auto object-contain object-left" />
          <div className="text-xs text-gray-400 pl-0.5">Application devis</div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="px-3 py-3 space-y-1.5">
        <Link
          to="/quotes/new"
          className="flex items-center justify-center gap-2 w-full bg-maji-600 hover:bg-maji-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Nouveau devis
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-2 space-y-0.5">
        {navItem('/dashboard', <LayoutDashboard size={16} />, 'Tableau de bord')}
        {navItem('/templates', <BookTemplate size={16} />, 'Templates')}
        {navItem('/clients', <Users size={16} />, 'Clients')}
        {navItem('/catalog', <BookOpen size={16} />, 'Catalogue')}
        {user?.role === 'directeur' && navItem('/validation', <ShieldCheck size={16} />, 'Validation')}
      </nav>

      <div className="mx-3 my-2 border-t border-gray-100" />

      {/* Recent quotes */}
      <div className="flex-1 sidebar-scroll px-0 py-1 space-y-1">
        <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Devis récents</div>
        <QuoteGroup title="Aujourd'hui" items={grouped.today} key="today" />
        <QuoteGroup title="Cette semaine" items={grouped.week} key="week" />
        <QuoteGroup title="Ce mois" items={grouped.month} key="month" />
        <QuoteGroup title="Plus ancien" items={grouped.older} key="older" />
      </div>

      {/* User / notifications */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <Bell size={16} />
            <span>Notifications</span>
            {unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unread}</span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute bottom-full left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto mb-1">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase">Notifications</div>
              {notifications.length === 0 && <div className="p-4 text-sm text-gray-400">Aucune notification</div>}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2 border-b border-gray-50 text-sm cursor-pointer hover:bg-gray-50 ${!n.read ? 'font-medium' : 'text-gray-500'}`}
                  onClick={() => {
                    api.post(`/notifications/${n.id}/read`)
                    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
                    if (n.quote_id) navigate(`/quotes/${n.quote_id}`)
                  }}
                >
                  <div>{n.title}</div>
                  {n.body && <div className="text-xs text-gray-400">{n.body}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-7 h-7 bg-maji-100 rounded-full flex items-center justify-center text-maji-700 text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-800 truncate">{user?.name}</div>
            <div className="text-xs text-gray-400">{user?.role}</div>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors" title="Déconnexion">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
