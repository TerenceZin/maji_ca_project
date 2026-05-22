import { useState } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import api from '../../api'
import { CatalogItem, QuoteComponent } from '../../types'
import CatalogSearch from './CatalogSearch'
import NumberInput from '../ui/NumberInput'

interface Props {
  rows: QuoteComponent[]
  onChange: (rows: QuoteComponent[]) => void
}

export default function ComponentsTable({ rows, onChange }: Props) {
  const [showSearch, setShowSearch] = useState(false)

  const addItem = (item: CatalogItem) => {
    const existing = rows.findIndex((r) => r.reference === item.reference)
    if (existing >= 0) {
      const updated = [...rows]
      updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1, total: (updated[existing].quantity + 1) * item.unit_price }
      onChange(updated)
    } else {
      onChange([...rows, {
        reference: item.reference,
        name: item.name,
        supplier: item.supplier,
        quantity: 1,
        unit: item.unit,
        unit_price: item.unit_price,
        total: item.unit_price,
        weight_g: item.weight_g,
        price_change_flag: item.price_change_flag,
        price_change_percent: item.price_change_percent,
        previous_price: item.previous_price,
      }])
    }
    setShowSearch(false)
  }

  const updateQty = (index: number, qty: number | null) => {
    const q = qty ?? 0
    if (q < 0) return
    const updated = [...rows]
    updated[index] = { ...updated[index], quantity: q, total: q * updated[index].unit_price }
    onChange(updated)
  }

  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))

  const getPriceClass = (row: QuoteComponent) => {
    if (!row.price_change_flag) return ''
    const pct = Math.abs(row.price_change_percent || 0)
    if (pct > 15) return 'bg-red-50'
    if (pct >= 5) return 'bg-amber-50'
    return ''
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left">Référence</th>
              <th className="px-4 py-2 text-left">Désignation</th>
              <th className="px-4 py-2 text-left">Fournisseur</th>
              <th className="px-4 py-2 text-right">Qté</th>
              <th className="px-4 py-2 text-left">Unité</th>
              <th className="px-4 py-2 text-right bg-gray-100">P.U. HT</th>
              <th className="px-4 py-2 text-right">Total HT</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">Aucun composant. Cliquez sur "Ajouter" pour commencer.</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className={`hover:bg-gray-50 ${getPriceClass(row)}`}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.reference}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    {row.price_change_flag && (
                      <span
                        title={`Prix précédent: ${row.previous_price?.toFixed(4)}€ (${row.price_change_percent! > 0 ? '+' : ''}${row.price_change_percent?.toFixed(1)}%)`}
                        className="shrink-0"
                      >
                        <AlertTriangle size={12} className={Math.abs(row.price_change_percent || 0) > 15 ? 'text-red-500' : 'text-amber-500'} />
                      </span>
                    )}
                    <span className="text-xs">{row.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.supplier}</td>
                <td className="px-4 py-2 text-right">
                  <NumberInput
                    min={0}
                    value={row.quantity}
                    onChange={(v) => updateQty(i, v)}
                    blurFallback={1}
                    className="w-16 text-right px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                  />
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.unit}</td>
                <td className="px-4 py-2 text-right bg-gray-50 text-gray-400 text-xs font-mono cursor-not-allowed">{row.unit_price.toFixed(4)}€</td>
                <td className="px-4 py-2 text-right font-medium">{row.total.toFixed(2)}€</td>
                <td className="px-4 py-2">
                  <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={6} className="px-4 py-2 text-right text-sm">Total composants</td>
                <td className="px-4 py-2 text-right">{rows.reduce((s, r) => s + r.total, 0).toFixed(2)}€</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <button onClick={() => setShowSearch(true)} className="btn-secondary gap-1.5 text-xs">
          <Plus size={14} /> Ajouter un composant
        </button>
      </div>

      {showSearch && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowSearch(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <CatalogSearch onSelect={addItem} onClose={() => setShowSearch(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
