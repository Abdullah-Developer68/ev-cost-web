import React from 'react'
import { useCostStore } from '../store/useCostStore'
import { ReportBuilder } from '../components/reports/ReportBuilder'
import { EmptyProject } from '../components/overview/EmptyProject'

export const ReportsPage: React.FC = () => {
  const items = useCostStore((s) => s.items)
  const isBooting = useCostStore((s) => s.isBooting)
  if (isBooting) return <div className="skeleton h-[480px]" aria-busy="true" />
  if (items.length === 0) return <EmptyProject />
  return <ReportBuilder />
}
