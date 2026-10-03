import snapshot from '../data/spectrum-device-pricing.json'

export type SpectrumDevicePrice = {
  id: string
  name: string
  brand: string
  type: string
  condition: 'New' | 'Preowned' | string
  storage: string
  fullPrice: number
  termMonths: number
  monthlyAfterCredit: number
  billCreditMonthly: number
  monthlyBeforeCredit: number
  saveAndReturnCredit: number
  priceTier: string
  availability: string
  url: string
}

export const devicePricingSource = snapshot.source
export const devicePricingCapturedAt = snapshot.capturedAt
export const spectrumDevicePrices = snapshot.devices as SpectrumDevicePrice[]

const normalize = (value: string) => value.toLowerCase().replace(/\bapple\b|\bgoogle\b|\bsamsung\b/g, '').replace(/\s+/g, ' ').replace(/[^a-z0-9+ ]/g, '').trim()

export function isPhone(device: SpectrumDevicePrice): boolean {
  return device.type === 'Smartphone' && !device.name.includes('&')
}

export function newPhones(brand?: string): SpectrumDevicePrice[] {
  return spectrumDevicePrices.filter((device) => isPhone(device) && device.condition === 'New' && (!brand || device.brand === brand))
}

export function findDevicePrice(model: string, condition?: 'New' | 'Preowned'): SpectrumDevicePrice | null {
  const wanted = normalize(model)
  if (!wanted) return null
  const pool = spectrumDevicePrices.filter((device) => isPhone(device) && (!condition || device.condition === condition))
  const byCondition = (a: SpectrumDevicePrice, b: SpectrumDevicePrice) => (a.condition === 'New' ? 0 : 1) - (b.condition === 'New' ? 0 : 1)
  const exact = pool.filter((device) => normalize(device.name) === wanted).sort(byCondition)[0]
  if (exact) return exact
  const contained = pool.filter((device) => wanted.includes(normalize(device.name)))
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length || byCondition(a, b))[0]
  return contained ?? null
}

export function formatMonthly(device: SpectrumDevicePrice): string {
  return `$${device.monthlyAfterCredit.toFixed(2)}/mo.`
}

export function devicePriceNote(device: SpectrumDevicePrice): string {
  const credit = device.billCreditMonthly > 0 ? ` after a ${`$${device.billCreditMonthly.toFixed(2)}`}/mo. bill credit (${`$${device.monthlyBeforeCredit.toFixed(2)}`}/mo. before credit)` : ''
  return `${device.termMonths} mos. at 0% APR${credit} with an eligible plan · taxes extra`
}
