export type TroubleshootingIssueType =
  | 'Complete Internet Outage'
  | 'Slow Internet'
  | 'Limited WiFi Coverage'
  | 'TV/Streaming Issue'
  | 'Device Connectivity Issue'
  | 'Smart Home Issue'

export type TroubleshootingStage = 'identify' | 'diagnostics' | 'resolution' | 'escalation' | 'resolved'

export type TroubleshootingState = {
  stage: TroubleshootingStage
  issueType: TroubleshootingIssueType | null
  reportedIssue: string
  affectedRoom: string | null
  symptom: string | null
  diagnosticResults: {
    network: 'available' | 'outage'
    gateway: 'online' | 'offline'
    wifi: 'weak' | 'normal'
    streaming: 'normal' | 'degraded'
    connectedDevices: number
    healthScore: number
    currentCoverage: number
    projectedCoverage: number
  } | null
  troubleshootingSteps: string[]
  completedSteps: string[]
  currentStepIndex: number
  customerResponses: string[]
  resolutionSummary: string | null
  demoMode: boolean
}

const issuePrompts: Record<TroubleshootingIssueType, RegExp> = {
  'Complete Internet Outage': /\b(modem|gateway|router|internet|wi-?fi|connection|online)\b.{0,35}\b(down|outage|out|not working|isn't working|is not working|no connection|offline)\b|\b(no internet|internet is down|internet outage|can't connect|cannot connect|modem.{0,20}flashing orange|flashing orange.{0,20}modem)\b/i,
  'Slow Internet': /\b(slow internet|internet is slow|slow wifi|slow wi-fi|lag(?:ging)?|game(?:s|ing)? online|work calls? keep dropping|calls? keep dropping|unstable connection|connection is unstable)\b/i,
  'Limited WiFi Coverage': /\b(bad|weak|poor|limited|spotty|no)\b.{0,25}\b(wi-?fi|signal|coverage|reception)\b|\b(wi-?fi|signal|coverage)\b.{0,25}\b(bedroom|room|basement|upstairs|downstairs|weak|poor|bad|dead zone)\b|\bsome rooms\b|\bbedroom has bad wi-?fi\b/i,
  'TV/Streaming Issue': /\b(tv|television|netflix|stream(?:ing)?|buffer(?:ing)?)\b.{0,35}\b(not working|isn't working|is not working|buffer|freeze|issue|problem|won't load|keeps|keeps buffering|error)\b|\b(tv isn't working|tv not working|streaming keeps buffering|netflix keeps buffering)\b/i,
  'Smart Home Issue': /\b(smart home|smart device|camera|doorbell|thermostat|smart speaker)\b.{0,35}\b(disconnect|offline|not working|won't connect|issue|problem)\b|\b(smart home devices keep disconnecting)\b/i,
  'Device Connectivity Issue': /\b(device|devices|phone|laptop|tablet|console|printer)\b.{0,30}\b(disconnect|can't connect|cannot connect|won't connect|offline|not connecting)\b|\b(connected devices keep disconnecting)\b/i,
}

const resolutionSteps: Record<TroubleshootingIssueType, string[]> = {
  'Complete Internet Outage': [
    'Check that the gateway power cable is firmly connected and the outlet is working.',
    'Restart the gateway: unplug it for 30 seconds, reconnect it, and allow a few minutes to come online.',
    'Check the service status in My Spectrum App for a known area interruption.',
  ],
  'Slow Internet': [
    'Run a speed test near the gateway and compare it with a test in the room where you notice slow speeds.',
    'Restart the gateway by unplugging it for 30 seconds, then reconnect and retest.',
    'Pause large downloads and disconnect devices you are not using, then test again.',
  ],
  'Limited WiFi Coverage': [
    'Move closer to the gateway and test the same activity again.',
    'Restart the gateway: unplug it for 30 seconds, reconnect it, and let the WiFi come back online.',
    'Place the gateway in a central, open location away from cabinets and large electronics.',
    'Add Spectrum WiFi range extenders to extend coverage to the bedroom and other low-signal areas.',
  ],
  'TV/Streaming Issue': [
    'Check whether other channels or streaming apps load on the same TV.',
    'Restart the TV box and modem, then reopen the app or channel.',
    'Check the TV box connections and install any available app or device updates.',
  ],
  'Device Connectivity Issue': [
    'Turn WiFi off and back on for the affected device, then reconnect to your home network.',
    'Restart the affected device and confirm it is using the correct WiFi network.',
    'Forget the saved WiFi network on that device and reconnect using your network password.',
  ],
  'Smart Home Issue': [
    'Confirm the smart device has power and is within WiFi range of the gateway.',
    'Restart the device and its companion app, then check its connection status.',
    'Reconnect the device to your home WiFi using the manufacturer’s setup steps.',
  ],
}

export function detectTroubleshootingIssue(message: string): TroubleshootingIssueType | null {
  return Object.entries(issuePrompts).find(([, pattern]) => pattern.test(message))?.[0] as TroubleshootingIssueType | undefined ?? null
}

export function isModemImageShareRequest(message: string, recentContext: string): boolean {
  const asksToShareImage = /\b(photo|picture|image|snapshot)\b/i.test(message)
    && /\b(can i|could i|may i|share|send|upload|attach|take|show|look at|view|analy[sz]e|check)\b/i.test(message)
  return asksToShareImage && /\b(modem|gateway|router|wi-?fi|internet|connection|signal|lights?)\b/i.test(recentContext)
}
export function isTroubleshootingRequest(message: string): boolean {
  return detectTroubleshootingIssue(message) !== null
    || /\b(modem diagnostics?|gateway status|modem lights?|signal issue|signal problem|service issue|technical support|troubleshoot|internet.*(?:problem|issue)|wifi.*(?:problem|issue)|wi-fi.*(?:problem|issue))\b/i.test(message)
}

export function beginTroubleshooting(message: string, demoMode = false): TroubleshootingState {
  const issueType = detectTroubleshootingIssue(message)
  const affectedRoom = findRoom(message)
  const clarifyCoverageSymptom = issueType === 'Limited WiFi Coverage' && affectedRoom !== null
  return {
    stage: issueType && !clarifyCoverageSymptom ? 'diagnostics' : 'identify',
    issueType,
    reportedIssue: message,
    affectedRoom,
    symptom: clarifyCoverageSymptom ? null : inferSymptom(message, issueType),
    diagnosticResults: null,
    troubleshootingSteps: issueType ? resolutionSteps[issueType] : [],
    completedSteps: [],
    currentStepIndex: 0,
    customerResponses: [],
    resolutionSummary: null,
    demoMode,
  }
}

export function completeDiagnostics(state: TroubleshootingState): TroubleshootingState {
  if (!state.issueType || state.stage !== 'diagnostics') return state
  const coverageIssue = state.issueType === 'Limited WiFi Coverage'
  const outage = state.issueType === 'Complete Internet Outage'
  return {
    ...state,
    stage: 'resolution',
    diagnosticResults: {
      network: outage ? 'outage' : 'available',
      gateway: outage ? 'offline' : 'online',
      wifi: coverageIssue ? 'weak' : 'normal',
      streaming: state.issueType === 'TV/Streaming Issue' ? 'degraded' : 'normal',
      connectedDevices: 27,
      healthScore: outage ? 18 : coverageIssue ? 74 : state.issueType === 'Slow Internet' ? 68 : 91,
      currentCoverage: coverageIssue ? 74 : 88,
      projectedCoverage: coverageIssue ? 96 : 88,
    },
  }
}

export function recordTroubleshootingResponse(state: TroubleshootingState, response: string): TroubleshootingState {
  const updated: TroubleshootingState = {
    ...state,
    customerResponses: [...state.customerResponses, response],
  }
  if (state.stage === 'identify') {
    if (customerConfirmsResolved(response)) {
      updated.stage = 'resolved'
      updated.resolutionSummary = `You reported that the issue was resolved after: ${response}`
      return updated
    }
    const issue = state.issueType ?? identifyFromAnswer(response)
    if (!issue) return updated
    return {
      ...updated,
      issueType: issue,
      troubleshootingSteps: resolutionSteps[issue],
      symptom: response,
      stage: 'diagnostics',
    }
  }
  if (state.stage !== 'resolution') return updated

  const saysNotResolved = /\b(no|not|still|didn't|did not|hasn't|has not|isn't|is not)\b/i.test(response)
    || /\b(still having trouble|no change|didn't help|did not help|not fixed)\b/i.test(response)
  const saysResolved = !saysNotResolved && /\b(yes|helped|fixed|working|resolved|better|great)\b/i.test(response)
  updated.completedSteps = [...state.completedSteps, state.troubleshootingSteps[state.currentStepIndex]].filter(Boolean)
  if (saysResolved) {
    updated.stage = 'resolved'
    updated.resolutionSummary = `The issue improved after: ${state.troubleshootingSteps[state.currentStepIndex]}`
    return updated
  }

  const nextIndex = state.currentStepIndex + 1
  if (nextIndex >= state.troubleshootingSteps.length) {
    updated.stage = 'escalation'
  } else {
    updated.currentStepIndex = nextIndex
  }
  return updated
}

export function troubleshootingReply(state: TroubleshootingState, response?: string): string {
  if (state.stage === 'identify') {
    if (!state.issueType) return 'Yes—you can share a clear photo of your modem or gateway. Use Take a photo or Upload an image below, or choose an issue type to continue.'
    if (state.issueType === 'Limited WiFi Coverage') {
      return `I can help improve the ${state.affectedRoom ? `${state.affectedRoom} ` : ''}WiFi. Is the main issue weak signal, slow speeds, frequent disconnects, or buffering and streaming?`
    }
    return 'I can help troubleshoot. Which issue best describes what you’re experiencing: a complete Internet outage, slow Internet, weak WiFi coverage, a TV or streaming issue, a device that won’t connect, or a smart home device issue?'
  }
  if (state.stage === 'diagnostics') {
    return `I’ve identified this as ${state.issueType?.toLowerCase() ?? 'a service issue'}${state.affectedRoom ? ` affecting the ${state.affectedRoom}` : ''}. I’m running a simulated connection test now.`
  }
  if (state.stage === 'resolution' && !response) {
    const room = state.affectedRoom ? ` in the ${state.affectedRoom}` : ''
    const coverageFinding = state.issueType === 'Limited WiFi Coverage'
      ? `The likely cause is reduced WiFi coverage${room}. This can happen when the gateway is far away, walls or floors weaken the signal, many devices are connected, or nearby WiFi networks cause interference.`
      : `The diagnostic points to ${state.issueType?.toLowerCase() ?? 'a service issue'}. I’ll guide you through one step at a time and remember what you’ve tried.`
    return `I’ve completed a diagnostic scan. Your gateway appears ${state.diagnosticResults?.gateway === 'online' ? 'healthy and connected' : 'offline'}, and ${coverageFinding}`
  }
  if (state.stage === 'resolution' && response) {
    if (state.currentStepIndex > state.completedSteps.length - 1) {
      return `Let’s try the next step: ${state.troubleshootingSteps[state.currentStepIndex]}`
    }
    if (/\b(yes|helped|fixed|working|resolved|better|great)\b/i.test(response)) {
      return `Great—your ${state.issueType?.toLowerCase() ?? 'service'} issue is resolved. ${state.resolutionSummary ?? ''}`
    }
    return `Thanks for checking. Let’s try the next step: ${state.troubleshootingSteps[state.currentStepIndex]}`
  }
  if (state.stage === 'escalation') {
    return 'We’ve worked through the recommended steps, but the issue is still there. Choose how you’d like to continue and I’ll help with the next step.'
  }
  if (state.stage === 'resolved') {
    return state.completedSteps.length > 0
      ? `Issue resolved. Summary: ${state.resolutionSummary ?? 'The service is working again.'} You tried ${state.completedSteps.length} troubleshooting step${state.completedSteps.length === 1 ? '' : 's'}.`
      : `Great—I’ve marked the issue resolved. ${state.resolutionSummary ?? 'Thanks for letting me know the service is working again.'}.`
  }
  return 'Let’s keep working through this together.'
}

function customerConfirmsResolved(response: string): boolean {
  if (/\b(?:not resolved|isn't resolved|is not resolved|still (?:not )?working|didn't help|did not help|no change|not fixed)\b/i.test(response)) return false
  return /\b(?:resolved|fixed|working again|back online|back up|came back online|restored|solved)\b/i.test(response)
}
function identifyFromAnswer(answer: string): TroubleshootingIssueType | null {
  if (/\b(weak signal|limited|coverage|dead zone|bedroom|room)\b/i.test(answer)) return 'Limited WiFi Coverage'
  if (/\b(slow|speed)\b/i.test(answer)) return 'Slow Internet'
  if (/\b(disconnect|drops?)\b/i.test(answer)) return 'Device Connectivity Issue'
  if (/\b(buffer|stream|tv)\b/i.test(answer)) return 'TV/Streaming Issue'
  return detectTroubleshootingIssue(answer)
}

function inferSymptom(message: string, issue: TroubleshootingIssueType | null): string | null {
  if (!issue) return null
  if (/\b(buffer(?:ing)?|netflix|stream(?:ing)?)\b/i.test(message)) return 'Buffering or streaming issues'
  if (/\b(disconnect|unstable|drops?)\b/i.test(message)) return 'Frequent disconnects'
  if (/\b(slow|lag|speed|game|calls?)\b/i.test(message)) return 'Slow speeds or lag'
  if (issue === 'Limited WiFi Coverage' || /\b(weak|poor|bad|bedroom|room|signal)\b/i.test(message)) return 'Weak WiFi signal'
  return null
}

function findRoom(message: string): string | null {
  const match = message.match(/\b(bedroom|living room|basement|upstairs|downstairs|kitchen|office|garage)\b/i)
  return match?.[0].toLowerCase() ?? null
}
