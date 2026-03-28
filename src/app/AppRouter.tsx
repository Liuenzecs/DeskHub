import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RESOURCE_PAGES } from '../lib/navigation'
import { AppLayout } from './AppLayout'

const OverviewPage = lazy(() =>
  import('../pages/OverviewPage').then((module) => ({ default: module.OverviewPage })),
)
const ResourcePage = lazy(() =>
  import('../pages/ResourcePage').then((module) => ({ default: module.ResourcePage })),
)
const WorkflowsPage = lazy(() =>
  import('../pages/WorkflowsPage').then((module) => ({ default: module.WorkflowsPage })),
)
const RecentPage = lazy(() =>
  import('../pages/RecentPage').then((module) => ({ default: module.RecentPage })),
)

function RouteFallback() {
  return (
    <div className="surface px-5 py-4 text-sm text-[color:var(--text-muted)]">
      正在加载页面...
    </div>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />} path="/">
        <Route element={<Navigate replace to="/overview" />} index />
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <OverviewPage />
            </Suspense>
          }
          path="overview"
        />
        {RESOURCE_PAGES.map((config) => (
          <Route
            key={config.route}
            element={
              <Suspense fallback={<RouteFallback />}>
                <ResourcePage config={config} />
              </Suspense>
            }
            path={config.route.slice(1)}
          />
        ))}
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <WorkflowsPage />
            </Suspense>
          }
          path="workflows"
        />
        <Route
          element={
            <Suspense fallback={<RouteFallback />}>
              <RecentPage />
            </Suspense>
          }
          path="recent"
        />
      </Route>
      <Route element={<Navigate replace to="/overview" />} path="*" />
    </Routes>
  )
}
