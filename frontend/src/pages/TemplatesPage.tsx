import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookTemplate, Search, Plus, FileText, Clock, Hash } from 'lucide-react'
import api from '../api'
import { Template } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TYPE_LABELS = { client: 'Client', product: 'Produit', combined: 'Combiné' }
const TYPE_COLORS = { client: 'bg-purple-50 text-purple-700', product: 'bg-blue-50 text-blue-700', combined: 'bg-green-50 text-green-700' }

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)
    api.get(`/templates?${params}`).then((r) => setTemplates(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, typeFilter])

  const useTemplate = async (t: Template) => {
    try {
      const full = await api.get(`/templates/${t.id}`)
      const res = await api.post('/quotes', {
        client_id: full.data.client_id,
        data: full.data.data,
        margin_percent: 30,
        total_ht: 0,
        total_ttc: 0,
      })
      toast.success('Devis créé depuis le template')
      navigate(`/quotes/${res.data.id}`)
    } catch {
      toast.error('Erreur création depuis template')
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm('Supprimer ce template ?')) return
    await api.delete(`/templates/${id}`)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    toast.success('Template supprimé')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bibliothèque de templates</h1>
          <p className="text-sm text-gray-500">{templates.length} template(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">Tous les types</option>
          <option value="client">Client</option>
          <option value="product">Produit</option>
          <option value="combined">Combiné</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 p-8 text-center">Chargement…</div>
      ) : templates.length === 0 ? (
        <div className="text-center p-16 text-gray-400">
          <BookTemplate size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucun template. Créez-en depuis l'éditeur de devis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                  {t.client_name && <div className="text-xs text-gray-400 mt-0.5">{t.client_name}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${TYPE_COLORS[t.type]}`}>{TYPE_LABELS[t.type]}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1"><Hash size={11} /> {t.usage_count} utilisations</span>
                {t.last_used_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true, locale: fr })}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <button onClick={() => useTemplate(t)} className="btn-primary flex-1 gap-1.5 text-xs">
                  <FileText size={13} /> Créer un devis
                </button>
                <button onClick={() => deleteTemplate(t.id)} className="btn-secondary text-xs text-red-500 hover:bg-red-50">Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
