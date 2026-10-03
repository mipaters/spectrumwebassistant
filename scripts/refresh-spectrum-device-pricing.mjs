// Refreshes src/data/spectrum-device-pricing.json from the public Spectrum device catalog.
// Usage: node scripts/refresh-spectrum-device-pricing.mjs
//
// NOTE: Spectrum does not publish a documented public device-catalog API (unlike some other
// carriers). This script is a template: point `endpoint` at a confirmed Spectrum catalog
// endpoint if/when one becomes available, or maintain src/data/spectrum-device-pricing.json
// by hand using public pricing from https://www.spectrum.com/phones.
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourcePage = 'https://www.spectrum.com/phones'
const endpoint = process.env.SPECTRUM_DEVICE_CATALOG_ENDPOINT
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/spectrum-device-pricing.json')

if (!endpoint) {
  console.log('SPECTRUM_DEVICE_CATALOG_ENDPOINT is not set; no confirmed public Spectrum device-catalog API is known.')
  console.log(`Maintain ${output} by hand using public pricing from ${sourcePage}, or set SPECTRUM_DEVICE_CATALOG_ENDPOINT to a confirmed endpoint.`)
  process.exit(0)
}

const response = await fetch(endpoint, {
  headers: {
    Accept: 'application/json',
    Referer: sourcePage,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  },
})
if (!response.ok) throw new Error(`Spectrum catalog request failed (${response.status})`)

const { devices } = await response.json()
const round = (value) => Math.round(Number(value) * 100) / 100

const snapshot = devices
  .filter((device) => device.deviceName && device.pricing && Number.isFinite(device.pricing.monthlyInstallmentAmount))
  .map((device) => {
    const pricing = device.pricing
    const billCredit = round(pricing.recurringCreditAmount || 0)
    const monthlyAfterCredit = round(pricing.monthlyInstallmentAmount)
    return {
      id: device.externalId,
      name: device.deviceName,
      brand: device.manufacturer.charAt(0).toUpperCase() + device.manufacturer.slice(1),
      type: device.deviceType,
      condition: device.deviceCondition,
      storage: device.memory,
      fullPrice: round(pricing.regularAmount),
      termMonths: pricing.recurringChargePeriod,
      monthlyAfterCredit,
      billCreditMonthly: billCredit,
      monthlyBeforeCredit: round(monthlyAfterCredit + billCredit),
      priceTier: pricing.priceTier,
      availability: device.availabilityOptions,
      url: `https://www.spectrum.com/phones/${device.urlSlug}`,
    }
  })

await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify({ source: sourcePage, capturedAt: new Date().toISOString().slice(0, 10), devices: snapshot }, null, 2)}\n`)
console.log(`Saved ${snapshot.length} devices to ${output}`)
