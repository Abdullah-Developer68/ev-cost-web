/**
 * The seeded demo project. Synthetic data, used on first run and by "Reset demo data".
 * Same content as the desktop app's `src/main/store/demoData.ts`.
 */
export const DEMO_PROJECT = {
  name: 'Autonomous Code Patching & Telemetry Platform',
  description: 'Real-time error capture, patch synthesis & sandbox verification system',
  currency: '$'
}

export interface DemoItem {
  taskName: string
  category: string
  bac: number
  plannedPercent: number
  actualPercent: number
  actualCost: number
  notes: string
}

export const DEMO_ITEMS: DemoItem[] = [
  {
    taskName: 'Live Runtime Error Listener & Code Auto-Patching System',
    category: 'Core Engineering',
    bac: 10000,
    plannedPercent: 50,
    actualPercent: 40,
    actualCost: 5000,
    notes: 'Core runtime listener module at 50% calendar milestone'
  },
  {
    taskName: 'AST Static Analysis & Syntax Tree Parser',
    category: 'Core Engineering',
    bac: 15000,
    plannedPercent: 75,
    actualPercent: 80,
    actualCost: 11000,
    notes: 'Analyzes code diffs and syntax trees for patching'
  },
  {
    taskName: 'Sandboxed Execution & Regression Test Runner',
    category: 'Infrastructure & QA',
    bac: 12000,
    plannedPercent: 60,
    actualPercent: 50,
    actualCost: 6500,
    notes: 'Isolated container runner for testing candidate patches'
  },
  {
    taskName: 'High-Throughput Telemetry Ingestion Pipeline',
    category: 'Infrastructure & QA',
    bac: 8000,
    plannedPercent: 90,
    actualPercent: 90,
    actualCost: 7200,
    notes: 'Kafka & ClickHouse streaming cluster'
  },
  {
    taskName: 'Enterprise SSO & Role-Based Access Control',
    category: 'Security & Compliance',
    bac: 6000,
    plannedPercent: 40,
    actualPercent: 30,
    actualCost: 3500,
    notes: 'OIDC/SAML integration and audit trails'
  }
]
