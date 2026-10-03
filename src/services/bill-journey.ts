import type { ImageAnalysis } from './image-analysis'
import { mobilePlans } from './offers'
import { findDevicePrice, newPhones, type SpectrumDevicePrice } from './device-pricing'

export type BillJourneyKind = 'billing' | 'compare'
export type BillJourneyStage = 'provider' | 'services' | 'phone' | 'upload'
export type BillPhone = { hasDevice: boolean; model: string | null }
export type BillJourneyState = {
  kind: BillJourneyKind
  stage: BillJourneyStage
  provider: string | null
  services: string | null
  phone: BillPhone | null
  analysis: ImageAnalysis | null
}

export function beginBillJourney(kind: BillJourneyKind): BillJourneyState {
  return { kind, stage: kind === 'compare' ? 'provider' : 'upload', provider: null, services: null, phone: null, analysis: null }
}

export function answerBillJourney(state: BillJourneyState, answer: string): BillJourneyState {
  if (state.stage === 'provider') return { ...state, provider: answer, stage: 'services' }
  if (state.stage === 'services') return { ...state, services: answer, stage: /mobile/i.test(answer) ? 'phone' : 'upload' }
  if (state.stage === 'phone') return { ...state, phone: parsePhoneAnswer(answer), stage: 'upload' }
  return state
}

export function parsePhoneAnswer(answer: string): BillPhone {
  const noDevice = /\b(no phone|sim.?only|byod|bring my own|own my phone|paid off|no device|no payment|no financing|just (?:the )?(?:plan|service)|service only|don'?t have a (?:phone )?payment)\b/i.test(answer)
  return noDevice ? { hasDevice: false, model: null } : { hasDevice: true, model: answer.trim().slice(0, 80) }
}

export function billJourneyPrompt(state: BillJourneyState): string {
  if (state.stage === 'provider') return 'Which provider’s bill would you like to compare with Spectrum? You can choose below, or share a photo now and I’ll identify the provider and services if they’re visible. Would you like to share it?'
  if (state.stage === 'phone') return 'Does that bill include a phone payment? Tell me which phone (for example “iPhone 15” or “Galaxy S24”) so I can compare a Spectrum plan with a phone, or choose SIM only if you’re bringing your own.'
  if (state.stage === 'services') return 'Which services are on that bill? You can choose below, or share a photo now and I’ll identify the services if they’re visible. Would you like to share it?'
  return state.kind === 'billing'
    ? 'Would you like to share a photo of your bill so I can explain the visible charges and suggest possible ways to save? Choose Take a photo or Upload an image below. You can cover account numbers, your name, address, and payment details first.'
    : `Would you like to share a photo of your ${state.provider ?? 'current provider'} bill? Choose Take a photo or Upload an image below, and I’ll identify the visible services and monthly total to compare with an illustrative Spectrum estimate. Please cover account numbers, name, address, and payment details first.`
}

export function detectBillJourneyKind(text: string): BillJourneyKind | null {
  const billTopic = /\b(bill|billing|invoice|statement|charges?)\b/i.test(text)
  const providerTopic = /\b(xfinity|comcast|at&t|att|verizon|t-mobile|tmobile|cox|optimum|frontier|spectrum|provider|competitor)\b/i.test(text)
  const compareIntent = /\b(compare|comparison|switch|switching|change provider|compare prices|savings?)\b/i.test(text)
  if (compareIntent && (billTopic || providerTopic)) return 'compare'
  if (billTopic && /\b(understand|understanding|explain|review|analy[sz]e|help|question|talk|discuss|ask|look|send|share|upload|photo|picture|image|issue|concern|high|expensive)\b/i.test(text)) return 'billing'
  if (/^\s*(my bill|billing inquiry|bill question)\s*$/i.test(text)) return 'billing'
  return null
}

export function isBillComparisonRequest(text: string): boolean {
  return detectBillJourneyKind(text) === 'compare'
}

export function isBillingHelpRequest(text: string): boolean {
  return detectBillJourneyKind(text) === 'billing'
}

export function isBillImageShareRequest(text: string, recentContext: string): boolean {
  const mentionsBill = /\b(bill|billing|invoice|statement)\b/i.test(text)
  const asksToShareImage = /\b(photo|picture|image|snapshot|bill)\b/i.test(text)
    && /\b(can i|could i|may i|share|send|upload|attach|take|show|look at|view|analy[sz]e|check)\b/i.test(text)
  return mentionsBill && asksToShareImage || asksToShareImage && detectBillJourneyKind(recentContext) !== null
}

export type SpectrumEstimate = { total: number; planLabel: string | null; planMonthly: number; deviceMonthly: number | null; deviceLabel: string | null; closestMatch: boolean }

const planById = (id: string) => mobilePlans.find((plan) => plan.id === id) ?? mobilePlans[0]
const brandOf = (model: string) => /iphone|apple/i.test(model) ? 'Apple' : /galaxy|samsung/i.test(model) ? 'Samsung' : /pixel|google/i.test(model) ? 'Google' : null

function pickSpectrumDevice(model: string | null): { device: SpectrumDevicePrice; closestMatch: boolean } | null {
  const exact = model ? findDevicePrice(model) : null
  if (exact) return { device: exact, closestMatch: false }
  const brand = model ? brandOf(model) : null
  const pool = newPhones().filter((device) => brand ? device.brand === brand : ['Apple', 'Samsung', 'Google'].includes(device.brand)).sort((a, b) => a.monthlyAfterCredit - b.monthlyAfterCredit)
  const fallback = pool[Math.floor(pool.length / 2)] ?? newPhones().sort((a, b) => a.monthlyAfterCredit - b.monthlyAfterCredit)[0]
  return fallback ? { device: fallback, closestMatch: true } : null
}

export function estimateSpectrum(services: string | null, lines: number | null, phone: BillPhone | null): SpectrumEstimate | null {
  if (!services) return null
  const normalized = services.toLowerCase()
  let planMonthly = 0
  let planLabel: string | null = null
  let deviceMonthly: number | null = null
  let deviceLabel: string | null = null
  let closestMatch = false
  if (normalized.includes('mobile')) {
    const lineCount = lines ?? 1
    const picked = phone?.hasDevice ? pickSpectrumDevice(phone.model) : null
    // Device bill credits are tied to an Unlimited Plus Premium plan; other devices work on By the Gig.
    const plan = planById(picked && picked.device.billCreditMonthly > 0 ? 'unlimitedPlusPremium' : 'byTheGig')
    planMonthly += normalized.includes('internet') ? lineCount * plan.bundlePrice : lineCount * plan.mobileOnlyPrice
    planLabel = plan.name
    if (picked) {
      deviceMonthly = picked.device.monthlyAfterCredit
      deviceLabel = picked.device.condition === 'Preowned' ? `${picked.device.name} (preowned)` : picked.device.name
      closestMatch = picked.closestMatch
    }
  }
  if (normalized.includes('internet')) planMonthly += 60
  if (normalized.includes('tv')) planMonthly += 25
  if (normalized.includes('home phone')) planMonthly += 10
  const total = planMonthly + (deviceMonthly ?? 0)
  return total ? { total: Math.round(total * 100) / 100, planLabel, planMonthly, deviceMonthly, deviceLabel, closestMatch } : null
}

export function estimateSpectrumMonthly(services: string | null, lines: number | null): number | null {
  return estimateSpectrum(services, lines, null)?.total ?? null
}
