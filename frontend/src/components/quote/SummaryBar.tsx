import { QuoteData } from '../../types'
import NumberInput from '../ui/NumberInput'

interface Props {
  data: QuoteData
  marginPercent: number
  totalHt: number
  totalTtc: number
  onMarginChange: (m: number) => void
}

export default function SummaryBar({ data, marginPercent, totalHt, totalTtc, onMarginChange }: Props) {
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const compTotal = data.components.reduce((s, c) => s + c.total, 0)
  const prodTotal = data.production.reduce((s, p) => s + p.cost, 0)
  const transportCost = data.transport?.cost || 0
  const subtotal = compTotal + prodTotal + transportCost

  return (
    <div className="summary-bar bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-4 text-gray-500 text-xs">
            <span>Composants: <b className="text-gray-800">{fmt(compTotal)}€</b></span>
            <span>·</span>
            <span>Production: <b className="text-gray-800">{fmt(prodTotal)}€</b></span>
            <span>·</span>
            <span>Transport: <b className="text-gray-800">{fmt(transportCost)}€</b></span>
            <span>·</span>
            <span>Sous-total: <b className="text-gray-800">{fmt(subtotal)}€</b></span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500">Marge</label>
            <input
              type="range"
              min={0}
              max={80}
              step={1}
              value={marginPercent}
              onChange={(e) => onMarginChange(parseFloat(e.target.value))}
              className="w-24 accent-maji-600"
            />
            <NumberInput
              min={0}
              max={80}
              value={marginPercent}
              onChange={(v) => onMarginChange(v ?? 0)}
              blurFallback={0}
              className="w-14 text-center px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">Total HT</div>
              <div className="font-bold text-gray-900 text-base">{fmt(totalHt)} €</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">TVA 20%</div>
              <div className="text-gray-600 text-sm">{fmt(totalHt * 0.2)} €</div>
            </div>
            <div className="text-right bg-maji-600 text-white px-4 py-2 rounded-lg">
              <div className="text-xs opacity-80">Total TTC</div>
              <div className="font-bold text-lg">{fmt(totalTtc)} €</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
