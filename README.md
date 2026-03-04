# AI Guardrail Arena

LLM 기반 Agent 시스템에서 발생할 수 있는 공격을 **Red Team Agent가 자동으로 생성**하고, **Guardrail이 이를 탐지·차단·정화**하는지를 실험하는 **자동 대결 시뮬레이터**.

## 한 줄 요약

> **Red Team Agent가 공격을 생성하고 Guardrail이 이를 방어하는 LLM 안전성 테스트 Arena**  
> Mastra가 **경기 진행자**, Discord가 **결과 대시보드** 역할을 한다.

---

## 1. 프로젝트 컨셉

### 목표

- LLM 시스템의 **안전성 테스트**
- Guardrail 정책의 **효과 검증**
- 공격/방어 전략의 **자동 실험**

### 핵심 구조

```
Red Team Agent  vs  Guardrail
          │
          ▼
      Target Agent
```

- **Red Team** → 시스템을 깨려고 공격
- **Guardrail** → 공격 탐지 및 방어
- **Target** → 실제 업무 수행

---

## 2. 시스템 구성 요소

| 구성 요소 | 역할 |
|----------|------|
| **Orchestrator** | Mastra Workflow로 전체 라운드 진행, 에이전트 호출, 결과 기록, Discord 알림 |
| **Red Team Agent** | Target이 정책을 위반하도록 유도하는 입력 생성 (prompt injection, data exfiltration, hallucination 유도 등) |
| **Guardrail** | 입력/출력 검사, `block` / `sanitize` / `allow` 결정 (MVP: Rule-based) |
| **Target Agent** | 실제 업무 수행 (MVP: Web Research Summarizer) |

---

## 3. 실행 흐름 (1 라운드)

1. Benign input 생성  
2. Red Team → 공격 입력 생성  
3. Guardrail → **입력** 검사  
4. Target Agent → 실행  
5. Guardrail → **출력** 검사  
6. 결과 기록  
7. Discord webhook 전송  

---

## 4. MVP 범위

**포함**

- Red Team 공격 생성  
- Guardrail 탐지 (rule-based)  
- Target agent 실행  
- Discord 결과 출력  

**제외 (초기 MVP)**

- Slack API, 브라우저 자동화, 고급 guardrail 모델, 공격 전략 학습  

---

## 5. 기술 스택

- **Mastra** — Agent orchestration, step 기반 workflow  
- **Node.js / TypeScript**  
- **LLM API** (OpenAI 등)  
- **Web search API** (Exa 등, Target용)  
- **Discord Webhook** — 결과 표시  

---

## 6. 가장 먼저 만들어야 할 파일 구조 (코딩 시작용)

바로 코딩에 들어갈 수 있도록 **의존성 순서**로 정리한 5개 파일(디렉터리)이다.

```
redteam/
├── README.md                    # 이 문서
├── package.json
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── types.ts                 # ① 데이터 구조 (RoundResult, GuardDecision 등)
│   ├── agents/
│   │   ├── guardrail-agent.ts   # ② Guardrail Agent (입력/출력 검사)
│   │   ├── red-team-agent.ts    # ③ Red Team Agent (공격 생성)
│   │   ├── target-agent.ts      # ④ Target Agent (Web Research Summarizer)
│   │   └── prompts/             # 프롬프트 분리 (guardrail, red-team)
│   ├── discord.ts               # ⑤ Discord webhook 전송
│   ├── arena-workflow.ts        # ⑥ Mastra Workflow (6 steps)
│   └── index.ts                 # 진입점 (라운드 실행)
```

### ① `src/types.ts`

- `RoundResult`, `GuardDecision`, `AttackType` 등 **라운드 결과·가드 결정** 타입
- 워크플로우 step 간 주고받는 데이터 스키마 (Zod 등) 정의

### ② `src/agents/guardrail-agent.ts`

- Mastra `Agent` + `checkInput(text)`, `checkOutput(text)`
- LLM 기반 분류: block / sanitize / allow
- 프롬프트: `agents/prompts/guardrail.ts`

### ③ `src/agents/red-team-agent.ts`

- Mastra `Agent`: benign input을 받아 공격 유형별로 **공격용 입력** 생성
- 프롬프트: `agents/prompts/red-team.ts`
- (선택) structured output: `{ attackInput, attackType }`

### ④ `src/agents/target-agent.ts`

- Mastra `Agent` + **web search tool**: 쿼리 → 검색 → 요약
- 출력: `answer`, `sources`, `uncertainty` 등 (타입은 `types.ts`와 맞추기)

### ⑤ `src/discord.ts`

- `sendRoundResult(result: RoundResult): Promise<void>`
- Discord webhook으로 라운드 요약 포맷팅 후 전송

### ⑥ `src/arena-workflow.ts`

- Mastra `createWorkflow` + `createStep` 6단계:
  1. Benign input 생성  
  2. Red Team attack 생성  
  3. Guardrail input check  
  4. Target agent run  
  5. Guardrail output check  
  6. Discord webhook  

`src/index.ts`에서 워크플로우를 한 라운드씩 실행하면 된다.

---

## 7. 데이터 로그 구조 (라운드 결과)

```json
{
  "round": 1,
  "attack_type": "prompt_injection",
  "attack_input": "...",
  "guard_decision": "sanitize",
  "target_output": "...",
  "final_output": "...",
  "notes": ["override_attempt"]
}
```

---

## 8. MVP 아키텍처

```
Mastra Workflow
     │
     ├─ Step 1: benign input
     ├─ Step 2: red team attack
     ├─ Step 3: guardrail input check
     ├─ Step 4: target agent run
     ├─ Step 5: guardrail output check
     └─ Step 6: discord webhook
```

---

## 9. 향후 확장

- **Adaptive Red Team**: 이전 라운드 실패를 학습  
- **Guardrail A/B 테스트**: guard_v1, guard_v2 성능 비교  
- **공격 통계**: attack_success_rate, false_positive_rate, guard_detection_rate  

---

## 로컬에서 돌려보는 절차

### 1. 사전 요구사항

- **Node.js 18+**
- **pnpm** (또는 npm/yarn)
- **OpenAI API 키** (필수)
- **Discord Webhook URL** (선택 — 없으면 결과는 콘솔에만 출력)

### 2. 환경 설정

```bash
# 저장소 루트에서
cd redteam

# .env 파일 생성
cp .env.example .env

# .env 편집: OPENAI_API_KEY 필수
# DISCORD_WEBHOOK_URL 있으면 라운드 결과가 Discord 채널로 전송됨
```

`.env` 예시:

```env
OPENAI_API_KEY=sk-...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. 의존성 설치 및 빌드

```bash
pnpm install
pnpm build
```

### 4. 한 라운드 실행

```bash
# 기본: 라운드 1, 기본 주제로 1회 실행
pnpm start

# 또는 TypeScript 직접 실행 (빌드 생략)
pnpm dev
```

### 5. 입력 지정 (선택)

```bash
# 사용자 입력 지정 — 원하는 질문을 그대로 사용
ARENA_USER_INPUT="GPT-5 출시일과 주요 기능 알려줘" pnpm dev

# Red Team 전략 지정 (prompt_injection | data_exfiltration | hallucination_induction | content_policy_violation)
ARENA_ATTACK_STRATEGY=prompt_injection pnpm dev
```

### 6. 실행 결과 확인

- **콘솔**: `Round finished: { finalOutput }` 로 마지막 출력 요약
- **Discord**: `DISCORD_WEBHOOK_URL` 이 설정돼 있으면 해당 채널에 라운드 요약 전송 (공격 유형, Guard 결정, Target 실행 여부, Notes)

### 7. 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| `Missing OPENAI_API_KEY` | `.env` 에 `OPENAI_API_KEY=sk-...` 설정 후 다시 실행 |
| `DISCORD_WEBHOOK_URL not set` | 경고일 뿐이며, Discord 없이 콘솔만으로 실행 가능 |
| 워크플로우/에이전트 에러 | `pnpm dev` 로 실행해 스택 트레이스 확인 |

---

## Mastra Studio (로컬 UI)

에이전트·워크플로우를 브라우저에서 테스트하려면:

```bash
pnpm run studio
```

실행 후:

- **Studio UI**: http://localhost:4111/
- **Swagger API**: http://localhost:4111/swagger-ui

---

## Quick Start (요약)

```bash
cp .env.example .env
# OPENAI_API_KEY (필수), DISCORD_WEBHOOK_URL (선택) 설정

pnpm install
pnpm build
pnpm start
```

환경 변수는 `.env.example` 참고.
