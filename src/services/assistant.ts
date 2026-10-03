import { additionalLinePrices, mobilePlans } from './offers'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type BudgetPreference = 'lower-cost' | 'balanced' | 'flexible'

export type JourneyStage = 'dataAndLines' | 'mobileProvider' | 'device' | 'phoneUsage' | 'travel' | 'homeServices' | 'budget'

export type CustomerProfile = {
  lineCount: number | null
  dataUsage: number | null
  currentProvider: string | null
  deviceAge: string | null
  deviceOwnership: string | null
  phoneUseCases: string[] | null
  travelFrequency: string | null
  travelDestinations: string | null
  homeInternetCustomer: boolean | null
  homeInternetProvider: string | null
  homeTvProvider: string | null
  interestedInBundling: boolean | null
  budgetPreference: BudgetPreference | null
  journeyAnswers: Partial<Record<JourneyStage, string>>
}

export type PlanRecommendation = {
  planName: string
  monthlyEstimate: number
  lineCount: number
  reason: string
  bundleName: string
  budgetPreference: BudgetPreference | null
}

export type AssistantReply = {
  reply: string
  profile: CustomerProfile
  journeyStarted: boolean
  completedQuestions: JourneyStage[]
  currentStage: JourneyStage | null
  recommendation?: PlanRecommendation
}

export const emptyCustomerProfile: CustomerProfile = {
  lineCount: null,
  dataUsage: null,
  currentProvider: null,
  deviceAge: null,
  deviceOwnership: null,
  phoneUseCases: null,
  travelFrequency: null,
  travelDestinations: null,
  homeInternetCustomer: null,
  homeInternetProvider: null,
  homeTvProvider: null,
  interestedInBundling: null,
  budgetPreference: null,
  journeyAnswers: {},
}

const planIntent = /\b(plan|mobile|wireless|data plan|recommend(?:ation)?)\b/i

export function isPlanJourneyRequest(message: string): boolean {
  return planIntent.test(message) && /\b(new|need|looking|want|recommend|help|find|switch|change)\b/i.test(message)
}

const journeyOrder: JourneyStage[] = ['dataAndLines', 'mobileProvider', 'device', 'phoneUsage', 'travel', 'homeServices', 'budget']
const journeyQuestions: Record<JourneyStage, string> = {
  dataAndLines: 'How much mobile data do you typically use each month, and how many lines do you need? For example, “50 GB and one line.”',
  mobileProvider: 'Who is your current mobile provider? You can also say “new customer” or “not sure.”',
  device: 'Are you bringing your current phone or looking to upgrade? About how old is your device?',
  phoneUsage: 'What do you mainly use your phone for? For example, streaming video, gaming, email, web browsing, or video calls and meetings.',
  travel: 'How often do you travel outside the U.S., and where do you usually go? “Rarely” or “not sure” is fine.',
  homeServices: 'Who provides your home Internet and TV, and are you open to switching or bundling services?',
  budget: 'What matters most for your monthly budget: the lowest price, a balance of price and benefits, or the most included?',
}

const wordNumbers: Record<string, number> = {
  one: 1, a: 1, an: 1, single: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

export async function sendMessage(
  messages: ChatMessage[],
  currentProfile: CustomerProfile,
  journeyStarted: boolean,
  completedQuestions: JourneyStage[],
  currentStage: JourneyStage | null,
): Promise<AssistantReply> {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? ''
  const started = journeyStarted || isPlanJourneyRequest(latestUserMessage)
  const activeJourney = started
  const correctionStage = journeyStarted && currentStage === null ? correctedStage(latestUserMessage) : null
  const answerStage = currentStage ?? correctionStage
  const profile = updateCustomerProfile(currentProfile, latestUserMessage, answerStage)

  if (activeJourney) {
    const completed = new Set(completedQuestions)
    if (journeyStarted && currentStage) {
      profile.journeyAnswers = { ...profile.journeyAnswers, [currentStage]: latestUserMessage }
      completeStageWithFallback(profile, currentStage)
      completed.add(currentStage)
    } else if (correctionStage) {
      profile.journeyAnswers = { ...profile.journeyAnswers, [correctionStage]: latestUserMessage }
      completeStageWithFallback(profile, correctionStage)
      completed.add(correctionStage)
    }
    for (const stage of journeyOrder) {
      if (stageIsAnswered(stage, profile)) completed.add(stage)
    }
    const done = journeyOrder.filter((stage) => completed.has(stage))
    const nextStage = journeyOrder.find((stage) => !completed.has(stage)) ?? null
    console.info(`[Spectra journey] current stage: ${nextStage ?? 'recommendation'}`, { completedQuestions: done })
    if (nextStage) {
      return {
        reply: journeyStarted
          ? `Thanks—I’ve noted ${describeStageValue(currentStage, profile)}. ${questionForStage(nextStage, profile)}`
          : `I can help you find a plan that fits. ${questionForStage(nextStage, profile)}`,
        profile,
        journeyStarted: true,
        completedQuestions: done,
        currentStage: nextStage,
      }
    }
    return {
      reply: 'Thanks—that gives me a clearer picture. Here’s a plan recommendation based on what you shared:',
      profile,
      journeyStarted: true,
      completedQuestions: done,
      currentStage: null,
      recommendation: recommendPlan(profile),
    }
  }

  const reply = await askGpt(messages, profile)
  return { reply, profile, journeyStarted: false, completedQuestions, currentStage }
}

export async function askGpt(messages: ChatMessage[], profile: CustomerProfile): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), profile }),
  })
  const data: { reply?: string; error?: string } | null = response.status === 404 ? null : await response.json().catch(() => null)
  if (!data) {
    console.warn('[Spectra Debug] /api/chat unavailable or not JSON', { status: response.status, contentType: response.headers.get('content-type') })
    throw new Error('Spectra’s service is not reachable right now. Please try again shortly.')
  }
  if (!response.ok) throw new Error(data.error || 'Spectra could not reply just now.')
  if (!data.reply) throw new Error('Spectra sent an empty reply. Please try again.')
  return data.reply
}

function correctedStage(message: string): JourneyStage | null {
  if (!/\b(actually|change|update|correction|i meant|instead)\b/i.test(message)) return null
  if (/\b(data|gb|gigabytes?|lines?)\b/i.test(message)) return 'dataAndLines'
  if (/\b(mobile provider|cell provider|wireless provider|carrier)\b/i.test(message)) return 'mobileProvider'
  if (/\b(stream|gaming|email|brows|video call|meeting)\b/i.test(message)) return 'phoneUsage'
  if (/\b(phone|device|upgrade)\b/i.test(message)) return 'device'
  if (/\b(travel|destination|trip|roam)\b/i.test(message)) return 'travel'
  if (/\b(internet|tv|bundle|home service|switch providers?)\b/i.test(message)) return 'homeServices'
  if (/\b(budget|price|cost|cheapest|affordable)\b/i.test(message)) return 'budget'
  return null
}

function completeStageWithFallback(profile: CustomerProfile, stage: JourneyStage): void {
  switch (stage) {
    case 'dataAndLines':
      profile.dataUsage ??= 60
      profile.lineCount ??= 1
      break
    case 'mobileProvider':
      profile.currentProvider ??= 'Not sure / new customer'
      break
    case 'device':
      profile.deviceOwnership ??= 'Not sure'
      profile.deviceAge ??= 'Not sure'
      break
    case 'phoneUsage':
      profile.phoneUseCases ??= ['Not specified']
      break
    case 'travel':
      profile.travelFrequency ??= 'Not sure'
      profile.travelDestinations ??= 'Not specified'
      break
    case 'homeServices':
      profile.homeInternetProvider ??= 'Not specified'
      profile.homeTvProvider ??= 'Not specified'
      profile.interestedInBundling ??= false
      profile.homeInternetCustomer = /\bspectrum\b/i.test(`${profile.homeInternetProvider} ${profile.homeTvProvider}`)
      break
    case 'budget':
      profile.budgetPreference ??= 'balanced'
      break
  }
}

function stageIsAnswered(stage: JourneyStage, profile: CustomerProfile): boolean {
  switch (stage) {
    case 'dataAndLines': return profile.dataUsage !== null && profile.lineCount !== null
    case 'mobileProvider': return profile.currentProvider !== null
    case 'device': return profile.deviceOwnership !== null && profile.deviceAge !== null
    case 'phoneUsage': return profile.phoneUseCases !== null
    case 'travel': return profile.travelFrequency !== null && profile.travelDestinations !== null
    case 'homeServices': return profile.homeInternetProvider !== null && profile.homeTvProvider !== null && profile.interestedInBundling !== null
    case 'budget': return profile.budgetPreference !== null
  }
}

function questionForStage(stage: JourneyStage, profile: CustomerProfile): string {
  if (stage === 'dataAndLines' && profile.dataUsage !== null) return 'And how many mobile lines do you need?'
  if (stage === 'dataAndLines' && profile.lineCount !== null) return 'And how much mobile data do you typically use each month?'
  if (stage === 'device' && profile.deviceOwnership !== null) return 'About how old is the phone you’ll use?'
  if (stage === 'device' && profile.deviceAge !== null) return 'Are you keeping your current phone or looking to upgrade?'
  if (stage === 'phoneUsage') return journeyQuestions.phoneUsage
  if (stage === 'travel' && profile.travelFrequency !== null) return 'Which countries or destinations do you usually travel to?'
  if (stage === 'travel' && profile.travelDestinations !== null) return 'How often do you travel outside the U.S.?'
  if (stage === 'homeServices' && profile.homeInternetProvider !== null && profile.homeTvProvider !== null) return 'Are you open to switching or bundling your home services with mobile?'
  return journeyQuestions[stage]
}

function describeStageValue(stage: JourneyStage | null, profile: CustomerProfile): string {
  switch (stage) {
    case 'dataAndLines': return `${profile.dataUsage ?? 'your'} GB of monthly data across ${profile.lineCount ?? 1} ${profile.lineCount === 1 ? 'line' : 'lines'}`
    case 'mobileProvider': return profile.currentProvider ?? 'your current provider'
    case 'device': return profile.deviceOwnership ?? 'your device plans'
    case 'phoneUsage': return profile.phoneUseCases?.join(', ') ?? 'your phone activities'
    case 'travel': return `${profile.travelFrequency ?? 'your travel frequency'}${profile.travelDestinations ? ` to ${profile.travelDestinations}` : ''}`
    case 'homeServices': return `your home Internet/TV providers and bundling preference`
    case 'budget': return profile.budgetPreference === 'lower-cost' ? 'your preference for a lower monthly cost'
      : profile.budgetPreference === 'flexible' ? 'your interest in more included benefits'
        : 'your preference for a balance of price and benefits'
    default: return 'the details you shared'
  }
}

function updateCustomerProfile(
  profile: CustomerProfile,
  answer: string,
  requestedStage: JourneyStage | null,
): CustomerProfile {
  const text = answer.toLowerCase()
  const updated = { ...profile }
  const lineMatch = text.match(/\b(\d+|one|a|an|single|two|three|four|five|six|seven|eight|nine|ten)\s*(?:phone\s*)?(?:lines?|phones?|people|users?)\b/i)
  if (lineMatch) updated.lineCount = Math.max(1, Math.min(10, parseCount(lineMatch[1])))
  else if (/\b(just me|only me|myself)\b/.test(text)) updated.lineCount = 1
  else if (requestedStage === 'dataAndLines') {
    const countMatch = text.match(/\b(\d+|one|a|an|single|two|three|four|five|six|seven|eight|nine|ten)\b/)
    if (countMatch) updated.lineCount = Math.max(1, Math.min(10, parseCount(countMatch[1])))
  }

  const explicitDataMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:gb|gigabytes?)\b/)
  const dataMatch = explicitDataMatch ?? text.match(/\b(?:about|around|use|using)\s+(\d+(?:\.\d+)?)\b/)
  if (dataMatch && (explicitDataMatch || /\bdata\b/.test(text) || requestedStage === 'dataAndLines')) {
    updated.dataUsage = Number(dataMatch[1])
  }

  const providerMatch = text.match(/\b(spectrum|xfinity|comcast|at&t|att|verizon|t-mobile|tmobile|cox|optimum|frontier|centurylink|mint\s+mobile|boost|cricket|visible|other provider)\b/)
  if (providerMatch && (requestedStage === 'mobileProvider' || /\b(mobile|cell|wireless)\s+(?:provider|carrier)\b/.test(text))) {
    updated.currentProvider = normalizeProvider(providerMatch[1])
  } else if (requestedStage === 'mobileProvider' && providerMatch) {
    updated.currentProvider = normalizeProvider(providerMatch[1])
  } else if (requestedStage === 'mobileProvider' && /\b(new customer|new to spectrum|not sure|don't know|dont know|no provider)\b/.test(text)) {
    updated.currentProvider = 'Not sure / new customer'
  }

  const deviceAgeMatch = text.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five)\s*(years?|yrs?|months?|mos?)\s*(?:old)?\b/)
  if (deviceAgeMatch && (/\b(phone|device|old|upgrade|years?|yrs?|months?|mos?)\b/.test(text) || requestedStage === 'device')) {
    const age = parseCount(deviceAgeMatch[1])
    const unit = deviceAgeMatch[2].startsWith('y') ? 'year' : 'month'
    updated.deviceAge = `${age} ${unit}${age === 1 ? '' : 's'}`
  }
  if (/\b(keep|keeping|bring|bringing|current phone|my phone|own phone)\b/.test(text)) updated.deviceOwnership = 'Keep / bring current phone'
  else if (/\b(new phone|upgrade|upgrading|new device|looking for a phone)\b/.test(text)) updated.deviceOwnership = 'Looking to upgrade'
  else if (requestedStage === 'device' && /\b(not sure|unsure|skip|rather not say)\b/.test(text)) updated.deviceOwnership = 'Not sure'
  if (requestedStage === 'device' && updated.deviceOwnership === null && text.trim()) updated.deviceOwnership = text.trim()

  if (/\b(never|rarely|once a year|once yearly|not much|no travel|no trips)\b/.test(text)) {
    updated.travelFrequency = 'Rarely'
  } else if (/\b(none|don't travel|dont travel|do not travel|no trips|not outside (?:the )?(?:us|u\.s\.?))\b/.test(text)) {
    updated.travelFrequency = 'Rarely'
  } else if (/\b(weekly|every week|monthly|every month|often|frequently|a lot|regularly)\b/.test(text)) {
    updated.travelFrequency = 'Frequently'
  } else if (/\b(once|twice|few times|sometimes|occasionally|yearly|per year|a year)\b/.test(text)) {
    updated.travelFrequency = 'Occasionally'
  } else if (requestedStage === 'travel' && /\b(not sure|unsure|depends|skip|rather not say)\b/.test(text)) {
    updated.travelFrequency = 'Not sure'
  } else if (requestedStage === 'travel' && text.trim()) {
    updated.travelFrequency = 'Not sure'
  }

  const noSwitch = /\b(?:(?:don't|dont|do not)\s+(?:want to\s+)?|not looking to\s+|won't\s+|will not\s+)(?:switch|change providers?)\b/.test(text)
  const bundled = /\b(bundle|bundling|open to switching|open to bundle|yes,? i(?:'m| am) open)\b/.test(text)
  const homeContext = requestedStage === 'homeServices' || /\b(home internet|home tv|internet provider|tv provider|home service)\b/.test(text) || noSwitch
  if (homeContext) {
    const internetMatch = text.match(/\b(?:internet|wifi|wi-fi)\s+(?:is\s+)?(?:with|from|through)?\s*(spectrum|xfinity|comcast|at&t|att|verizon|cox|optimum|frontier|centurylink)\b/)
    const tvMatch = text.match(/\b(?:tv|television)\s+(?:is\s+)?(?:with|from|through)?\s*(spectrum|xfinity|comcast|directv|dish|at&t|att|verizon)\b/)
    const provider = providerMatch ? normalizeProvider(providerMatch[1]) : null
    const defaultProvider = provider ?? 'Not specified'
    updated.homeInternetProvider = internetMatch ? normalizeProvider(internetMatch[1]) : defaultProvider
    updated.homeTvProvider = tvMatch ? normalizeProvider(tvMatch[1]) : defaultProvider
    updated.interestedInBundling = noSwitch ? false : bundled || /\b(yes|interested|sure|open to)\b/.test(text)
    updated.homeInternetCustomer = /\bspectrum\b/i.test(`${updated.homeInternetProvider} ${updated.homeTvProvider}`)
  }

  if (/\b(low|lowest|cheapest|lower|save|budget|affordable|as little as possible)\b/.test(text)) {
    updated.budgetPreference = 'lower-cost'
  } else if (/\b(balance|balanced|middle|some benefits|good value)\b/.test(text)) {
    updated.budgetPreference = 'balanced'
  } else if (/\b(most included|best plan|premium|flexible|don't mind|dont mind|more benefits)\b/.test(text)) {
    updated.budgetPreference = 'flexible'
  } else if (requestedStage === 'budget' && /\b(not sure|unsure|skip|rather not say)\b/.test(text)) {
    updated.budgetPreference = 'balanced'
  }
  if (requestedStage === 'travel') {
    const destinationMatch = text.match(/\b(?:to|in|visiting)\s+(?:the\s+)?(united states|u\.?s\.?a?|america|mexico)\b/i)
    if (destinationMatch) {
      updated.travelDestinations = /^(?:u\.?s\.?a?|america|united states)$/i.test(destinationMatch[1]) ? 'United States' : 'Mexico'
    } else if (/\binternational(?:ly)?\b/.test(text)) updated.travelDestinations = 'International'
    else if (/\b(none|don't travel|dont travel|do not travel|no trips|not outside (?:the )?(?:us|u\.s\.?))\b/.test(text)) updated.travelDestinations = 'None'
    else {
      const destination = text.match(/\b(?:to|in|visiting)\s+([a-z][a-z ,'-]{1,35})/i)
      if (destination) updated.travelDestinations = destination[1].trim().replace(/[?.!,]+$/, '')
    }
    if (updated.travelDestinations === null && /\b(not sure|unsure|skip|rather not say)\b/.test(text)) updated.travelDestinations = 'Not specified'
    else if (updated.travelDestinations === null && updated.travelFrequency !== null) updated.travelDestinations = 'Not specified'
  }
  if (requestedStage === 'device' && updated.deviceAge === null && updated.deviceOwnership !== null) updated.deviceAge = 'Not sure'
  if (requestedStage === 'phoneUsage') {
    const activities: [RegExp, string][] = [
      [/\b(stream(?:ing)?(?: video)?|youtube|netflix)\b/, 'Streaming video'],
      [/\b(gam(?:e|es|ing)|gaming)\b/, 'Gaming'],
      [/\b(email|e-mail)\b/, 'Email'],
      [/\b(brows(?:e|ing)|internet)\b/, 'Web browsing'],
      [/\b(video calls?|meetings?|zoom|teams)\b/, 'Video calls and meetings'],
      [/\b(social media|instagram|tiktok|facebook)\b/, 'Social media'],
      [/\b(music|spotify)\b/, 'Music'],
    ]
    const uses = activities.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)
    updated.phoneUseCases = uses.length ? uses : [/\b(not sure|unsure|skip|rather not say)\b/.test(text) ? 'Not specified' : answer.trim()]
  }
  if (requestedStage === 'homeServices' && updated.homeInternetProvider === null) {
    updated.homeInternetProvider = providerMatch ? normalizeProvider(providerMatch[1]) : 'Not specified'
    updated.homeTvProvider = providerMatch ? normalizeProvider(providerMatch[1]) : 'Not specified'
    updated.interestedInBundling = noSwitch ? false : bundled
    updated.homeInternetCustomer = /\bspectrum\b/i.test(`${updated.homeInternetProvider} ${updated.homeTvProvider}`)
  }
  if (requestedStage === 'budget' && updated.budgetPreference === null) {
    updated.budgetPreference = 'balanced'
  }
  if (requestedStage === 'dataAndLines' && /\b(not sure|unsure|skip|rather not say|doesn't matter|doesnt matter)\b/.test(text)) {
    if (updated.dataUsage === null) updated.dataUsage = 60
    if (updated.lineCount === null) updated.lineCount = 1
  }
  return updated
}

function parseCount(value: string): number {
  return wordNumbers[value.toLowerCase()] ?? Number(value)
}

function normalizeProvider(value: string): string {
  const provider = value.toLowerCase()
  if (provider === 'at&t' || provider === 'att') return 'AT&T'
  if (provider === 't-mobile' || provider === 'tmobile') return 'T-Mobile'
  if (provider.startsWith('mint')) return 'Mint Mobile'
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function recommendPlan(profile: CustomerProfile): PlanRecommendation {
  const dataUsage = profile.dataUsage ?? 60
  const travelFrequency = profile.travelFrequency?.toLowerCase() ?? ''
  const frequentlyTravels = travelFrequency.includes('frequent') || travelFrequency.includes('weekly') || travelFrequency.includes('monthly')
  const internationalTravel = /\b(international|europe|asia|overseas|world|abroad)\b/.test(travelFrequency)
  const highDataPhoneUse = profile.phoneUseCases?.some((use) => /streaming|gaming|video calls/i.test(use)) ?? false
  const recommendedId = internationalTravel && frequentlyTravels
    ? 'unlimitedPlusPremium'
    : frequentlyTravels || dataUsage > 100 || highDataPhoneUse
      ? 'unlimitedPlus'
      : dataUsage > 60
        ? 'unlimited'
        : 'byTheGig'
  const plan = mobilePlans.find((item) => item.id === recommendedId) ?? mobilePlans[0]
  const lineCount = profile.lineCount ?? 1
  const bundleName = profile.homeInternetCustomer ? 'With Internet or TV' : 'Mobile Only'
  const firstLine = profile.homeInternetCustomer ? plan.bundlePrice : plan.mobileOnlyPrice
  const extraPrices = additionalLinePrices[plan.id as keyof typeof additionalLinePrices]
  const monthlyEstimate = extraPrices && lineCount > 1
    ? firstLine + Array.from({ length: lineCount - 1 }, (_, index) => extraPrices[Math.min(index, extraPrices.length - 1)]).reduce((sum, price) => sum + price, 0)
    : firstLine * lineCount
  const reasons = [`${dataUsage} GB of typical monthly data use`, `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`]
  if (frequentlyTravels) reasons.push('frequent travel needs')
  if (highDataPhoneUse) reasons.push(`your ${profile.phoneUseCases?.filter((use) => /streaming|gaming|video calls/i.test(use)).join(' and ')} use`)
  if (profile.budgetPreference === 'lower-cost') reasons.push('your preference for a lower monthly cost')
  return {
    planName: plan.name,
    monthlyEstimate,
    lineCount,
    reason: `This is a starting fit for ${reasons.join(', ')}. Confirm roaming destinations and current eligibility before choosing.`,
    bundleName,
    budgetPreference: profile.budgetPreference,
  }
}
