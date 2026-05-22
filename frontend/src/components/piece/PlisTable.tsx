import { Plus, Trash2 } from 'lucide-react'
import { PliIn } from '../../types'
import NumberInput from '../ui/NumberInput'

interface Props {
  rows: PliIn[]
  onChange: (rows: PliIn[]) => void
}

const EMPTY_PLI: PliIn = { angle_deg: null, rayon_mm: null, longueur_mm: null, quantite: 1 }

export default function PlisTable({ rows, onChange }: Props) {
  const update = (i: number, patch: Partial<PliIn>) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const add = () => onChange([...rows, { ...EMPTY_PLI }])

  return (
    <div className="p-4 space-y-2">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left pb-2 pr-3 font-medium">Angle (°)</th>
                <th className="text-left pb-2 pr-3 font-medium">Rayon (mm)</th>
                <th className="text-left pb-2 pr-3 font-medium">Longueur (mm)</th>
                <th className="text-left pb-2 pr-3 font-medium w-20">Qté</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr key={i} className="group">
                  <td className="py-1.5 pr-3">
                    <NumberInput
                      step={0.5}
                      min={0}
                      max={180}
                      placeholder="90"
                      value={row.angle_deg}
                      onChange={(v) => update(i, { angle_deg: v })}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <NumberInput
                      step={0.1}
                      min={0}
                      placeholder="—"
                      value={row.rayon_mm}
                      onChange={(v) => update(i, { rayon_mm: v })}
                      className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <NumberInput
                      step={0.1}
                      min={0}
                      placeholder="—"
                      value={row.longueur_mm}
                      onChange={(v) => update(i, { longueur_mm: v })}
                      className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <NumberInput
                      integer
                      min={1}
                      value={row.quantite}
                      onChange={(v) => update(i, { quantite: v ?? 1 })}
                      blurFallback={1}
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => remove(i)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-3">Aucun pli</p>
      )}

      <button
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-maji-600 hover:text-maji-800 font-medium py-1 transition-colors"
      >
        <Plus size={14} /> Ajouter un pli
      </button>
    </div>
  )
}
