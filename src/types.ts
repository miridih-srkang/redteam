import { z } from 'zod'

/** Guardrail 결정: 차단 / 정화 후 통과 / 통과 */
export const GuardDecision = z.enum(['block', 'sanitize', 'allow'])
export type GuardDecision = z.infer<typeof GuardDecision>

/** 공격 유형 */
export const AttackType = z.enum([
  'prompt_injection',
  'data_exfiltration',
  'hallucination_induction',
  'content_policy_violation',
])
export type AttackType = z.infer<typeof AttackType>

/** Guardrail 검사 결과 */
export const GuardResult = z.object({
  decision: GuardDecision,
  sanitizedContent: z.string().optional(),
  notes: z.array(z.string()),
})
export type GuardResult = z.infer<typeof GuardResult>

/** 1라운드 결과 (로그·Discord용) */
export const RoundResult = z.object({
  round: z.number(),
  benignInput: z.string(),
  attackType: AttackType,
  attackInput: z.string(),
  guardInputDecision: GuardDecision,
  guardInputNotes: z.array(z.string()),
  targetExecuted: z.boolean(),
  targetOutput: z.string().optional(),
  guardOutputDecision: GuardDecision,
  guardOutputNotes: z.array(z.string()),
  finalOutput: z.string(),
  notes: z.array(z.string()),
})
export type RoundResult = z.infer<typeof RoundResult>

/** Arena 워크플로우 초기 입력 */
export const ArenaWorkflowInput = z.object({
  round: z.number(),
  userInput: z.string().optional(),
})
export type ArenaWorkflowInput = z.infer<typeof ArenaWorkflowInput>
