export interface WorkPackageItem {
  id: number
  projectId: number
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes: string | null
  createdAt: Date | string | null
}

export interface Project {
  id: number
  name: string
  description: string | null
  currency: string
  createdAt: Date | string | null
}
