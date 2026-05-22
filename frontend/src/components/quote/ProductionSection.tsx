import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import api from '../../api'
import { QuoteProductionLine } from '../../types'
import toast from 'react-hot-toast'
import NumberInput from '../ui/NumberInput'

interface Props {
  rows: QuoteProductionLine[]
  onChange: (rows: QuoteProductionLine[]) => void
  estimatedDelivery?: string
}

const OPERATION_TYPES = [
  { value: 'decoupe_laser', label: 'Découpe laser', unit: 'mètre linéaire' },
  { value: 'poinconnage', label: 'Poinçonnage', unit: 'coup' },
  { value: 'pliage', label: 'Pliage', unit: 'pli' },
  { value: 'soudure_tig', label: 'Soudure TIG', unit: 'mètre linéaire' },
  { value: 'soudure_mig', label: 'Soudure MIG/MAG', unit: 'mètre linéaire' },
  { value: 'ebavurage', label: 'Ébavurage', unit: 'mètre linéaire' },
  { value: 'peinture', label: 'Peinture', unit: 'm²' },
  { value: 'zingage', label: 'Zingage', unit: 'lot' },
  { value: 'assemblage', label: 'Assemblage', unit: 'point' },
]

const MATERIALS = ['acier', 'inox', 'alu', 'galvanise']
const THICKNESSES = [0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0]

export default function ProductionSection({ rows, onChange, estimatedDelivery }: Props) {
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState({ operation_type: 'decoupe_laser', quantity: 1, material: 'acier', thickness_mm: 1.0, complexity_factor: 1.0 })
  const [calculating, setCalculating] = useState(false)

  const handleAddManual = async () => {
    setCalculating(true)
    try {
      const res = await api.post('/production/calculate', newRow)
      if (res.data.error) { toast.error(res.data.error); return }
      onChange([...rows, { ...res.data, ...newRow }])
      setAddingRow(false)
      setNewRow({ operation_type: 'decoupe_laser', quantity: 1, material: 'acier', thickness_mm: 1.0, complexity_factor: 1.0 })
    } catch {
      toast.error('Erreur calcul')
    } finally {
      setCalculating(false)
    }
  }

  const updateTime = (index: number, time_min: number) => {
    const updated = [...rows]
    const row = updated[index]
    updated[index] = { ...row, time_min, cost: (time_min / 60) * row.hourly_cost }
    onChange(updated)
  }

  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))

  const totalTime = rows.reduce((s, r) => s + r.time_min, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const latestDelivery = rows.reduce((latest, r) => {
    if (!r.estimated_delivery) return latest
    if (!latest || r.estimated_delivery > latest) return r.estimated_delivery
    return latest
  }, '' as string)

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2 text-left">Opération</th>
              <th className="px-4 py-2 text-left">Machine</th>
              <th className="px-4 py-2 text-right">Qté</th>
              <th className="px-4 py-2 text-left">Matière</th>
              <th className="px-4 py-2 text-right">Ép. (mm)</th>
              <th className="px-4 py-2 text-right">Temps (min)</th>
              <th className="px-4 py-2 text-right">Coût/h</th>
              <th className="px-4 py-2 text-right">Total HT</th>
              <th className="px-4 py-2 text-left">Livraison est.</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400 text-sm">Aucune opération. Ajoutez-en une ci-dessous.</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-xs">{row.operation_name || row.operation_type}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.machine_name || '—'}</td>
                <td className="px-4 py-2 text-right text-xs">{row.quantity} {row.unit_of_measure}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.material}</td>
                <td className="px-4 py-2 text-right text-xs">{row.thickness_mm}</td>
                <td className="px-4 py-2 text-right">
                  <NumberInput
                    min={0}
                    step={0.1}
                    value={row.time_min}
                    onChange={(v) => updateTime(i, v ?? 0)}
                    blurFallback={0}
                    className="w-20 text-right px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                  />
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">{row.hourly_cost}€/h</td>
                <td className="px-4 py-2 text-right font-medium">{row.cost.toFixed(2)}€</td>
                <td className="px-4 py-2 text-xs text-gray-500">{row.estimated_delivery || '—'}</td>
                <td className="px-4 py-2">
                  <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-sm">
                <td colSpan={5} className="px-4 py-2 text-right text-xs text-gray-500">Totaux production</td>
                <td className="px-4 py-2 text-right">{totalTime.toFixed(1)} min</td>
                <td />
                <td className="px-4 py-2 text-right">{totalCost.toFixed(2)}€</td>
                <td className="px-4 py-2 text-xs font-medium text-maji-700">{latestDelivery ? `≥ ${latestDelivery}` : '—'}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add row */}
      <div className="px-4 py-3 border-t border-gray-100">
        {!addingRow ? (
          <button onClick={() => setAddingRow(true)} className="btn-secondary gap-1.5 text-xs">
            <Plus size={14} /> Ajouter une opération
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Opération</label>
              <select value={newRow.operation_type} onChange={(e) => setNewRow((n) => ({ ...n, operation_type: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500">
                {OPERATION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quantité ({OPERATION_TYPES.find(o => o.value === newRow.operation_type)?.unit})</label>
              <NumberInput min={0.01} step={0.01} value={newRow.quantity} onChange={(v) => setNewRow((n) => ({ ...n, quantity: v ?? 1 }))} blurFallback={1} className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Matière</label>
              <select value={newRow.material} onChange={(e) => setNewRow((n) => ({ ...n, material: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500">
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Épaisseur (mm)</label>
              <select value={newRow.thickness_mm} onChange={(e) => setNewRow((n) => ({ ...n, thickness_mm: parseFloat(e.target.value) }))} className="px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500">
                {THICKNESSES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddingRow(false)} className="btn-secondary text-xs">Annuler</button>
              <button onClick={handleAddManual} disabled={calculating} className="btn-primary text-xs gap-1">
                {calculating && <Loader2 size={12} className="animate-spin" />} Calculer et ajouter
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
