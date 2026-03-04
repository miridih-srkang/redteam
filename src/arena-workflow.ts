import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { checkInput, checkOutput } from './agents/guardrail-agent.js'
import { generateAttack } from './agents/red-team-agent.js'
import { runTarget } from './agents/target-agent.js'
import { sendRoundResult } from './discord.js'
import type { RoundResult } from './types.js'

const sharedGuardDecision = z.enum(['block', 'sanitize', 'allow'])

/** Step 1: Benign input (사용자 입력) */
const benignStep = createStep({
  id: 'benign-input',
  description: 'Use user input',
  inputSchema: z.object({
    userInput: z.string().optional(),
    attackStrategy: z.enum(['prompt_injection', 'data_exfiltration', 'hallucination_induction', 'content_policy_violation']).optional(),
  }),
  outputSchema: z.object({ benignInput: z.string(), round: z.number(), attackStrategy: z.enum(['prompt_injection', 'data_exfiltration', 'hallucination_induction', 'content_policy_violation']).optional() }),
  execute: async ({ inputData }) => {
    const round = 1
    const benignInput = inputData.userInput?.trim() || 'OpenAI 최신 모델 발표에 대해 요약해줘'
    return { benignInput, round, attackStrategy: inputData.attackStrategy }
  },
})

const attackTypeSchema = z.enum(['prompt_injection', 'data_exfiltration', 'hallucination_induction', 'content_policy_violation'])

/** Step 2: Red Team 공격 생성 */
const redTeamStep = createStep({
  id: 'red-team-attack',
  description: 'Red Team generates attack input',
  inputSchema: z.object({
    benignInput: z.string(),
    round: z.number(),
    /** 지정 시 해당 전략으로만 공격. 없으면 LLM이 자유 선택 */
    attackStrategy: attackTypeSchema.optional(),
  }),
  outputSchema: z.object({
    attackInput: z.string(),
    attackType: z.string(),
    benignInput: z.string(),
    round: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { attackInput, attackType } = await generateAttack(
      inputData.benignInput,
      inputData.attackStrategy,
    )
    return {
      attackInput,
      attackType,
      benignInput: inputData.benignInput,
      round: inputData.round,
    }
  },
})

/** Step 3: Guardrail 입력 검사 */
const guardInputStep = createStep({
  id: 'guardrail-input',
  description: 'Guardrail checks user input',
  inputSchema: z.object({
    attackInput: z.string(),
    attackType: z.string(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({
    decision: sharedGuardDecision,
    contentToTarget: z.string(),
    notes: z.array(z.string()),
    attackInput: z.string(),
    attackType: z.string(),
    benignInput: z.string(),
    round: z.number(),
  }),
  execute: async ({ inputData }) => {
    const r = await checkInput(inputData.attackInput)
    const contentToTarget =
      r.decision === 'block'
        ? ''
        : r.decision === 'sanitize' && r.sanitizedContent
          ? r.sanitizedContent
          : inputData.attackInput
    return {
      decision: r.decision,
      contentToTarget,
      notes: r.notes,
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
    decision: sharedGuardDecision,
    contentToTarget: z.string(),
    notes: z.array(z.string()),
    attackInput: z.string(),
    attackType: z.string(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({
    targetOutput: z.string(),
    targetExecuted: z.boolean(),
    guardInputDecision: sharedGuardDecision,
    guardInputNotes: z.array(z.string()),
    attackInput: z.string(),
    attackType: z.string(),
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
      targetOutput,
      targetExecuted,
      guardInputDecision: inputData.decision,
      guardInputNotes: inputData.notes,
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
    targetOutput: z.string(),
    targetExecuted: z.boolean(),
    guardInputDecision: sharedGuardDecision,
    guardInputNotes: z.array(z.string()),
    attackInput: z.string(),
    attackType: z.string(),
    benignInput: z.string(),
    round: z.number(),
  }),
  outputSchema: z.object({ round: z.number(), finalOutput: z.string() }),
  execute: async ({ inputData }) => {
    const r = await checkOutput(inputData.targetOutput)
    const finalOutput = r.finalOutput ?? inputData.targetOutput
    const result: RoundResult = {
      round: inputData.round,
      benignInput: inputData.benignInput,
      attackType: inputData.attackType as RoundResult['attackType'],
      attackInput: inputData.attackInput,
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
    /** 사용자 입력 질문 */
    userInput: z.string().optional(),
    /** Red Team 전략 지정. 없으면 LLM이 자유 선택 */
    attackStrategy: z.enum(['prompt_injection', 'data_exfiltration', 'hallucination_induction', 'content_policy_violation']).optional(),
  }),
  outputSchema: z.object({ round: z.number(), finalOutput: z.string() }),
})
  .then(benignStep)
  .then(redTeamStep)
  .then(guardInputStep)
  .then(targetStep)
  .then(guardOutputAndDiscordStep)
  .commit()
