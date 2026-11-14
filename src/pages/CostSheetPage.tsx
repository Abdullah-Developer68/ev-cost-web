import React from 'react'
import { useCostStore } from '../store/useCostStore'
import { PackagesToolbar } from '../components/packages/PackagesToolbar'
import { PackagesTable } from '../components/packages/PackagesTable'
import { CategorySummary } from '../components/packages/CategorySummary'
import { EmptyProject } from '../components/overview/EmptyProject'

export const CostSheetPage: React.FC = () => {
  const items = useCostStore((s) => s.items)
  const isBooting = useCostStore((s) => s.isBooting)

  if (isBooting) return <div className="skeleton h-[480px]" aria-busy="true" />
  if (items.length === 0) return <EmptyProject />

  return (
    <div className="space-y-5">
      <PackagesToolbar />
      <PackagesTable />
      <CategorySummary />
    </div>
  )
}
