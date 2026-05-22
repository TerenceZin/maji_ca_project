import { useState } from 'react'
import { Loader2, Mail, Send, X } from 'lucide-react'

interface Props {
  quoteRef: string
  clientEmail?: string
  onSend: (email: string, message: string) => Promise<void>
  onClose: () => void
}

export default function SendEmailModal({ quoteRef, clientEmail, onSend, onClose }: Props) {
  const [email, setEmail] = useState(clientEmail || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!email.trim()) return
    setSending(true)
    setError('')
    try {
      await onSend(email.trim(), message.trim())
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Erreur lors de l\'envoi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Mail size={18} className="text-maji-600" /> Envoyer le devis par email
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">Devis {quoteRef} · PDF joint automatiquement</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse email du destinataire <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="client@entreprise.fr"
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message personnalisé <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Bonjour,&#10;&#10;Veuillez trouver ci-joint votre devis. N'hésitez pas à nous contacter pour toute question."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 btn-secondary">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={!email.trim() || sending}
            className="flex-1 btn-primary gap-1.5"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Envoi en cours…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}
