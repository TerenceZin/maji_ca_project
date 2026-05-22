import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle, Send, ThumbsUp, XCircle, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react'
import api from '../api'
import { Quote } from '../types'
import { useAuthStore } from '../store/auth'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'En attente', validated: 'Validé',
  sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé', refused_client: 'Refusé client',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  validated: 'bg-green-50 text-green-700 border-green-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  refused: 'bg-red-50 text-red-700 border-red-200',
  refused_client: 'bg-red-50 text-red-700 border-red-200',
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<Record<string, number>>({})
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([])
  const [pendingValidation, setPendingValidation] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/quotes/stats'),
      api.get('/quotes?status=&limit=10'),
      user?.role === 'directeur' ? api.get('/quotes?status=submitted') : Promise.resolve({ data: [] }),
    ]).then(([statsRes, quotesRes, validationRes]) => {
      setStats(statsRes.data)
      setRecentQuotes(quotesRes.data.slice(0, 8))
      setPendingValidation(validationRes.data.filter((q: Quote) => q.total_ht > 10000))
    }).finally(() => setLoading(false))
  }, [user])

  const statCards = [
    { key: 'draft', label: 'Brouillons', icon: <FileText size={18} />, color: 'text-gray-500' },
    { key: 'submitted', label: 'En attente', icon: <Clock size={18} />, color: 'text-yellow-500' },
    { key: 'validated', label: 'Validés', icon: <CheckCircle size={18} />, color: 'text-green-500' },
    { key: 'sent', label: 'Envoyés', icon: <Send size={18} />, color: 'text-blue-500' },
    { key: 'accepted', label: 'Acceptés', icon: <ThumbsUp size={18} />, color: 'text-emerald-500' },
    { key: 'refused', label: 'Refusés', icon: <XCircle size={18} />, color: 'text-red-500' },
  ]

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return
    setDeleting(id)
    try {
      await api.delete(`/quotes/${id}`)
      setRecentQuotes((prev) => prev.filter((q) => q.id !== id))
      setStats((prev) => {
        const q = recentQuotes.find((r) => r.id === id)
        if (!q) return prev
        return { ...prev, [q.status]: Math.max(0, (prev[q.status] || 0) - 1) }
      })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement…</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500">Bonjour, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(({ key, label, icon, color }) => (
          <Link key={key} to={`/quotes?status=${key}`} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className={`mb-2 ${color}`}>{icon}</div>
            <div className="text-2xl font-bold text-gray-900">{stats[key] || 0}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </Link>
        ))}
      </div>

      {/* Price alerts */}
      {(stats.price_alerts || 0) > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <div className="font-medium text-amber-800">Alertes prix catalogue</div>
            <div className="text-sm text-amber-700">
              {stats.price_alerts} article(s) ont un prix modifié depuis la dernière synchronisation.{' '}
              <Link to="/catalog" className="underline">Voir le catalogue</Link>
            </div>
          </div>
        </div>
      )}

      {/* Director validation queue */}
      {user?.role === 'directeur' && pendingValidation.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 border-b border-yellow-100">
            <ShieldAlert className="text-yellow-600" size={18} />
            <span className="font-semibold text-yellow-800">
              {pendingValidation.length} devis en attente de validation
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingValidation.map((q) => (
              <div key={q.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-sm">{q.reference} — {q.client_name || '—'}</div>
                  <div className="text-xs text-gray-500">{q.total_ht.toLocaleString('fr-FR')}€ HT</div>
                </div>
                <Link to={`/quotes/${q.id}`} className="text-xs bg-maji-600 text-white px-3 py-1.5 rounded-lg hover:bg-maji-700">
                  Examiner
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent quotes */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Devis récents</h2>
        </div>
        {recentQuotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucun devis pour l'instant.</p>
            <Link to="/quotes/new" className="mt-3 inline-block text-sm text-maji-600 hover:underline">Créer votre premier devis</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentQuotes.map((q) => (
              <div key={q.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
                <Link to={`/quotes/${q.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{q.reference}</div>
                    <div className="text-xs text-gray-500 truncate">{q.client_name || 'Sans client'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{q.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                    <div className="text-xs text-gray-400">{q.updated_at ? formatDistanceToNow(new Date(q.updated_at), { addSuffix: true, locale: fr }) : ''}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[q.status] || ''}`}>
                    {STATUS_LABELS[q.status] || q.status}
                  </span>
                </Link>
                {['draft', 'submitted'].includes(q.status) && (
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deleting === q.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    title="Supprimer ce devis"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
