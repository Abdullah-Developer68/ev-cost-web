import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  calculateEacScenarios,
  calculateEvmMetrics,
  healthOf,
  ProjectEvmSummary
} from './calculations'
import { formatCurrency, formatIndex, formatSignedCurrency, formatSignedPercent } from './utils'
import type { Suggestion } from './suggestions'
import { ANOMALY_KIND_LABEL, summarizeAnomalies, type AnomalyReport } from './anomalies'
import type { WorkPackageItem } from '../types'

export interface ReportSections {
  summary: boolean
  chart: boolean
  table: boolean
  actions: boolean
  /** The unusual-spend (anomaly detection) findings. */
  anomalies: boolean
  scenarios: boolean
}

export interface ReportOptions {
  projectName: string
  description?: string | null
  currency: string
  summary: ProjectEvmSummary
  items: WorkPackageItem[]
  suggestions: Suggestion[]
  /** Unusual-spend findings; the section is skipped when absent. */
  anomalies?: AnomalyReport
  sections: ReportSections
}

type RGB = [number, number, number]

// The light theme's tokens, as print colours: ink on white with hairline rules.
const INK: RGB = [17, 17, 17]
const INK_3: RGB = [110, 110, 115]
const RULE: RGB = [230, 230, 227]
const RULE_STRONG: RGB = [212, 212, 208]
/** The soft chip behind a computed answer, and behind table totals. */
const SUBTLE: RGB = [241, 241, 240]
const GRID: RGB = [236, 236, 234]
const GOOD: RGB = [26, 127, 55]
const WATCH: RGB = [138, 90, 0]
const RISK: RGB = [178, 71, 13]
const BAD: RGB = [207, 34, 46]
const TINT: Record<'healthy' | 'watch' | 'at-risk' | 'critical', { text: RGB; fill: RGB }> = {
  healthy: { text: GOOD, fill: [232, 245, 236] },
  watch: { text: WATCH, fill: [251, 243, 223] },
  'at-risk': { text: RISK, fill: [253, 238, 228] },
  critical: { text: BAD, fill: [253, 236, 236] }
}
const SERIES: Record<'bac' | 'pv' | 'ev' | 'ac', RGB> = {
  bac: [220, 220, 216],
  pv: [47, 111, 235],
  ev: [23, 161, 122],
  ac: [229, 104, 58]
}

/**
 * The PDF base fonts only cover WinAnsi. Map the typographic characters the
 * app uses on screen to safe equivalents so nothing renders as garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/−/g, '-')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/∞/g, 'n/a')
    .replace(/→/g, '->')
    .replace(/₹/g, 'Rs ')
    .replace(/…/g, '...')
    .replace(/[^\S\n]/g, ' ') // any whitespace (incl. no-break space) except newlines
    .replace(/[^\n\x20-\x7E¡-ÿ€‘’“”–—•]/g, '')
}

const PAGE_MARGIN = 14

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(pdfSafe(text), PAGE_MARGIN, y)
  doc.setDrawColor(...RULE_STRONG)
  doc.setLineWidth(0.25)
  doc.line(PAGE_MARGIN, y + 2.2, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y + 2.2)
  return y + 7.5
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 16) {
    doc.addPage()
    return 18
  }
  return y
}

function lastY(doc: jsPDF, fallback: number): number {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback
  )
}

function drawPackageChart(
  doc: jsPDF,
  items: WorkPackageItem[],
  currency: string,
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const labelWidth = 62
  const chartX = PAGE_MARGIN + labelWidth
  const chartWidth = pageWidth - chartX - PAGE_MARGIN - 4
  const barH = 2.4
  const groupGap = 3.5
  const metrics = items.map((item) => ({ item, m: calculateEvmMetrics(item) }))
  const max = Math.max(1, ...metrics.map(({ m }) => Math.max(m.bac, m.ac)))
  const groupH = barH * 3 + 2 + groupGap
  let y = ensureSpace(doc, startY, 14 + metrics.length * groupH)

  // legend
  const legend: Array<[string, RGB]> = [
    ['Budget (BAC)', SERIES.bac],
    ['Planned value (PV)', SERIES.pv],
    ['Earned value (EV)', SERIES.ev],
    ['Actual cost (AC)', SERIES.ac]
  ]
  let lx = chartX
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  for (const [label, color] of legend) {
    doc.setFillColor(...color)
    doc.rect(lx, y - 2.4, 3, 3, 'F')
    doc.setTextColor(...INK_3)
    doc.text(label, lx + 4.2, y)
    lx += doc.getTextWidth(label) + 11
  }
  y += 5

  // gridlines
  const top = y
  const height = metrics.length * groupH
  doc.setDrawColor(...GRID)
  doc.setLineWidth(0.2)
  for (let i = 0; i <= 4; i++) {
    const x = chartX + (chartWidth * i) / 4
    doc.line(x, top - 1, x, top + height)
    doc.setTextColor(...INK_3)
    doc.setFontSize(7)
    doc.text(pdfSafe(formatCurrency((max * i) / 4, currency)), x, top + height + 4, {
      align: 'center'
    })
  }

  for (const { item, m } of metrics) {
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    const label = doc.splitTextToSize(pdfSafe(item.taskName), labelWidth - 4)[0] as string
    doc.text(label, PAGE_MARGIN, y + barH * 1.5 + 1.2)
    // BAC track behind the group
    doc.setFillColor(...SERIES.bac)
    doc.rect(chartX, y - 0.6, (m.bac / max) * chartWidth, barH * 3 + 3.2, 'F')
    const bars: Array<[number, RGB]> = [
      [m.pv, SERIES.pv],
      [m.ev, SERIES.ev],
      [m.ac, SERIES.ac]
    ]
    bars.forEach(([value, color], i) => {
      doc.setFillColor(...color)
      doc.rect(chartX, y + i * (barH + 0.8), Math.max(0.3, (value / max) * chartWidth), barH, 'F')
    })
    y += groupH
  }
  return top + height + 14
}

export function buildEvmReportPdf(options: ReportOptions): jsPDF {
  const { projectName, description, currency, summary, items, suggestions, anomalies, sections } =
    options
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const money = (v: number): string => pdfSafe(formatCurrency(v, currency))
  const signed = (v: number): string => pdfSafe(formatSignedCurrency(v, currency))
  const today = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Header: project name in ink, the product name opposite, a hairline under both
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(pdfSafe(projectName), PAGE_MARGIN, 17, { maxWidth: pageWidth - PAGE_MARGIN * 2 - 44 })
  doc.setFontSize(10)
  doc.text('EV-COST', pageWidth - PAGE_MARGIN, 14.5, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK_3)
  doc.text('Earned value report', pageWidth - PAGE_MARGIN, 18.5, { align: 'right' })
  doc.setFontSize(9)
  doc.text(
    pdfSafe(`${today}  ·  ${items.length} work packages  ·  Currency ${currency.trim()}`),
    PAGE_MARGIN,
    23
  )
  doc.setDrawColor(...RULE_STRONG)
  doc.setLineWidth(0.25)
  doc.line(PAGE_MARGIN, 27, pageWidth - PAGE_MARGIN, 27)

  // Verdict: a soft status chip, then the one-sentence summary
  const { level } = healthOf(summary.cpi, summary.spi)
  const levelLabel = {
    healthy: 'On track',
    watch: 'Watch',
    'at-risk': 'At risk',
    critical: 'Critical'
  }[level]
  const cost = summary.cpi >= 1 ? 'Under or on budget' : 'Over budget'
  const schedule = summary.spi >= 1 ? 'on or ahead of schedule' : 'behind schedule'
  const forecast =
    summary.vac >= 0
      ? `forecast to finish ${money(summary.vac)} under budget`
      : `forecast to finish ${money(-summary.vac)} over budget`
  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const tint = TINT[level]
  const badgeW = doc.getTextWidth(levelLabel) + 6
  doc.setFillColor(...tint.fill)
  doc.roundedRect(PAGE_MARGIN, y - 4.3, badgeW, 6.2, 1.2, 1.2, 'F')
  doc.setTextColor(...tint.text)
  doc.text(levelLabel, PAGE_MARGIN + 3, y)
  doc.setTextColor(...INK)
  doc.setFontSize(12)
  doc.text(pdfSafe(`${cost} and ${schedule}; ${forecast}.`), PAGE_MARGIN + badgeW + 4, y + 0.3)
  if (description) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK_3)
    doc.text(pdfSafe(description), PAGE_MARGIN, y + 7)
    y += 6
  }
  y += 11

  if (sections.summary) {
    y = sectionTitle(doc, 'Worked solution: all 12 EVM metrics and the percentage variances', y)
    const n = (v: number, d = 0): string =>
      Number.isFinite(v)
        ? v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
        : 'n/a'
    const s = summary
    const rows = [
      [
        'BAC',
        'Budget at completion',
        'Sum of package budgets',
        '',
        money(s.bac),
        'Total approved budget'
      ],
      [
        'PV',
        'Planned value',
        '% planned x BAC',
        `${n(s.plannedPercent, 1)}% x ${n(s.bac)}`,
        money(s.pv),
        'Value of work scheduled to date'
      ],
      [
        'EV',
        'Earned value',
        '% complete x BAC',
        `${n(s.actualPercent, 1)}% x ${n(s.bac)}`,
        money(s.ev),
        'Value of work actually done'
      ],
      ['AC', 'Actual cost', 'Sum of costs to date', '', money(s.ac), 'Money spent so far'],
      [
        'CV',
        'Cost variance',
        'EV - AC',
        `${n(s.ev)} - ${n(s.ac)}`,
        signed(s.cv),
        s.cv >= 0 ? 'Under budget' : 'Over budget'
      ],
      [
        'SV',
        'Schedule variance',
        'EV - PV',
        `${n(s.ev)} - ${n(s.pv)}`,
        signed(s.sv),
        s.sv >= 0 ? 'Ahead of schedule' : 'Behind schedule'
      ],
      [
        'CPI',
        'Cost performance index',
        'EV / AC',
        `${n(s.ev)} / ${n(s.ac)}`,
        formatIndex(s.cpi),
        `Earns ${currency.trim()}${formatIndex(s.cpi)} per ${currency.trim()}1 spent`
      ],
      [
        'SPI',
        'Schedule performance index',
        'EV / PV',
        `${n(s.ev)} / ${n(s.pv)}`,
        formatIndex(s.spi),
        `${formatIndex(s.spi * 100, 0)}% of planned pace`
      ],
      [
        'EAC',
        'Estimate at completion',
        'BAC / CPI',
        `${n(s.bac)} / ${n(s.cpi, 3)}`,
        money(s.eac),
        'Forecast total cost'
      ],
      [
        'ETC',
        'Estimate to complete',
        'EAC - AC',
        `${n(s.eac)} - ${n(s.ac)}`,
        money(s.etc),
        'Still needed to finish'
      ],
      [
        'VAC',
        'Variance at completion',
        'BAC - EAC',
        `${n(s.bac)} - ${n(s.eac)}`,
        signed(s.vac),
        s.vac >= 0 ? 'Forecast surplus' : 'Forecast deficit'
      ],
      [
        'CV%',
        'Cost variance %',
        'CV / EV x 100',
        s.cvPercent === null ? 'EV is 0' : `${n(s.cv)} / ${n(s.ev)} x 100`,
        formatSignedPercent(s.cvPercent),
        'Cost variance relative to work done'
      ],
      [
        'SV%',
        'Schedule variance %',
        'SV / PV x 100',
        s.svPercent === null ? 'PV is 0' : `${n(s.sv)} / ${n(s.pv)} x 100`,
        formatSignedPercent(s.svPercent),
        'Schedule variance relative to plan'
      ],
      [
        'VAC%',
        'Variance at completion %',
        'VAC / BAC x 100',
        s.vacPercent === null ? 'BAC is 0' : `${n(s.vac)} / ${n(s.bac)} x 100`,
        formatSignedPercent(s.vacPercent),
        'Forecast over/under-run relative to budget'
      ],
      [
        'TCPI',
        'To-complete performance index',
        '(BAC - EV) / (BAC - AC)',
        `${n(s.bac - s.ev)} / ${n(s.bac - s.ac)}`,
        pdfSafe(formatIndex(s.tcpi)),
        Number.isFinite(s.tcpi)
          ? s.tcpi > 1
            ? 'Efficiency needed on remaining work'
            : 'Achievable at current pace'
          : 'Budget spent; BAC unreachable'
      ]
    ].map((row) => row.map(pdfSafe))

    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['', 'Metric', 'Formula', 'Substitution', 'Answer', 'Meaning']],
      body: rows,
      headStyles: {
        textColor: INK_3,
        fontStyle: 'bold',
        fontSize: 8.5,
        lineWidth: { bottom: 0.25 },
        lineColor: RULE_STRONG
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: INK,
        lineWidth: { bottom: 0.1 },
        lineColor: RULE,
        cellPadding: 1.6
      },
      columnStyles: {
        0: { fontStyle: 'bold', font: 'courier', cellWidth: 14 },
        2: { font: 'courier' },
        3: { font: 'courier', textColor: INK_3 },
        4: { fontStyle: 'bold', halign: 'right', cellWidth: 28 }
      },
      didParseCell: (data) => {
        if (data.column.index === 4) data.cell.styles.halign = 'right'
        if (data.section === 'body' && data.column.index === 4 && data.row.index >= 4) {
          data.cell.styles.fillColor = SUBTLE
        }
      }
    })
    y = lastY(doc, y) + 10
  }

  if (sections.chart && items.length > 0) {
    y = ensureSpace(doc, y, 40)
    y = sectionTitle(doc, 'Budget, plan, earned and spent by work package', y)
    y = drawPackageChart(doc, items, currency, y + 2)
  }

  if (sections.table && items.length > 0) {
    y = ensureSpace(doc, y, 30)
    y = sectionTitle(doc, 'Work package breakdown', y)
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [
        [
          'Work package',
          'Category',
          'BAC',
          'Plan %',
          'Act %',
          'PV',
          'EV',
          'AC',
          'CV',
          'CV%',
          'SV',
          'CPI',
          'SPI',
          'EAC',
          'VAC',
          'TCPI'
        ]
      ],
      body: items.map((item) => {
        const m = calculateEvmMetrics(item)
        return [
          item.taskName,
          item.category,
          money(m.bac),
          `${m.plannedPercent.toFixed(0)}%`,
          `${m.actualPercent.toFixed(0)}%`,
          money(m.pv),
          money(m.ev),
          money(m.ac),
          signed(m.cv),
          formatSignedPercent(m.cvPercent),
          signed(m.sv),
          formatIndex(m.cpi),
          formatIndex(m.spi),
          money(m.eac),
          signed(m.vac),
          pdfSafe(formatIndex(m.tcpi))
        ].map(pdfSafe)
      }),
      foot: [
        [
          'Project total',
          '',
          money(summary.bac),
          `${summary.plannedPercent.toFixed(0)}%`,
          `${summary.actualPercent.toFixed(0)}%`,
          money(summary.pv),
          money(summary.ev),
          money(summary.ac),
          signed(summary.cv),
          formatSignedPercent(summary.cvPercent),
          signed(summary.sv),
          formatIndex(summary.cpi),
          formatIndex(summary.spi),
          money(summary.eac),
          signed(summary.vac),
          pdfSafe(formatIndex(summary.tcpi))
        ]
      ],
      headStyles: {
        textColor: INK_3,
        fontStyle: 'bold',
        fontSize: 7.5,
        lineWidth: { bottom: 0.25 },
        lineColor: RULE_STRONG
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: INK,
        lineWidth: { bottom: 0.1 },
        lineColor: RULE,
        cellPadding: 1.4
      },
      footStyles: {
        fontSize: 7.5,
        fontStyle: 'bold',
        textColor: INK,
        fillColor: SUBTLE,
        lineWidth: { top: 0.25 },
        lineColor: RULE_STRONG
      },
      columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 26 } },
      didParseCell: (data) => {
        if (data.column.index >= 2) data.cell.styles.halign = 'right'
        if (data.section === 'body' && [8, 9, 10, 14].includes(data.column.index)) {
          const text = String(data.cell.raw)
          data.cell.styles.textColor = text.startsWith('-')
            ? BAD
            : text.startsWith('+')
              ? GOOD
              : INK
        }
      }
    })
    y = lastY(doc, y) + 10
  }

  if (sections.actions && suggestions.length > 0) {
    y = ensureSpace(doc, y, 30)
    y = sectionTitle(doc, 'Recommended actions', y)
    const levelName = { critical: 'Critical', warning: 'Warning', info: 'Note', positive: 'Good' }
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['#', 'Level', 'Action', 'Why', 'Steps', 'Triggered by']],
      body: suggestions.map((s, i) => [
        String(i + 1),
        levelName[s.severity],
        pdfSafe(s.title),
        pdfSafe(s.detail),
        pdfSafe(s.steps.map((step, k) => `${k + 1}. ${step}`).join('\n')),
        pdfSafe(s.triggers.map((t) => `${t.metric} ${t.value} (${t.rule})`).join('\n'))
      ]),
      headStyles: {
        textColor: INK_3,
        fontStyle: 'bold',
        fontSize: 8,
        lineWidth: { bottom: 0.25 },
        lineColor: RULE_STRONG
      },
      bodyStyles: {
        fontSize: 7.8,
        textColor: INK,
        lineWidth: { bottom: 0.1 },
        lineColor: RULE,
        cellPadding: 1.8,
        valign: 'top'
      },
      columnStyles: {
        0: { cellWidth: 8, fontStyle: 'bold', textColor: INK_3 },
        1: { cellWidth: 20, fontStyle: 'bold' },
        2: { cellWidth: 52, fontStyle: 'bold' },
        3: { cellWidth: 72 },
        5: { cellWidth: 44, textColor: INK_3 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const raw = String(data.cell.raw)
          data.cell.styles.textColor =
            raw === 'Critical' ? BAD : raw === 'Good' ? GOOD : raw === 'Warning' ? RISK : INK_3
        }
      }
    })
    y = lastY(doc, y) + 10
  }

  if (sections.anomalies && anomalies) {
    y = ensureSpace(doc, y, 34)
    y = sectionTitle(doc, 'Unusual spend (anomaly detection)', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK_3)
    const method = pdfSafe(
      'Method: each package with progress and cost is scored on ln(AC / EV) against the others with the robust modified z-score M = 0.6745 x (x - median) / MAD. |M| >= 2.5 is unusual, |M| >= 3.5 extreme.'
    )
    const methodLines = doc.splitTextToSize(method, pageWidth - PAGE_MARGIN * 2)
    doc.text(methodLines, PAGE_MARGIN, y)
    y += methodLines.length * 3.6 + 1
    doc.setTextColor(...INK)
    const summaryLines = doc.splitTextToSize(
      pdfSafe(summarizeAnomalies(anomalies, currency)),
      pageWidth - PAGE_MARGIN * 2
    )
    doc.text(summaryLines, PAGE_MARGIN, y + 1)
    y += summaryLines.length * 3.8 + 3
    if (anomalies.anomalies.length > 0) {
      autoTable(doc, {
        startY: y,
        theme: 'plain',
        margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
        head: [['Work package', 'Finding', 'Level', 'AC / EV', 'Typical', 'Score', 'Why']],
        body: anomalies.anomalies.map((a) =>
          [
            a.taskName,
            ANOMALY_KIND_LABEL[a.kind],
            a.level === 'extreme' ? 'Extreme' : 'Unusual',
            a.costPerValue === null ? 'n/a' : formatIndex(a.costPerValue),
            a.peerMedian === null ? 'n/a' : formatIndex(a.peerMedian),
            a.score === null ? 'n/a' : formatIndex(a.score),
            a.explanation
          ].map(pdfSafe)
        ),
        headStyles: {
          textColor: INK_3,
          fontStyle: 'bold',
          fontSize: 8,
          lineWidth: { bottom: 0.25 },
          lineColor: RULE_STRONG
        },
        bodyStyles: {
          fontSize: 7.8,
          textColor: INK,
          lineWidth: { bottom: 0.1 },
          lineColor: RULE,
          cellPadding: 1.8,
          valign: 'top'
        },
        columnStyles: {
          0: { cellWidth: 52, fontStyle: 'bold' },
          1: { cellWidth: 34 },
          2: { cellWidth: 16, fontStyle: 'bold' },
          3: { cellWidth: 16, halign: 'right' },
          4: { cellWidth: 16, halign: 'right' },
          5: { cellWidth: 14, halign: 'right' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 2) {
            data.cell.styles.textColor = String(data.cell.raw) === 'Extreme' ? BAD : RISK
          }
        }
      })
      y = lastY(doc, y) + 10
    } else {
      y += 6
    }
  }

  if (sections.scenarios && items.length > 0) {
    y = ensureSpace(doc, y, 34)
    y = sectionTitle(doc, 'Forecast range (three EAC methods)', y)
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      head: [['If...', 'Formula', 'Assumption', 'EAC', 'vs budget']],
      body: calculateEacScenarios(summary).map((sc) => [
        pdfSafe(sc.label),
        pdfSafe(sc.formula.replace(/÷/g, '/').replace(/×/g, 'x')),
        pdfSafe(sc.assumption),
        money(sc.eac),
        signed(sc.vac)
      ]),
      headStyles: {
        textColor: INK_3,
        fontStyle: 'bold',
        fontSize: 8.5,
        lineWidth: { bottom: 0.25 },
        lineColor: RULE_STRONG
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: INK,
        lineWidth: { bottom: 0.1 },
        lineColor: RULE,
        cellPadding: 1.6
      },
      columnStyles: {
        1: { font: 'courier' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right' }
      }
    })
  }

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const h = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK_3)
    doc.text(
      'Generated by EV-COST. Formulas follow the standard earned value method (PMI).',
      PAGE_MARGIN,
      h - 7
    )
    doc.text(`Page ${p} of ${pages}`, pageWidth - PAGE_MARGIN, h - 7, { align: 'right' })
  }

  return doc
}

export function exportEvmReportPdf(options: ReportOptions): void {
  const doc = buildEvmReportPdf(options)
  const slug =
    options.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'project'
  doc.save(`${slug}-evm-report.pdf`)
}
