import 'dotenv/config'
import { arenaWorkflow } from './arena-workflow.js'

function ensureEnv(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('Missing OPENAI_API_KEY. Set it in .env or export OPENAI_API_KEY=sk-...')
    process.exit(1)
  }
  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.warn('DISCORD_WEBHOOK_URL not set — round result will only be printed to console.')
  }
}

async function main() {
  ensureEnv()

  const userInput = process.env.ARENA_USER_INPUT?.trim() || undefined
  const rawStrategy = process.env.ARENA_ATTACK_STRATEGY?.trim()
  const attackStrategy =
    rawStrategy === 'prompt_injection' ||
    rawStrategy === 'data_exfiltration' ||
    rawStrategy === 'hallucination_induction' ||
    rawStrategy === 'content_policy_violation'
      ? rawStrategy
      : undefined

  console.log('Starting Arena...')
  const run = await arenaWorkflow.createRun()
  const result = await run.start({
    inputData: { userInput, attackStrategy },
  })
  if (result.status === 'success') {
    const out = (result as { result: { round: number; finalOutput: string } }).result
    console.log('Round finished:', out)
  } else {
    console.log('Round result:', result)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
