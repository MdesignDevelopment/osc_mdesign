// Rule verification for the capability model and the two new modules'
// business rules. Run with `npm run verify`.
//
// This is deliberately a plain script rather than a test-framework suite: the
// project has no test runner, and standing one up was called out as unbudgeted
// work in SPEC-WYER-MERKATOR.md §12. It needs no database — everything checked
// here is pure logic.
//
// The first block is the important one: it is the regression test for the
// denylist privilege escalation described in §1.1. If a future role is added to
// the Role enum without declaring capabilities, `permissions.ts` fails to
// compile; if it is declared too broadly, these assertions fail.

import { can, landingRoute, capabilitiesFor } from '../src/lib/permissions'
import { resolveFlags, buildDesignWhere } from '../src/lib/design-sessions'
import { resolveCompletion, validateAddressRecord } from '../src/lib/addresses'
import { diffFields, initialFields, DESIGN_SESSION_FIELDS, ADDRESS_REQUEST_FIELDS } from '../src/lib/audit'

let pass = 0
let fail = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`) }
}

// The §1.1 escalation this guards against is no longer "WM must not touch OSC"
// — the product owner granted full CRUD. What still matters is that the grant is
// bounded: capabilities outside operational records must not come along for the
// ride, and they must be denied by declaration rather than by accident.
console.log('\n== RBAC: WM full read/write/delete on operational records ==')
for (const cap of [
  'osc:read', 'osc:write', 'osc:delete', 'osc:comment',
  'design:read', 'design:write', 'design:delete',
  'address:read', 'address:write', 'address:delete',
  'audit:read:osc', 'audit:read:design', 'audit:read:address',
] as const) {
  check(`WM ${cap}`, can('WM_SUPPORT_ENGINEER', cap), true)
}

console.log('\n== RBAC: the grant is still bounded ==')
check('WM users:manage', can('WM_SUPPORT_ENGINEER', 'users:manage'), false)
check('WM api:integration (API key page)', can('WM_SUPPORT_ENGINEER', 'api:integration'), false)
check('WM scripts:ingest', can('WM_SUPPORT_ENGINEER', 'scripts:ingest'), false)
check('WM is not silently ADMIN', capabilitiesFor('WM_SUPPORT_ENGINEER').length, 13)

console.log('\n== RBAC: existing roles unchanged ==')
check('ADMIN has every capability', capabilitiesFor('ADMIN').length, 16)
check('SUPPORT osc:write', can('SUPPORT_ENGINEER', 'osc:write'), true)
check('SUPPORT osc:comment', can('SUPPORT_ENGINEER', 'osc:comment'), true)
check('SUPPORT api:integration', can('SUPPORT_ENGINEER', 'api:integration'), true)
check('SUPPORT design:write', can('SUPPORT_ENGINEER', 'design:write'), true)
check('SUPPORT users:manage', can('SUPPORT_ENGINEER', 'users:manage'), false)
check('EXTERN osc:read', can('EXTERN', 'osc:read'), true)
check('EXTERN keeps commenting', can('EXTERN', 'osc:comment'), true)
check('EXTERN osc:write', can('EXTERN', 'osc:write'), false)
check('EXTERN design:read', can('EXTERN', 'design:read'), false)
check('EXTERN audit (any)', can('EXTERN', 'audit:read:osc'), false)
check('EXTERN cannot reach API key page', can('EXTERN', 'api:integration'), false)
check('unknown role denied', can('NOPE', 'design:read'), false)
check('undefined role denied', can(undefined, 'design:read'), false)

console.log('\n== Landing routes (§4.5) ==')
// WM can now read the OSC dashboard, but its work lives in the two modules.
check('WM still lands on design-sessions', landingRoute('WM_SUPPORT_ENGINEER'), '/design-sessions')
check('ADMIN lands on dashboard', landingRoute('ADMIN'), '/dashboard')
check('EXTERN lands on /osc, not the OSC dashboard', landingRoute('EXTERN'), '/osc')

console.log('\n== Design flag lifecycle (§6.6) ==')
const base = { sendOcRequestToPartner: false, aapOnHold: false, readyToPost: false, posted: false }

const r1 = resolveFlags(base, { posted: true })
check('posted auto-sets readyToPost', r1.flags.readyToPost, true)
check('auto-set is reported', r1.autoSet, ['readyToPost'])
check('no error', r1.error, undefined)

const r2 = resolveFlags({ ...base, posted: true, readyToPost: true }, { readyToPost: false })
check('un-tick ready while posted is blocked', r2.error, 'Un-tick Posted first.')
check('blocked change leaves flags untouched', r2.flags.readyToPost, true)

const r3 = resolveFlags({ ...base, readyToPost: true }, { aapOnHold: true })
check('hold on ready warns, not blocks', r3.error, undefined)
check('hold on ready warning text', r3.warnings, ['This session is marked ready to post.'])

const r4 = resolveFlags({ ...base, aapOnHold: true }, { posted: true })
check('post while on hold allowed', r4.flags.posted, true)
check('post while on hold warns', r4.warnings.includes('AAP is still on hold.'), true)
check('post while on hold keeps hold', r4.flags.aapOnHold, true)

const r5 = resolveFlags({ ...base, posted: true, readyToPost: true }, { posted: false })
check('un-post is allowed', r5.flags.posted, false)
check('un-post leaves ready set', r5.flags.readyToPost, true)

// Stage stopped being derived from the four flags once "On report 3" arrived, so
// filtering by it is now a straight column match. The subtle part is that
// `hidePosted` filters the posted FLAG, which is independent of the stage.
console.log('\n== Design session stage filtering (§6.6) ==')
check(
  'no stage chosen hides posted-flagged rows by default',
  buildDesignWhere({}),
  { posted: false },
)
check(
  'hidePosted=0 drops the posted predicate',
  buildDesignWhere({ hidePosted: '0' }),
  {},
)
check(
  'a chosen stage matches the column',
  buildDesignWhere({ stage: 'ON_REPORT_3' }),
  { stage: 'ON_REPORT_3' },
)
check(
  'a chosen stage does not also apply hidePosted',
  buildDesignWhere({ stage: 'POSTED' }),
  { stage: 'POSTED' },
)
check(
  'an unknown stage value falls back rather than matching nothing',
  buildDesignWhere({ stage: 'IN_DESIGN' }),
  { posted: false },
)
check(
  'duplicates filter matches the supplied keys',
  buildDesignWhere({ dupes: '1', hidePosted: '0' }, ['MRO_X_01_POP_001']),
  { popZoneKey: { in: ['MRO_X_01_POP_001'] } },
)
check(
  'duplicates filter with no duplicate zones matches nothing',
  buildDesignWhere({ dupes: '1', hidePosted: '0' }, []),
  { popZoneKey: { in: [] } },
)
check(
  'dupes off ignores the key list entirely',
  buildDesignWhere({ hidePosted: '0' }, ['MRO_X_01_POP_001']),
  {},
)

console.log('\n== Address completion invariant (§7.4) ==')
const c1 = resolveCompletion({ status: 'COMPLETED', completionDate: null })
check('COMPLETED auto-dates', c1.completionDate !== null, true)

const c2 = resolveCompletion({ status: 'ON_HOLD', completionDate: '2026-01-01', clearCompletionDate: true })
check('clearing works', c2.completionDate, null)

const c3 = resolveCompletion({ status: 'BLOCKED', completionDate: '2026-01-01' })
check('non-completed keeps date when not clearing', c3.completionDate?.toISOString().slice(0, 10), '2026-01-01')

const c4 = resolveCompletion({ status: 'COMPLETED', completionDate: '2026-03-05' })
check('explicit date preserved', c4.completionDate?.toISOString().slice(0, 10), '2026-03-05')

// The grid PATCH endpoint edits one cell at a time, so addressRequestSchema's
// cross-field rules cannot run on the payload — they run on the merged record
// instead. These are the rules the DB CHECK constraints would otherwise be the
// first to surface.
console.log('\n== Address record validation after a single-cell edit (§7.1/§7.4) ==')
const baseAddress = {
  requestDate: new Date('2026-01-05T00:00:00Z'),
  tinaUuid: 'tina-1',
  aapId: null,
  status: 'NOT_STARTED' as const,
  completionDate: null,
}
check('a valid record passes', validateAddressRecord(baseAddress), null)
check(
  'clearing the only identifier is rejected',
  validateAddressRecord({ ...baseAddress, tinaUuid: null }) !== null,
  true,
)
check(
  'clearing one of two identifiers is allowed',
  validateAddressRecord({ ...baseAddress, tinaUuid: null, aapId: 'aap-1' }),
  null,
)
check(
  'whitespace-only identifier does not count',
  validateAddressRecord({ ...baseAddress, tinaUuid: '   ' }) !== null,
  true,
)
check(
  'COMPLETED without a date is rejected',
  validateAddressRecord({ ...baseAddress, status: 'COMPLETED' }) !== null,
  true,
)
check(
  'completion before request is rejected',
  validateAddressRecord({
    ...baseAddress,
    status: 'COMPLETED',
    completionDate: new Date('2026-01-04T00:00:00Z'),
  }) !== null,
  true,
)
check(
  'completion on the request date is allowed',
  validateAddressRecord({
    ...baseAddress,
    status: 'COMPLETED',
    completionDate: new Date('2026-01-05T00:00:00Z'),
  }),
  null,
)
check(
  'a future request date is rejected',
  validateAddressRecord({
    ...baseAddress,
    requestDate: new Date(Date.now() + 7 * 86_400_000),
  }) !== null,
  true,
)
check(
  'an unparseable request date is rejected',
  validateAddressRecord({ ...baseAddress, requestDate: new Date('nope') }) !== null,
  true,
)

console.log('\n== Audit diffing (§5) ==')
check(
  'boolean false→true logged as No→Yes',
  diffFields({ posted: false }, { posted: true }, DESIGN_SESSION_FIELDS),
  [{ fieldChanged: 'posted', oldValue: 'No', newValue: 'Yes' }],
)
check(
  'unchanged field produces nothing',
  diffFields({ posted: true }, { posted: true }, DESIGN_SESSION_FIELDS),
  [],
)
check(
  'field absent from patch is skipped',
  diffFields({ posted: false, notes: 'a' }, { notes: 'b' }, DESIGN_SESSION_FIELDS),
  [{ fieldChanged: 'notes', oldValue: 'a', newValue: 'b' }],
)
check(
  'date diffs are date-only (no phantom time diffs)',
  diffFields(
    { requestDate: new Date('2026-01-05T09:30:00Z') },
    { requestDate: new Date('2026-01-05T22:15:00Z') },
    ADDRESS_REQUEST_FIELDS,
  ),
  [],
)
check(
  'real date change is logged',
  diffFields(
    { requestDate: new Date('2026-01-05T00:00:00Z') },
    { requestDate: new Date('2026-01-06T00:00:00Z') },
    ADDRESS_REQUEST_FIELDS,
  ),
  [{ fieldChanged: 'requestDate', oldValue: '2026-01-05', newValue: '2026-01-06' }],
)
check(
  'null → value logged',
  diffFields({ cabinetName: null }, { cabinetName: 'H70CA03HA06' }, DESIGN_SESSION_FIELDS),
  [{ fieldChanged: 'cabinetName', oldValue: null, newValue: 'H70CA03HA06' }],
)
check(
  'CREATE omits default-false booleans',
  initialFields(
    { popZone: 'MRO_X_01_POP_001', mroPartner: 'ZTE', posted: false, aapOnHold: false, readyToPost: false, sendOcRequestToPartner: false, notes: null },
    DESIGN_SESSION_FIELDS,
  ),
  [
    { fieldChanged: 'popZone', oldValue: null, newValue: 'MRO_X_01_POP_001' },
    { fieldChanged: 'mroPartner', oldValue: null, newValue: 'ZTE' },
  ],
)
check(
  'CREATE keeps a true boolean',
  initialFields({ popZone: 'P', posted: true }, DESIGN_SESSION_FIELDS).map((c) => c.fieldChanged),
  ['popZone', 'posted'],
)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
