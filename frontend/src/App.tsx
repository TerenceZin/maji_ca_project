import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import QuoteEditorPage from './pages/QuoteEditorPage'
import TemplatesPage from './pages/TemplatesPage'
import CatalogPage from './pages/CatalogPage'
import ClientsPage from './pages/ClientPage'
import ClientDetailPage from './pages/ClientDetailPage'
import ValidationPage from './pages/ValidationPage'
import PdfPreviewPage from './pages/PdfPreviewPage'
import QuotesListPage from './pages/QuotesListPage'
import PieceEditorPage from './pages/PieceEditorPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="quotes" element={<QuotesListPage />} />
        <Route path="quotes/new" element={<QuoteEditorPage />} />
        <Route path="quotes/:id" element={<QuoteEditorPage />} />
        <Route path="quotes/:id/pdf" element={<PdfPreviewPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="validation" element={<ValidationPage />} />
        <Route path="pieces" element={<Navigate to="/pieces/new" replace />} />
        <Route path="pieces/new" element={<PieceEditorPage />} />
        <Route path="pieces/:id" element={<PieceEditorPage />} />
      </Route>
    </Routes>
  )
}
