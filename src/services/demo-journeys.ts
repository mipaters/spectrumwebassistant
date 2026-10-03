export type DemoJourneyId = 'care' | 'offers' | 'roaming' | 'technical' | 'multimodal'

export type DemoJourneyStep = {
  prompt: string
  options: string[]
  accepts?: RegExp
}

export type DemoJourneyDefinition = {
  title: string
  opening: string
  steps: DemoJourneyStep[]
  completion: (answers: string[]) => string
}

export type DemoJourneyState = {
  id: DemoJourneyId
  title: string
  stage: number
  answers: string[]
  complete: boolean
  completionMessage: string | null
}

const journeys: Record<DemoJourneyId, DemoJourneyDefinition> = {
  care: {
    title: 'AI-Powered Customer Care',
    opening: 'I can help you make sense of your bill. Let’s narrow it down together.',
    steps: [
      { prompt: 'What would you like help with?', options: ['A charge I don’t recognize', 'My monthly plan price', 'A payment or credit', 'Roaming charges'] },
      { prompt: 'Where do you see it?', options: ['This month’s bill', 'A previous bill', 'I’m not sure'] },
      { prompt: 'What would you like to do next?', options: ['Explain the charge', 'Find ways to lower my bill', 'Get help from a billing specialist'] },
    ],
    completion: (answers) => `I’ve noted ${answers[0]?.toLowerCase() ?? 'your billing question'} on ${answers[1]?.toLowerCase() ?? 'your bill'}. ${answers[2] === 'Find ways to lower my bill' ? 'We can review plan and bundle options together.' : answers[2] === 'Get help from a billing specialist' ? 'A billing specialist can review account-specific details after securely verifying your account.' : 'I can explain common charges, but only a verified Spectrum account specialist can confirm a specific account charge.'}`,
  },
  offers: {
    title: 'Personalized Offer Recommendations',
    opening: 'I’ll help narrow down offers based on what matters to you.',
    steps: [
      { prompt: 'Which service are you interested in?', options: ['Mobile plan', 'New phone', 'Internet', 'TV & streaming', 'Home security'] },
      { prompt: 'What matters most in an offer?', options: ['Lowest monthly cost', 'More data or speed', 'A new device', 'Bundle and save'] },
      { prompt: 'How would you like to continue?', options: ['See matching options', 'Compare plans and devices', 'Talk it through with Chris'] },
    ],
    completion: (answers) => `I’ve tailored this demo to ${answers[0]?.toLowerCase() ?? 'your service'} with a focus on ${answers[1]?.toLowerCase() ?? 'your priorities'}. ${answers[2] === 'Compare plans and devices' ? 'Use Mobile or Phones & Devices in the navigation to compare the catalog.' : 'I’ve highlighted the relevant Spectrum options for your next step.'} Offers shown in this demo are illustrative, not live or account-verified.`,
  },
  roaming: {
    title: 'Roaming Advisor',
    opening: 'Let’s get your trip details so I can help you plan for roaming.',
    steps: [
      { prompt: 'Where are you travelling?', options: ['Mexico', 'Canada', 'International', 'I’m staying in the U.S.'], accepts: /[a-z]{3,}/i },
      { prompt: 'How long will you be away?', options: ['A day or two', 'About a week', 'Two weeks or more', 'Not sure yet'], accepts: /\b(day|days|night|nights|weekend|week|weeks|month|months|year|couple|few|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|not sure|unsure|don'?t know|dont know|long|short|while)\b/i },
      { prompt: 'How do you expect to use your phone?', options: ['Calls and messages', 'Maps and browsing', 'Lots of data and streaming', 'Mostly WiFi'], accepts: /\b(calls?|calling|text|texts|texting|messages?|messaging|maps?|navigation|browsing|browse|web|data|stream|streaming|video|videos|wifi|wi-fi|email|emails|social|music|photos?|work|internet|everything|mostly|not sure|unsure|don'?t know|dont know)\b/i },
    ],
    completion: (answers) => answers[0] === 'I’m staying in the U.S.'
      ? 'Since you’re staying in the U.S., roaming likely won’t be needed for this trip. Check your plan details for any applicable use outside your local coverage.'
      : `For ${answers[0]?.toLowerCase() ?? 'your destination'} for ${answers[1]?.toLowerCase() ?? 'your trip'}, plan for coverage that matches ${answers[2]?.toLowerCase() ?? 'your phone use'}. Roaming availability and daily rates depend on destination and plan; check current Spectrum terms before travelling. I can’t activate roaming or verify your account in this demo.`,
  },
  technical: {
    title: 'Technical Support Assistant',
    opening: 'I’ll guide you through a quick, step-by-step service check.',
    steps: [
      { prompt: 'Which service needs attention?', options: ['Home Internet / WiFi', 'TV or streaming', 'A connected device', 'Smart home'] },
      { prompt: 'Which symptom best describes it?', options: ['Not working at all', 'Slow or buffering', 'Drops or disconnects', 'Only one room or device'] },
      { prompt: 'Try this first: restart the affected device or gateway, then test again. What happened?', options: ['That fixed it', 'It improved, but still has issues', 'No change'] },
    ],
    completion: (answers) => answers[2] === 'That fixed it'
      ? `Glad it’s working again. We recorded ${answers[0]?.toLowerCase() ?? 'your service'} with the symptom “${answers[1]?.toLowerCase() ?? 'reported issue'}” and your successful restart step.`
      : `We recorded ${answers[0]?.toLowerCase() ?? 'your service'} with the symptom “${answers[1]?.toLowerCase() ?? 'reported issue'}.” Since the restart ${answers[2] === 'It improved, but still has issues' ? 'only partly helped' : 'did not help'}, next try checking cables and testing near the gateway. If it continues, contact Spectrum Support for account and line diagnostics. This demo cannot test the live network.`,
  },
  multimodal: {
    title: 'Multimodal Care Experience',
    opening: 'Let’s preview how a future multimodal support session could work. For now, these are guided demo choices only.',
    steps: [
      { prompt: 'What would you share with a future support assistant?', options: ['A modem photo', 'A screenshot of an error', 'A short video of the issue', 'A voice description'] },
      { prompt: 'What should the assistant help identify?', options: ['Device or cable status', 'The error message', 'What happens before it disconnects', 'My spoken description'] },
      { prompt: 'How should support continue?', options: ['Show step-by-step instructions', 'Save a summary for a specialist', 'Start a live support conversation'] },
    ],
    completion: (answers) => `Demo scenario complete: you chose to share ${answers[0]?.toLowerCase() ?? 'a support detail'}, identify ${answers[1]?.toLowerCase() ?? 'the issue'}, and ${answers[2]?.toLowerCase() ?? 'continue support'}. Uploads, image/video analysis, voice and live sessions are future capabilities and are not enabled in this prototype.`,
  },
}

export function startDemoJourney(id: DemoJourneyId): DemoJourneyState {
  return { id, title: journeys[id].title, stage: 0, answers: [], complete: false, completionMessage: null }
}

export function currentDemoJourneyStep(state: DemoJourneyState): DemoJourneyStep | null {
  return journeys[state.id].steps[state.stage] ?? null
}

export function demoJourneyOpening(state: DemoJourneyState): string {
  return journeys[state.id].opening
}

export function answerDemoJourney(state: DemoJourneyState, answer: string): DemoJourneyState {
  if (state.complete) return state
  const answers = [...state.answers, answer]
  const definition = journeys[state.id]
  const stage = state.stage + 1
  if (stage >= definition.steps.length) {
    return { ...state, stage, answers, complete: true, completionMessage: definition.completion(answers) }
  }
  return { ...state, stage, answers }
}

const fillerOnly = /^\s*(?:(?:um+|uh+|hmm+|mm+|ah+|oh+|er+|huh)[\s.,!?]*)+$/i

export function isDemoAnswerAcceptable(state: DemoJourneyState, answer: string): boolean {
  const step = currentDemoJourneyStep(state)
  if (!step) return true
  const text = answer.trim()
  if (!text || fillerOnly.test(text)) return false
  if (step.options.some((option) => option.toLowerCase() === text.toLowerCase())) return true
  return step.accepts ? step.accepts.test(text) : true
}

export function demoJourneyReprompt(state: DemoJourneyState): string {
  return `I didn’t catch that. ${currentDemoJourneyStep(state)?.prompt ?? 'Could you say that again?'}`
}
