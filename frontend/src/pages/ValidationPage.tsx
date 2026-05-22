import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, X, MessageSquare, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import api from '../api'
import { Quote } from '../types'
import toast from 'react-hot-toast'

export default function ValidationPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [actionQuote, setActionQuote] = useState<Quote | null>(null)
  const [comment, setComment] = useState('')
  const [action, setAction] = useState<'approve' | 'refuse' | 'request_modification'>('approve')

  const load = () => {
    api.get('/quotes?status=submitted').then((r) => {
      setQuotes(r.data.filter((q: Quote) => q.total_ht > 10000))
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAction = async () => {
    if (!actionQuote) return
    try {
      await api.post(`/quotes/${actionQuote.id}/validate?action=${action}${comment ? `&comment=${encodeURIComponent(comment)}` : ''}`)
      toast.success(action === 'approve' ? 'Devis approuvé' : action === 'refuse' ? 'Devis refusé' : 'Modification demandée')
      setActionQuote(null)
      setComment('')
      load()
    } catch {
      toast.error('Erreur')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="text-maji-600" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File de validation</h1>
          <p className="text-sm text-gray-500">Devis &gt; 10 000€ en attente d'approbation</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 p-8">Chargement…</div>
      ) : quotes.length === 0 ? (
        <div className="text-center p-16 text-gray-400">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-30 text-green-500" />
          <p className="text-green-600 font-medium">Aucun devis en attente de validation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-yellow-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-gray-900">{q.reference}</div>
                  <div className="text-sm text-gray-500">{q.client_name || 'Sans client'}</div>
                  {q.validation_comment && (
                    <div className="mt-2 text-xs bg-gray-50 rounded p-2 text-gray-600">{q.validation_comment}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-gray-900">{q.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</div>
                  <div className="text-xs text-gray-400">HT — Marge {q.margin_percent}%</div>
                  <div className="text-xs text-gray-400">{q.created_at ? new Date(q.created_at).toLocaleDateString('fr-FR') : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Link to={`/quotes/${q.id}`} className="btn-secondary text-xs">Voir le détail</Link>
                <button
                  onClick={() => { setActionQuote(q); setAction('approve'); setComment('') }}
                  className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition"
                >
                  <CheckCircle size={13} /> Approuver
                </button>
                <button
                  onClick={() => { setActionQuote(q); setAction('request_modification'); setComment('') }}
                  className="flex items-center gap-1.5 text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg transition"
                >
                  <MessageSquare size={13} /> Demander modification
                </button>
                <button
                  onClick={() => { setActionQuote(q); setAction('refuse'); setComment('') }}
                  className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition"
                >
                  <XCircle size={13} /> Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action modal */}
      {actionQuote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              {action === 'approve' && <CheckCircle className="text-green-500" size={20} />}
              {action === 'refuse' && <XCircle className="text-red-500" size={20} />}
              {action === 'request_modification' && <AlertCircle className="text-yellow-500" size={20} />}
              <h3 className="font-semibold">
                {action === 'approve' ? 'Approuver' : action === 'refuse' ? 'Refuser' : 'Demander une modification'}
                {' — '}{actionQuote.reference}
              </h3>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Commentaire {action !== 'approve' ? '*' : '(optionnel)'}</label>
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Motif, instructions…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActionQuote(null)} className="btn-secondary">Annuler</button>
              <button
                onClick={handleAction}
                disabled={action !== 'approve' && !comment.trim()}
                className={`text-white px-4 py-2 rounded-lg text-sm font-medium transition ${action === 'approve' ? 'bg-green-500 hover:bg-green-600' : action === 'refuse' ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'} disabled:opacity-50`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
