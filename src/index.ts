import 'dotenv/config'
import * as readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { arenaWorkflow } from './arena-workflow.js'
import type { ArenaMode, AttackType } from './types.js'

function ensureEnv(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('Missing OPENAI_API_KEY. Set it in .env or export OPENAI_API_KEY=sk-...')
    process.exit(1)
  }
  if (!process.env.DISCORD_WEBHOOK_URL?.trim()) {
    console.warn('DISCORD_WEBHOOK_URL not set — round result will only be printed to console.\n')
  }
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question)
  return answer.trim()
}

async function selectMode(rl: readline.Interface): Promise<ArenaMode> {
  console.log('\n=== AI Guardrail Arena ===\n')
  console.log('모드를 선택하세요:')
  console.log('  1) 🎯 직접 공격 — 공격 메시지를 직접 입력')
  console.log('  2) 🤖 자동 생성 — 일반 메시지를 Red Team이 공격으로 변환')
  const choice = await prompt(rl, '\n선택 (1 또는 2): ')
  if (choice === '1' || choice === 'direct') return 'direct'
  return 'auto'
}

async function selectStrategy(rl: readline.Interface): Promise<AttackType | undefined> {
  console.log('\n공격 전략을 선택하세요 (선택사항):')
  console.log('  1) prompt_injection — 프롬프트 인젝션')
  console.log('  2) data_exfiltration — 데이터 탈취')
  console.log('  3) hallucination_induction — 환각 유도')
  console.log('  4) content_policy_violation — 콘텐츠 정책 위반')
  console.log('  5) 자동 선택 (LLM이 판단)')
  const choice = await prompt(rl, '\n선택 (1-5, 기본 5): ')
  const map: Record<string, AttackType> = {
    '1': 'prompt_injection',
    '2': 'data_exfiltration',
    '3': 'hallucination_induction',
    '4': 'content_policy_violation',
  }
  return map[choice] ?? undefined
}

async function main() {
  ensureEnv()

  const rl = readline.createInterface({ input: stdin, output: stdout })

  try {
    while (true) {
      const mode = await selectMode(rl)

      let userInput: string
      let attackStrategy: AttackType | undefined

      if (mode === 'direct') {
        console.log('\n🎯 직접 공격 모드')
        userInput = await prompt(rl, '공격 메시지를 입력하세요: ')
      } else {
        console.log('\n🤖 자동 생성 모드')
        userInput = await prompt(rl, '일반 메시지를 입력하세요 (빈 입력 시 기본값 사용): ')
        attackStrategy = await selectStrategy(rl)
      }

      if (!userInput) {
        userInput = 'OpenAI 최신 모델 발표에 대해 요약해줘'
        console.log(`\n기본 입력 사용: "${userInput}"`)
      }

      console.log('\n⏳ Arena 실행 중...\n')

      const run = await arenaWorkflow.createRun()
      const result = await run.start({
        inputData: { mode, userInput, attackStrategy },
      })

      if (result.status === 'success') {
        const out = (result as { result: { round: number; finalOutput: string } }).result
        console.log('✅ Round 완료')
        console.log(`   최종 출력: ${out.finalOutput || '(차단됨)'}`)
      } else {
        console.log('Round result:', result)
      }

      const again = await prompt(rl, '\n다시 실행하시겠습니까? (y/n): ')
      if (again.toLowerCase() !== 'y' && again.toLowerCase() !== 'yes') {
        console.log('\n👋 Arena를 종료합니다.')
        break
      }
    }
  } finally {
    rl.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
