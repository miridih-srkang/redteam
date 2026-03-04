import { Mastra } from '@mastra/core'
import { guardrailAgent } from '../agents/guardrail-agent.js'
import { redTeamAgent } from '../agents/red-team-agent.js'
import { targetAgent } from '../agents/target-agent.js'
import { arenaWorkflow } from '../arena-workflow.js'

export const mastra = new Mastra({
  agents: { guardrailAgent, redTeamAgent, targetAgent },
  workflows: { arenaWorkflow },
})
