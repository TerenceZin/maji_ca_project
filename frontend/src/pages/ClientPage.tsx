import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Users, Pencil, Trash2 } from 'lucide-react'
import api from '../api'
import { Client } from '../types'
import ClientFormModal from '../components/clients/ClientFormModal'
import DeleteClientConfirm from '../components/clients/DeleteClientConfirm'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const reload = () => {
    setLoading(true)
    api.get(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      .then((r) => setClients(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-1.5 text-sm">
          <Plus size={15} /> Nouveau client
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client…" className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maji-500" />
      </div>

      {loading ? (
        <div className="text-gray-400 p-8">Chargement…</div>
      ) : clients.length === 0 ? (
        <div className="text-center p-16 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>Aucun client pour l'instant.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-1.5 text-sm mt-4 inline-flex">
            <Plus size={15} /> Créer un client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                <th className="px-4 py-3 text-left">Raison sociale</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">SIRET</th>
                <th className="px-4 py-3 text-left">Conditions paiement</th>
                <th className="px-4 py-3 text-right">Remise</th>
                <th className="px-4 py-3 text-right">Marge cible</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/clients/${c.id}`} className="hover:text-maji-700">{c.company_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.contact_name}{c.contact_email ? <div className="text-xs">{c.contact_email}</div> : null}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.siret || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.payment_terms || '—'}</td>
                  <td className="px-4 py-3 text-right text-xs">{c.default_discount || 0}%</td>
                  <td className="px-4 py-3 text-right text-xs">{c.target_margin || 30}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        title="Modifier"
                        className="p-1.5 text-gray-400 hover:text-maji-600 hover:bg-maji-50 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleting(c)}
                        title="Supprimer"
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <ClientFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => reload()}
        />
      )}
      {editing && (
        <ClientFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}
      {deleting && (
        <DeleteClientConfirm
          client={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); reload() }}
        />
      )}
    </div>
  )
}
