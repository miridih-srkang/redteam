# AI Guardrail Arena

LLM 기반 Agent 시스템의 안전성을 테스트하는 **공격-방어 시뮬레이터**.
**직접 공격 메시지를 입력**하거나, **Red Team Agent가 자동으로 공격을 생성**하여 Guardrail Agent가 이를 탐지·차단·정화하는지를 실험한다.

## 한 줄 요약

> Mastra가 **경기 진행자**, Discord가 **결과 대시보드** 역할을 하는 LLM 안전성 테스트 Arena

---

## 1. 프로젝트 컨셉

### 목표

- LLM 시스템의 **안전성 테스트**
- Guardrail 정책의 **효과 검증**
- 공격/방어 전략의 **자동 실험**

### 두 가지 모드

| 모드 | 설명 |
|------|------|
| **🎯 Direct (직접 공격)** | 사용자가 공격 메시지를 직접 입력. 가드레일이 감지하면 **공격 유형까지 분석**하여 리포트 |
| **🤖 Auto (자동 생성)** | 일반 메시지를 입력하면 Red Team Agent가 공격 메시지로 변환 후 가드레일과 대결 |

---

## 2. 시스템 구성 요소

| 구성 요소 | 역할 | 파일 |
|----------|------|------|
| **Red Team Agent** | Target이 정책을 위반하도록 유도하는 입력 생성 (Auto 모드) | `agents/red-team-agent.ts` |
| **Guardrail Agent** | LLM 기반 입력/출력 검사, `block` / `sanitize` / `allow` 결정 | `agents/guardrail-agent.ts` |
| **Target Agent** | 일반 지식 기반 요약 (Web Research Summarizer) | `agents/target-agent.ts` |
| **Arena Workflow** | Mastra Workflow로 전체 라운드 진행, 모드 분기, 결과 전송 | `arena-workflow.ts` |

---

## 3. 실행 흐름

### 🎯 Direct 모드 (직접 공격)

```
사용자 공격 메시지 입력
        │
        ▼
┌─────────────────────────┐
│  Guardrail 입력 검사     │
│  + 공격 유형 분석        │◄── block/sanitize/allow 판정
│    (감지 시 유형 분류)    │    + 공격 유형·confidence·설명
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │ block?      │
     ├─ Yes ──► 차단 (Target 미실행)
     └─ No ───► Target Agent 실행
                    │
                    ▼
            Guardrail 출력 검사
                    │
                    ▼
            최종 결과 + Discord 전송
```

### 🤖 Auto 모드 (자동 생성)

```
사용자 일반 메시지 입력
        │
        ▼
┌─────────────────────────┐
│  Red Team Agent          │
│  공격 메시지 + 유형 생성  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Guardrail 입력 검사     │◄── block/sanitize/allow 판정
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     │ block?      │
     ├─ Yes ──► 차단 (Target 미실행)
     └─ No ───► Target Agent 실행
                    │
                    ▼
            Guardrail 출력 검사
                    │
                    ▼
            최종 결과 + Discord 전송
```

---

## 4. 공격 유형 (AttackType)

| 유형 | 설명 |
|------|------|
| `prompt_injection` | 지시 무시, 역할 부여, 구분자 조작 등 |
| `data_exfiltration` | API 키, 비밀번호, 자격증명 요청 |
| `hallucination_induction` | 가짜 정보·과장된 수치·상상한 내용을 답변하도록 유도 |
| `content_policy_violation` | 욕설·혐오·유해 콘텐츠 유도 |

Direct 모드에서 가드레일이 공격을 감지하면 위 유형 중 해당되는 것을 **confidence(high/medium/low)와 한국어 설명**과 함께 분류한다. 여러 유형이 동시에 감지될 수 있다.

---

## 5. 기술 스택

- **Mastra** — Agent orchestration, step 기반 workflow
- **Node.js 18+** / **TypeScript**
- **OpenAI API** (gpt-5.2, gpt-4o-mini)
- **Discord Webhook** — 결과 표시

---

## 6. 프로젝트 구조

```
redteam/
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── types.ts                 # ArenaMode, RoundResult, GuardDecision, AttackType 등
│   ├── agents/
│   │   ├── guardrail-agent.ts   # Guardrail Agent (입력/출력 검사 + 공격 유형 분석)
│   │   ├── red-team-agent.ts    # Red Team Agent (공격 생성)
│   │   ├── target-agent.ts      # Target Agent (Summarizer)
│   │   └── prompts/
│   │       ├── guardrail.ts     # Guardrail 시스템 프롬프트
│   │       └── red-team.ts      # Red Team 지침 + 전략별 힌트
│   ├── mastra/
│   │   └── index.ts             # Mastra 인스턴스 (Studio용)
│   ├── discord.ts               # Discord webhook 전송 (모드별 포맷)
│   ├── arena-workflow.ts        # Mastra Workflow (모드 분기 포함)
│   └── index.ts                 # 대화형 CLI 진입점
```

---

## 7. 로컬에서 돌려보기

### 1. 사전 요구사항

- **Node.js 18+**
- **pnpm** (또는 npm/yarn)
- **OpenAI API 키** (필수)
- **Discord Webhook URL** (선택 — 없으면 결과는 콘솔에만 출력)

### 2. 환경 설정

```bash
cd redteam
cp .env.example .env
# .env 편집: OPENAI_API_KEY 필수
```

`.env` 예시:

```env
OPENAI_API_KEY=sk-...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. 의존성 설치 및 실행

```bash
pnpm install
pnpm dev
```

실행하면 대화형 CLI가 시작된다:

```
=== AI Guardrail Arena ===

모드를 선택하세요:
  1) 🎯 직접 공격 — 공격 메시지를 직접 입력
  2) 🤖 자동 생성 — 일반 메시지를 Red Team이 공격으로 변환

선택 (1 또는 2): _
```

### 4. Mastra Studio (브라우저 UI)

```bash
pnpm run studio
```

- **Studio**: http://localhost:4111
- **API**: http://localhost:4111/api

워크플로우 실행 내역과 각 스텝의 입출력을 시각적으로 확인할 수 있다.

---

## 8. Quick Start

```bash
cp .env.example .env
# OPENAI_API_KEY (필수), DISCORD_WEBHOOK_URL (선택) 설정

pnpm install
pnpm dev
```

---

## 9. 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| `Missing OPENAI_API_KEY` | `.env`에 `OPENAI_API_KEY=sk-...` 설정 |
| `DISCORD_WEBHOOK_URL not set` | 경고일 뿐, Discord 없이 콘솔만으로 실행 가능 |
| `EADDRINUSE: port 4111` | 이전 Studio 프로세스가 포트 점유. `lsof -i :4111` 후 `kill <PID>` |
| `SyntaxError: Unexpected end of input` | `rm -rf .mastra/output && pnpm run studio` 로 캐시 삭제 후 재실행 |
