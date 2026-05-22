import { Plus, Trash2 } from 'lucide-react'
import { TrouForme, TrouIn } from '../../types'
import NumberInput from '../ui/NumberInput'

interface Props {
  rows: TrouIn[]
  onChange: (rows: TrouIn[]) => void
}

const FORMES: TrouForme[] = ['circulaire', 'ovale', 'carré', 'rectangulaire']

const EMPTY_TROU: TrouIn = { forme: 'circulaire', diametre_mm: null, largeur_mm: null, hauteur_mm: null, quantite: 1 }

export default function TrousTable({ rows, onChange }: Props) {
  const update = (i: number, patch: Partial<TrouIn>) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    onChange(next)
  }

  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  const add = () => onChange([...rows, { ...EMPTY_TROU }])

  const isCircular = (f: TrouForme) => f === 'circulaire' || f === 'ovale'

  return (
    <div className="p-4 space-y-2">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left pb-2 pr-3 font-medium">Forme</th>
                <th className="text-left pb-2 pr-3 font-medium">Ø (mm)</th>
                <th className="text-left pb-2 pr-3 font-medium">Larg. (mm)</th>
                <th className="text-left pb-2 pr-3 font-medium">Haut. (mm)</th>
                <th className="text-left pb-2 pr-3 font-medium w-20">Qté</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => {
                const circ = isCircular(row.forme)
                return (
                  <tr key={i} className="group">
                    {/* Forme */}
                    <td className="py-1.5 pr-3">
                      <select
                        value={row.forme}
                        onChange={(e) => {
                          const f = e.target.value as TrouForme
                          update(i, { forme: f, diametre_mm: null, largeur_mm: null, hauteur_mm: null })
                        }}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 bg-white"
                      >
                        {FORMES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>

                    {/* Ø — visible si circulaire / ovale */}
                    <td className="py-1.5 pr-3">
                      {circ ? (
                        <NumberInput
                          step={0.001}
                          min={0}
                          placeholder="—"
                          value={row.diametre_mm}
                          onChange={(v) => update(i, { diametre_mm: v })}
                          className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                        />
                      ) : (
                        <span className="text-gray-300 text-xs px-2">—</span>
                      )}
                    </td>

                    {/* Largeur — visible si carré / rectangulaire */}
                    <td className="py-1.5 pr-3">
                      {!circ ? (
                        <NumberInput
                          step={0.1}
                          min={0}
                          placeholder="—"
                          value={row.largeur_mm}
                          onChange={(v) => update(i, { largeur_mm: v })}
                          className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                        />
                      ) : (
                        <span className="text-gray-300 text-xs px-2">—</span>
                      )}
                    </td>

                    {/* Hauteur */}
                    <td className="py-1.5 pr-3">
                      {!circ ? (
                        <NumberInput
                          step={0.1}
                          min={0}
                          placeholder="—"
                          value={row.hauteur_mm}
                          onChange={(v) => update(i, { hauteur_mm: v })}
                          className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
                        />
                      ) : (
                        <span className="text-gray-300 text-xs px-2">—</span>
                      )}
                    </td>

                    {/* Quantité */}
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

                    {/* Supprimer */}
                    <td className="py-1.5">
                      <button
                        onClick={() => remove(i)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-3">Aucun trou / découpe</p>
      )}

      <button
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-maji-600 hover:text-maji-800 font-medium py-1 transition-colors"
      >
        <Plus size={14} /> Ajouter un trou / une découpe
      </button>
    </div>
  )
}
