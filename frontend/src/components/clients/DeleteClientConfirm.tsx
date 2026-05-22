import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api'
import { Client, Quote } from '../../types'

interface Props {
  client: Client
  onClose: () => void
  onDeleted: () => void
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumis', validated: 'Validé', sent: 'Envoyé',
  accepted: 'Accepté', refused: 'Refusé', refused_client: 'Refusé client',
}

export default function DeleteClientConfirm({ client, onClose, onDeleted }: Props) {
  const [quotes, setQuotes] = useState<Quote[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get(`/quotes?client_id=${client.id}`)
      .then((r) => setQuotes(r.data))
      .catch(() => setQuotes([]))
  }, [client.id])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/clients/${client.id}`)
      toast.success('Client supprimé')
      onDeleted()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h3 className="font-semibold">Supprimer ce client ?</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <p className="text-sm text-gray-700 mb-3">
          Êtes-vous sûr de vouloir supprimer <span className="font-semibold">{client.company_name}</span> ?
          Cette action supprimera également <span className="font-semibold">tous les devis liés</span> à ce client.
        </p>

        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
          {quotes === null ? (
            <div className="p-4 text-sm text-gray-400">Chargement des devis impactés…</div>
          ) : quotes.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Aucun devis lié à ce client.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Référence</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-right">Total HT</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="px-3 py-2 font-medium">{q.reference}</td>
                    <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{STATUS_LABELS[q.status] || q.status}</span></td>
                    <td className="px-3 py-2 text-right">{(q.total_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{q.created_at ? new Date(q.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {quotes && quotes.length > 0 && (
          <div className="text-xs text-red-600 mb-3">
            {quotes.length} devis seront supprimés définitivement.
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary" disabled={deleting}>Annuler</button>
          <button
            onClick={handleDelete}
            disabled={deleting || quotes === null}
            className="inline-flex items-center bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
