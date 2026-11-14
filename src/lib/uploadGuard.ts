/**
 * Checks an uploaded spreadsheet before any parser touches it.
 *
 * The extension and the browser's MIME type are chosen by whoever named the
 * file, so neither is trusted. This module looks at the bytes:
 *
 * - .xlsx must be a ZIP (starts with "PK\x03\x04") and contain the parts of an
 *   Excel workbook. Its central directory is read, without inflating anything,
 *   to refuse zip bombs (huge declared uncompressed size, absurd compression
 *   ratio, thousands of entries), ZIP64 archives, and macro-enabled workbooks
 *   (xl/vbaProject.bin) renamed to .xlsx.
 * - .csv must be text: no NUL bytes, and not a known binary format (ZIP, PDF,
 *   Windows or Linux executable) with its extension changed.
 *
 * Pure apart from reading the File, so it is unit-tested with crafted bytes.
 */

export const UPLOAD_LIMITS = {
  /** Largest file accepted, compressed. */
  maxBytes: 10 * 1024 * 1024,
  /** Largest total uncompressed size declared by an .xlsx archive. */
  maxUncompressedBytes: 50 * 1024 * 1024,
  /** Most entries an .xlsx archive may hold. */
  maxEntries: 2000,
  /** Highest uncompressed ÷ compressed ratio for any single entry. */
  maxCompressionRatio: 200,
  /** Most data rows a single import may contain. */
  maxRows: 5000
} as const

export type UploadKind = 'csv' | 'xlsx'

export type UploadCheck = { ok: true; kind: UploadKind } | { ok: false; error: string }

const fail = (error: string): UploadCheck => ({ ok: false, error })

const startsWith = (bytes: Uint8Array, signature: number[]): boolean =>
  signature.every((b, i) => bytes[i] === b)

const ZIP_LOCAL = [0x50, 0x4b, 0x03, 0x04] // PK\x03\x04
const BINARY_SIGNATURES: Array<{ name: string; bytes: number[] }> = [
  { name: 'a ZIP archive', bytes: ZIP_LOCAL },
  { name: 'a PDF', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { name: 'a Windows program', bytes: [0x4d, 0x5a] }, // MZ
  { name: 'a Linux program', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // \x7FELF
  { name: 'an old Excel (.xls) file', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE2
  { name: 'a PNG image', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { name: 'a JPEG image', bytes: [0xff, 0xd8, 0xff] }
]

export interface ZipEntry {
  name: string
  compressedSize: number
  uncompressedSize: number
}

/**
 * Lists a ZIP archive's entries from its central directory. Throws on anything
 * that is not a well-formed, non-ZIP64 archive. Nothing is decompressed.
 */
export function readZipDirectory(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer)
  const len = buffer.byteLength
  // The end-of-central-directory record is in the last 22 + 65,535 bytes.
  let eocd = -1
  for (let i = len - 22; i >= Math.max(0, len - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('the archive has no central directory')

  const entryCount = view.getUint16(eocd + 10, true)
  const dirSize = view.getUint32(eocd + 12, true)
  const dirOffset = view.getUint32(eocd + 16, true)
  if (entryCount === 0xffff || dirOffset === 0xffffffff || dirSize === 0xffffffff) {
    throw new Error('ZIP64 archives are not accepted')
  }
  if (dirOffset + dirSize > len) throw new Error('the central directory is out of bounds')

  const entries: ZipEntry[] = []
  const decoder = new TextDecoder()
  let p = dirOffset
  for (let n = 0; n < entryCount; n++) {
    if (p + 46 > len || view.getUint32(p, true) !== 0x02014b50) {
      throw new Error('the central directory is corrupt')
    }
    const compressedSize = view.getUint32(p + 20, true)
    const uncompressedSize = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('ZIP64 archives are not accepted')
    }
    if (p + 46 + nameLen > len) throw new Error('the central directory is corrupt')
    const name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen))
    entries.push({ name, compressedSize, uncompressedSize })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** Validates an .xlsx archive's structure and declared sizes. */
export function checkXlsxArchive(buffer: ArrayBuffer): UploadCheck {
  let entries: ZipEntry[]
  try {
    entries = readZipDirectory(buffer)
  } catch (err) {
    return fail(`This is not a valid Excel file: ${err instanceof Error ? err.message : err}.`)
  }
  if (entries.length > UPLOAD_LIMITS.maxEntries) {
    return fail(
      `The workbook has ${entries.length} parts; at most ${UPLOAD_LIMITS.maxEntries} are accepted.`
    )
  }
  const names = new Set(entries.map((e) => e.name))
  if (!names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) {
    return fail('This ZIP file is not an Excel workbook (.xlsx).')
  }
  if ([...names].some((n) => /(^|\/)vbaProject\.bin$/i.test(n))) {
    return fail(
      'This workbook contains macros. Save it as a plain .xlsx without macros and try again.'
    )
  }
  if (entries.some((e) => e.name.includes('..') || e.name.startsWith('/'))) {
    return fail('The workbook contains unsafe file paths.')
  }
  const total = entries.reduce((sum, e) => sum + e.uncompressedSize, 0)
  if (total > UPLOAD_LIMITS.maxUncompressedBytes) {
    return fail(
      `The workbook expands to ${Math.round(total / 1024 / 1024)} MB; at most ${UPLOAD_LIMITS.maxUncompressedBytes / 1024 / 1024} MB is accepted.`
    )
  }
  const bomb = entries.find(
    (e) =>
      e.uncompressedSize > 1024 * 1024 &&
      e.uncompressedSize / Math.max(1, e.compressedSize) > UPLOAD_LIMITS.maxCompressionRatio
  )
  if (bomb) {
    return fail(
      'The workbook is compressed suspiciously well (a possible zip bomb), so it was not opened.'
    )
  }
  return { ok: true, kind: 'xlsx' }
}

/** Validates the first bytes of a .csv file: it must be text, not a renamed binary. */
export function checkCsvBytes(head: Uint8Array): UploadCheck {
  const binary = BINARY_SIGNATURES.find((s) => startsWith(head, s.bytes))
  if (binary) return fail(`This file is ${binary.name}, not a CSV, even though it ends in .csv.`)
  if (head.includes(0)) return fail('This file contains binary data, so it is not a CSV.')
  return { ok: true, kind: 'csv' }
}

/**
 * Checks an uploaded file by name, size and content. Call it before parsing;
 * only a result with ok: true should reach the CSV or Excel parser.
 */
export async function checkUpload(file: File): Promise<UploadCheck> {
  const name = file.name.toLowerCase()
  const kind: UploadKind | null = name.endsWith('.csv')
    ? 'csv'
    : name.endsWith('.xlsx')
      ? 'xlsx'
      : null
  if (!kind) return fail('Choose a .csv or .xlsx file.')
  if (file.size === 0) return fail('The file is empty.')
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return fail(`The file is larger than ${UPLOAD_LIMITS.maxBytes / 1024 / 1024} MB.`)
  }

  if (kind === 'csv') {
    const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer())
    return checkCsvBytes(head)
  }

  const buffer = await file.arrayBuffer()
  if (!startsWith(new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength)), ZIP_LOCAL)) {
    return fail('This file ends in .xlsx but is not an Excel workbook.')
  }
  return checkXlsxArchive(buffer)
}
