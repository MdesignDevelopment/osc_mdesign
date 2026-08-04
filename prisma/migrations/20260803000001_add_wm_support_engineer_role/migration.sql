-- Adds the Wyer/Merkator Support Engineer role.
--
-- This is deliberately isolated in its own migration: PostgreSQL cannot use a
-- newly added enum value inside the same transaction that created it, so any
-- migration or seed that REFERENCES 'WM_SUPPORT_ENGINEER' must run after this
-- one has committed.
--
-- Prerequisite: the capability layer in src/lib/permissions.ts must already be
-- deployed. Before that migration of role checks, a user holding this role
-- passes every `role === 'EXTERN'` denylist check and gains OSC write/delete
-- access. See SPEC-WYER-MERKATOR.md §1.1.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'WM_SUPPORT_ENGINEER';
