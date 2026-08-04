import { z } from 'zod'
import { Role, AddressRequestStatus, ScriptStatus, DesignStage } from '@prisma/client'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
})

export const oscRequestSchema = z.object({
  receivedDate: z.string().optional().nullable(),
  partnerId: z.string().min(1, 'Partner is required'),
  popzone: z.string().min(1, 'PopZone is required'),
  priority: z.enum(['HIGH_PRIO', 'MEDIUM_PRIO', 'LOW_PRIO', 'NOT_DEFINED']).optional().nullable(),
  status: z.enum(['OSC_UPDATED', 'EMAIL_SENT', 'EMAIL_SENT_REMINDER', 'ON_HOLD', 'CHECK_REMARKS']),
  remark: z.string().optional().nullable(),
  updatedDate: z.string().optional().nullable(),
  oscRequestDate: z.string().optional().nullable(),
  mailSentDate: z.string().optional().nullable(),
})

export const commentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty').max(2000),
})

// nativeEnum, not a hand-maintained z.enum list: adding a Role value should not
// require remembering to update two schemas here. See SPEC-WYER-MERKATOR.md §1.5.
export const userCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').transform(v => v.toLowerCase().trim()),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  role: z.nativeEnum(Role),
})

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().transform(v => v.toLowerCase().trim()).optional(),
  password: z.string().min(12, 'Password must be at least 12 characters').optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(12, 'New password must be at least 12 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

// --- Design Session Tracker (spec §6.1) ------------------------------------

// Deliberately not a hard `MRO_<CITY>_<NN>_POP_<NNN>` regex. Every observed
// value follows that shape, but the convention is owned by an upstream system;
// a strict pattern would eventually reject legitimate data. The UI warns on
// non-conforming input instead of blocking it (spec §10.2).
const popZone = z
  .string()
  .min(3, 'POP Zone must be at least 3 characters')
  .max(64, 'POP Zone must be at most 64 characters')
  .transform(v => v.trim())
  .refine(v => /^[A-Za-z0-9_-]+$/.test(v), 'POP Zone cannot contain spaces or punctuation')

/**
 * True when a POP zone departs from the usual MRO_<CITY>_<NN>_POP_<NNN> shape.
 *
 * Calibrated against all 433 live POP zones, which flushed out two variants a
 * naive pattern rejects:
 *   - hyphenated Belgian place names — 19 zones
 *     (MRO_MOLENBEEK-SAINT-JEAN_07_POP_002, MRO_SINT-ANTELINKS_01_POP_001)
 *   - a trailing split-POP letter — 2 zones (MRO_MECHELEN_03_POP_008_A)
 *
 * Both are legitimate production values, so warning on them would put a notice
 * on ~5% of valid input — exactly how a soft warning trains people to ignore it.
 * The pattern now matches all 433 while still flagging genuinely malformed
 * entries such as `CABINET_123` or `MRO_GENK_1_POP_1`.
 */
export function isUnusualPopZone(value: string): boolean {
  return !/^MRO_[A-Z0-9-]+(_[A-Z0-9-]+)*_\d{2}_POP_\d{3}(_[A-Z])?$/.test(value.trim().toUpperCase())
}

const designSessionFields = {
  cabinetName: z.string().max(64).optional().nullable(),
  mroPartner: z.string().max(64).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  actionsDone: z.string().max(5000).optional().nullable(),
  // Stored and hand-picked, independent of the four flags below.
  stage: z.nativeEnum(DesignStage).optional(),
  sendOcRequestToPartner: z.boolean().optional(),
  aapOnHold: z.boolean().optional(),
  readyToPost: z.boolean().optional(),
  posted: z.boolean().optional(),
}

export const designSessionCreateSchema = z.object({
  popZone,
  ...designSessionFields,
})

// popZone is absent on purpose: it is immutable after creation. It is the
// record identity, the OSC Status join key, and the script link key — editing
// it would silently re-point both (spec §6.1).
export const designSessionUpdateSchema = z.object({
  ...designSessionFields,
  expectedUpdatedAt: z.string().optional(), // optimistic concurrency (spec §10.1)
})

export const designSessionFlagsSchema = z.object({
  sendOcRequestToPartner: z.boolean().optional(),
  aapOnHold: z.boolean().optional(),
  readyToPost: z.boolean().optional(),
  posted: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
}).refine(
  d => ['sendOcRequestToPartner', 'aapOnHold', 'readyToPost', 'posted']
    .some(k => d[k as keyof typeof d] !== undefined),
  { message: 'At least one flag must be provided' },
)

/**
 * Single-cell edits from the grid view.
 *
 * Distinct from designSessionUpdateSchema on purpose: PUT rebuilds the whole
 * record, so an omitted field means "clear it". Here an omitted key means
 * "leave it alone" and only an explicit null clears — otherwise editing the
 * Cabinet cell would silently wipe Notes.
 */
export const designSessionPatchSchema = z.object({
  ...designSessionFields,
  expectedUpdatedAt: z.string().optional(),
}).refine(
  d => Object.keys(designSessionFields).some(k => d[k as keyof typeof d] !== undefined),
  { message: 'At least one field must be provided' },
)

export const deleteWithReasonSchema = z.object({
  reason: z.string().min(1, 'A reason is required').max(500),
})

// --- Addresses Tracker (spec §7.1) -----------------------------------------

export const addressRequestSchema = z.object({
  requestDate: z.string().min(1, 'Request date is required'),
  reporter: z.string().min(2, 'Reporter must be at least 2 characters').max(128),
  reportedById: z.string().optional().nullable(),
  tinaUuid: z.string().max(64).optional().nullable(),
  aapId: z.string().max(64).optional().nullable(),
  status: z.nativeEnum(AddressRequestStatus),
  notes: z.string().max(5000).optional().nullable(),
  completionDate: z.string().optional().nullable(),
  expectedUpdatedAt: z.string().optional(),
})
  // Assumption A2 — mirrored by the chk_address_identifier DB constraint, which
  // is the backstop for bulk imports and any path that skips this schema.
  .refine(d => Boolean(d.tinaUuid?.trim()) || Boolean(d.aapId?.trim()), {
    message: 'Either a Tina UUID or an AAP ID is required',
    path: ['tinaUuid'],
  })
  // Completion invariant (spec §7.4). The route defaults a missing completion
  // date to today, so this only fires when the client sends an explicit null.
  .refine(d => d.status !== 'COMPLETED' || d.completionDate !== null, {
    message: 'A completed request needs a completion date',
    path: ['completionDate'],
  })
  .refine(
    d => !d.completionDate || new Date(d.completionDate) >= new Date(d.requestDate),
    { message: 'Completion date cannot precede the request date', path: ['completionDate'] },
  )
  .refine(
    d => new Date(d.requestDate).getTime() <= Date.now() + 86_400_000,
    { message: 'Request date cannot be in the future', path: ['requestDate'] },
  )

export const addressStatusPatchSchema = z.object({
  status: z.nativeEnum(AddressRequestStatus),
  completionDate: z.string().optional().nullable(),
  clearCompletionDate: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
})

/**
 * Single-cell edits from the grid view.
 *
 * Every field is optional because one cell moves at a time. The cross-field
 * rules addressRequestSchema enforces (at-least-one identifier, the completion
 * invariant, date ordering) cannot be checked here — a partial payload does not
 * carry the other side of the comparison — so the route merges onto the stored
 * record first and validates that with `validateAddressRecord`.
 */
export const addressPatchSchema = z.object({
  requestDate: z.string().min(1).optional(),
  reporter: z.string().min(2, 'Reporter must be at least 2 characters').max(128).optional(),
  reportedById: z.string().optional().nullable(),
  tinaUuid: z.string().max(64).optional().nullable(),
  aapId: z.string().max(64).optional().nullable(),
  status: z.nativeEnum(AddressRequestStatus).optional(),
  notes: z.string().max(5000).optional().nullable(),
  completionDate: z.string().optional().nullable(),
  clearCompletionDate: z.boolean().optional(),
  expectedUpdatedAt: z.string().optional(),
}).refine(
  d => ['requestDate', 'reporter', 'reportedById', 'tinaUuid', 'aapId', 'status', 'notes', 'completionDate']
    .some(k => d[k as keyof typeof d] !== undefined),
  { message: 'At least one field must be provided' },
)

// --- Script execution ingest (spec §6.5) -----------------------------------

export const scriptExecutionIngestSchema = z.object({
  popZone: z.string().min(3).max(64),
  scriptName: z.string().min(1).max(200),
  scriptVersion: z.string().max(50).optional().nullable(),
  status: z.nativeEnum(ScriptStatus),
  executedAt: z.string().datetime({ offset: true }),
  durationMs: z.number().int().nonnegative().max(2_147_483_647).optional().nullable(),
  output: z.string().optional().nullable(),
  executedByLabel: z.string().max(120).optional().nullable(),
  externalRef: z.string().max(200).optional().nullable(),
})

export const scriptExecutionIngestPayloadSchema = z.union([
  scriptExecutionIngestSchema,
  z.array(scriptExecutionIngestSchema).min(1).max(500),
])

export type LoginInput = z.infer<typeof loginSchema>
export type OscRequestInput = z.infer<typeof oscRequestSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type DesignSessionCreateInput = z.infer<typeof designSessionCreateSchema>
export type DesignSessionUpdateInput = z.infer<typeof designSessionUpdateSchema>
export type DesignSessionFlagsInput = z.infer<typeof designSessionFlagsSchema>
export type DesignSessionPatchInput = z.infer<typeof designSessionPatchSchema>
export type AddressRequestInput = z.infer<typeof addressRequestSchema>
export type AddressStatusPatchInput = z.infer<typeof addressStatusPatchSchema>
export type AddressPatchInput = z.infer<typeof addressPatchSchema>
export type ScriptExecutionIngestInput = z.infer<typeof scriptExecutionIngestSchema>
