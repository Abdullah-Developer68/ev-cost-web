import React from 'react'
import { useCostStore } from '../store/useCostStore'
import { StatusHero } from '../components/overview/StatusHero'
import { WorkedSheet } from '../components/overview/WorkedSheet'
import { NextActionsPanel } from '../components/overview/NextActionsPanel'
import { EmptyProject } from '../components/overview/EmptyProject'
import { PackagePerformanceChart } from '../components/charts/PackagePerformanceChart'
import { PerformanceMap } from '../components/charts/PerformanceMap'
import { ForecastBullets } from '../components/charts/ForecastBullets'
import { VarianceBars } from '../components/charts/VarianceBars'

const OverviewSkeleton: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading project">
    <div className="skeleton h-[260px]" />
    <div className="grid gap-6 min-[1360px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="skeleton h-[420px]" />
      <div className="skeleton h-[420px]" />
    </div>
  </div>
)

export const DashboardPage: React.FC = () => {
  const items = useCostStore((s) => s.items)
  const isBooting = useCostStore((s) => s.isBooting)

  if (isBooting) return <OverviewSkeleton />
  if (items.length === 0) return <EmptyProject />

  return (
    <div className="space-y-6">
      <StatusHero />
      <div className="grid items-start gap-6 min-[1360px]:grid-cols-[minmax(0,1fr)_340px]">
        <WorkedSheet />
        <NextActionsPanel />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <PackagePerformanceChart />
        <PerformanceMap />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ForecastBullets />
        <VarianceBars />
      </div>
    </div>
  )
}
