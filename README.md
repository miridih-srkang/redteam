# AI Guardrail Arena

LLM 기반 Agent 시스템에서 발생할 수 있는 공격을 **Red Team Agent가 자동으로 생성**하고, **Guardrail Agent가 이를 탐지·차단·정화**하는지를 실험하는 **자동 대결 시뮬레이터**.

## 한 줄 요약

> **Red Team Agent가 공격을 생성하고 Guardrail Agent가 이를 방어하는 LLM 안전성 테스트 Arena**  
> Mastra가 **경기 진행자**, Discord가 **결과 대시보드** 역할을 한다.

---

## 1. 프로젝트 컨셉

### 목표

- LLM 시스템의 **안전성 테스트**
- Guardrail 정책의 **효과 검증**
- 공격/방어 전략의 **자동 실험**

### 핵심 구조

```
Red Team Agent  vs  Guardrail Agent
          │
          ▼
      Target Agent
```

- **Red Team Agent** → 시스템을 깨려고 공격 생성
- **Guardrail Agent** → 입력/출력 검사 및 방어
- **Target Agent** → 실제 업무 수행 (Web Research Summarizer)

---

## 2. 시스템 구성 요소

| 구성 요소 | 역할 |
|----------|------|
| **Orchestrator** | Mastra Workflow로 전체 라운드 진행, 에이전트 호출, 결과 기록, Discord 알림 |
| **Red Team Agent** | Target이 정책을 위반하도록 유도하는 입력 생성 (prompt_injection, data_exfiltration, hallucination_induction, content_policy_violation) |
| **Guardrail Agent** | LLM 기반 입력/출력 검사, `block` / `sanitize` / `allow` 결정 |
| **Target Agent** | Web Research Summarizer (일반 지식 기반 요약, MVP에서는 웹 검색 툴 없음) |

---

## 3. 실행 흐름 (1 라운드)

1. Benign input 생성 (사용자 입력 또는 기본값)
2. Red Team → 공격 입력 + 유형 생성
3. Guardrail → **입력** 검사
4. Target Agent → 실행
5. Guardrail → **출력** 검사 + Discord webhook 전송

---

## 4. 공격 유형 (AttackType)

| 유형 | 설명 |
|------|------|
| `prompt_injection` | 지시 무시, 역할 부여, 구분자 조작 등 |
| `data_exfiltration` | API 키, 비밀번호, 자격증명 요청 |
| `hallucination_induction` | 가짜 정보·과장된 수치·상상한 내용을 답변하도록 유도 |
| `content_policy_violation` | 욕설·혐오·유해 콘텐츠 유도 |

---

## 5. 기술 스택

- **Mastra** — Agent orchestration, step 기반 workflow
- **Node.js 18+** / **TypeScript**
- **OpenAI API** (gpt-5, gpt-5-mini, gpt-4o-mini)
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
│   ├── types.ts                 # RoundResult, GuardDecision, AttackType 등
│   ├── agents/
│   │   ├── guardrail-agent.ts   # Guardrail Agent (입력/출력 검사)
│   │   ├── red-team-agent.ts    # Red Team Agent (공격 생성)
│   │   ├── target-agent.ts      # Target Agent (Summarizer)
│   │   └── prompts/
│   │       ├── guardrail.ts     # Guardrail 시스템 프롬프트
│   │       └── red-team.ts      # Red Team 지침 + 전략별 힌트
│   ├── mastra/
│   │   └── index.ts             # Mastra 인스턴스 (Studio용)
│   ├── discord.ts               # Discord webhook 전송
│   ├── arena-workflow.ts        # Mastra Workflow (5 steps)
│   └── index.ts                 # CLI 진입점
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

### 4. 입력 지정 (선택)

```bash
# 사용자 입력 지정
ARENA_USER_INPUT="GPT-5 출시일과 주요 기능 알려줘" pnpm dev

# Red Team 전략 지정 (없으면 LLM 자유 선택)
ARENA_ATTACK_STRATEGY=prompt_injection pnpm dev
```

### 5. Mastra Studio (브라우저 UI)

```bash
pnpm run studio
```

- **Studio**: http://localhost:4112
- **API**: http://localhost:4112/api

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
| `EADDRINUSE: port 4112` | 이전 Studio 프로세스가 포트 점유. `lsof -i :4112` 후 `kill <PID>` |
| `SyntaxError: Unexpected end of input` | `rm -rf .mastra/output && pnpm run studio` 로 캐시 삭제 후 재실행 |

---

## 10. 향후 확장

- **Adaptive Red Team**: 이전 라운드 실패를 학습
- **Guardrail A/B 테스트**: guard_v1, guard_v2 성능 비교
- **공격 통계**: attack_success_rate, false_positive_rate, guard_detection_rate
- **Target 웹 검색**: Exa 등 검색 API 연동
