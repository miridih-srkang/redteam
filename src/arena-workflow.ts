import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { checkInput, checkOutput, checkInputWithAnalysis } from './agents/guardrail-agent.js'
import type { DetectedAttackType } from './agents/guardrail-agent.js'
import { generateAttack } from './agents/red-team-agent.js'
import { runTarget } from './agents/target-agent.js'
import { sendRoundResult } from './discord.js'
import type { RoundResult } from './types.js'

const sharedGuardDecision = z.enum(['block', 'sanitize', 'allow'])
const sharedMode = z.enum(['direct', 'auto'])
const attackTypeSchema = z.enum(['prompt_injection', 'data_exfiltration', 'hallucination_induction', 'content_policy_violation'])

const detectedAttackTypeSchema = z.object({
  type: attackTypeSchema,
  confidence: z.enum(['high', 'medium', 'low']),
  explanation: z.string(),
})

/** Step 1: 사용자 입력 처리 */
const benignStep = createStep({
  id: 'benign-input',
  description: 'Use user input',
  inputSchema: z.object({
    mode: sharedMode,
    userInput: z.string().optional(),
    attackStrategy: attackTypeSchema.optional(),
  }),
  outputSchema: z.object({
    mode: sharedMode,
    benignInput: z.string(),
    round: z.number(),
    attackStrategy: attackTypeSchema.optional(),
  }),
  execute: async ({ inputData }) => {
    const round = 1
    const benignInput = inputData.userInput?.trim() || 'OpenAI 최신 모델 발표에 대해 요약해줘'
    return { mode: inputData.mode, benignInput, round, attackStrategy: inputData.attackStrategy }
  },
})

/** Step 2: Red Team 공격 생성 (auto 모드) 또는 직접 입력 패스스루 (direct 모드) */
const redTeamStep = createStep({
  id: 'red-team-attack',
  description: 'Red Team generates attack input (auto mode) or pass-through (direct mode)',
  inputSchema: z.object({
    mode: sharedMode,
    benignInput: z.string(),
    round: z.number(),
    attackStrategy: attackTypeSchema.optional(),
  }),
  outputSchema: z.object({
    mode: sharedMode,
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.mode === 'direct') {
      // direct 모드: 사용자 입력을 그대로 공격 메시지로 사용
      return {
        mode: inputData.mode,
        attackInput: inputData.benignInput,
        attackType: undefined,
        benignInput: inputData.benignInput,
        round: inputData.round,
      }
    }

    // auto 모드: Red Team이 공격 생성
    const { attackInput, attackType } = await generateAttack(
      inputData.benignInput,
      inputData.attackStrategy,
    )
    return {
      mode: inputData.mode,
      attackInput,
      attackType,
      benignInput: inputData.benignInput,
      round: inputData.round,
    }
  },
})

/** Step 3: Guardrail 입력 검사 (direct 모드에서는 공격 유형 분석 포함) */
const guardInputStep = createStep({
  id: 'guardrail-input',
  description: 'Guardrail checks user input',
  inputSchema: z.object({
    mode: sharedMode,
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({
    mode: sharedMode,
    decision: sharedGuardDecision,
    contentToTarget: z.string(),
    notes: z.array(z.string()),
    detectedAttackTypes: z.array(detectedAttackTypeSchema).optional(),
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.mode === 'direct') {
      // direct 모드: 가드레일이 block/sanitize/allow 판정 + 공격 유형 분석
      const r = await checkInputWithAnalysis(inputData.attackInput)
      const contentToTarget =
        r.decision === 'block'
          ? ''
          : r.decision === 'sanitize' && r.sanitizedContent
            ? r.sanitizedContent
            : inputData.attackInput
      return {
        mode: inputData.mode,
        decision: r.decision,
        contentToTarget,
        notes: r.notes,
        detectedAttackTypes: r.detectedAttackTypes,
        attackInput: inputData.attackInput,
        attackType: inputData.attackType,
        benignInput: inputData.benignInput,
        round: inputData.round,
      }
    }

    // auto 모드: 기존 로직 (block/sanitize 적용)
    const r = await checkInput(inputData.attackInput)
    const contentToTarget =
      r.decision === 'block'
        ? ''
        : r.decision === 'sanitize' && r.sanitizedContent
          ? r.sanitizedContent
          : inputData.attackInput
    return {
      mode: inputData.mode,
      decision: r.decision,
      contentToTarget,
      notes: r.notes,
      detectedAttackTypes: undefined,
      attackInput: inputData.attackInput,
      attackType: inputData.attackType,
      benignInput: inputData.benignInput,
      round: inputData.round,
    }
  },
})

/** Step 4: Target Agent 실행 */
const targetStep = createStep({
  id: 'target-agent',
  description: 'Target agent runs with (sanitized) input',
  inputSchema: z.object({
    mode: sharedMode,
    decision: sharedGuardDecision,
    contentToTarget: z.string(),
    notes: z.array(z.string()),
    detectedAttackTypes: z.array(detectedAttackTypeSchema).optional(),
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({
    mode: sharedMode,
    targetOutput: z.string(),
    targetExecuted: z.boolean(),
    guardInputDecision: sharedGuardDecision,
    guardInputNotes: z.array(z.string()),
    detectedAttackTypes: z.array(detectedAttackTypeSchema).optional(),
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  execute: async ({ inputData }) => {
    const wasBlocked = inputData.decision === 'block' || !inputData.contentToTarget
    let targetOutput = ''
    let targetExecuted = false
    if (!wasBlocked) {
      const out = await runTarget(inputData.contentToTarget)
      targetOutput = out.text
      targetExecuted = true
    }
    return {
      mode: inputData.mode,
      targetOutput,
      targetExecuted,
      guardInputDecision: inputData.decision,
      guardInputNotes: inputData.notes,
      detectedAttackTypes: inputData.detectedAttackTypes,
      attackInput: inputData.attackInput,
      attackType: inputData.attackType,
      benignInput: inputData.benignInput,
      round: inputData.round,
    }
  },
})

/** Step 5: Guardrail 출력 검사 + Discord 전송 */
const guardOutputAndDiscordStep = createStep({
  id: 'guard-output-discord',
  description: 'Guardrail output check and Discord notification',
  inputSchema: z.object({
    mode: sharedMode,
    targetOutput: z.string(),
    targetExecuted: z.boolean(),
    guardInputDecision: sharedGuardDecision,
    guardInputNotes: z.array(z.string()),
    detectedAttackTypes: z.array(detectedAttackTypeSchema).optional(),
    attackInput: z.string(),
    attackType: z.string().optional(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({ round: z.number(), finalOutput: z.string() }),
  execute: async ({ inputData }) => {
    const r = await checkOutput(inputData.targetOutput)
    const finalOutput = r.finalOutput ?? inputData.targetOutput
    const result: RoundResult = {
      round: inputData.round,
      mode: inputData.mode,
      benignInput: inputData.benignInput,
      attackType: inputData.attackType as RoundResult['attackType'],
      attackInput: inputData.attackInput,
      detectedAttackTypes: inputData.detectedAttackTypes as RoundResult['detectedAttackTypes'],
      guardInputDecision: inputData.guardInputDecision,
      guardInputNotes: inputData.guardInputNotes,
      targetExecuted: inputData.targetExecuted,
      targetOutput: inputData.targetOutput,
      guardOutputDecision: r.decision,
      guardOutputNotes: r.notes,
      finalOutput,
      notes: [...inputData.guardInputNotes, ...r.notes],
    }
    await sendRoundResult(result)
    return { round: inputData.round, finalOutput }
  },
})

export const arenaWorkflow = createWorkflow({
  id: 'arena-workflow',
  inputSchema: z.object({
    /** Arena 모드: direct(직접 공격) / auto(Red Team 자동 생성) */
    mode: sharedMode.default('auto'),
    /** 사용자 입력 질문 */
    userInput: z.string().optional(),
    /** Red Team 전략 지정 (auto 모드). 없으면 LLM이 자유 선택 */
    attackStrategy: attackTypeSchema.optional(),
  }),
  outputSchema: z.object({ round: z.number(), finalOutput: z.string() }),
})
  .then(benignStep)
  .then(redTeamStep)
  .then(guardInputStep)
  .then(targetStep)
  .then(guardOutputAndDiscordStep)
  .commit()
