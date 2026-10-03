import { PhoneProduct, productCards } from './offers'
import type { ImageAnalysis } from './image-analysis'

export type DeviceUpgradeStage = 'currentDevice' | 'priorities' | 'budget' | 'tradeIn' | 'recommendation'
export type DeviceUpgradeBrand = PhoneProduct['line'] | 'Other'
export type DeviceUpgradePriority = 'camera' | 'battery' | 'performance' | 'value'
export type DeviceUpgradeBudget = 'under-30' | '30-to-50' | 'flexible'

export type DeviceUpgradeState = {
  stage: DeviceUpgradeStage
  currentDevice: string | null
  preferredBrand: DeviceUpgradeBrand | null
  priorities: DeviceUpgradePriority[]
  budget: DeviceUpgradeBudget | null
  recommendation: PhoneProduct | null
  tradeIn: { status: 'none' | 'assessed'; analysis?: ImageAnalysis }
}

export function isDeviceUpgradeRequest(message: string): boolean {
  return /\b(?:upgrade|upgrading|new phone|new device|shop(?:ping)? for (?:a )?phone|looking for (?:a )?(?:new )?phone|replace my phone|phone recommendation)\b/i.test(message)
}

export function beginDeviceUpgrade(): DeviceUpgradeState {
  return {
    stage: 'currentDevice',
    currentDevice: null,
    preferredBrand: null,
    priorities: [],
    budget: null,
    recommendation: null,
    tradeIn: { status: 'none' },
  }
}

export function completeTradeIn(state: DeviceUpgradeState, analysis?: ImageAnalysis): DeviceUpgradeState {
  const recommendation = recommendDevice(state.preferredBrand, state.priorities, state.budget ?? 'flexible')
  return { ...state, stage: 'recommendation', recommendation, tradeIn: analysis ? { status: 'assessed', analysis } : { status: 'none' } }
}

export function tradeInAssessmentReply(analysis: ImageAnalysis): string {
  const device = analysis.deviceDescription ? `your ${analysis.deviceDescription}` : 'your phone'
  switch (analysis.tradeInOutlook) {
    case 'worth-trading-in': return `${device[0].toUpperCase()}${device.slice(1)} looks to be in good visible condition, so a trade-in is worth pursuing. Final credit depends on a full device check.`
    case 'limited-value': return `${device[0].toUpperCase()}${device.slice(1)} shows some visible wear. A trade-in may still be worthwhile, but the credit could be reduced.`
    case 'not-recommended': return `I can see significant damage on ${device}, so a trade-in may offer little or no credit. A repair or recycling may be worth comparing.`
    default: return 'I couldn’t assess the phone clearly from that photo. Try a well-lit photo of the front and back, or continue without a trade-in.'
  }
}

export function advanceDeviceUpgrade(state: DeviceUpgradeState, answer: string): DeviceUpgradeState {
  if (state.stage === 'currentDevice') {
    const normalized = answer.toLowerCase()
    const preferredBrand: DeviceUpgradeBrand = /\b(iphone|apple|ios)\b/.test(normalized)
      ? 'Apple'
      : /\b(samsung|galaxy|android)\b/.test(normalized)
        ? 'Samsung'
        : /\b(pixel|google)\b/.test(normalized)
          ? 'Google'
          : 'Other'
    return { ...state, stage: 'priorities', currentDevice: answer.trim(), preferredBrand }
  }
  if (state.stage === 'priorities') {
    const normalized = answer.toLowerCase()
    const priorities: DeviceUpgradePriority[] = []
    if (/\b(camera|photo|photos|picture)\b/.test(normalized)) priorities.push('camera')
    if (/\b(battery|all.day|lasting)\b/.test(normalized)) priorities.push('battery')
    if (/\b(gaming|game|performance|fast|power)\b/.test(normalized)) priorities.push('performance')
    if (/\b(value|price|afford|budget|lower|save)\b/.test(normalized)) priorities.push('value')
    return { ...state, stage: 'budget', priorities: priorities.length ? priorities : ['value'] }
  }
  if (state.stage === 'budget') {
    const normalized = answer.toLowerCase()
    const budget: DeviceUpgradeBudget = /\b(under|less than|below|maximum|max|30 or less|30\/mo)\b/.test(normalized)
      ? 'under-30'
      : /\b(30|50|middle|moderate)\b/.test(normalized)
        ? '30-to-50'
        : 'flexible'
    return { ...state, stage: 'tradeIn', budget }
  }
  if (state.stage === 'tradeIn') return completeTradeIn(state)
  return state
}

function recommendDevice(
  brand: DeviceUpgradeBrand | null,
  priorities: DeviceUpgradePriority[],
  budget: DeviceUpgradeBudget,
): PhoneProduct {
  const preferred = brand && brand !== 'Other' ? brand : null
  const candidates = (preferred ? productCards.filter((product) => product.line === preferred) : productCards)
    .filter((product) => deviceMonthlyPrice(product) !== null)
  const pool = candidates.length ? candidates : productCards
  const price = (product: PhoneProduct) => deviceMonthlyPrice(product) ?? Infinity
  const byPrice = [...pool].sort((a, b) => price(a) - price(b))
  const within = (limit: number) => byPrice.filter((product) => price(product) <= limit)
  const pick = (list: PhoneProduct[], top: boolean) => (top ? list[list.length - 1] : list[0])
  const premium = priorities.some((priority) => priority !== 'value')
  if (budget === 'under-30') return pick(within(30), premium) ?? byPrice[0]
  if (budget === '30-to-50') return pick(within(50).filter((product) => price(product) > 30), premium) ?? pick(within(50), true) ?? byPrice[0]
  return premium ? byPrice[byPrice.length - 1] : byPrice[Math.floor(byPrice.length / 2)]
}

export function deviceUpgradeQuestion(stage: DeviceUpgradeStage): string {
  switch (stage) {
    case 'currentDevice': return 'Let’s find an upgrade that fits. What phone do you use now—iPhone, Samsung Galaxy, Google Pixel, or something else?'
    case 'priorities': return 'Thanks. What matters most in your next phone: camera, battery life, gaming and performance, or value?'
    case 'budget': return 'What monthly device budget feels comfortable: under $30, around $30–$50, or flexible for the right phone?'
    case 'tradeIn': return 'Do you have a phone you’d like to trade in? Take a photo or upload one and I’ll check its visible condition to tell you whether a trade-in looks worthwhile.'
    case 'recommendation': return 'Based on what you shared, here’s a phone to consider.'
  }
}

export function describeDeviceMatch(state: DeviceUpgradeState): string {
  const priorities = state.priorities.map((priority) => ({
    camera: 'camera quality',
    battery: 'battery life',
    performance: 'performance',
    value: 'value',
  }[priority]))
  return `Matched to your ${state.preferredBrand && state.preferredBrand !== 'Other' ? `${state.preferredBrand} preference and ` : ''}${priorities.join(' and ') || 'everyday use'}${state.budget === 'under-30' ? ', with a lower monthly budget in mind' : state.budget === '30-to-50' ? ', within your $30–$50 monthly range' : ''}.`
}

export function deviceMonthlyPrice(product: PhoneProduct): number | null {
  const match = product.monthlyPrice?.match(/\$([\d.]+)\s*\/mo/i)
  return match ? Number(match[1]) : null
}
