import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Trash2 } from 'lucide-react'
import api from '../api'
import { Quote } from '../types'
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

const DELETABLE = ['draft', 'submitted']

export default function QuotesListPage() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api.get(`/quotes${status ? `?status=${status}` : ''}`).then((r) => {
      setQuotes(r.data)
    }).finally(() => setLoading(false))
  }, [status])

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce devis ? Cette action est irréversible.')) return
    setDeleting(id)
    try {
      await api.delete(`/quotes/${id}`)
      setQuotes((prev) => prev.filter((q) => q.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const title = status ? `Devis — ${STATUS_LABELS[status] || status}` : 'Tous les devis'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <Link to="/quotes/new" className="btn-primary text-sm">+ Nouveau devis</Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'submitted', 'validated', 'sent', 'accepted', 'refused'].map((s) => (
          <Link
            key={s}
            to={s ? `/quotes?status=${s}` : '/quotes'}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              status === s
                ? 'bg-maji-600 text-white border-maji-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-maji-400'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Tous'}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-gray-400 text-center">Chargement…</div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p>Aucun devis{status ? ` avec le statut « ${STATUS_LABELS[status]} »` : ''}.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <Link to={`/quotes/${q.id}`} className="flex-1 min-w-0 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">{q.reference}</div>
                    <div className="text-xs text-gray-500 truncate">{q.client_name || 'Sans client'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{q.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                    <div className="text-xs text-gray-400">
                      {q.updated_at ? formatDistanceToNow(new Date(q.updated_at), { addSuffix: true, locale: fr }) : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[q.status] || ''}`}>
                    {STATUS_LABELS[q.status] || q.status}
                  </span>
                </Link>
                {DELETABLE.includes(q.status) && (
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deleting === q.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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
