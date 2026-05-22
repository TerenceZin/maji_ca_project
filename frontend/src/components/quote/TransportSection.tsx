import { useEffect, useMemo, useState } from 'react'
import { Lock, TrendingDown, Unlock, Zap } from 'lucide-react'
import api from '../../api'
import { Carrier, PieceIn, QuoteTransport } from '../../types'
import NumberInput from '../ui/NumberInput'
import {
  DEFAULT_PACKAGING_MARGIN_MM,
  computePackageDimensions,
  parseDimensions,
  volumetricWeightG,
} from '../../utils/packageDimensions'

interface Props {
  value: QuoteTransport
  onChange: (t: QuoteTransport) => void
  netWeightG: number
  piece?: PieceIn | null
  quantitySerie?: number
}

const MODES = ['routier', 'maritime', 'aérien', 'express']

function calcCarrierCost(carrier: Carrier, grossG: number, volG: number): number {
  const effectiveKg = Math.max(grossG, volG) / 1000
  if (effectiveKg >= 70) return carrier.tarif_palette
  return Math.max(effectiveKg, 1) * carrier.tarif_kg
}

export default function TransportSection({ value, onChange, netWeightG, piece, quantitySerie }: Props) {
  const [carriers, setCarriers] = useState<Carrier[]>([])

  useEffect(() => {
    api.get('/carriers').then((r) => setCarriers(r.data)).catch(() => {})
  }, [])

  // Default auto mode = true on first render if undefined (back-compat with existing quotes).
  const autoDimensions = value.auto_dimensions !== false
  const packagingMarginMm = value.packaging_margin_mm ?? DEFAULT_PACKAGING_MARGIN_MM

  const autoResult = useMemo(() => {
    if (!piece) return null
    return computePackageDimensions({
      piece,
      quantity: Math.max(quantitySerie || 1, 1),
      packagingMarginMm,
    })
  }, [piece?.longueur_mm, piece?.largeur_mm, piece?.hauteur_mm, piece?.epaisseur_mm, quantitySerie, packagingMarginMm])

  // Push auto-computed dimensions into the transport value when active.
  useEffect(() => {
    if (!autoDimensions || !autoResult) return
    const needsUpdate =
      value.dimensions !== autoResult.formatted ||
      (value.n_colis ?? 1) !== autoResult.n_colis
    if (needsUpdate) {
      onChange({ ...value, dimensions: autoResult.formatted, n_colis: autoResult.n_colis })
    }
  }, [autoDimensions, autoResult?.formatted, autoResult?.n_colis])

  // Recompute volumetric + gross + carrier cost whenever inputs change.
  useEffect(() => {
    const gross = netWeightG + (value.weight_packaging_g || 0)
    const parsed = parseDimensions(value.dimensions || '')
    const volumetric = parsed ? volumetricWeightG(parsed) : 0

    let cost = value.cost
    if (value.carrier_id) {
      const carrier = carriers.find((c) => c.id === value.carrier_id)
      if (carrier) cost = calcCarrierCost(carrier, gross, volumetric)
    }

    if (
      gross !== value.weight_gross_g ||
      volumetric !== value.volumetric_weight_g ||
      cost !== value.cost
    ) {
      onChange({
        ...value,
        weight_net_g: netWeightG,
        weight_gross_g: gross,
        volumetric_weight_g: volumetric,
        cost,
      })
    }
  }, [netWeightG, value.weight_packaging_g, value.dimensions, value.carrier_id, carriers])

  const set = (k: keyof QuoteTransport, v: unknown) => onChange({ ...value, [k]: v })

  const applyCarrier = (carrierId: number | undefined) => {
    if (!carrierId) {
      onChange({ ...value, carrier_id: undefined, carrier_name: undefined })
      return
    }
    const carrier = carriers.find((c) => c.id === carrierId)
    if (!carrier) return
    const cost = calcCarrierCost(carrier, value.weight_gross_g || 0, value.volumetric_weight_g || 0)
    onChange({ ...value, carrier_id: carrier.id, carrier_name: carrier.name, cost })
  }

  const fastest = carriers.length > 0
    ? carriers.reduce((a, b) => (a.delai_moyen_j <= b.delai_moyen_j ? a : b))
    : null

  const cheapest = carriers.length > 0
    ? carriers.reduce((a, b) =>
        calcCarrierCost(a, value.weight_gross_g || 0, value.volumetric_weight_g || 0) <=
        calcCarrierCost(b, value.weight_gross_g || 0, value.volumetric_weight_g || 0) ? a : b
      )
    : null

  const selectedCarrier = carriers.find((c) => c.id === value.carrier_id)
  const nColis = value.n_colis && value.n_colis > 1 ? value.n_colis : (autoDimensions ? autoResult?.n_colis : undefined)
  const canAutoCompute = !!autoResult

  const toggleAuto = () => {
    if (autoDimensions) {
      onChange({ ...value, auto_dimensions: false })
    } else {
      if (autoResult) {
        onChange({
          ...value,
          auto_dimensions: true,
          dimensions: autoResult.formatted,
          n_colis: autoResult.n_colis,
        })
      } else {
        onChange({ ...value, auto_dimensions: true })
      }
    }
  }

  const recomputeNow = () => {
    if (!autoResult) return
    onChange({
      ...value,
      auto_dimensions: true,
      dimensions: autoResult.formatted,
      n_colis: autoResult.n_colis,
    })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Sélecteur transporteur */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Transporteur</label>
        <select
          value={value.carrier_id ?? ''}
          onChange={(e) => applyCarrier(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
        >
          <option value="">— Sélectionner un transporteur —</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.service_type} · {c.delai_moyen_j}j · {c.tarif_kg.toFixed(2)} €/kg
            </option>
          ))}
        </select>

        {carriers.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {fastest && (
              <button
                type="button"
                onClick={() => applyCarrier(fastest.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <Zap size={12} /> Le plus rapide — {fastest.name} ({fastest.delai_moyen_j}j)
              </button>
            )}
            {cheapest && cheapest.id !== fastest?.id && (
              <button
                type="button"
                onClick={() => applyCarrier(cheapest.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <TrendingDown size={12} /> Le moins cher — {cheapest.name}
              </button>
            )}
          </div>
        )}

        {selectedCarrier && (
          <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Délai moyen : <b>{selectedCarrier.delai_moyen_j} jour(s) ouvré(s)</b></span>
            <span>Zones : {selectedCarrier.zones_geo}</span>
            <span>Tarif au kg : {selectedCarrier.tarif_kg.toFixed(2)} €</span>
            <span>Tarif palette (≥ 70 kg) : {selectedCarrier.tarif_palette.toFixed(2)} €</span>
          </div>
        )}
      </div>

      {/* Champs transport */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mode de transport</label>
          <select
            value={value.mode}
            onChange={(e) => set('mode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          >
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Poids net (g)</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">
            {netWeightG.toLocaleString('fr-FR')} g
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Poids emballage (g)</label>
          <NumberInput
            min={0}
            value={value.weight_packaging_g}
            onChange={(v) => set('weight_packaging_g', v ?? 0)}
            blurFallback={0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Poids brut total (g)</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">
            {value.weight_gross_g.toLocaleString('fr-FR')} g
          </div>
        </div>

        {/* Dimensions colis — bloc auto/manuel */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">
              Dimensions colis (LxlxH cm)
              {nColis && nColis > 1 && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                  ↳ {nColis} colis identiques
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              {!autoDimensions && canAutoCompute && (
                <button
                  type="button"
                  onClick={recomputeNow}
                  className="text-[11px] text-maji-600 hover:text-maji-800 underline"
                >
                  ↻ Recalculer auto
                </button>
              )}
              <button
                type="button"
                onClick={toggleAuto}
                disabled={!canAutoCompute && autoDimensions === false}
                title={canAutoCompute ? '' : 'Renseignez longueur et largeur de la pièce pour activer l’auto'}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  autoDimensions
                    ? 'bg-maji-50 text-maji-700 border-maji-200 hover:bg-maji-100'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                } ${!canAutoCompute ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {autoDimensions ? <Lock size={11} /> : <Unlock size={11} />}
                {autoDimensions ? 'Auto' : 'Manuel'}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={value.dimensions}
            onChange={(e) => set('dimensions', e.target.value)}
            disabled={autoDimensions}
            placeholder="ex: 60x40x30  ou  3 × 60x40x30"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 ${
              autoDimensions ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-200'
            }`}
          />
          {autoDimensions && !canAutoCompute && (
            <p className="text-[11px] text-amber-600 mt-1">
              ⚠ Renseignez longueur et largeur de la pièce pour calculer automatiquement.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Marge emballage (mm)</label>
          <NumberInput
            integer
            min={0}
            max={500}
            value={packagingMarginMm}
            onChange={(v) => set('packaging_margin_mm', v ?? DEFAULT_PACKAGING_MARGIN_MM)}
            blurFallback={DEFAULT_PACKAGING_MARGIN_MM}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Poids volumétrique (g)</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400">
            {value.volumetric_weight_g.toLocaleString('fr-FR')} g
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Zone / distance de livraison</label>
          <input
            type="text"
            value={value.zone}
            onChange={(e) => set('zone', e.target.value)}
            placeholder="ex: France métropolitaine"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Coût transport HT (€){selectedCarrier && <span className="ml-1 text-blue-500 font-medium">(indicatif)</span>}
          </label>
          <NumberInput
            min={0}
            step={0.01}
            value={value.cost}
            onChange={(v) => set('cost', v ?? 0)}
            blurFallback={0}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
          />
        </div>
      </div>
    </div>
  )
}
