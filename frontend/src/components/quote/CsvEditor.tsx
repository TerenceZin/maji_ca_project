import { useMemo } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import { QuoteData } from '../../types'

registerAllModules()

interface Props {
  data: QuoteData
  onChange: (data: QuoteData) => void
}

type Row = { type: string; reference: string; name: string; quantity: number | string; unit: string; unit_price: number; total: number; _index: number; _locked: boolean }

export default function CsvEditor({ data, onChange }: Props) {
  const rows: Row[] = useMemo(() => {
    const result: Row[] = []
    data.components.forEach((c, i) =>
      result.push({ type: 'Composant', reference: c.reference, name: c.name, quantity: c.quantity, unit: c.unit, unit_price: c.unit_price, total: c.total, _index: i, _locked: true })
    )
    data.production.forEach((p, i) =>
      result.push({ type: 'Production', reference: p.operation_type, name: p.operation_name || p.operation_type, quantity: `${p.time_min} min`, unit: p.unit_of_measure, unit_price: p.hourly_cost / 60, total: p.cost, _index: i, _locked: false })
    )
    const t = data.transport
    result.push({ type: 'Transport', reference: t.mode, name: `Transport ${t.mode}`, quantity: 1, unit: 'forfait', unit_price: t.cost, total: t.cost, _index: 0, _locked: false })
    return result
  }, [data])

  const tableData = rows.map((r) => [r.type, r.reference, r.name, r.quantity, r.unit, r.unit_price, r.total])

  const handleAfterChange = (changes: any) => {
    if (!changes) return
    const newData = { ...data, components: [...data.components], production: [...data.production], transport: { ...data.transport } }
    changes.forEach(([rowIdx, col, , newVal]: [number, number, any, any]) => {
      const row = rows[rowIdx]
      if (!row || row._locked) return
      if (row.type === 'Production' && col === 3) {
        // time_min changed
        const time = parseFloat(newVal) || 0
        newData.production[row._index] = { ...newData.production[row._index], time_min: time, cost: (time / 60) * newData.production[row._index].hourly_cost }
      }
      if (row.type === 'Composant' && col === 3) {
        const qty = parseInt(newVal) || 0
        newData.components[row._index] = { ...newData.components[row._index], quantity: qty, total: qty * newData.components[row._index].unit_price }
      }
      if (row.type === 'Transport' && col === 6) {
        newData.transport = { ...newData.transport, cost: parseFloat(newVal) || 0 }
      }
    })
    onChange(newData)
  }

  return (
    <div className="p-4">
      <p className="text-xs text-gray-400 mb-2">Les colonnes grisées (prix unitaires, références) sont verrouillées. Vous pouvez modifier les quantités, temps et coût transport.</p>
      <HotTable
        data={tableData}
        colHeaders={['Type', 'Référence', 'Désignation', 'Quantité', 'Unité', 'P.U. HT', 'Total HT']}
        columns={[
          { readOnly: true },
          { readOnly: true },
          { readOnly: true },
          { type: 'text' },
          { readOnly: true },
          { type: 'numeric', numericFormat: { pattern: '0.0000€' }, readOnly: true },
          { type: 'numeric', numericFormat: { pattern: '0.00€' }, readOnly: true },
        ]}
        cells={(row) => {
          const r = rows[row]
          if (!r) return {}
          if (r._locked) return { readOnly: true, className: 'price-locked' }
          return {}
        }}
        afterChange={handleAfterChange}
        rowHeaders={true}
        width="100%"
        height={Math.max(200, rows.length * 28 + 60)}
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
      />
    </div>
  )
}
