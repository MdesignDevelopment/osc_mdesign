/**
 * One-time fix: subtract 1 year from oscRequestDate / mailSentDate
 * on records where those dates are ~1 year ahead of receivedDate.
 *
 * Run:  npx tsx prisma/fix-dates.ts
 * Add --apply to commit the changes (dry-run by default).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const THRESHOLD_DAYS = 330 // ~11 months — safely flags 1-year mismatches

function fmt(d: Date | null) {
  if (!d) return 'null'
  return d.toISOString().slice(0, 10)
}

function subtractYear(d: Date): Date {
  const copy = new Date(d)
  copy.setFullYear(copy.getFullYear() - 1)
  return copy
}

async function main() {
  const records = await prisma.oscRequest.findMany({
    where: { receivedDate: { not: null } },
    select: {
      id: true,
      popzone: true,
      partner: { select: { name: true } },
      receivedDate: true,
      oscRequestDate: true,
      mailSentDate: true,
    },
  })

  const oscFix: typeof records = []
  const mailFix: typeof records = []

  for (const r of records) {
    const ref = r.receivedDate!.getTime()
    if (r.oscRequestDate) {
      const diff = (r.oscRequestDate.getTime() - ref) / 86_400_000
      if (diff > THRESHOLD_DAYS) oscFix.push(r)
    }
    if (r.mailSentDate) {
      const diff = (r.mailSentDate.getTime() - ref) / 86_400_000
      if (diff > THRESHOLD_DAYS) mailFix.push(r)
    }
  }

  console.log(`\n=== OSC Request Date fixes (${oscFix.length} records) ===`)
  for (const r of oscFix) {
    console.log(
      `  ${r.popzone.padEnd(35)} ${r.partner.name.padEnd(12)}` +
      `  received: ${fmt(r.receivedDate)}` +
      `  oscRequest: ${fmt(r.oscRequestDate)} → ${fmt(subtractYear(r.oscRequestDate!))}`,
    )
  }

  console.log(`\n=== Mail Sent Date fixes (${mailFix.length} records) ===`)
  for (const r of mailFix) {
    console.log(
      `  ${r.popzone.padEnd(35)} ${r.partner.name.padEnd(12)}` +
      `  received: ${fmt(r.receivedDate)}` +
      `  mailSent:   ${fmt(r.mailSentDate)} → ${fmt(subtractYear(r.mailSentDate!))}`,
    )
  }

  const total = oscFix.length + mailFix.length
  if (total === 0) {
    console.log('\nNo records need fixing.')
    return
  }

  if (!APPLY) {
    console.log(`\n[DRY RUN] ${total} field(s) would be updated. Re-run with --apply to commit.\n`)
    return
  }

  console.log('\nApplying fixes...')

  for (const r of oscFix) {
    await prisma.oscRequest.update({
      where: { id: r.id },
      data: { oscRequestDate: subtractYear(r.oscRequestDate!) },
    })
  }
  console.log(`  oscRequestDate fixed: ${oscFix.length} records`)

  for (const r of mailFix) {
    await prisma.oscRequest.update({
      where: { id: r.id },
      data: { mailSentDate: subtractYear(r.mailSentDate!) },
    })
  }
  console.log(`  mailSentDate fixed:   ${mailFix.length} records`)

  console.log('\nDone.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
