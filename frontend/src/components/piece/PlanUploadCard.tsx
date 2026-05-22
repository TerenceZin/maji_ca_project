import { useCallback, useEffect, useRef, useState } from 'react'
import { FileUp, Loader2, Sparkles, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api'
import { ExtractPlanResult, PlanFileMeta } from '../../types'

interface Props {
  planFileMeta: PlanFileMeta | null
  onExtracted: (result: ExtractPlanResult, meta: PlanFileMeta) => void
  onClear: () => void
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif'

export default function PlanUploadCard({ planFileMeta, onExtracted, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [apiPreviewUrl, setApiPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [extracting, setExtracting] = useState(false)

  // Crée un blob URL local dès qu'un fichier est sélectionné
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Récupère tout fichier plan (image ou PDF) via axios pour envoyer le token Bearer.
  // Un <img> ou <embed> avec une URL directe /api/... déclencherait un 401.
  useEffect(() => {
    if (!planFileMeta) {
      setApiPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
      return
    }
    let url: string | null = null
    api.get(`/plan-files/${planFileMeta.id}/download`, { responseType: 'blob' })
      .then(r => {
        url = URL.createObjectURL(r.data)
        setApiPreviewUrl(url)
      })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [planFileMeta?.id])

  const handleFile = (f: File) => setFile(f)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleAnalyse = async () => {
    if (!file) return
    setExtracting(true)
    try {
      const fd1 = new FormData(); fd1.append('file', file)
      const fd2 = new FormData(); fd2.append('file', file)
      const [uploadRes, extractRes] = await Promise.all([
        api.post<PlanFileMeta>('/plan-files/upload', fd1, { headers: { 'Content-Type': 'multipart/form-data' } }),
        api.post<ExtractPlanResult>('/ai/extract-plan', fd2, { headers: { 'Content-Type': 'multipart/form-data' } }),
      ])
      onExtracted(extractRes.data, uploadRes.data)
      toast.success('Plan analysé avec succès !')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Erreur lors de l'analyse")
    } finally {
      setExtracting(false)
    }
  }

  const handleClear = () => {
    setFile(null)
    setPreviewUrl(null)
    onClear()
  }

  const isPdf = (file?.type === 'application/pdf') || (planFileMeta?.mime_type === 'application/pdf')
  const isImage = file?.type.startsWith('image/') || planFileMeta?.mime_type?.startsWith('image/')
  const displayName = file?.name || planFileMeta?.filename || null
  const hasFile = !!file || !!planFileMeta

  // Priorité : blob local (fichier fraîchement sélectionné) > blob via axios (planFileMeta restauré)
  const imgSrc = previewUrl ?? apiPreviewUrl

  return (
    <div className="space-y-3">
      {/* ── Barre fichier + bouton ── */}
      {!hasFile ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragging ? 'border-maji-500 bg-maji-50' : 'border-gray-200 hover:border-maji-300 hover:bg-gray-50'
          }`}
        >
          <FileUp size={28} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium text-gray-600 mb-0.5">
            Déposez le plan ici ou <span className="text-maji-600">cliquez pour choisir</span>
          </p>
          <p className="text-xs text-gray-400">PDF, PNG, JPG, WebP — max 20 Mo</p>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <FileText size={18} className={isPdf ? 'text-red-400' : 'text-blue-400'} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">{displayName}</div>
            {file && <div className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} Ko</div>}
            {planFileMeta && !file && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Enregistré · id #{planFileMeta.id}
              </div>
            )}
          </div>
          {file && !extracting && (
            <button onClick={handleAnalyse} className="btn-primary gap-1.5 text-xs py-1.5 shrink-0">
              <Sparkles size={13} /> Analyser avec Claude
            </button>
          )}
          {extracting && (
            <span className="flex items-center gap-1.5 text-xs text-maji-600 shrink-0">
              <Loader2 size={13} className="animate-spin" /> Analyse…
            </span>
          )}
          <button onClick={handleClear} className="text-gray-300 hover:text-red-500 transition-colors shrink-0" title="Retirer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Aperçu visuel ── */}
      {hasFile && (
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {isImage && imgSrc && (
            <img
              src={imgSrc}
              alt={displayName ?? 'Plan'}
              className="w-full object-contain max-h-96"
              style={{ background: '#f9fafb' }}
            />
          )}
          {isPdf && (previewUrl ?? apiPreviewUrl) && (
            <embed
              src={(previewUrl ?? apiPreviewUrl)!}
              type="application/pdf"
              className="w-full"
              style={{ height: '480px' }}
            />
          )}
          {isPdf && !previewUrl && !apiPreviewUrl && planFileMeta && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin text-maji-400" />
              <span>Chargement du plan…</span>
            </div>
          )}
        </div>
      )}

      {/* Indicateur analyse en cours */}
      {extracting && (
        <div className="flex items-center gap-2 text-xs text-maji-600 bg-maji-50 rounded-lg px-3 py-2">
          <Loader2 size={12} className="animate-spin shrink-0" />
          Claude Opus 4.7 analyse le plan et extrait la géométrie de la pièce…
        </div>
      )}
    </div>
  )
}
