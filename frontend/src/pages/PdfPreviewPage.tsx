import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react'
import api from '../api'

export default function PdfPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get(`/pdf/${id}`, { responseType: 'blob' }).then((r) => {
      const url = URL.createObjectURL(r.data)
      setBlobUrl(url)
    }).catch(() => setError(true))
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [id])

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/quotes/${id}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></Link>
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-maji-600" />
            <span className="font-semibold">Aperçu PDF</span>
          </div>
        </div>
        {blobUrl && (
          <a href={blobUrl} download={`devis-${id}.pdf`} className="btn-primary gap-1.5 text-sm">
            <Download size={15} /> Télécharger PDF
          </a>
        )}
      </div>
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        {error ? (
          <p className="text-red-500">Impossible de charger le PDF.</p>
        ) : blobUrl ? (
          <iframe src={blobUrl} className="w-full h-full border-0" title="Aperçu devis PDF" />
        ) : (
          <Loader2 className="animate-spin text-gray-400" size={32} />
        )}
      </div>
    </div>
  )
}
