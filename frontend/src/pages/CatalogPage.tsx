import { useEffect, useState } from 'react'
import { Search, RefreshCw, AlertTriangle, Plus } from 'lucide-react'
import api from '../api'
import { CatalogItem } from '../types'
import toast from 'react-hot-toast'

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [supplier, setSupplier] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [requestDesc, setRequestDesc] = useState('')
  const [requestSupplier, setRequestSupplier] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    if (supplier) params.set('supplier', supplier)
    api.get(`/catalog?${params}`).then((r) => setItems(r.data)).finally(() => setLoading(false))
    api.get('/catalog/last-sync').then((r) => setLastSync(r.data.last_sync))
  }

  useEffect(() => { load() }, [search, category, supplier])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/catalog/refresh')
      toast.success(`Synchronisation terminée — ${res.data.updated} article(s) mis à jour`)
      load()
    } catch {
      toast.error('Erreur de synchronisation')
    } finally {
      setSyncing(false)
    }
  }

  const handleRequest = async () => {
    if (!requestDesc.trim()) return
    await api.post('/catalog/requests', { description: requestDesc, supplier: requestSupplier || null })
    toast.success('Demande envoyée')
    setShowRequest(false)
    setRequestDesc('')
    setRequestSupplier('')
  }

  const priceChangeStyle = (item: CatalogItem) => {
    if (!item.price_change_flag) return ''
    const abs = Math.abs(item.price_change_percent || 0)
    if (abs > 15) return 'bg-red-50'
    if (abs >= 5) return 'bg-amber-50'
    return ''
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue</h1>
          <div className="text-xs text-gray-400 mt-0.5">
            Dernière synchro : {lastSync ? new Date(lastSync).toLocaleString('fr-FR') : '—'}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRequest(true)} className="btn-secondary gap-1.5 text-sm"><Plus size={15} /> Demander un ajout</button>
          <button onClick={handleSync} disabled={syncing} className="btn-primary gap-1.5 text-sm">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Synchroniser
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher référence ou nom…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">Toutes catégories</option>
          <option value="composant">Composants</option>
          <option value="matiere_premiere">Matières premières</option>
        </select>
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">Tous fournisseurs</option>
          <option value="Bossard">Bossard</option>
          <option value="ArcelorMittal">ArcelorMittal</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="px-4 py-3 text-left">Référence</th>
                <th className="px-4 py-3 text-left">Désignation</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Fournisseur</th>
                <th className="px-4 py-3 text-right">Prix unitaire</th>
                <th className="px-4 py-3 text-left">Unité</th>
                <th className="px-4 py-3 text-right">Poids (g)</th>
                <th className="px-4 py-3 text-center">Évolution</th>
                <th className="px-4 py-3 text-left">Mise à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Chargement…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Aucun article trouvé</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 ${priceChangeStyle(item)}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.reference}</td>
                  <td className="px-4 py-3 text-xs">{item.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.category === 'composant' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'}`}>
                      {item.category === 'composant' ? 'Composant' : 'Matière'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.supplier}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {item.unit_price.toFixed(4)}€
                    {item.previous_price && (
                      <div className="text-xs text-gray-400 line-through">{item.previous_price.toFixed(4)}€</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500">{item.weight_g ? item.weight_g.toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {item.price_change_flag ? (
                      <span className={`flex items-center justify-center gap-1 text-xs font-medium ${Math.abs(item.price_change_percent || 0) > 15 ? 'text-red-600' : 'text-amber-600'}`}>
                        <AlertTriangle size={12} />
                        {(item.price_change_percent || 0) > 0 ? '+' : ''}{item.price_change_percent?.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {item.last_updated ? new Date(item.last_updated).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request modal */}
      {showRequest && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold mb-4">Demander l'ajout d'une référence</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description *</label>
                <textarea rows={3} value={requestDesc} onChange={(e) => setRequestDesc(e.target.value)} placeholder="Nom, spécifications, utilisation…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fournisseur suggéré</label>
                <input type="text" value={requestSupplier} onChange={(e) => setRequestSupplier(e.target.value)} placeholder="Bossard, ArcelorMittal…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRequest(false)} className="btn-secondary">Annuler</button>
                <button onClick={handleRequest} disabled={!requestDesc.trim()} className="btn-primary">Envoyer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
