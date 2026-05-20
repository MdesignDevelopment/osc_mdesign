import { PrismaClient, OscStatus, Priority, Role } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as bcrypt from 'bcryptjs'
import * as path from 'path'

const prisma = new PrismaClient()

const PARTNERS = [
  'CIRCET', 'UNIT-T', 'JACOPS', 'EQUANS', 'CAS-VOS',
  'PTM', 'ZTE', 'Denys', 'APK', 'CONSTRUCTEL', 'FYBER49',
  'BESIX', 'HUBICON',
]

function mapStatus(raw: string | null | undefined): OscStatus {
  if (!raw) return OscStatus.ON_HOLD
  const s = raw.toUpperCase().trim()
  if (s === 'OSC UPDATED') return OscStatus.OSC_UPDATED
  if (s === 'EMAIL SENT') return OscStatus.EMAIL_SENT
  if (s.includes('REMINDER')) return OscStatus.EMAIL_SENT_REMINDER
  if (s === 'ON HOLD') return OscStatus.ON_HOLD
  if (s === 'CHECK REMARKS') return OscStatus.CHECK_REMARKS
  return OscStatus.ON_HOLD
}

function mapPriority(raw: string | null | undefined): Priority | null {
  if (!raw) return null
  const s = raw.toUpperCase().trim()
  if (s.includes('HIGH')) return Priority.HIGH_PRIO
  if (s.includes('LOW')) return Priority.LOW_PRIO
  return null
}

function toDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  const parsed = new Date(String(val))
  return isNaN(parsed.getTime()) ? null : parsed
}

async function main() {
  console.log('Seeding database...')

  // Require admin password from environment
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD
  if (!adminSeedPassword) {
    throw new Error('ADMIN_SEED_PASSWORD env var is required')
  }

  // Create admin user
  const adminPassword = await bcrypt.hash(adminSeedPassword, 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mdesign.ma' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@mdesign.ma',
      password: adminPassword,
      role: Role.ADMIN,
    },
  })
  console.log('Created admin:', admin.email)

  // Seed partners
  const partnerMap: Record<string, string> = {}
  for (const name of PARTNERS) {
    const partner = await prisma.partner.upsert({
      where: { name },
      update: {},
      create: { name },
    })
    partnerMap[name.toLowerCase()] = partner.id
  }
  console.log('Created partners:', Object.keys(partnerMap).length)

  // Load Excel file — validate path to prevent traversal
  const rawPath = process.env.XLSX_PATH || path.join(__dirname, '../data/OSCs-update-status.xlsx')
  const xlsxPath = path.resolve(rawPath)
  const allowedBase = path.resolve('/app/data')
  const cwdBase = path.resolve(process.cwd())
  if (!xlsxPath.startsWith(allowedBase) && !xlsxPath.startsWith(cwdBase)) {
    throw new Error(`Invalid XLSX_PATH: must be within /app/data or project directory`)
  }
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(xlsxPath)
  } catch {
    console.warn(`Excel file not found at ${xlsxPath}. Skipping data import.`)
    console.log('Seed complete (no Excel data imported).')
    return
  }

  const sheet = workbook.Sheets['OSC UPDATES']
  if (!sheet) {
    console.warn('Sheet "OSC UPDATES" not found. Skipping.')
    return
  }

  const rows = XLSX.utils.sheet_to_json<{
    'Received Date from the Partners'?: unknown
    'PARTNER'?: string
    'POPZONE'?: string
    'PRIO'?: string
    'Status'?: string
    'REMARK'?: string
    'Updated Date'?: unknown
    'OSC Request date from wyre'?: unknown
    'Mail send to partner'?: unknown
  }>(sheet, { defval: null })

  console.log(`Importing ${rows.length} OSC records...`)

  let imported = 0
  for (const row of rows) {
    const partnerName = row['PARTNER']?.trim()
    if (!partnerName || !row['POPZONE']) continue

    let partnerId = partnerMap[partnerName.toLowerCase()]
    if (!partnerId) {
      // Create partner on the fly if not in predefined list
      const newPartner = await prisma.partner.upsert({
        where: { name: partnerName },
        update: {},
        create: { name: partnerName },
      })
      partnerId = newPartner.id
      partnerMap[partnerName.toLowerCase()] = partnerId
    }

    await prisma.oscRequest.create({
      data: {
        receivedDate: toDate(row['Received Date from the Partners']),
        partnerId,
        popzone: row['POPZONE'],
        priority: mapPriority(row['PRIO']),
        status: mapStatus(row['Status']),
        remark: row['REMARK'] || null,
        updatedDate: toDate(row['Updated Date']),
        oscRequestDate: toDate(row['OSC Request date from wyre']),
        mailSentDate: toDate(row['Mail send to partner']),
        createdById: admin.id,
      },
    })
    imported++
  }

  console.log(`Imported ${imported} OSC records.`)
  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
