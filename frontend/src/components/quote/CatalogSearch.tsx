import { useEffect, useState } from 'react'
import { Search, X, AlertCircle } from 'lucide-react'
import api from '../../api'
import { CatalogItem } from '../../types'
import toast from 'react-hot-toast'

interface Props {
  onSelect: (item: CatalogItem) => void
  onClose: () => void
}

export default function CatalogSearch({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [requestDesc, setRequestDesc] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.length >= 2) {
        setLoading(true)
        api.get(`/catalog?search=${encodeURIComponent(search)}`).then((r) => setResults(r.data)).finally(() => setLoading(false))
      } else {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const handleRequest = async () => {
    if (!requestDesc.trim()) return
    await api.post('/catalog/requests', { description: requestDesc })
    toast.success('Demande envoyée')
    setShowRequest(false)
    setRequestDesc('')
  }

  return (
    <div className="flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="font-semibold text-gray-800">Ajouter du catalogue</div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {loading && <div className="p-4 text-center text-sm text-gray-400">Recherche…</div>}
        {!loading && search.length >= 2 && results.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-400">Aucun résultat pour "{search}"</div>
        )}
        {results.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 mb-1 border border-transparent hover:border-gray-200 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">{item.reference}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.category === 'composant' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'}`}>
                  {item.category === 'composant' ? 'Composant' : 'Matière'}
                </span>
                {item.price_change_flag && (
                  <span className="text-xs text-amber-600 flex items-center gap-0.5">
                    <AlertCircle size={10} /> Prix mis à jour
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-800 truncate">{item.name}</div>
              <div className="text-xs text-gray-400">{item.supplier}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold text-sm">{item.unit_price.toFixed(4)}€</div>
              <div className="text-xs text-gray-400">/{item.unit}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        {!showRequest ? (
          <button onClick={() => setShowRequest(true)} className="text-sm text-maji-600 hover:underline flex items-center gap-1">
            <AlertCircle size={13} /> Référence introuvable ? Demander l'ajout
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              autoFocus
              rows={2}
              value={requestDesc}
              onChange={(e) => setRequestDesc(e.target.value)}
              placeholder="Description de la référence à ajouter (nom, fournisseur, spécifications…)"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowRequest(false)} className="btn-secondary text-xs">Annuler</button>
              <button onClick={handleRequest} className="btn-primary text-xs">Envoyer la demande</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
