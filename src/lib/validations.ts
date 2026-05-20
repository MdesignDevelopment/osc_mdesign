import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
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

export const userCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'SUPPORT_ENGINEER', 'EXTERN']),
})

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().nullable(),
  role: z.enum(['ADMIN', 'SUPPORT_ENGINEER', 'EXTERN']).optional(),
  active: z.boolean().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type OscRequestInput = z.infer<typeof oscRequestSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
