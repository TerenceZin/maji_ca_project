import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import api from '../../api'
import { ProductTemplate, QuoteData, QuoteTransport } from '../../types'

interface Props {
  quantity: number
  onApply: (patch: Partial<QuoteData>) => void
}

export default function ProductSearch({ quantity, onApply }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductTemplate[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      api.get('/product-templates', { params: { q: query } })
        .then((r) => { setResults(r.data); setOpen(true) })
        .catch(() => {})
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const apply = (pt: ProductTemplate) => {
    const scale = Math.max(quantity || 1, 1)
    const components = pt.components_data.map((c) => ({
      ...c,
      quantity: parseFloat((c.quantity * scale).toFixed(4)),
      total: parseFloat((c.unit_price * c.quantity * scale).toFixed(4)),
    }))
    const production = pt.production_data.map((p) => ({
      ...p,
      quantity: parseFloat((p.quantity * scale).toFixed(4)),
      time_min: parseFloat((p.time_min * scale).toFixed(2)),
      cost: parseFloat((p.cost * scale).toFixed(2)),
    }))
    const transport: QuoteTransport = {
      mode: 'routier',
      carrier_id: undefined,
      carrier_name: undefined,
      weight_net_g: 0,
      weight_packaging_g: pt.poids_emballage_g * scale,
      weight_gross_g: 0,
      dimensions: pt.dimensions_colis,
      volumetric_weight_g: 0,
      zone: '',
      cost: 0,
    }
    onApply({ components, production, transport })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Rechercher un produit Maji (boîtier, rack, capot…)"
            className="w-full pl-8 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.length > 0 ? (
            results.map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => apply(pt)}
                className="w-full text-left px-4 py-3 hover:bg-maji-50 border-b border-gray-100 last:border-0 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-gray-900 group-hover:text-maji-700">{pt.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{pt.reference}</span>
                  </div>
                  {pt.category && (
                    <span className="shrink-0 text-xs text-maji-600 bg-maji-50 border border-maji-100 px-2 py-0.5 rounded-full">
                      {pt.category}
                    </span>
                  )}
                </div>
                {pt.description && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{pt.description}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  Colis : {pt.dimensions_colis} cm · Emballage : {pt.poids_emballage_g} g ·{' '}
                  {pt.components_data.length} composant{pt.components_data.length > 1 ? 's' : ''} ·{' '}
                  {pt.production_data.length} opération{pt.production_data.length > 1 ? 's' : ''}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400">
              Aucun produit trouvé pour « {query} »
            </div>
          )}
        </div>
      )}
    </div>
  )
}
