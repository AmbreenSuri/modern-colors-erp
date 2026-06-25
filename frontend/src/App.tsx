import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AppLayout } from '@/components/layout/AppLayout'
import { Toaster } from '@/components/common/Toaster'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CataloguePage } from '@/pages/CataloguePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PurchaseOrdersPage } from '@/pages/PurchaseOrdersPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { LabelsPage } from '@/pages/LabelsPage'
import { ReceivingPage } from '@/pages/ReceivingPage'
import { AuditPage } from '@/pages/AuditPage'
import type { Role } from '@/types/api'

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function AuthedRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="review/:poId" element={<ReviewPage />} />
        <Route path="labels" element={<LabelsPage />} />
        <Route path="receiving" element={<ReceivingPage />} />
        <Route path="catalogue" element={<CataloguePage />} />
        <Route
          path="audit"
          element={
            <RequireRole roles={['ADMIN', 'SUPERVISOR']}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={['ADMIN']}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthedRoutes />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}
