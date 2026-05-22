import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import api from '../api'
import { Client, Quote } from '../types'
import toast from 'react-hot-toast'
import NumberInput from '../components/ui/NumberInput'
import DeleteClientConfirm from '../components/clients/DeleteClientConfirm'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    api.get(`/clients/${id}`).then((r) => setClient(r.data))
    api.get(`/quotes?client_id=${id}`).then((r) => setQuotes(r.data))
  }, [id])

  const handleSave = async () => {
    if (!client) return
    setSaving(true)
    try {
      await api.put(`/clients/${id}`, client)
      toast.success('Client mis à jour')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!client) return <div className="p-8 text-gray-400">Chargement…</div>

  const field = (key: keyof Client, label: string, type = 'text') => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={(client[key] as string) || ''}
        onChange={(e) => setClient((c) => c ? { ...c, [key]: e.target.value } : c)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
      />
    </div>
  )

  const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', submitted: 'Soumis', validated: 'Validé', sent: 'Envoyé', accepted: 'Accepté', refused: 'Refusé' }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/clients" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Informations</h3>
        <div className="grid grid-cols-2 gap-4">
          {field('company_name', 'Raison sociale')}
          {field('siret', 'SIRET')}
          {field('address', 'Adresse')}
          {field('phone', 'Téléphone')}
          {field('contact_name', 'Contact')}
          {field('contact_email', 'Email contact')}
          {field('payment_terms', 'Conditions de paiement')}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Remise habituelle (%)</label>
            <NumberInput min={0} max={100} value={client.default_discount ?? 0} onChange={(v) => setClient((c) => c ? { ...c, default_discount: v ?? 0 } : c)} blurFallback={0} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Marge cible (%)</label>
            <NumberInput min={0} max={100} value={client.target_margin ?? 30} onChange={(v) => setClient((c) => c ? { ...c, target_margin: v ?? 30 } : c)} blurFallback={30} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={15} /> Supprimer le client
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary gap-1.5"><Save size={15} /> Sauvegarder</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">Historique des devis</div>
        {quotes.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">Aucun devis pour ce client</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left">Référence</th>
              <th className="px-4 py-2 text-right">Total HT</th>
              <th className="px-4 py-2 text-left">Statut</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{q.reference}</td>
                  <td className="px-4 py-3 text-right">{q.total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{STATUS_LABELS[q.status] || q.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{q.created_at ? new Date(q.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3"><Link to={`/quotes/${q.id}`} className="text-maji-600 hover:underline text-xs">Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDelete && client && (
        <DeleteClientConfirm
          client={client}
          onClose={() => setShowDelete(false)}
          onDeleted={() => navigate('/clients')}
        />
      )}
    </div>
  )
}
