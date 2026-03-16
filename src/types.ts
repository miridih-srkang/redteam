import { z } from 'zod'

/** Arena 모드: direct(직접 공격 입력) / auto(Red Team 자동 생성) */
export const ArenaMode = z.enum(['direct', 'auto'])
export type ArenaMode = z.infer<typeof ArenaMode>

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
  mode: ArenaMode,
  benignInput: z.string(),
  attackType: AttackType.optional(),
  attackInput: z.string(),
  /** direct 모드에서 가드레일이 감지한 공격 유형들 */
  detectedAttackTypes: z.array(z.object({
    type: AttackType,
    confidence: z.enum(['high', 'medium', 'low']),
    explanation: z.string(),
  })).optional(),
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
