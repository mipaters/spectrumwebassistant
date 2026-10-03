// Demo data and conversation logic for the Advanced WiFi device-management journey.
// Simulates a signed-in household account with multiple connected devices so Spectra
// can demonstrate usage insights and schedule-based WiFi pause controls.

export type WifiDeviceType = 'phone' | 'laptop' | 'console' | 'tv' | 'tablet' | 'speaker'

export type WifiDevice = {
  id: string
  name: string
  owner: string
  type: WifiDeviceType
  dailyGB: number
  nightGB: number // usage between 10 PM and 7 AM
}

export type HouseholdAccount = {
  accountName: string
  address: string
  planName: string
  members: string[]
  devices: WifiDevice[]
}

export const demoHousehold: HouseholdAccount = {
  accountName: 'The Alvarez Household',
  address: '482 Trailwood Lane, Austin, TX',
  planName: 'Spectrum Internet Gig · Advanced WiFi',
  members: ['Dana (parent)', 'Marcus (parent)', 'Jordan (teen)', 'Priya (teen)'],
  devices: [
    { id: 'ps5-jordan', name: 'Jordan’s PlayStation 5', owner: 'Jordan', type: 'console', dailyGB: 42.6, nightGB: 28.4 },
    { id: 'tv-living', name: 'Living Room Smart TV', owner: 'Household', type: 'tv', dailyGB: 18.2, nightGB: 6.1 },
    { id: 'laptop-dana', name: 'Dana’s Work Laptop', owner: 'Dana', type: 'laptop', dailyGB: 9.4, nightGB: 0.4 },
    { id: 'ipad-priya', name: 'Priya’s iPad', owner: 'Priya', type: 'tablet', dailyGB: 6.8, nightGB: 1.9 },
    { id: 'iphone-marcus', name: 'Marcus’s iPhone', owner: 'Marcus', type: 'phone', dailyGB: 3.1, nightGB: 0.2 },
    { id: 'speaker-kitchen', name: 'Kitchen Smart Speaker', owner: 'Household', type: 'speaker', dailyGB: 0.6, nightGB: 0.1 },
  ],
}

export type WifiPauseSchedule = {
  deviceId: string
  start: string
  end: string
}

export type WifiJourneyStage = 'usage' | 'confirm' | 'done'

export type WifiJourneyState = {
  stage: WifiJourneyStage
  targetDeviceId: string
  schedule: WifiPauseSchedule
}

export function rankByNightUsage(devices: WifiDevice[] = demoHousehold.devices): WifiDevice[] {
  return [...devices].sort((a, b) => b.nightGB - a.nightGB)
}

export function findDevice(id: string): WifiDevice | undefined {
  return demoHousehold.devices.find((device) => device.id === id)
}

const usageIntent = /\b(which (?:device|devices)|most (?:data|internet|usage|bandwidth)|using (?:the )?most|data usage|network usage|who'?s using|who is using|hogging|device usage|connected devices|my devices|wifi devices)\b/i
export function isUsageRequest(text: string): boolean {
  return usageIntent.test(text)
}

const pauseIntent = /\b(pause|disconnect|cut off|block|turn off|kick off|restrict|schedule)\b/i
export function isPauseRequest(text: string): boolean {
  return pauseIntent.test(text)
}

const approveIntent = /\b(yes|approve|confirm|do it|go ahead|sounds good|sure|please do|that works|ok(?:ay)?|yep|yeah|please)\b/i
export function isApproval(text: string): boolean {
  return approveIntent.test(text)
}

const declineIntent = /\b(no|don'?t|cancel|never ?mind|not now|decline|stop)\b/i
export function isDecline(text: string): boolean {
  return declineIntent.test(text)
}

export function beginWifiUsageJourney(): WifiJourneyState {
  const top = rankByNightUsage()[0]
  return { stage: 'usage', targetDeviceId: top.id, schedule: { deviceId: top.id, start: '10:00 PM', end: '7:00 AM' } }
}

export function usageSummaryReply(): string {
  const ranked = rankByNightUsage()
  const top = ranked[0]
  const lines = ranked.map((device, index) => `${index + 1}. ${device.name} (${device.owner}) — ${device.dailyGB} GB today, ${device.nightGB} GB overnight`).join('\n')
  return `Here’s today’s usage across your connected devices:\n${lines}\n\n${top.name} is using by far the most data overnight, mostly between 10 PM and 7 AM. Want me to pause its WiFi access during those hours?`
}

export function moveToConfirm(state: WifiJourneyState): WifiJourneyState {
  return { ...state, stage: 'confirm' }
}

export function confirmReply(state: WifiJourneyState): string {
  const device = findDevice(state.targetDeviceId)
  return `Got it. I’ll pause ${device?.name ?? 'that device'} from WiFi every night between ${state.schedule.start} and ${state.schedule.end}, starting tonight. Want me to go ahead and approve that schedule?`
}

export function completeReply(state: WifiJourneyState): string {
  const device = findDevice(state.targetDeviceId)
  return `Done! ${device?.name ?? 'That device'} will automatically pause from WiFi between ${state.schedule.start} and ${state.schedule.end} each night. Everyone else stays connected the whole time. You can change or remove this schedule anytime in My Spectrum App → Advanced WiFi.`
}

export function declineReply(state: WifiJourneyState): string {
  const device = findDevice(state.targetDeviceId)
  return `No problem — I won’t make any changes to ${device?.name ?? 'that device'}’s WiFi access. Let me know if you’d like to revisit this later.`
}
