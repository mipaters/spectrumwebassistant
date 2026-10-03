import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { ChatMessage, CustomerProfile, emptyCustomerProfile, JourneyStage, PlanRecommendation, askGpt, isPlanJourneyRequest, sendMessage } from './services/assistant'
import { isRelevantToJourney } from './services/relevance'
import { isSpeechAvailable, listenOnce, SpeechCancelledError, SpeechNoMatchError, speak, stopListening, stopSpeaking } from './services/speech'
import { azureCapabilities } from './config/azure'
import { analyzeImage, ImageAnalysis, ImageAnalysisType } from './services/image-analysis'
import { answerBillJourney, beginBillJourney, BillJourneyKind, BillJourneyState, billJourneyPrompt, estimateSpectrum, BillPhone, detectBillJourneyKind, isBillImageShareRequest } from './services/bill-journey'
import { ArchitecturePage } from './ArchitecturePage'
import { devicePricingCapturedAt } from './services/device-pricing'
import { additionalLinePrices, catalog, featuredPromotions, homeWifiOffer, mobilePlans, offerSnapshotDate, offers, productCards } from './services/offers'
import homeHeroImage from './assets/home-hero.png'
import { beginTroubleshooting, completeDiagnostics, isModemImageShareRequest, isTroubleshootingRequest, recordTroubleshootingResponse, TroubleshootingState, troubleshootingReply } from './services/troubleshooting'
import { advanceDeviceUpgrade, beginDeviceUpgrade, completeTradeIn, describeDeviceMatch, deviceMonthlyPrice, deviceUpgradeQuestion, DeviceUpgradeStage, DeviceUpgradeState, isDeviceUpgradeRequest, tradeInAssessmentReply } from './services/device-upgrade'
import { answerDemoJourney, currentDemoJourneyStep, demoJourneyOpening, demoJourneyReprompt, isDemoAnswerAcceptable, DemoJourneyId, DemoJourneyState, startDemoJourney } from './services/demo-journeys'

type Page = 'home' | 'mobile' | 'internet' | 'tv' | 'smartHome' | 'homePhone' | 'devices' | 'support' | 'account' | 'cart' | 'checkout' | 'about' | 'architecture'
type IconName = 'search' | 'person' | 'cart' | 'chevron' | 'arrow' | 'close' | 'menu' | 'spark' | 'send' | 'reset' | 'wifi' | 'phone' | 'home' | 'play' | 'shield' | 'globe' | 'check' | 'mic' | 'speaker'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4.5 4.5" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-1.5a7 7 0 0 1 14 0V21" /></>,
    cart: <><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    spark: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    speaker: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /></>,
    wifi: <><path d="M5 9a11 11 0 0 1 14 0M8 12a6.5 6.5 0 0 1 8 0m-5 3a2 2 0 0 1 2 0" /><circle cx="12" cy="18" r="1" /></>,
    phone: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z" /></>,
    play: <><path d="m9 6 10 6-10 6Z" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function SpectrumLogo({ className = '' }: { className?: string }) {
  return <span className={`spectrum-logo ${className}`} aria-label="Spectrum" role="img"><span className="spectrum-wordmark">Spectrum</span><svg className="spectrum-logo-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 2.5v15l13-7.5z" /></svg></span>
}

const navigation: { label: string; page: Page }[] = [
  { label: 'Internet', page: 'internet' }, { label: 'Mobile', page: 'mobile' }, { label: 'TV & Streaming', page: 'tv' },
  { label: 'Home WiFi', page: 'smartHome' }, { label: 'Phones & Devices', page: 'devices' },
  { label: 'My Offers', page: 'account' }, { label: 'Support', page: 'support' },
]

const walkthroughs = [
  { id: 'sales', title: 'AI-Assisted Sales', text: 'Find a plan made for your everyday.', icon: 'spark' as IconName, prompt: 'I’m looking for a mobile plan. Can you recommend one?' },
  { id: 'care', title: 'AI-Powered Customer Care', text: 'Get clear answers and help that feels human.', icon: 'person' as IconName, prompt: 'Can you help me understand a charge on my bill?' },
  { id: 'upgrade', title: 'Device Upgrade Journey', text: 'Explore your next phone and trade-in options.', icon: 'phone' as IconName, prompt: 'I’m thinking about upgrading my phone. What should I consider?' },
  { id: 'offers', title: 'Personalized Offers', text: 'See options that fit how you connect.', icon: 'spark' as IconName, prompt: 'Are there any promotions or offers that might suit me?' },
  { id: 'roaming', title: 'Roaming Advisor', text: 'Travel with more confidence and fewer surprises.', icon: 'globe' as IconName, prompt: 'I’m travelling soon. How does roaming work?' },
  { id: 'technical', title: 'Technical Support', text: 'Troubleshoot home WiFi, one step at a time.', icon: 'wifi' as IconName, prompt: 'My home internet has been slow. Can you help?' },
  { id: 'compare', title: 'Compare with Competitors', text: 'See your estimated annual savings with Spectrum.', icon: 'shield' as IconName, prompt: 'Compare my current provider with Spectrum.' },
]

type BillComparison = { provider: string; currentMonthly: number | null; spectrumMonthly: number | null; annualSavings: number | null; planLabel: string | null; planMonthly: number | null; deviceMonthly: number | null; deviceLabel: string | null; currentPhone: string | null; phoneAssumed: boolean }

function buildBillComparison(journey: BillJourneyState, analysis: ImageAnalysis, phone: BillPhone | null): BillComparison {
  const services = journey.services ?? (analysis.services?.join(' + ') || null)
  const estimate = estimateSpectrum(services, analysis.lineCount ?? null, phone)
  const currentMonthly = analysis.monthlyTotal ?? null
  const spectrumMonthly = estimate?.total ?? null
  const annualSavings = currentMonthly !== null && spectrumMonthly !== null ? Math.round((currentMonthly - spectrumMonthly) * 12 * 100) / 100 : null
  return { provider: journey.provider ?? analysis.provider ?? 'your current provider', currentMonthly, spectrumMonthly, annualSavings, planLabel: estimate?.planLabel ?? null, planMonthly: estimate?.planMonthly ?? null, deviceMonthly: estimate?.deviceMonthly ?? null, deviceLabel: estimate?.deviceLabel ?? null, currentPhone: phone?.hasDevice ? phone.model : null, phoneAssumed: estimate?.closestMatch ?? false }
}

type SpectraMessage = ChatMessage & { imageDataUrl?: string; imageAnalysis?: ImageAnalysis; imageAnalysisType?: ImageAnalysisType; billComparison?: BillComparison }

const initialMessages: SpectraMessage[] = [{
  role: 'assistant',
  content: 'Hi, I’m Spectra 👋 I can help you find a plan, choose a device, troubleshoot your internet and more. What can I help with?',
}]

const commonRequests = [
  { label: 'Get a mobile plan', prompt: 'I need a new mobile plan.' },
  { label: 'Shop for a phone', prompt: 'I’m looking for a new phone.' },
  { label: 'Sign up for Internet', prompt: 'I’m interested in signing up for Spectrum Internet.' },
  { label: 'Explore TV', prompt: 'I’m interested in signing up for Spectrum TV.' },
  { label: 'Troubleshoot a service', prompt: 'I need help troubleshooting a service issue.' },
  { label: 'Understand my bill', prompt: 'I need help understanding my bill.' },
]

function App() {
  const [page, setPage] = useState<Page>('home')
  const [cartCount, setCartCount] = useState(0)
  const [cartLabel, setCartLabel] = useState('Spectrum Mobile plan')
  const [cartMonthlyPrice, setCartMonthlyPrice] = useState<number | null>(50)
  const [spectraOpen, setSpectraOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [messages, setMessages] = useState<SpectraMessage[]>(initialMessages)
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile>(emptyCustomerProfile)
  const [planJourneyStarted, setPlanJourneyStarted] = useState(false)
  const [completedJourneyQuestions, setCompletedJourneyQuestions] = useState<JourneyStage[]>([])
  const [currentJourneyStage, setCurrentJourneyStage] = useState<JourneyStage | null>(null)
  const [planRecommendation, setPlanRecommendation] = useState<PlanRecommendation>()
  const [troubleshooting, setTroubleshooting] = useState<TroubleshootingState | null>(null)
  const [imageAnalyzing, setImageAnalyzing] = useState(false)
  const [billJourney, setBillJourney] = useState<BillJourneyState | null>(null)
  const [deviceUpgrade, setDeviceUpgrade] = useState<DeviceUpgradeState | null>(null)
  const [executiveJourney, setExecutiveJourney] = useState<DemoJourneyState | null>(null)
  const [input, setInput] = useState('')
  const [speechReady, setSpeechReady] = useState(false)
  const [listening, setListening] = useState(false)
  const [readAloud, setReadAloud] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [listenTick, setListenTick] = useState(0)
  const speakingRef = useRef(false)
  const speakId = useRef(0)
  const spokenCount = useRef(0)
  const submitRef = useRef<(event?: FormEvent, content?: string) => Promise<void>>(async () => {})
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [email, setEmail] = useState('')
  const [signedIn, setSignedIn] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!spectraOpen || !(azureCapabilities.speechInput || azureCapabilities.speechOutput)) return
    let active = true
    void isSpeechAvailable().then((ok) => { if (active) setSpeechReady(ok) })
    return () => { active = false }
  }, [spectraOpen])
  useEffect(() => {
    if (!readAloud) {
      stopSpeaking()
      speakingRef.current = false
      setSpeaking(false)
      spokenCount.current = messages.length
      return
    }
    const last = messages[messages.length - 1]
    if (messages.length > spokenCount.current && last?.role === 'assistant') {
      const id = ++speakId.current
      speakingRef.current = true
      setSpeaking(true)
      void speak(last.content).finally(() => {
        if (speakId.current !== id) return
        speakingRef.current = false
        setSpeaking(false)
      })
    }
    spokenCount.current = messages.length
  }, [messages, readAloud])
  useEffect(() => {
    if (!spectraOpen && voiceMode) setVoiceMode(false)
    if (!spectraOpen) stopSpeaking()
  }, [spectraOpen, voiceMode])
  useEffect(() => {
    if (!voiceMode || !spectraOpen || sending || speaking || speakingRef.current) return
    let cancelled = false
    setListening(true)
    setChatError('')
    listenOnce()
      .then(async (transcript) => {
        if (cancelled) return
        setListening(false)
        if (/\b(stop|end|quit|turn off|disable)\b.*\b(listening|voice|microphone|mic)\b/i.test(transcript)) {
          setVoiceMode(false)
          return
        }
        await submitRef.current(undefined, transcript)
      })
      .catch((error) => {
        if (cancelled || error instanceof SpeechCancelledError) return
        setListening(false)
        if (error instanceof SpeechNoMatchError) { setListenTick((tick) => tick + 1); return }
        setVoiceMode(false)
        setChatError(error instanceof Error ? error.message : 'Voice input failed. Please try again.')
      })
    return () => {
      cancelled = true
      stopListening()
      setListening(false)
    }
  }, [voiceMode, spectraOpen, sending, speaking, listenTick])
  function toggleVoiceMode() {
    if (voiceMode) {
      setVoiceMode(false)
      return
    }
    if (azureCapabilities.speechOutput) setReadAloud(true)
    setVoiceMode(true)
  }  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [page])
  useEffect(() => {
    if (troubleshooting) console.info(`[Spectra troubleshooting] current stage: ${troubleshooting.stage}`, { issueType: troubleshooting.issueType, affectedRoom: troubleshooting.affectedRoom, completedSteps: troubleshooting.completedSteps.length })
  }, [troubleshooting])
  useEffect(() => {
    if (!troubleshooting?.demoMode || troubleshooting.stage !== 'identify' || troubleshooting.customerResponses.length > 0) return
    const timer = window.setTimeout(() => {
      const identified = recordTroubleshootingResponse(troubleshooting, 'Weak signal')
      setTroubleshooting(identified)
      setMessages((existing) => [...existing, { role: 'user', content: 'Weak signal' }, { role: 'assistant', content: troubleshootingReply(identified) }])
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [troubleshooting])
  useEffect(() => {
    if (troubleshooting?.stage !== 'diagnostics' || troubleshooting.diagnosticResults) return
    const timer = window.setTimeout(() => {
      const completed = completeDiagnostics(troubleshooting)
      setTroubleshooting(completed)
      setMessages((existing) => [...existing, { role: 'assistant', content: troubleshootingReply(completed) }])
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [troubleshooting])
  useEffect(() => {
    if (!troubleshooting?.demoMode || troubleshooting.stage !== 'resolution' || troubleshooting.completedSteps.length > 0) return
    const timer = window.setTimeout(() => {
      const resolved = recordTroubleshootingResponse(troubleshooting, 'That helped')
      setTroubleshooting(resolved)
      setMessages((existing) => [...existing, { role: 'user', content: 'I moved closer to the gateway and tested again. That helped.' }, { role: 'assistant', content: troubleshootingReply(resolved) }])
    }, 4300)
    return () => window.clearTimeout(timer)
  }, [troubleshooting])
  useEffect(() => {
    const handleSuggestedMessage = (event: Event) => {
      const message = (event as CustomEvent<string>).detail
      if (message) void submitMessage(undefined, message)
    }
    window.addEventListener('spectra-message', handleSuggestedMessage)
    return () => window.removeEventListener('spectra-message', handleSuggestedMessage)
  }, [messages, sending])

  function navigate(next: Page) {
    setPage(next)
    setMobileMenu(false)
    setSearchOpen(false)
  }

  function runBillJourney(kind: BillJourneyKind) {
    if (sending || imageAnalyzing) return
    setDemoOpen(false)
    setSpectraOpen(true)
    setTroubleshooting(null)
    setDeviceUpgrade(null)
    setExecutiveJourney(null)
    setPlanJourneyStarted(false)
    setCompletedJourneyQuestions([])
    setCurrentJourneyStage(null)
    setPlanRecommendation(undefined)
    const state = beginBillJourney(kind)
    setBillJourney(state)
    setMessages([...initialMessages, { role: 'assistant', content: billJourneyPrompt(state) }])
  }

  async function analyzeJourneyImage(file: File) {
    if (imageAnalyzing || sending) return
    const accepted = ['image/jpeg', 'image/png', 'image/webp']
    if (!accepted.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setChatError(!accepted.includes(file.type) ? 'Choose a JPG, JPEG, PNG, or WEBP image.' : 'The image must be 5 MB or smaller.')
      return
    }
    setChatError('')
    setImageAnalyzing(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image.'))
        reader.onerror = () => reject(new Error('Could not read the image.'))
        reader.readAsDataURL(file)
      })
      const analysisType: ImageAnalysisType = deviceUpgrade?.stage === 'tradeIn' ? 'tradeIn' : billJourney ? 'bill' : 'modem'
      const uploadLabel = analysisType === 'tradeIn' ? 'Trade-in phone image uploaded.' : analysisType === 'bill' ? 'Bill image uploaded.' : 'Modem or gateway image uploaded.'
      setMessages((current) => [...current, { role: 'user', content: uploadLabel, imageDataUrl: dataUrl, imageAnalysisType: analysisType }])
      const { analysis } = await analyzeImage(file, dataUrl, analysisType)
      if (analysisType === 'tradeIn' && deviceUpgrade) {
        const retake = analysis.tradeInOutlook === 'need-better-photo'
        if (!retake) setDeviceUpgrade(completeTradeIn(deviceUpgrade, analysis))
        setMessages((current) => [...current, { role: 'assistant', content: `${tradeInAssessmentReply(analysis)}${retake ? '' : ' Here’s a phone to consider next.'}`, imageAnalysis: analysis, imageAnalysisType: analysisType }])
        return
      }
      const services = billJourney?.services ?? (analysis.services?.join(' + ') || null)
      const detectedPhone: BillPhone | null = analysis.includesDevicePayment === true ? { hasDevice: true, model: analysis.deviceModel ?? null } : analysis.includesDevicePayment === false ? { hasDevice: false, model: null } : null
      const phone = billJourney?.phone ?? detectedPhone
      const needsPhoneDetails = billJourney?.kind === 'compare' && /mobile/i.test(services ?? '') && phone === null
      const billComparison = billJourney?.kind === 'compare' ? buildBillComparison(billJourney, analysis, phone) : undefined
      setMessages((current) => [...current, { role: 'assistant', content: analysis.issueSummary, imageAnalysis: analysis, imageAnalysisType: analysisType, billComparison }])
      if (billJourney && needsPhoneDetails) {
        const awaiting: BillJourneyState = { ...billJourney, services, analysis, stage: 'phone' }
        setBillJourney(awaiting)
        setMessages((current) => [...current, { role: 'assistant', content: billJourneyPrompt(awaiting) }])
        return
      }
      if (billJourney) setBillJourney(null)
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Image analysis failed. Please try again.')
    } finally {
      setImageAnalyzing(false)
    }
  }

  async function submitMessage(event?: FormEvent, content = input) {
    event?.preventDefault()
    const text = content.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setChatError('')
    setSending(true)
    try {
      const recentUserMessages = messages.filter((message) => message.role === 'user').slice(-1)
      const recentUserContext = recentUserMessages.map((message) => message.content).join(' ')
      const contextualBillKind = [...recentUserMessages].reverse().map((message) => detectBillJourneyKind(message.content)).find((kind) => kind !== null) ?? null
      const currentBillKind = detectBillJourneyKind(text)
      const contextualBillPhoto = isBillImageShareRequest(text, recentUserContext)
      const requestedBillKind = currentBillKind ?? (contextualBillPhoto ? billJourney?.kind ?? contextualBillKind ?? 'billing' : null)
      if (requestedBillKind && billJourney?.kind !== requestedBillKind) {
        const started = beginBillJourney(requestedBillKind)
        setBillJourney(started)
        setTroubleshooting(null)
        setDeviceUpgrade(null)
        setExecutiveJourney(null)
        setPlanJourneyStarted(false)
        setCompletedJourneyQuestions([])
        setCurrentJourneyStage(null)
        setPlanRecommendation(undefined)
        setMessages([...next, { role: 'assistant', content: billJourneyPrompt(started) }])
        return
      }
      if (billJourney && billJourney.stage === 'upload' && /\b(photo|picture|image|snapshot|bill|upload|send|share)\b/i.test(text)) {
        setMessages([...next, { role: 'assistant', content: billJourneyPrompt(billJourney) }])
        return
      }
      if (billJourney && billJourney.stage !== 'upload') {
        const updated = answerBillJourney(billJourney, text)
        if (updated.stage === 'upload' && updated.analysis) {
          const comparison = buildBillComparison(updated, updated.analysis, updated.phone)
          setBillJourney(null)
          setMessages([...next, { role: 'assistant', content: 'Thanks—here’s the updated comparison with your phone included.', imageAnalysis: updated.analysis, imageAnalysisType: 'bill', billComparison: comparison }])
          return
        }
        setBillJourney(updated)
        setMessages([...next, { role: 'assistant', content: billJourneyPrompt(updated) }])
        return
      }
      if (isModemImageShareRequest(text, recentUserContext)) {
        const imageJourney = troubleshooting ?? beginTroubleshooting('modem diagnostics')
        activateTroubleshooting(imageJourney)
        setMessages([...next, { role: 'assistant', content: 'Yes—you can share a clear photo of your modem or gateway. Use Take a photo or Upload an image below, and I’ll check the visible lights, connections, and error indicators.' }])
        return
      }
      const changingMind = /\b(?:don't|do not|no longer|changed my mind|instead|rather|forget)\b/i.test(text)
      if (changingMind && deviceUpgrade && deviceUpgrade.stage !== 'recommendation' && isPlanJourneyRequest(text)) {
        console.info('[Spectra journey] switching from device upgrade to mobile plan')
        setDeviceUpgrade(null)
        setTroubleshooting(null)
        setExecutiveJourney(null)
        setPlanRecommendation(undefined)
        setCompletedJourneyQuestions([])
        const result = await sendMessage(next, customerProfile, false, [], null)
        setCustomerProfile(result.profile)
        setPlanJourneyStarted(result.journeyStarted)
        setCompletedJourneyQuestions(result.completedQuestions)
        setCurrentJourneyStage(result.currentStage)
        setPlanRecommendation(result.recommendation)
        setMessages([...next, { role: 'assistant', content: result.reply }])
        return
      }
      if (changingMind && planJourneyStarted && isDeviceUpgradeRequest(text)) {
        console.info('[Spectra journey] switching from mobile plan to device upgrade')
        setPlanJourneyStarted(false)
        setCompletedJourneyQuestions([])
        setCurrentJourneyStage(null)
        setPlanRecommendation(undefined)
        setTroubleshooting(null)
        setExecutiveJourney(null)
        const startedUpgrade = beginDeviceUpgrade()
        setDeviceUpgrade(startedUpgrade)
        setMessages([...next, { role: 'assistant', content: deviceUpgradeQuestion(startedUpgrade.stage) }])
        return
      }
      const journeyActive = Boolean(
        (executiveJourney && !executiveJourney.complete)
        || (troubleshooting && troubleshooting.stage !== 'resolved')
        || (deviceUpgrade && deviceUpgrade.stage !== 'recommendation')
        || (planJourneyStarted && currentJourneyStage),
      )
      const stepOptions = executiveJourney && !executiveJourney.complete ? currentDemoJourneyStep(executiveJourney)?.options ?? [] : []
      if (journeyActive && !isRelevantToJourney(text, stepOptions)) {
        console.info('[Spectra journey] off-topic message sent to GPT; journey state unchanged')
        const reply = await askGpt(next, customerProfile)
        setMessages([...next, { role: 'assistant', content: reply }])
        setSending(false)
        return
      }
      if (executiveJourney && !executiveJourney.complete) {
        if (!isDemoAnswerAcceptable(executiveJourney, text)) {
          setMessages([...next, { role: 'assistant', content: demoJourneyReprompt(executiveJourney) }])
          setSending(false)
          return
        }
        const updated = answerDemoJourney(executiveJourney, text)
        setExecutiveJourney(updated)
        const step = currentDemoJourneyStep(updated)
        const reply = updated.complete
          ? updated.completionMessage ?? 'This demo journey is complete.'
          : step?.prompt ?? 'Let’s continue.'
        setMessages([...next, { role: 'assistant', content: reply }])
        setSending(false)
        return
      }
      if (troubleshooting?.stage === 'resolved') {
        if (isTroubleshootingRequest(text)) {
          const nextTroubleshooting = beginTroubleshooting(text)
          activateTroubleshooting(nextTroubleshooting)
          setMessages([...next, { role: 'assistant', content: troubleshootingReply(nextTroubleshooting) }])
          setSending(false)
          return
        }
        setTroubleshooting(null)
      } else if (troubleshooting) {
        const nextTroubleshooting = recordTroubleshootingResponse(troubleshooting, text)
        setTroubleshooting(nextTroubleshooting)
        setMessages([...next, { role: 'assistant', content: troubleshootingActionReply(nextTroubleshooting, text) }])
        setSending(false)
        return
      }
      if (isTroubleshootingRequest(text)) {
        const nextTroubleshooting = beginTroubleshooting(text)
        activateTroubleshooting(nextTroubleshooting)
        setMessages([...next, { role: 'assistant', content: troubleshootingReply(nextTroubleshooting) }])
        setSending(false)
        return
      }
      if (deviceUpgrade?.stage === 'tradeIn' && /\b(yes|yeah|yep|sure|have|trade)\b/i.test(text) && !/\b(no|not|don't|dont|skip|without)\b/i.test(text)) {
        setMessages([...next, { role: 'assistant', content: 'Great—choose Take a photo or Upload an image below. Please show the full front of the phone, and the back too if you can.' }])
        setSending(false)
        return
      }
      if (deviceUpgrade && deviceUpgrade.stage !== 'recommendation') {
        const updated = advanceDeviceUpgrade(deviceUpgrade, text)
        setDeviceUpgrade(updated)
        setMessages([...next, { role: 'assistant', content: updated.stage === 'recommendation'
          ? `Great—${describeDeviceMatch(updated)} My phone pricing here is a reference, not a live offer.`
          : deviceUpgradeQuestion(updated.stage) }])
        setSending(false)
        return
      }
      if (isDeviceUpgradeRequest(text)) {
        const startedUpgrade = beginDeviceUpgrade()
        setDeviceUpgrade(startedUpgrade)
        setExecutiveJourney(null)
        setTroubleshooting(null)
        setPlanJourneyStarted(false)
        setCompletedJourneyQuestions([])
        setCurrentJourneyStage(null)
        setPlanRecommendation(undefined)
        setMessages([...next, { role: 'assistant', content: deviceUpgradeQuestion(startedUpgrade.stage) }])
        setSending(false)
        return
      }
      const result = await sendMessage(next, customerProfile, planJourneyStarted, completedJourneyQuestions, currentJourneyStage)
      setCustomerProfile(result.profile)
      setPlanJourneyStarted(result.journeyStarted)
      setCompletedJourneyQuestions(result.completedQuestions)
      setCurrentJourneyStage(result.currentStage)
      setPlanRecommendation(result.recommendation)
      setMessages([...next, { role: 'assistant', content: result.reply }])
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  submitRef.current = submitMessage

  function resetConversation() {
    if (sending || imageAnalyzing) return
    setVoiceMode(false)
    stopListening()
    setMessages(initialMessages)
    setImageAnalyzing(false)
    setBillJourney(null)
    setCustomerProfile(emptyCustomerProfile)
    setPlanJourneyStarted(false)
    setCompletedJourneyQuestions([])
    setCurrentJourneyStage(null)
    setPlanRecommendation(undefined)
    setTroubleshooting(null)
    setDeviceUpgrade(null)
    setExecutiveJourney(null)
    setInput('')
    setChatError('')
  }

  function runWalkthrough(prompt: string) {
    setDemoOpen(false)
    setSpectraOpen(true)
    submitMessage(undefined, prompt)
  }

  function runExecutiveJourney(id: DemoJourneyId, prompt: string) {
    setBillJourney(null)
    if (sending) return
    setDemoOpen(false)
    const journey = startDemoJourney(id)
    setExecutiveJourney(journey)
    setTroubleshooting(null)
    setDeviceUpgrade(null)
    setPlanJourneyStarted(false)
    setCompletedJourneyQuestions([])
    setCurrentJourneyStage(null)
    setPlanRecommendation(undefined)
    setCustomerProfile(emptyCustomerProfile)
    setChatError('')
    setInput('')
    setMessages([
      { role: 'assistant', content: initialMessages[0].content },
      { role: 'user', content: prompt },
      { role: 'assistant', content: `${demoJourneyOpening(journey)} ${currentDemoJourneyStep(journey)?.prompt ?? ''}`.trim() },
    ])
    setSpectraOpen(true)
  }

  function runDeviceUpgradeJourney() {
    setBillJourney(null)
    if (sending) return
    setDemoOpen(false)
    const startedUpgrade = beginDeviceUpgrade()
    setDeviceUpgrade(startedUpgrade)
    setTroubleshooting(null)
    setExecutiveJourney(null)
    setPlanJourneyStarted(false)
    setCompletedJourneyQuestions([])
    setCurrentJourneyStage(null)
    setPlanRecommendation(undefined)
    setCustomerProfile(emptyCustomerProfile)
    setChatError('')
    setMessages([
      { role: 'assistant', content: initialMessages[0].content },
      { role: 'user', content: 'I’m thinking about upgrading my phone. What should I consider?' },
      { role: 'assistant', content: deviceUpgradeQuestion(startedUpgrade.stage) },
    ])
    setSpectraOpen(true)
  }

  function runTroubleshootingDemo() {
    if (sending) return
    const report = 'My bedroom has bad WiFi.'
    const nextTroubleshooting = beginTroubleshooting(report, true)
    setMessages([
      { role: 'assistant', content: initialMessages[0].content },
      { role: 'user', content: report },
      { role: 'assistant', content: troubleshootingReply(nextTroubleshooting) },
    ])
    activateTroubleshooting(nextTroubleshooting)
    setCustomerProfile(emptyCustomerProfile)
    setChatError('')
    setSpectraOpen(true)
  }

  function activateTroubleshooting(state: TroubleshootingState) {
    setBillJourney(null)
    setTroubleshooting(state)
    setDeviceUpgrade(null)
      setExecutiveJourney(null)
    setPlanJourneyStarted(false)
    setCompletedJourneyQuestions([])
    setCurrentJourneyStage(null)
    setPlanRecommendation(undefined)
  }

  function addToCart(label: string, monthlyPrice: number | null = 50) {
    setCartLabel(label)
    setCartMonthlyPrice(monthlyPrice)
    setCartCount((count) => count + 1)
    navigate('cart')
  }

  function addRecommendationToCart(recommendation: PlanRecommendation) {
    const lines = customerProfile.lineCount ?? recommendation.lineCount
    const data = customerProfile.dataUsage ?? 60
    addToCart(`${recommendation.planName} — ${data} GB, ${lines} ${lines === 1 ? 'line' : 'lines'}`, recommendation.monthlyEstimate)
    setSpectraOpen(false)
  }

  function addUpgradeDeviceToCart(deviceName: string) {
    const product = productCards.find((item) => item.name === deviceName)
    addToCart(deviceName, product ? deviceMonthlyPrice(product) : null)
    setSpectraOpen(false)
  }

  return (
    <>
      <header className="site-header">
        <div className={`navigation-wrap ${mobileMenu ? 'navigation-open' : ''}`}>
          <div className="top-bar">
            <button className="wordmark wordmark-header" onClick={() => navigate('home')} aria-label="Spectrum home"><SpectrumLogo /></button>
            <nav className="main-nav" aria-label="Main navigation">
              {navigation.map((item) => <button key={item.label} onClick={() => navigate(item.page)} className={page === item.page ? 'nav-active' : ''}>{item.label}</button>)}
            </nav>
            <div className="header-actions">
              <button className="mobile-nav-toggle" aria-label={mobileMenu ? 'Close menu' : 'Open menu'} onClick={() => setMobileMenu(!mobileMenu)}><Icon name={mobileMenu ? 'close' : 'menu'} /></button>
              <button className="header-link search-trigger" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search"><Icon name="search" /><span>Search</span></button>
              <button className="header-link" onClick={() => navigate('account')} aria-label={signedIn ? 'My Spectrum App account' : 'Sign in'}><Icon name="person" /><span>{signedIn ? 'My Spectrum App' : 'Sign in'}</span></button>
              <button className="header-link cart-trigger" onClick={() => navigate('cart')} aria-label={`Shopping cart, ${cartCount} items`}><Icon name="cart" /><span>Cart</span>{cartCount > 0 && <b className="cart-count">{cartCount}</b>}</button>
              <button className={`header-link architecture-trigger ${page === 'architecture' ? 'nav-active' : ''}`} onClick={() => navigate('architecture')} aria-label="View solution architecture"><Icon name="shield" /><span>Architecture</span></button>
              <button className="demo-button" onClick={() => setDemoOpen(true)}><Icon name="spark" size={16} /><span>Executive Demo</span></button>
            </div>
          </div>
        </div>
        {searchOpen && <div className="search-panel"><div className="search-inner page-width"><Icon name="search" /><input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(searchText.toLowerCase().includes('internet') ? 'internet' : searchText.toLowerCase().includes('phone') || searchText.toLowerCase().includes('device') ? 'devices' : 'mobile') }} placeholder="What are you looking for?" aria-label="Search Spectrum" /><button onClick={() => navigate(searchText.toLowerCase().includes('internet') ? 'internet' : 'mobile')}>Search <Icon name="arrow" size={15} /></button></div><div className="search-suggestions page-width"><span>Popular:</span>{['5G plans', 'Internet deals', 'New phones'].map((item) => <button key={item} onClick={() => { setSearchText(item); navigate(item.includes('Internet') ? 'internet' : item.includes('phones') ? 'devices' : 'mobile') }}>{item}</button>)}</div></div>}
      </header>

      <main>
        {page === 'home' && <HomePage onNavigate={navigate} onAdd={addToCart} onDemo={() => setDemoOpen(true)} />}
        {page === 'mobile' && <MobilePlansPage onAdd={addToCart} onChat={() => setSpectraOpen(true)} onPhones={() => navigate('devices')} />}
        {page === 'internet' && <CategoryPage category="internet" onAdd={addToCart} onChat={() => setSpectraOpen(true)} />}
        {page === 'tv' && <CategoryPage category="tv" onAdd={addToCart} onChat={() => setSpectraOpen(true)} />}
        {page === 'smartHome' && <HomeWifiPage onAdd={addToCart} onChat={() => setSpectraOpen(true)} />}
        {page === 'homePhone' && <CategoryPage category="homePhone" onAdd={addToCart} onChat={() => setSpectraOpen(true)} />}
        {page === 'devices' && <DevicesPage onAdd={addToCart} />}
        {page === 'architecture' && <ArchitecturePage onChat={() => setSpectraOpen(true)} />}
        {page === 'about' && <AboutSpectrumPage onNavigate={navigate} />}
        {page === 'support' && <SupportPage onNavigate={navigate} onChat={() => setSpectraOpen(true)} />}
        {page === 'account' && <AccountPage signedIn={signedIn} email={email} setEmail={setEmail} onSignIn={() => setSignedIn(true)} onChat={() => setSpectraOpen(true)} />}
        {page === 'cart' && <CartPage count={cartCount} label={cartLabel} monthlyPrice={cartMonthlyPrice} onNavigate={navigate} onRemove={() => setCartCount(0)} />}
        {page === 'checkout' && <CheckoutPage step={checkoutStep} label={cartLabel} monthlyPrice={cartMonthlyPrice} setStep={(next) => setCheckoutStep(checkoutStep === 3 && next === 1 ? 4 : next)} />}
      </main>

      <Footer onNavigate={navigate} />

      {!spectraOpen && <button className="spectra-launcher" onClick={() => setSpectraOpen(true)} aria-label="Chat with Spectra, your AI assistant"><span className="spectra-launcher-icon"><Icon name="spark" size={21} /></span><span>Chat with Spectra</span><span className="online-dot" /></button>}
      {spectraOpen && <aside className="spectra-panel" aria-label="Chat with Spectra" aria-modal="true" role="dialog">
        <div className="spectra-header">
          <div className="spectra-avatar"><Icon name="spark" size={22} /></div><div className="spectra-heading"><strong>Spectra</strong><span><i /> Your Spectrum assistant</span></div>
          <button className="chat-reset" onClick={resetConversation} disabled={sending || imageAnalyzing} aria-label="Start a new conversation with Spectra" title="Start a new conversation"><Icon name="reset" size={15} /><span>New chat</span></button>
          <button className="panel-close" onClick={() => setSpectraOpen(false)} aria-label="Close Spectra chat"><Icon name="close" /></button>
        </div>
        <div className="spectra-context"><Icon name="shield" size={14} /> Helpful answers, here whenever you need them</div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`chat-message ${message.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>{message.role === 'assistant' && <span className="tiny-spectra"><Icon name="spark" size={13} /></span>}<div className="chat-message-content"><p>{message.content}</p>{message.imageDataUrl && <img className="chat-image-attachment" src={message.imageDataUrl} alt={message.imageAnalysisType === 'bill' ? 'Customer-uploaded bill' : message.imageAnalysisType === 'tradeIn' ? 'Customer-uploaded trade-in phone' : 'Customer-uploaded modem or gateway'} />}{message.imageAnalysis && <ImageAnalysisCard analysis={message.imageAnalysis} analysisType={message.imageAnalysisType ?? 'modem'} comparison={message.billComparison} />}</div></div>)}
          {(sending || imageAnalyzing) && <div className="typing-indicator" aria-label={imageAnalyzing ? "Spectra is analyzing the image" : "Spectra is typing"}><span /><span /><span /></div>}
          {chatError && <div className="chat-error" role="alert">{chatError} {messages[messages.length - 1]?.imageDataUrl ? <button onClick={() => setChatError('')}>Dismiss</button> : <button onClick={() => submitMessage(undefined, messages[messages.length - 1]?.content || '')}>Try again</button>}</div>}
          <div ref={chatEndRef} />
        </div>
        {troubleshooting && <TroubleshootingExperience state={troubleshooting} onSelect={(answer) => submitMessage(undefined, answer)} onImage={analyzeJourneyImage} imageAnalyzing={imageAnalyzing} disabled={sending || imageAnalyzing} />}
        {billJourney && <BillJourneyPanel state={billJourney} onSelect={(answer) => submitMessage(undefined, answer)} onImage={analyzeJourneyImage} imageAnalyzing={imageAnalyzing} disabled={sending || imageAnalyzing} />}
        {planRecommendation && !troubleshooting && <RecommendationSummary profile={customerProfile} recommendation={planRecommendation} onAdd={() => addRecommendationToCart(planRecommendation)} />}
        {deviceUpgrade && <DeviceUpgradePanel state={deviceUpgrade} onImage={analyzeJourneyImage} imageAnalyzing={imageAnalyzing} onSelect={(answer) => submitMessage(undefined, answer)} onAdd={() => deviceUpgrade.recommendation && addUpgradeDeviceToCart(deviceUpgrade.recommendation.name)} onBrowse={() => { setSpectraOpen(false); navigate('devices') }} disabled={sending} />}
        {executiveJourney && <ExecutiveJourneyPanel state={executiveJourney} onSelect={(answer) => submitMessage(undefined, answer)} disabled={sending} />}
        {messages.length === 1 && <div className="suggestion-chips"><span className="suggestion-heading">Popular requests</span>{commonRequests.map((request) => <button key={request.label} onClick={() => submitMessage(undefined, request.prompt)} disabled={sending}>{request.label} <Icon name="arrow" size={13} /></button>)}</div>}
        {messages.length === 1 && <button className="troubleshooting-demo-button" onClick={runTroubleshootingDemo} disabled={sending}><Icon name="play" size={14} /> Demo Walkthrough: bedroom WiFi fix</button>}
        {planJourneyStarted && currentJourneyStage && <JourneyQuickReplies stage={currentJourneyStage} onSelect={(answer) => submitMessage(undefined, answer)} disabled={sending} />}
        <form className="chat-composer" onSubmit={(event) => submitMessage(event)}><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitMessage() } }} placeholder="Ask Spectra anything..." aria-label="Message Spectra" disabled={sending || imageAnalyzing} />{speechReady && azureCapabilities.speechInput && <button type="button" className={voiceMode ? 'voice-button is-active' : 'voice-button'} onClick={toggleVoiceMode} aria-label={voiceMode ? 'Stop listening' : 'Start voice conversation'} aria-pressed={voiceMode} title={voiceMode ? (listening ? 'Listening… click to stop' : 'Voice conversation on — click to stop') : 'Start voice conversation'}><Icon name="mic" size={17} /></button>}{speechReady && azureCapabilities.speechOutput && <button type="button" className={readAloud ? 'voice-button is-active' : 'voice-button'} onClick={() => setReadAloud(!readAloud)} aria-label="Read Spectra's replies aloud" aria-pressed={readAloud}><Icon name="speaker" size={17} /></button>}<button type="submit" disabled={!input.trim() || sending || imageAnalyzing} aria-label="Send message"><Icon name="send" size={17} /></button></form>
        <p className="chat-disclaimer">Spectra uses AI and can make mistakes. Don’t share sensitive info.</p>
      </aside>}

      {demoOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDemoOpen(false) }}><section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title"><div className="demo-modal-top"><span className="demo-kicker"><Icon name="spark" size={16} /> SPECTRUM EXPERIENCE STUDIO</span><button className="panel-close" onClick={() => setDemoOpen(false)} aria-label="Close executive demo"><Icon name="close" /></button></div><h2 id="demo-title">A more personal kind<br />of connection.</h2><p className="demo-intro">Explore how AI can make every customer moment feel more thoughtful. Choose a journey to begin.</p><div className="walkthrough-grid">{walkthroughs.map((item, index) => <button key={item.id} className="walkthrough-tile" onClick={() => item.id === 'upgrade' ? runDeviceUpgradeJourney() : item.id === 'sales' ? runWalkthrough(item.prompt) : item.id === 'care' ? runBillJourney('billing') : item.id === 'compare' ? runBillJourney('compare') : runExecutiveJourney(item.id as DemoJourneyId, item.prompt)}><span className="tile-icon"><Icon name={item.icon} size={19} /></span><span className="tile-number">0{index + 1}</span><strong>{item.title}</strong><small>{item.text}</small><span className="tile-arrow"><Icon name="arrow" size={16} /></span></button>)}</div><div className="demo-modal-foot"><span><i className="online-dot" /> Interactive preview</span><span>Powered by Spectrum AI</span></div></section></div>}
    </>
  )
}

function ExecutiveJourneyPanel({ state, onSelect, disabled }: { state: DemoJourneyState; onSelect: (answer: string) => void; disabled: boolean }) {
  const step = currentDemoJourneyStep(state)
  const total = 3
  return <section className="executive-journey-card" aria-label={`${state.title} guided journey`}>
    <div className="executive-journey-header"><span className="executive-journey-icon"><Icon name={state.complete ? 'check' : 'spark'} size={16} /></span><div><strong>{state.complete ? 'Journey complete' : state.title}</strong><small>{state.complete ? 'Your choices are saved in this chat' : `Step ${state.stage + 1} of ${total}`}</small></div>{!state.complete && <span className="executive-progress">{Math.round((state.stage / total) * 100)}%</span>}</div>
    {!state.complete && step && <div className="executive-journey-choices"><span>{step.prompt}</span><div>{step.options.map((option) => <button key={option} onClick={() => onSelect(option)} disabled={disabled}>{option}</button>)}</div></div>}
    {state.answers.length > 0 && <details className="executive-journey-answers"><summary>{state.complete ? 'Journey summary' : 'Your answers so far'}</summary><ol>{state.answers.map((answer, index) => <li key={`${index}-${answer}`}>{answer}</li>)}</ol></details>}
    {state.complete && <div className="executive-journey-done"><Icon name="check" size={15} /><span>All steps complete. You can start another demo using Executive Demo.</span></div>}
  </section>
}

function DeviceUpgradePanel({ state, onImage, imageAnalyzing, onSelect, onAdd, onBrowse, disabled }: { state: DeviceUpgradeState; onImage: (file: File) => void; imageAnalyzing: boolean; onSelect: (answer: string) => void; onAdd: () => void; onBrowse: () => void; disabled: boolean }) {
  const options: Record<Exclude<DeviceUpgradeStage, 'recommendation'>, { label: string; answer: string }[]> = {
    currentDevice: [
      { label: 'Apple iPhone', answer: 'I currently use an iPhone' },
      { label: 'Samsung Galaxy', answer: 'I currently use a Samsung Galaxy' },
      { label: 'Google Pixel', answer: 'I currently use a Google Pixel' },
      { label: 'Something else', answer: 'I use another phone' },
    ],
    priorities: [
      { label: 'Camera', answer: 'Camera quality matters most' },
      { label: 'Battery', answer: 'Battery life matters most' },
      { label: 'Gaming & performance', answer: 'Gaming and performance matter most' },
      { label: 'Value', answer: 'Value and price matter most' },
    ],
    budget: [
      { label: 'Under $30/mo.', answer: 'Under $30 per month' },
      { label: '$30–$50/mo.', answer: 'Around $30 to $50 per month' },
      { label: 'Flexible', answer: 'Flexible for the right phone' },
    ],
    tradeIn: [
      { label: 'No trade-in', answer: 'No trade-in, skip' },
    ],
  }
  const product = state.recommendation
  return <section className="upgrade-journey-card" aria-label="Guided phone upgrade">
    <div className="upgrade-journey-heading"><span className="upgrade-heading-icon"><Icon name="phone" size={16} /></span><div><strong>{product ? 'Your phone match' : 'Phone upgrade journey'}</strong><small>{product ? 'Personalized to your preferences' : `Step ${state.stage === 'currentDevice' ? 1 : state.stage === 'priorities' ? 2 : state.stage === 'budget' ? 3 : 4} of 4 · ${state.stage === 'currentDevice' ? 'Current phone' : state.stage === 'priorities' ? 'What matters most' : state.stage === 'budget' ? 'Monthly budget' : 'Trade-in'}`}</small></div></div>
    {!product && state.stage !== 'recommendation' && <div className="upgrade-quick-replies"><span>{deviceUpgradeQuestion(state.stage)}</span><div>{state.stage === 'tradeIn' && <><div className="troubleshooting-image-actions"><label className="troubleshooting-image-button">Take a photo<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" capture="environment" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label><label className="troubleshooting-image-button">Upload an image<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label></div><small>JPG, JPEG, PNG, or WEBP · Up to 5 MB. Visible condition only; final trade-in credit needs a full device check.</small>{imageAnalyzing && <small role="status">Checking your phone’s condition…</small>}</>}{options[state.stage].map((option) => <button key={option.label} onClick={() => onSelect(option.answer)} disabled={disabled || imageAnalyzing}>{option.label}</button>)}</div></div>}
    {product && <>
      <article className="upgrade-recommendation">
        <div className={`upgrade-product-art ${product.swatch}`}><div className="product-phone"><i /><b /><span /></div></div>
        <div className="upgrade-product-copy"><span>{product.line} · A good fit for you</span><h3>{product.name}</h3><p>{describeDeviceMatch(state)}</p>
          {product.monthlyPrice ? <strong>{product.monthlyPrice}</strong> : <strong>See current pricing options</strong>}
          {product.priceNote && <small>{product.priceNote}</small>}
        </div>
      </article>
      <p className="upgrade-pricing-note">Pricing reflects the device reference data available in this demo, not a live offer. Confirm current financing, trade-in value, plan eligibility and taxes before purchase.</p>
      <div className="upgrade-recommendation-actions"><button className="button-primary" onClick={onAdd}>Add this phone to cart <Icon name="arrow" size={14} /></button><button className="button-outline" onClick={onBrowse}>Compare all phones</button></div>
    </>}
  </section>
}

function BillJourneyPanel({ state, onSelect, onImage, imageAnalyzing, disabled }: { state: BillJourneyState; onSelect: (answer: string) => void; onImage: (file: File) => void; imageAnalyzing: boolean; disabled: boolean }) {
  const providerOptions = ['Bell', 'Telus', 'Freedom / Fido / Virgin', 'Another provider']
  const serviceOptions = ['Mobile only', 'Home Internet only', 'Mobile + Internet', 'Mobile + Internet + TV']
  const phoneOptions = ['iPhone', 'Samsung Galaxy', 'Google Pixel', 'Another phone', 'SIM only / my own phone']
  const options = state.stage === 'provider' ? providerOptions : state.stage === 'services' ? serviceOptions : state.stage === 'phone' ? phoneOptions : []
  const imageActions = <div className="troubleshooting-image-actions">
    <label className="troubleshooting-image-button">Take a photo<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" capture="environment" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label>
    <label className="troubleshooting-image-button">Upload an image<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label>
  </div>
  return <section className="bill-journey-card" aria-label={state.kind === 'billing' ? 'Bill review journey' : 'Competitor bill comparison'}>
    <strong>{state.kind === 'billing' ? 'Understand your bill' : 'Compare your bill with Spectrum'}</strong>
    <p className="bill-photo-prompt">{state.analysis ? 'Bill already received' : `Share a bill photo now${state.stage !== 'upload' ? ' (optional)' : ''}`}</p>
    {!state.analysis && imageActions}
    <small>JPG, JPEG, PNG, or WEBP · Up to 5 MB. Cover account numbers, name, address, and payment details before sharing.</small>
    {options.length > 0 && <><p className="bill-photo-prompt">Or choose an option:</p><div className="bill-journey-options">{options.map((option) => <button key={option} onClick={() => onSelect(option)} disabled={disabled}>{option}</button>)}</div></>}
    {imageAnalyzing && <small role="status">Reviewing the bill image…</small>}
  </section>
}

function BillComparisonCard({ comparison, services }: { comparison: NonNullable<SpectraMessage['billComparison']>; services: string[] }) {
  const shownServices = services.length ? services.join(', ') : 'services selected in the journey'
  const money = (value: number) => `$${value.toFixed(2)}`
  const spectrumLine = comparison.spectrumMonthly === null ? 'not enough service details to estimate' : `${money(comparison.spectrumMonthly)}/mo.`
  return <div className="bill-comparison-card"><strong>Estimated monthly comparison</strong><p>{comparison.provider}{comparison.currentPhone ? ` (with ${comparison.currentPhone})` : ''}: {comparison.currentMonthly === null ? 'Monthly recurring total not clearly visible' : `${money(comparison.currentMonthly)}/mo.`}</p><p>Spectrum estimate ({shownServices}): {spectrumLine}</p>{comparison.planLabel && comparison.planMonthly !== null && <p className="bill-comparison-breakdown">{comparison.planLabel}{comparison.deviceMonthly !== null && comparison.deviceLabel ? ` + ${comparison.deviceLabel} financing${comparison.phoneAssumed ? ' (closest current model — I couldn’t match your exact phone)' : ''}` : ''}: {money(comparison.planMonthly)}{comparison.deviceMonthly !== null ? ` + ${money(comparison.deviceMonthly)}` : ''}</p>}<b>{comparison.annualSavings === null ? 'Annual savings unavailable until the bill total and services are confirmed.' : comparison.annualSavings > 0 ? `Estimated annual savings: ${money(comparison.annualSavings)}` : `Spectrum is estimated to cost ${money(Math.abs(comparison.annualSavings))} more per year.`}</b><small>{`Illustrative estimate using reference Spectrum rates (monthly plan prices, Internet $60, TV $25) and device financing from the Spectrum phone pricing captured ${devicePricingCapturedAt}. Your phone model, taxes, fees, discounts, trade-in and eligibility can change actual pricing. Confirm current offers before switching.`}</small></div>
}

function TradeInCard({ analysis }: { analysis: ImageAnalysis }) {
  const outlook = { 'worth-trading-in': 'Worth trading in', 'limited-value': 'May have limited value', 'not-recommended': 'Trade-in not recommended', 'need-better-photo': 'Need a clearer photo' }[analysis.tradeInOutlook ?? 'need-better-photo']
  return <section className="image-analysis-card" aria-label="Trade-in phone assessment"><strong>Trade-in assessment</strong><dl><div><dt>Phone</dt><dd>{analysis.deviceDescription ?? 'Not identified'}</dd></div><div><dt>Visible condition</dt><dd>{analysis.condition ?? 'unclear'}</dd></div><div><dt>Outlook</dt><dd>{outlook}</dd></div><div><dt>Confidence</dt><dd>{analysis.confidence}%</dd></div></dl>{analysis.damageFindings && analysis.damageFindings.length > 0 && <div className="bill-suggestions"><strong>Visible findings</strong><ul>{analysis.damageFindings.map((finding) => <li key={finding}>{finding}</li>)}</ul></div>}<p>{analysis.recommendedAction}</p><small>Based only on the photo. Not a trade-in quote; battery, function and eligibility are confirmed in a full device check.</small></section>
}

function ImageAnalysisCard({ analysis, analysisType, comparison }: { analysis: ImageAnalysis; analysisType: ImageAnalysisType; comparison?: SpectraMessage['billComparison'] }) {
  if (analysisType === 'tradeIn') return <TradeInCard analysis={analysis} />
  return <section className="image-analysis-card" aria-label={analysisType === 'bill' ? 'Bill analysis' : 'Modem image analysis'}><strong>{analysisType === 'bill' ? 'Bill review' : 'Visual troubleshooting'}</strong><dl><div><dt>Issue summary</dt><dd>{analysis.issueSummary}</dd></div><div><dt>Likely cause</dt><dd>{analysis.likelyRootCause}</dd></div><div><dt>Confidence</dt><dd>{analysis.confidence}%</dd></div><div><dt>Recommended next step</dt><dd>{analysis.recommendedAction}</dd></div></dl>{analysisType === 'bill' && <>{analysis.charges && analysis.charges.length > 0 && <div className="bill-charges"><strong>Visible charges</strong>{analysis.charges.map((charge, index) => <div key={`${index}-${charge.label}`}><span>{charge.label}</span><b>${charge.amount.toFixed(2)}</b></div>)}</div>}{analysis.suggestions && analysis.suggestions.length > 0 && <div className="bill-suggestions"><strong>Possible next steps</strong><ul>{analysis.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div>}</>}{comparison && <BillComparisonCard comparison={comparison} services={analysis.services ?? []} /> }<small>{analysisType === 'bill' ? 'Based only on readable bill content. Amounts and recommendations may be incomplete; verify with your provider.' : 'Based only on what is visible in the image. Not a live network diagnostic.'}</small></section>
}

function TroubleshootingExperience({ state, onSelect, onImage, imageAnalyzing, disabled }: { state: TroubleshootingState; onSelect: (answer: string) => void; onImage: (file: File) => void; imageAnalyzing: boolean; disabled: boolean }) {
  const diagnostic = state.diagnosticResults
  const issueOptions: { label: string; answer: string }[] = state.issueType === 'Limited WiFi Coverage' ? [
    { label: 'Weak signal', answer: 'Weak signal' },
    { label: 'Slow speeds', answer: 'Slow speeds' },
    { label: 'Frequent disconnects', answer: 'Frequent disconnects' },
    { label: 'Buffering / streaming', answer: 'Buffering or streaming issues' },
  ] : [
    { label: 'Complete Internet outage', answer: 'Complete Internet outage' },
    { label: 'Slow Internet', answer: 'Slow speeds' },
    { label: 'Weak WiFi coverage', answer: 'Weak signal in a room' },
    { label: 'TV or streaming', answer: 'Buffering or streaming issues' },
    { label: 'Device won’t connect', answer: 'A device keeps disconnecting' },
    { label: 'Smart home device', answer: 'Smart home devices disconnect' },
  ]
  const diagnosticItems = state.diagnosticResults ? [
    { label: 'Network status', value: state.diagnosticResults.network === 'available' ? 'Internet service available' : 'Service interruption detected', status: state.diagnosticResults.network === 'available' ? 'diagnostic-ok' : 'diagnostic-warn' },
    { label: 'Gateway health', value: state.diagnosticResults.gateway === 'online' ? 'Gateway online' : 'Gateway offline', status: state.diagnosticResults.gateway === 'online' ? 'diagnostic-ok' : 'diagnostic-warn' },
    { label: `WiFi coverage${state.affectedRoom ? ` · ${state.affectedRoom}` : ''}`, value: state.diagnosticResults.wifi === 'weak' ? 'Weak signal detected' : 'Coverage looks good', status: state.diagnosticResults.wifi === 'weak' ? 'diagnostic-warn' : 'diagnostic-ok' },
    { label: 'Streaming performance', value: state.diagnosticResults.streaming === 'normal' ? 'Normal' : 'Degraded', status: state.diagnosticResults.streaming === 'normal' ? 'diagnostic-ok' : 'diagnostic-warn' },
    { label: 'Connected devices', value: `${state.diagnosticResults.connectedDevices} devices`, status: '' },
  ] : [
    { label: 'Network status', value: 'Checking…', status: '' },
    { label: 'Gateway health', value: 'Checking…', status: '' },
    { label: `WiFi coverage${state.affectedRoom ? ` · ${state.affectedRoom}` : ''}`, value: 'Checking…', status: '' },
    { label: 'Streaming performance', value: 'Checking…', status: '' },
    { label: 'Connected devices', value: 'Checking…', status: '' },
  ]
  return <section className="troubleshooting-card" aria-label="Guided troubleshooting">
    <div className="troubleshooting-card-header"><span className="troubleshooting-icon"><Icon name={state.stage === 'resolved' ? 'check' : 'wifi'} size={16} /></span><div><strong>{state.stage === 'resolved' ? 'Issue resolved' : 'Guided troubleshooting'}</strong><small>{state.issueType ?? 'Let’s identify the service issue'}{state.affectedRoom ? ` · ${state.affectedRoom}` : ''}</small></div><span className={`troubleshooting-stage-pill troubleshooting-${state.stage}`}>{state.stage === 'diagnostics' ? 'TESTING' : state.stage.toUpperCase()}</span></div>
    {state.stage === 'identify' && <div className="troubleshooting-options"><span>What best describes the issue?</span><div>{issueOptions.map((option) => <button key={option.label} onClick={() => onSelect(option.answer)} disabled={disabled}>{option.label}</button>)}</div></div>}
    {state.stage === 'diagnostics' && <div className="diagnostics-content">
      <div className="diagnostics-list">{diagnosticItems.map((item) => <div key={item.label}><span>{item.label}</span><strong className={item.status}>{item.value}</strong></div>)}</div>
      <div className="diagnostics-gauge"><div className="health-ring" style={{ '--health-score': `${diagnostic?.healthScore ?? 0}%` } as React.CSSProperties}><span>{diagnostic?.healthScore ?? '—'}<small>/100</small></span></div><div><strong>Connection health</strong><small>Simulated demo diagnostic</small></div></div>
      {state.issueType === 'Limited WiFi Coverage' && <div className="coverage-comparison"><span>Current coverage <b>{diagnostic?.currentCoverage ?? 74}%</b></span><span>With WiFi Pods <b>{diagnostic?.projectedCoverage ?? 96}%</b></span><span>Expected streaming quality <b>Excellent</b></span></div>}
      <div className="diagnostics-progress"><i /></div><p className="diagnostic-disclaimer">Demo simulation only. This does not access or test a live Spectrum network.</p>
    </div>}
    {state.stage === 'resolution' && diagnostic && <div className="resolution-content">
      <div className="diagnostics-list diagnostics-results">{diagnosticItems.map((item) => <div key={item.label}><span>{item.label}</span><strong className={item.status}>{item.value}</strong></div>)}</div>
      <div className="resolution-finding"><strong>Likely cause</strong><p>{state.issueType === 'Limited WiFi Coverage' ? `Reduced WiFi coverage${state.affectedRoom ? ` in the ${state.affectedRoom}` : ' in this area'}—often caused by distance from the gateway, walls or floors, interference, or many connected devices.` : `The simulated scan indicates ${state.issueType?.toLowerCase()}. We’ll work through the steps below and keep track of what you have tried.`}</p></div>
      <div className="resolution-step"><span>STEP {Math.min(state.currentStepIndex + 1, state.troubleshootingSteps.length)} OF {state.troubleshootingSteps.length}</span><p>{state.troubleshootingSteps[state.currentStepIndex]}</p>{state.completedSteps.length > 0 && <small>Already tried: {state.completedSteps.join(' ')}</small>}</div>
      {state.issueType === 'Limited WiFi Coverage' && <div className="pods-recommendation"><div><strong>WiFi Pods may help</strong><p>Based on the simulated scan, Pods could extend coverage in low-signal areas.</p></div><div><span>{diagnostic.currentCoverage}%</span><i>→</i><b>{diagnostic.projectedCoverage}%</b></div><small>Projected coverage · Streaming quality: Excellent</small></div>}
      <div className="resolution-actions"><button className="button-primary" onClick={() => onSelect('That helped')} disabled={disabled}><Icon name="check" size={14} /> That helped</button><button className="button-outline" onClick={() => onSelect('Still having trouble')} disabled={disabled}>Still having trouble</button></div>
    </div>}
    {state.stage === 'escalation' && <div className="troubleshooting-options"><p>Choose your next step. These demo options do not submit a real service request or order.</p><div className="escalation-options">{[
      'Schedule a technician visit',
      'Order WiFi Pods',
      'Chat with a specialist',
      'Continue advanced diagnostics',
    ].map((option) => <button key={option} onClick={() => onSelect(option)} disabled={disabled}>{option}<Icon name="arrow" size={13} /></button>)}</div></div>}
    {state.stage === 'resolved' && <div className="resolved-summary"><strong><Icon name="check" size={16} /> Issue Resolved</strong><p>{state.resolutionSummary}</p><small>{state.completedSteps.length} troubleshooting step{state.completedSteps.length === 1 ? '' : 's'} recorded · Your reported issue and responses remain in this chat.</small></div>}
    {(!state.issueType || ['Complete Internet Outage', 'Slow Internet', 'Limited WiFi Coverage', 'Device Connectivity Issue'].includes(state.issueType)) && <div className="troubleshooting-image-upload"><strong>Modem &amp; WiFi image diagnostics</strong><p>Share a clear photo of your gateway, lights, or cable connections. Avoid including personal information.</p><div className="troubleshooting-image-actions"><label className="troubleshooting-image-button">Take a photo<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" capture="environment" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label><label className="troubleshooting-image-button">Upload an image<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={disabled || imageAnalyzing} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImage(file) }} /></label></div><small>JPG, JPEG, PNG, or WEBP · Up to 5 MB. AI visual guidance only; not a live network test.</small>{imageAnalyzing && <small role="status">Analyzing your image…</small>}</div>}
    {state.issueType !== 'TV/Streaming Issue' && state.issueType !== 'Smart Home Issue' && <div className="multimodal-placeholder"><span>Additional support capabilities</span><div><button disabled title="Coming soon">Share error screenshot</button><button disabled title="Coming soon">Record modem lights</button><button disabled title="Coming soon">Live voice support</button></div><small>Additional video and live support options are coming soon</small></div>}
  </section>
}

function troubleshootingActionReply(state: TroubleshootingState, response: string): string {
  if (state.stage === 'escalation') {
    if (/technician/i.test(response)) return 'A technician visit is an option for persistent service issues. In this demo I can’t schedule a real appointment; contact Spectrum support to arrange one.'
    if (/pods/i.test(response)) return 'WiFi Pods can help extend coverage. In this demo no order is placed; you can review availability and terms with Spectrum.'
    if (/specialist/i.test(response)) return 'A Spectrum specialist can take a closer look. This demo cannot start a live transfer, but you can reach support through the Support page.'
    if (/advanced/i.test(response)) return 'For advanced diagnostics, a Spectrum specialist can verify line and gateway details. This demo has only simulated the checks.'
  }
  if (state.stage === 'identify') return troubleshootingReply(state)
  return troubleshootingReply(state, response)
}

function JourneyQuickReplies({ stage, onSelect, disabled }: { stage: JourneyStage; onSelect: (answer: string) => void; disabled: boolean }) {
  const options = stage === 'dataAndLines'
    ? [
        { label: '10 GB · 1 line', answer: '10 GB and 1 line' },
        { label: '30 GB · 1 line', answer: '30 GB and 1 line' },
        { label: '50 GB · 1 line', answer: '50 GB and 1 line' },
        { label: '100 GB · 2 lines', answer: '100 GB and 2 lines' },
      ]
    : stage === 'travel'
      ? [
          { label: 'US', answer: 'I travel within the United States' },
          { label: 'Mexico', answer: 'I travel to Mexico' },
          { label: 'International', answer: 'I travel internationally' },
            { label: 'None', answer: 'I don’t travel outside the U.S.' },
        ]
      : stage === 'phoneUsage'
        ? [
            { label: 'Streaming & gaming', answer: 'I use my phone for streaming video and gaming' },
            { label: 'Email & browsing', answer: 'I use my phone for email and web browsing' },
            { label: 'Video calls & meetings', answer: 'I use my phone for video calls and meetings' },
            { label: 'A mix of everything', answer: 'I use my phone for streaming, gaming, email, browsing and video calls' },
          ]
      : []
  if (!options.length) return null
  return <div className="journey-quick-replies" aria-label={stage === 'travel' ? 'Choose a roaming destination' : stage === 'phoneUsage' ? 'Choose common phone activities' : 'Choose typical monthly data use'}>
    <span>{stage === 'travel' ? 'Common destinations' : stage === 'phoneUsage' ? 'Common phone activities' : 'Typical data use'}</span>
    <div>{options.map((option) => <button key={option.label} onClick={() => onSelect(option.answer)} disabled={disabled}>{option.label}</button>)}</div>
  </div>
}

function RecommendationSummary({ profile, recommendation, onAdd }: { profile: CustomerProfile; recommendation: PlanRecommendation; onAdd: () => void }) {
  const profileRows: [string, string][] = [
    ['Lines', `${profile.lineCount ?? recommendation.lineCount}`],
    ['Typical data use', profile.dataUsage === null ? 'Not shared' : `${profile.dataUsage} GB / month`],
    ['Current provider', profile.currentProvider ?? 'Not shared'],
    ['Device', profile.deviceOwnership ?? 'Not shared'],
    ['Device age', profile.deviceAge ?? 'Not shared'],
    ['Phone use', profile.phoneUseCases?.join(', ') ?? 'Not shared'],
    ['Travel', profile.travelFrequency ? `${profile.travelFrequency}${profile.travelDestinations ? ` — ${profile.travelDestinations}` : ''}` : 'Not shared'],
    ['Home Internet provider', profile.homeInternetProvider ?? 'Not shared'],
    ['Home TV provider', profile.homeTvProvider ?? 'Not shared'],
    ['Open to bundling', profile.interestedInBundling === null ? 'Not shared' : profile.interestedInBundling ? 'Yes' : 'No'],
    ['Budget preference', profile.budgetPreference ?? 'Not shared'],
  ]
  return <section className="recommendation-summary" aria-label="Your mobile plan recommendation">
    <div className="recommendation-summary-heading"><span><Icon name="spark" size={16} /></span><div><strong>Your plan recommendation</strong><small>Based on what you shared with Spectra</small></div></div>
    <div className="recommendation-summary-plan"><div><span>GOOD PLACE TO START</span><strong>{recommendation.planName}</strong></div><div className="recommendation-summary-price"><strong>${recommendation.monthlyEstimate}</strong><span>/mo.</span></div></div>
    <p className="recommendation-summary-reason">{recommendation.reason}</p>
    <p className="recommendation-summary-bundle">Pricing option: {recommendation.bundleName}. Price snapshot is illustrative; eligibility, taxes and current offers apply.</p>
    <details className="recommendation-profile"><summary>Details I used</summary><dl>{profileRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
    <button className="button-primary recommendation-add" onClick={onAdd}>Add this plan to cart <Icon name="arrow" size={14} /></button>
  </section>
}

function HomePage({ onNavigate, onAdd, onDemo }: { onNavigate: (page: Page) => void; onAdd: (label: string) => void; onDemo: () => void }) {
  const activeOffer = offers.find((offer) => offer.category === 'mobile')!
  const internetOffer = offers.find((offer) => offer.category === 'internet')!
  const streamingOffer = featuredPromotions.find((offer) => offer.id === 'streaming-apps-included')!
  const [checking, setChecking] = useState(false)
  const [address, setAddress] = useState('')
  const [checked, setChecked] = useState(false)

  return <>
    <section className="availability-hero">
      <div className="availability-hero-art" aria-hidden="true"><img src={homeHeroImage} alt="" /></div>
      <div className="page-width availability-layout">
        <div className="availability-card">
          <span className="eyebrow availability-eyebrow">GET STARTED WITH SPECTRUM</span>
          <h1 className="availability-heading">Say hi to fast<br />Internet and WiFi</h1>
          <p className="availability-copy">{internetOffer.description}</p>
          <div className="availability-price">
            <span className="availability-price-label">{internetOffer.title}</span>
            <div className="availability-price-value"><strong>{internetOffer.price}</strong><em>/mo</em></div>
            <small>{internetOffer.priceNote}</small>
          </div>
          {!checking && <>
            <button className="button-primary availability-cta" onClick={() => setChecking(true)}>Check availability <Icon name="arrow" size={16} /></button>
            <p className="availability-signin">Already a Spectrum customer? <button onClick={() => onNavigate('account')}>Sign in</button></p>
          </>}
          {checking && !checked && <form className="availability-form" onSubmit={(event) => { event.preventDefault(); setChecked(true) }}>
            <label htmlFor="availability-address">Enter your address</label>
            <input id="availability-address" required autoFocus value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address, city, state" />
            <div className="availability-form-actions"><button type="submit" className="button-primary">Check availability <Icon name="arrow" size={16} /></button><button type="button" className="button-text-dark" onClick={() => setChecking(false)}>Cancel</button></div>
          </form>}
          {checked && <div className="availability-result">
            <span className="availability-result-icon"><Icon name="check" size={18} /></span>
            <div><strong>Good news — Spectrum is available at your address.</strong><p>{internetOffer.title} starting at {internetOffer.price}/mo {internetOffer.priceNote}.</p></div>
            <button className="button-primary" onClick={() => onNavigate('internet')}>See Internet plans <Icon name="arrow" size={16} /></button>
          </div>}
        </div>
      </div>
    </section>
    <div className="trust-strip page-width"><span><Icon name="globe" /> America’s most reliable 5G network</span><span><Icon name="shield" /> Support when you need it</span><span><Icon name="wifi" /> Better together at home</span><button onClick={() => onNavigate('support')}>Why Spectrum <Icon name="arrow" size={14} /></button></div>
    <section className="tv-promo-feature" aria-label="Spectrum TV streaming apps">
      <div className="tv-promo-offer">
        <div className="tv-promo-copy"><span className="tv-promo-eyebrow">{streamingOffer.eyebrow}</span><h2>{streamingOffer.title}</h2><p>{streamingOffer.description}</p><button className="tv-promo-shop" onClick={() => onNavigate(streamingOffer.category)}>Shop TV bundles <Icon name="arrow" size={17} /></button></div>
        <StreamingArtwork />
      </div>
      <aside className="mobile-promo-story">
        <span className="mobile-promo-eyebrow">SPECTRUM MOBILE</span>
        <h2>Nationwide 5G.<br />No contracts.<br />More savings.</h2>
        <button className="mobile-promo-learn-more" onClick={() => onNavigate('mobile')}>See mobile plans <span aria-hidden="true">↗</span></button>
        <div className="mobile-promo-brand" aria-label="Spectrum Mobile savings">
          <div className="mobile-promo-spectrum"><SpectrumLogo className="spectrum-logo-large" /></div>
          <div className="mobile-promo-teams"><span>BY THE<br />GIG</span><span>UNLIMITED</span><span>UNLIMITED<br />PLUS</span><span>UNLIMITED<br />PLUS PREMIUM</span></div>
        </div>
      </aside>
    </section>
    <section className="section-block page-width explore-section"><div className="section-heading"><div><span className="eyebrow eyebrow-red">FIND YOUR FIT</span><h2>What brings you here?</h2><p>Great connections start with the right place to begin.</p></div><button className="button-quiet" onClick={() => onNavigate('support')}>Explore all services <Icon name="arrow" size={15} /></button></div><div className="category-grid">{[{ title: 'Mobile plans', sub: 'Find your kind of unlimited.', icon: 'phone' as IconName, page: 'mobile' as Page, color: 'cat-red' }, { title: 'Internet', sub: 'Ready for whatever’s next.', icon: 'wifi' as IconName, page: 'internet' as Page, color: 'cat-purple' }, { title: 'TV & Streaming', sub: 'All your favourites, together.', icon: 'play' as IconName, page: 'tv' as Page, color: 'cat-orange' }, { title: 'Smart Home', sub: 'Feel at home, wherever you are.', icon: 'home' as IconName, page: 'smartHome' as Page, color: 'cat-blue' }].map((item) => <button key={item.page} className="category-card" onClick={() => onNavigate(item.page)}><span className={`category-icon ${item.color}`}><Icon name={item.icon} size={22} /></span><span><strong>{item.title}</strong><small>{item.sub}</small></span><span className="category-arrow"><Icon name="arrow" size={17} /></span></button>)}</div></section>
    <section className="offer-feature"><div className="page-width offer-feature-inner"><div className="offer-art"><span className="art-orb art-orb-one" /><span className="art-orb art-orb-two" /><span className="art-line" /><div className="art-phone"><span className="art-screen"><i /><i /><i /></span></div><span className="art-spark art-spark-one">✳</span><span className="art-spark art-spark-two">✦</span><span className="art-caption">FIND YOUR<br />INFINITE</span></div><div className="offer-copy"><span className="eyebrow eyebrow-red">{activeOffer.eyebrow}</span><h2>Room for all<br />your <em>what ifs.</em></h2><p>{activeOffer.description}</p><div className="offer-price"><strong>{activeOffer.price}</strong><span>{activeOffer.priceNote}</span></div><div className="offer-fineprint">With eligible plan. New activations. Limited-time offer.</div><div className="hero-actions"><button className="button-primary" onClick={() => onAdd('Spectrum Mobile plan')}>Explore mobile plans <Icon name="arrow" size={16} /></button><button className="button-text-dark" onClick={() => onNavigate('mobile')}>See offer details</button></div></div></div></section>
    <section className="section-block page-width promo-section"><div className="section-heading"><div><span className="eyebrow eyebrow-red">GOOD THINGS, CONNECTED</span><h2>There’s more in store.</h2><p>Thoughtful offers for the ways you connect.</p></div><button className="button-quiet" onClick={() => onNavigate('devices')}>Shop all offers <Icon name="arrow" size={15} /></button></div><div className="promo-grid">{offers.slice(1).map((offer, index) => <PromoCard key={offer.id} offer={offer} index={index} onClick={() => onNavigate(offer.category === 'internet' ? 'internet' : offer.category === 'devices' ? 'devices' : 'tv')} />)}</div></section>
    <section className="recommend-section"><div className="page-width recommend-inner"><div><span className="eyebrow eyebrow-red">MADE FOR YOUR EVERYDAY</span><h2>A little help<br />finding your fit.</h2><p>Tell us what matters most and we’ll help you find a plan, device or service that feels right.</p><button className="button-primary" onClick={() => onDemo()}>Get a personal recommendation <Icon name="arrow" size={16} /></button></div><div className="recommend-art"><div className="recommend-card"><span className="recommend-avatar"><Icon name="spark" size={20} /></span><div><b>Made for your next chapter.</b><span>Let’s find something that fits.</span></div><Icon name="arrow" size={17} /></div><div className="recommend-orbit" /><div className="recommend-ball" /></div></div></section>
    <section className="section-block page-width story-section"><div className="story-card"><div className="story-visual"><span className="story-sun" /><div className="story-person"><i /><b /></div><span className="story-type">HERE FOR<br />EVERY<br />CHAPTER.</span></div><div className="story-copy"><span className="eyebrow eyebrow-red">THE SPECTRUM DIFFERENCE</span><h2>It’s what a good connection can do.</h2><p>Bringing people closer to what they love with a network that shows up, and support that’s here when you need it.</p><button className="button-text-dark" onClick={() => onNavigate('about')}>Get to know us <Icon name="arrow" size={15} /></button></div></div></section>
  </>
}

function AboutSpectrumPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const stories = [
    { category: 'News Releases', date: 'Oct 2, 2026', title: 'Spectrum expands Advanced WiFi to more neighborhoods', image: 'news-music' },
    { category: 'News Releases', date: 'Oct 1, 2026', title: 'Spectrum TV Signature adds Disney+, Paramount+ and ViX Premium', image: 'news-tv', href: 'https://corporate.charter.com/newsroom' },
    { category: 'Articles', date: 'Sep 28, 2026', title: 'Spectrum Mobile crosses 10 million lines nationwide', image: 'news-mobile' },
  ]

  return <div className="about-page">
    <div className="about-subnav"><div className="page-width about-subnav-inner"><button className="about-subnav-brand" onClick={() => onNavigate('home')}>SPECTRUM <span>ABOUT</span></button><nav aria-label="About Spectrum"><button className="about-current" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>About Spectrum</button><button onClick={() => document.getElementById('about-pillars')?.scrollIntoView({ behavior: 'smooth' })}>Our businesses</button><button onClick={() => document.getElementById('about-impact')?.scrollIntoView({ behavior: 'smooth' })}>Our impact</button><button onClick={() => document.getElementById('about-news')?.scrollIntoView({ behavior: 'smooth' })}>News &amp; Stories</button></nav><button className="about-home-link" onClick={() => onNavigate('home')}>Spectrum.com <Icon name="arrow" size={14} /></button></div></div>
    <section className="about-hero">
      <div className="about-hero-shade" aria-hidden="true" />
      <div className="page-width about-hero-content"><span className="eyebrow">ABOUT SPECTRUM</span><h1>America’s connectivity<br />and entertainment company</h1><p>Connecting people to what matters most — in their homes, in their communities, and in the moments we share.</p><button className="about-hero-cta" onClick={() => document.getElementById('about-pillars')?.scrollIntoView({ behavior: 'smooth' })}>Discover Spectrum <Icon name="arrow" size={16} /></button></div>
      <span className="about-hero-caption">CONNECTION IS WHERE IT ALL BEGINS</span>
    </section>
    <section className="about-pillars page-width" id="about-pillars">
      <div className="about-pillar-heading"><span className="eyebrow eyebrow-red">WHO WE ARE</span><h2>Bringing people<br />closer to what matters.</h2></div>
      <div className="about-pillar-grid">
        <article className="about-pillar-card">
          <div className="about-pillar-photo about-communications about-media-art"><div className="about-media-screen"><span>SPECTRUM</span><strong>Connected<br />every day.</strong><i /><i /></div><span>01 / CONNECTING AMERICA</span></div>
          <div className="about-pillar-copy"><span>AMERICA’S CONNECTIVITY LEADER</span><h3>Connections that bring us closer.</h3><p>From mobile and internet to TV and business solutions, Spectrum helps people stay connected to what matters in their lives.</p><button onClick={() => onNavigate('mobile')}>Explore our services <Icon name="arrow" size={15} /></button></div>
        </article>
        <article className="about-pillar-card">
          <div className="about-pillar-photo about-sports about-media-art"><div className="about-media-screen"><span>SPECTRUM TV</span><strong>Live sports,<br />every season.</strong><i /><i /></div><span>02 / STREAMING &amp; LIVE TV</span></div>
          <div className="about-pillar-copy"><span>AMERICA’S TV &amp; STREAMING LEADER</span><h3>All your favorites, together.</h3><p>Spectrum TV brings live sports, news and the streaming apps you already love into one simple experience.</p><button onClick={() => onNavigate('tv')}>Explore TV &amp; streaming <Icon name="arrow" size={15} /></button></div>
        </article>
        <article className="about-pillar-card">
          <div className="about-pillar-photo about-media-art"><div className="about-media-screen"><span>SPECTRUM</span><strong>Stories that<br />move us.</strong><i /><i /><i /></div><div className="about-media-orbit" /><span>03 / STORIES THAT RESONATE</span></div>
          <div className="about-pillar-copy"><span>AMERICA’S MEDIA &amp; ENTERTAINMENT COMPANY</span><h3>Stories made to be shared.</h3><p>From live sports and breaking news to premium entertainment, Spectrum reaches people wherever they watch, listen and engage.</p><button onClick={() => onNavigate('tv')}>Explore entertainment <Icon name="arrow" size={15} /></button></div>
        </article>
      </div>
    </section>
    <section className="about-impact" id="about-impact">
      <div className="page-width about-impact-inner"><div className="about-impact-art"><div className="impact-sun" /><div className="impact-figure impact-figure-one"><i /><b /></div><div className="impact-figure impact-figure-two"><i /><b /></div><span>ROOM TO GROW</span></div><div className="about-impact-copy"><span className="eyebrow eyebrow-red">INVESTING IN COMMUNITIES</span><h2>Helping people find their <em>next.</em></h2><p>Through local workforce programs, digital literacy initiatives and community investment, we’re building a brighter future for the communities we serve.</p><button className="button-outline" onClick={() => onNavigate('support')}>Explore our community impact <Icon name="arrow" size={15} /></button></div></div>
    </section>
    <section className="about-story page-width">
      <div className="about-story-copy"><span className="eyebrow eyebrow-red">OUR STORY</span><h2>Built for the next<br />generation of connection.</h2><p>Spectrum is a Charter Communications brand built from decades of investment in cable, fiber and wireless networks. Today we connect tens of millions of homes and businesses across the country with internet, TV, mobile and voice service.</p><button className="button-text-dark" onClick={() => document.getElementById('about-news')?.scrollIntoView({ behavior: 'smooth' })}>See what’s next <Icon name="arrow" size={15} /></button></div>
      <div className="about-story-visual"><div className="about-story-rings" /><span>MADE FOR<br />WHAT’S NEXT.</span><div className="about-story-mark"><SpectrumLogo /></div></div>
    </section>
    <section className="about-news" id="about-news"><div className="page-width"><div className="about-news-heading"><div><span className="eyebrow eyebrow-red">IN THE NEWS</span><h2>What’s happening at Spectrum.</h2></div><button onClick={() => window.open('https://corporate.charter.com/newsroom', '_blank', 'noopener,noreferrer')}>See all news <Icon name="arrow" size={15} /></button></div><div className="about-news-grid">{stories.map((story) => <article className="about-news-card" key={story.title}><div className={`about-news-image ${story.image}`} aria-hidden="true">{story.image === 'news-tv' ? <><span>SPECTRUM TV</span><strong>STREAMING<br />APPS INCLUDED.</strong><i /></> : story.image === 'news-mobile' ? <><span>SPECTRUM MOBILE</span><strong>10 MILLION<br />LINES.</strong><i /></> : <><span>SPECTRUM PRESENTS</span><strong>ADVANCED<br />WIFI.</strong><i /></>}</div><div className="about-news-copy"><span>{story.category} <i /> {story.date}</span><h3>{story.title}</h3><a href={story.href ?? 'https://corporate.charter.com/newsroom'} target="_blank" rel="noreferrer">Read story <span aria-hidden="true">↗</span></a></div></article>)}</div></div></section>
    <section className="about-bottom-cta"><span className="eyebrow">MORE CONNECTED, COAST TO COAST.</span><h2>Let’s make what’s next<br />possible together.</h2><button className="button-primary" onClick={() => onNavigate('home')}>Explore Spectrum <Icon name="arrow" size={16} /></button></section>
  </div>
}

function StreamingArtwork() {
  const apps = [
    { label: 'Disney+', from: '#1a3b73', to: '#0d1f40' },
    { label: 'Paramount+', from: '#2f6fe0', to: '#0f2d6b' },
    { label: 'ViX Premium', from: '#e0632f', to: '#7a2c0f' },
  ]
  return <div className="tv-promo-art" aria-hidden="true">
    <svg className="tv-promo-screen" viewBox="0 0 590 355" role="presentation">
      <defs>
        <linearGradient id="streamBg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2a3550" /><stop offset=".55" stopColor="#141c33" /><stop offset="1" stopColor="#080b16" /></linearGradient>
        {apps.map((app, index) => <linearGradient id={`streamApp${index}`} key={app.label} x1="0" y1="0" x2="1" y2="1"><stop stopColor={app.from} /><stop offset="1" stopColor={app.to} /></linearGradient>)}
        <filter id="screenGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="11" /></filter>
      </defs>
      <rect x="20" y="16" width="542" height="314" rx="8" fill="#527ba0" opacity=".42" filter="url(#screenGlow)" />
      <rect x="28" y="20" width="530" height="300" rx="5" fill="#090d15" stroke="#707b89" strokeWidth="5" />
      <rect x="37" y="29" width="512" height="282" fill="url(#streamBg)" />
      {apps.map((app, index) => <g key={app.label} transform={`translate(${86 + index * 150} 90)`}>
        <rect width="120" height="170" rx="18" fill={`url(#streamApp${index})`} />
        <circle cx="60" cy="68" r="24" fill="#ffffff2a" />
        <path d="M51 56 76 68 51 80Z" fill="#fff" />
        <text x="60" y="130" textAnchor="middle" fill="#fff" fontFamily="Arial,sans-serif" fontSize="15" fontWeight="700">{app.label}</text>
      </g>)}
      <text x="299" y="55" textAnchor="middle" fill="#fff" fontFamily="Manrope,Arial,sans-serif" fontSize="17" fontWeight="700">Included with Stream TV Signature</text>
    </svg>
    <span className="tv-promo-phone"><i /><b>TV</b><small>STREAM TV</small></span>
  </div>
}

function PromoCard({ offer, index, onClick }: { offer: (typeof offers)[number]; index: number; onClick: () => void }) {
  const names: Record<string, string> = { ignite: 'A home that keeps up.', iphone: 'Your next phone is here.', bundle: 'A little more, together.' }
  return <button className={`promo-card promo-${offer.tone}`} onClick={onClick}><span className="promo-art-shape"><span className="promo-shape-inner" /><span className="promo-art-lines" /></span><span className="promo-label">{offer.tag}</span><span className="promo-icon">{index === 0 ? <Icon name="wifi" size={21} /> : index === 1 ? <Icon name="phone" size={21} /> : <Icon name="home" size={21} />}</span><span className="promo-title">{names[offer.id]}</span><span className="promo-description">{offer.description}</span><span className="promo-cta">Explore offer <Icon name="arrow" size={15} /></span></button>
}

function CategoryPage({ category, onAdd, onChat }: { category: keyof typeof catalog; onAdd: (label: string) => void; onChat: () => void }) {
  const item = catalog[category]
  const color = category === 'mobile' ? 'category-hero-mobile' : category === 'internet' ? 'category-hero-internet' : category === 'tv' ? 'category-hero-tv' : 'category-hero-home'
  return <>
    <div className="breadcrumbs page-width"><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button><span>/</span><span>{item.title}</span></div>
    <section className={`category-hero ${color}`}><div className="page-width category-hero-inner"><div><span className="eyebrow">{category === 'mobile' ? 'SPECTRUM MOBILE' : category === 'internet' ? 'SPECTRUM' : category === 'tv' ? 'SPECTRUM TV' : 'MADE FOR HOME'}</span><h1>{item.title}<br /><em>{category === 'mobile' ? 'made for more.' : category === 'internet' ? 'made for real life.' : category === 'tv' ? 'made for your nights.' : 'made for home.'}</em></h1><p>{item.detail}</p><button className="button-primary" onClick={() => onAdd(item.label)}>{category === 'mobile' ? 'Explore plans' : 'Explore options'} <Icon name="arrow" size={16} /></button><small className="category-trust"><Icon name="shield" size={15} /> Backed by the Spectrum network</small></div><div className={`category-art category-art-${category}`} aria-hidden="true"><div className="category-art-glow" /><div className="category-art-ring ring-a" /><div className="category-art-ring ring-b" />{category === 'mobile' ? <div className="big-phone"><span className="phone-pill" /><span className="phone-clock">09:41</span><span className="phone-sun" /></div> : category === 'internet' ? <div className="wifi-device"><span /><span /><span /><i /></div> : category === 'tv' ? <div className="tv-device"><span className="tv-screen-glow"><Icon name="play" size={30} /></span><i /></div> : <div className="home-shape"><Icon name={category === 'smartHome' ? 'shield' : 'home'} size={68} /></div>}<span className="category-orbit-dot" /></div></div></section>
    <div className="category-subnav page-width"><span>Explore {item.title.toLowerCase()}</span><button onClick={onChat}><Icon name="spark" size={15} /> Ask Spectra</button><button onClick={() => window.scrollTo({ top: 690, behavior: 'smooth' })}>Plans & pricing <Icon name="chevron" size={14} /></button><button onClick={() => window.scrollTo({ top: 1080, behavior: 'smooth' })}>Why Spectrum <Icon name="chevron" size={14} /></button></div>
    <section className="section-block page-width plan-section"><div className="section-heading"><div><span className="eyebrow eyebrow-red">A GOOD PLACE TO START</span><h2>{category === 'mobile' ? 'Find your kind of unlimited.' : category === 'internet' ? 'The right speed for your home.' : category === 'tv' ? 'Make TV yours.' : 'Simple options, more peace of mind.'}</h2><p>More ways to get the most out of your connection.</p></div><span className="pricing-note">Prices shown for eligible customers</span></div><div className="plan-grid">{[item, { ...item, label: category === 'mobile' ? 'Spectrum Mobile Extra' : `${item.label} Plus`, price: category === 'mobile' ? '$65' : category === 'internet' ? '$75' : category === 'tv' ? '$40' : '$35', features: [...item.features.slice(0, 2), category === 'mobile' ? 'More data for sharing' : 'More flexibility, your way'] }].map((plan, index) => <PlanCard key={plan.label} plan={plan} featured={index === 1} onAdd={() => onAdd(plan.label)} />)}</div><p className="legal-copy">All plans subject to eligibility, taxes, and applicable terms. Prices and availability may vary by location.</p></section>
    <section className="category-perks"><div className="page-width perks-inner"><div className="perks-heading"><span className="eyebrow eyebrow-red">A LITTLE MORE SPECTRUM</span><h2>Good things<br />come connected.</h2><p>From reliable network experiences to help when you need it, we’re here for your everyday.</p></div><div className="perks-list">{item.features.map((feature, index) => <div key={feature} className="perk-row"><span>0{index + 1}</span><Icon name={index === 0 ? 'globe' : index === 1 ? 'shield' : 'spark'} size={19} /><strong>{feature}</strong><Icon name="arrow" size={16} /></div>)}</div></div></section>
  </>
}

function MobilePlansPage({ onAdd, onChat, onPhones }: { onAdd: (label: string) => void; onChat: () => void; onPhones: () => void }) {
  const [lineCount, setLineCount] = useState(1)
  const [withInternet, setWithInternet] = useState(true)

  function monthlyTotal(plan: (typeof mobilePlans)[number]) {
    const firstLine = withInternet ? plan.bundlePrice : plan.mobileOnlyPrice
    const extraLinePrices = additionalLinePrices[plan.id as keyof typeof additionalLinePrices]
    if (lineCount === 1) return firstLine
    if (!extraLinePrices) return undefined
    return firstLine + Array.from({ length: lineCount - 1 }, (_, index) => extraLinePrices[Math.min(index, extraLinePrices.length - 1)]).reduce((total, price) => total + price, 0)
  }

  return <>
    <div className="breadcrumbs page-width"><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button><span>/</span><span>Mobile plans</span></div>
    <section className="mobile-plans-hero">
      <div className="page-width mobile-plans-hero-inner">
        <span className="eyebrow eyebrow-red">SPECTRUM MOBILE</span>
        <h1>5G+ mobile plans</h1>
        <p>Get value-packed plans on America’s most reliable 5G network.</p>
        <div className="mobile-inclusions" aria-label="Included with all plans">
          {['Nationwide 5G network access', 'Unlimited nationwide talk and text', 'Unlimited international texts', 'Spam Call Detect', 'HD video streaming'].map((feature) => <span key={feature}><Icon name="check" size={16} />{feature}</span>)}
        </div>
      </div>
    </section>
    <div className="mobile-plans-subnav page-width">
      <strong>Explore mobile plans</strong>
      <button onClick={onChat}><Icon name="spark" size={15} /> Ask Spectra</button>
      <button onClick={onPhones}>Shop phones <Icon name="arrow" size={14} /></button>
    </div>
    <section className="mobile-plans-content page-width">
      <div className="mobile-plans-controls">
        <div className="line-selector">
          <span className="control-label">How many lines do you need?</span>
          <div className="line-stepper" role="group" aria-label="Number of phone lines">
            <button onClick={() => setLineCount((count) => Math.max(1, count - 1))} disabled={lineCount === 1} aria-label="Remove a line">−</button>
            <output aria-live="polite">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</output>
            <button onClick={() => setLineCount((count) => Math.min(4, count + 1))} disabled={lineCount === 4} aria-label="Add a line">+</button>
          </div>
        </div>
        <fieldset className="bundle-toggle">
          <legend>Select applicable options</legend>
          <label className={withInternet ? 'bundle-selected' : ''}><input type="radio" name="mobile-bundle" checked={withInternet} onChange={() => setWithInternet(true)} />2+ lines on this plan</label>
          <label className={!withInternet ? 'bundle-selected' : ''}><input type="radio" name="mobile-bundle" checked={!withInternet} onChange={() => setWithInternet(false)} />Single line</label>
        </fieldset>
        <p className="bundle-saving">Spectrum Mobile requires an active Spectrum Internet plan. {withInternet ? 'Pricing shown reflects multi-line savings on Unlimited Plus Premium.' : 'Single-line pricing is shown for Unlimited Plus Premium; other plans are the same price per line.'}</p>
      </div>
      <div className="mobile-plans-heading">
        <div><span className="eyebrow eyebrow-red">FIND YOUR FIT</span><h2>Plans made for how you connect.</h2></div>
        <span>Prices for new activations and when you bring your own phone.</span>
      </div>
      <div className="mobile-plan-grid">
        {mobilePlans.map((plan, index) => {
          const total = monthlyTotal(plan)
          const singleLinePrice = withInternet ? plan.bundlePrice : plan.mobileOnlyPrice
          return <article className={`mobile-plan-card ${index === 1 ? 'mobile-plan-popular' : ''}`} key={plan.id}>
            {plan.badge && <span className="mobile-plan-badge"><Icon name="shield" size={13} />{plan.badge}</span>}
            <span className="mobile-plan-name">{plan.name}</span>
            <p className="mobile-plan-data">{plan.data}</p>
            <div className="mobile-plan-price"><strong>${total ?? singleLinePrice}</strong><span>/mo.{lineCount > 1 && total !== undefined ? ` total for ${lineCount} lines` : ''}</span></div>
            {lineCount > 1 && !plan.mixAndMatch
              ? <p className="mobile-plan-price-note">Multi-line pricing is not listed for this plan.</p>
              : <p className="mobile-plan-price-note">With an active Spectrum Internet plan and after Auto-Pay Discount{lineCount === 1 && <> · <s>${plan.priceBeforeIncentives}/mo.</s> before incentives</>}</p>}
            <ul className="mobile-plan-features">{plan.features.map((feature) => <li key={feature}><Icon name="check" size={15} />{feature}</li>)}</ul>
            <details className="mobile-plan-perks"><summary>Top perks</summary><ul>{plan.perks.map((perk) => <li key={perk}>{perk}</li>)}</ul></details>
            <button className={index === 1 ? 'button-primary' : 'button-outline'} onClick={() => onAdd(`${plan.name} · ${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`)}>Get plan <Icon name="arrow" size={15} /></button>
          </article>
        })}
      </div>
      <p className="mobile-price-disclaimer">Prices and offers shown are a reference snapshot from {offerSnapshotDate}, not a live Spectrum feed. Prices depend on eligibility, Auto-Pay, service bundle and location; taxes and terms apply. Confirm current details with Spectrum.</p>
      <div className="additional-lines">
        <div><span className="eyebrow eyebrow-red">KEEP EVERYONE CONNECTED</span><h3>Save when you mix and match select plans.</h3><p>Published additional-line prices after Auto-Pay when you bring your own phone.</p></div>
        <div className="additional-lines-table-wrap"><table className="additional-lines-table"><thead><tr><th scope="col">Phone lines</th><th scope="col">By the Gig</th><th scope="col">Unlimited</th><th scope="col">Unlimited Plus</th><th scope="col">Unlimited Plus Premium</th></tr></thead><tbody><tr><th scope="row">Add a 2nd line</th><td>$20/mo.</td><td>$25/mo.</td><td>$40/mo.</td><td>$50/mo.</td></tr><tr><th scope="row">Add a 3rd line</th><td>$20/mo.</td><td>$25/mo.</td><td>$40/mo.</td><td>$50/mo.</td></tr><tr><th scope="row">Add a 4th or more</th><td>$20/mo.</td><td>$25/mo.</td><td>$40/mo.</td><td>$50/mo.</td></tr></tbody></table></div>
      </div>
      <div className="mobile-phone-promo"><div><span className="eyebrow eyebrow-red">LOOKING TO FINANCE A PHONE?</span><h3>Find your next phone, your way.</h3><p>Explore current smartphones, flexible financing and trade-in options.</p></div><button className="button-primary" onClick={onPhones}>Browse phones <Icon name="arrow" size={15} /></button></div>
    </section>
  </>
}

function HomeWifiPage({ onAdd, onChat }: { onAdd: (label: string) => void; onChat: () => void }) {
  function shopHomeWifi() {
    onAdd(homeWifiOffer.name)
  }

  return <>
    <div className="breadcrumbs page-width"><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button><span>/</span><span>Home WiFi</span></div>
    <section className="security-hero">
      <div className="security-hero-inner page-width">
        <div className="security-hero-copy">
          <span className="eyebrow">ADVANCED WIFI &amp; INVINCIBLE WIFI</span>
          <h1>WiFi that keeps<br />up <em>everywhere.</em></h1>
          <p>Whole-home mesh coverage, built-in network security and parental controls — all from the My Spectrum App.</p>
          <div className="security-hero-actions"><button className="button-primary" onClick={shopHomeWifi}>Get Advanced WiFi <Icon name="arrow" size={16} /></button><span>Starting from <strong>${homeWifiOffer.startingPrice}{homeWifiOffer.priceCadence}</strong></span></div>
          <small className="security-hero-note">{homeWifiOffer.priceNote}</small>
        </div>
        <NetworkIllustration variant="home" className="security-hero-art" />
      </div>
    </section>
    <section className="security-benefits page-width" aria-label="Included WiFi features">
      {homeWifiOffer.benefits.map((benefit, index) => <div className="security-benefit" key={benefit}><span className="security-benefit-icon"><Icon name={index === 0 ? 'play' : index === 1 ? 'shield' : index === 2 ? 'home' : 'wifi'} size={20} /></span><strong>{benefit}</strong></div>)}
    </section>
    <div className="security-subnav page-width"><strong>Feel good about your network.</strong><button onClick={onChat}><Icon name="spark" size={15} /> Ask Spectra</button><button onClick={() => document.getElementById('security-features')?.scrollIntoView({ behavior: 'smooth' })}>Explore features <Icon name="chevron" size={14} /></button><button onClick={() => document.getElementById('security-plans')?.scrollIntoView({ behavior: 'smooth' })}>Plans &amp; setup <Icon name="chevron" size={14} /></button></div>
    <section className="security-feature-section" id="security-features">
      <div className="page-width">
        <div className="security-section-heading"><span className="eyebrow eyebrow-red">YOUR NETWORK, IN YOUR HANDS</span><h2>More peace of mind.<br /><em>One app.</em></h2><p>From checking connected devices to pausing WiFi for the kids, keep the things that matter close.</p></div>
        <div className="security-feature-list">
          {homeWifiOffer.features.map((feature, index) => <article className={`security-feature-row ${index % 2 ? 'security-feature-reverse' : ''}`} key={feature.title}>
            <NetworkIllustration variant={feature.art} className="security-feature-art" />
            <div className="security-feature-copy"><span className="security-feature-number">0{index + 1} / HOME WIFI</span><h3>{feature.title}</h3><p>{feature.description}</p>{index === 0 && <button className="button-text-dark" onClick={onChat}>Ask Spectra how it works <Icon name="arrow" size={15} /></button>}</div>
          </article>)}
        </div>
      </div>
    </section>
    <section className="security-setup" id="security-plans">
      <div className="page-width">
        <div className="security-setup-heading"><span className="eyebrow eyebrow-red">UP AND RUNNING YOUR WAY</span><h2>Setup made easy.</h2><p>Choose the setup that works for your home. Get help whenever you need it.</p></div>
        <div className="security-setup-grid">
          <article className="security-setup-card"><div className="security-setup-art security-setup-self"><NetworkIllustration variant="app" /></div><div className="security-setup-copy"><span>OPTION 01</span><h3>Set it up yourself</h3><p>The My Spectrum App walks you through activation and router setup, with 24/7 tech support when you need it.</p><button className="button-text-dark" onClick={shopHomeWifi}>Choose Advanced WiFi <Icon name="arrow" size={15} /></button></div></article>
          <article className="security-setup-card"><div className="security-setup-art security-setup-pro"><NetworkIllustration variant="support" /></div><div className="security-setup-copy"><span>OPTION 02</span><h3>Hire a pro</h3><p>Prefer an expert? Choose professional installation, no matter how many devices connect.</p><button className="button-text-dark" onClick={onChat}>Talk to Spectra <Icon name="arrow" size={15} /></button></div></article>
        </div>
      </div>
    </section>
    <section className="security-offer-band">
      <div className="page-width security-offer-inner"><NetworkIllustration variant="sensors" className="security-offer-art" /><div><span className="eyebrow">ADVANCED WIFI &amp; INVINCIBLE WIFI</span><h2>Keep every device<br /><em>connected.</em></h2><p>{homeWifiOffer.priceNote}</p><button className="button-primary" onClick={shopHomeWifi}>Add Home WiFi <Icon name="arrow" size={16} /></button><small>Reference offer captured {offerSnapshotDate}. Price and availability may change.</small></div></div>
    </section>
    <div className="security-support page-width"><span className="security-support-icon"><Icon name="phone" size={22} /></span><div><strong>Need a hand getting started?</strong><p>We’re here to help you find the right setup for your home.</p></div><button className="button-outline" onClick={onChat}>Chat with Spectra <Icon name="spark" size={15} /></button></div>
  </>
}

function NetworkIllustration({ variant, className = '' }: { variant: 'home' | 'app' | 'door' | 'camera' | 'sensors' | 'tv' | 'support'; className?: string }) {
  const labels = {
    home: 'Illustration of a comfortable home with connected WiFi devices',
    app: 'Illustration of a mobile app managing a home network',
    door: 'Illustration of WiFi coverage reaching every room',
    camera: 'Illustration of a home network security dashboard',
    sensors: 'Illustration of connected devices on a home network',
    tv: 'Illustration of a television streaming over WiFi',
    support: 'Illustration of a technician setting up home WiFi',
  }
  return <div className={`security-illustration security-illustration-${variant} ${className}`} role="img" aria-label={labels[variant]}>
    <svg viewBox="0 0 640 440" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`security-wall-${variant}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f4e9dc" /><stop offset="1" stopColor="#d2dfd5" /></linearGradient>
        <linearGradient id={`security-night-${variant}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#304943" /><stop offset="1" stopColor="#132d34" /></linearGradient>
        <linearGradient id={`security-screen-${variant}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#afc8ae" /><stop offset="1" stopColor="#6c8e80" /></linearGradient>
        <linearGradient id={`security-door-${variant}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a56f4d" /><stop offset="1" stopColor="#694334" /></linearGradient>
      </defs>
      {variant === 'home' && <>
        <rect width="640" height="440" fill={`url(#security-wall-${variant})`} />
        <path d="M0 329h640v111H0z" fill="#b88b6d" /><path d="M0 340h640" stroke="#f0d1ab" strokeWidth="8" opacity=".65" />
        <rect x="72" y="47" width="211" height="191" rx="5" fill="#fcf7ee" /><rect x="83" y="58" width="189" height="169" fill="#adc4ba" />
        <path d="M83 178c40-54 77-25 109-68s54-12 80-53v170H83z" fill="#738b7c" /><path d="M178 58v169M83 143h189" stroke="#f9f3e7" strokeWidth="8" />
        <path d="M0 299q91-75 177 0v41H0z" fill="#dda988" /><path d="M0 307q85-54 164 0v68H0z" fill="#b86c50" />
        <rect x="302" y="126" width="88" height="164" rx="5" fill={`url(#security-door-${variant})`} /><circle cx="374" cy="210" r="5" fill="#e2c18a" />
        <rect x="331" y="110" width="31" height="17" rx="5" fill="#2e3535" /><circle cx="347" cy="117" r="4" fill="#81d5bd" />
        <rect x="414" y="230" width="194" height="105" rx="38" fill="#849788" /><rect x="432" y="211" width="153" height="72" rx="32" fill="#98a99a" /><path d="M431 312v65M581 310v67" stroke="#514a42" strokeWidth="10" />
        <path d="M475 227v-68q0-51 40-51t40 51v68" fill="none" stroke="#283735" strokeWidth="9" /><rect x="500" y="176" width="31" height="53" rx="7" fill="#253638" /><circle cx="515" cy="188" r="5" fill="#8be1c7" /><circle cx="515" cy="215" r="3" fill="#8be1c7" />
        <path d="M599 223q-41-64-24-112 48 23 39 110M603 267q-22-78 12-119 39 48 4 127" fill="#66816d" /><path d="M582 282h41l-6 56h-31z" fill="#c38d67" />
        <rect x="391" y="46" width="190" height="78" rx="12" fill="#fff" opacity=".94" /><circle cx="418" cy="85" r="13" fill="#ddf2e9" /><path d="m412 85 4 4 8-9" stroke="#397c66" strokeWidth="3" fill="none" /><text x="441" y="79" fontSize="14" fontFamily="Arial" fontWeight="700" fill="#243b34">Home is protected</text><text x="441" y="99" fontSize="11" fontFamily="Arial" fill="#6d7771">All devices are online</text>
        <circle cx="318" cy="117" r="24" fill="#fff" opacity=".28" /><circle cx="347" cy="117" r="40" fill="none" stroke="#eaf8f0" strokeWidth="2" opacity=".6" />
      </>}
      {variant === 'app' && <>
        <rect width="640" height="440" fill="#ece9e0" /><circle cx="166" cy="228" r="145" fill="#d5ded1" /><path d="M47 262 165 152l124 110v113H47z" fill="#fff" /><path d="m29 271 136-132 142 132" fill="none" stroke="#6b8275" strokeWidth="16" strokeLinejoin="round" /><rect x="78" y="273" width="59" height="102" rx="4" fill="#af8163" /><rect x="180" y="251" width="67" height="58" rx="3" fill="#b7d0c5" /><path d="M180 280h67M213 251v58" stroke="#fff" strokeWidth="5" /><rect x="368" y="44" width="178" height="350" rx="28" fill="#242b2b" /><rect x="379" y="58" width="156" height="323" rx="20" fill="#f8f7f3" /><rect x="427" y="67" width="60" height="8" rx="4" fill="#343b39" /><text x="394" y="111" fontSize="14" fontFamily="Arial" fontWeight="700" fill="#293833">My home</text><rect x="394" y="129" width="126" height="96" rx="10" fill={`url(#security-screen-${variant})`} /><path d="m394 202 43-47 28 26 19-21 36 34v31H394z" fill="#4f7769" /><text x="404" y="244" fontSize="10" fontFamily="Arial" fill="#273832">Front door</text><circle cx="505" cy="242" r="8" fill="#66a18b" /><rect x="394" y="266" width="126" height="42" rx="9" fill="#fff" /><circle cx="416" cy="287" r="11" fill="#e4eee6" /><path d="M410 287h12M416 281v12" stroke="#59836d" strokeWidth="2" /><text x="436" y="291" fontSize="10" fontFamily="Arial" fill="#39443e">Door lock</text><rect x="394" y="319" width="126" height="42" rx="9" fill="#fff" /><circle cx="416" cy="340" r="11" fill="#e4eee6" /><path d="M411 340q5-6 10 0M413 344q3-3 6 0" stroke="#59836d" strokeWidth="2" fill="none" /><text x="436" y="344" fontSize="10" fontFamily="Arial" fill="#39443e">WiFi network</text>
      </>}
      {variant === 'door' && <>
        <rect width="640" height="440" fill="#eae5d9" /><rect x="152" y="35" width="338" height="405" fill={`url(#security-door-${variant})`} /><rect x="175" y="58" width="151" height="164" fill="#a9c3b7" /><path d="M175 174q66-75 151-24v72H175z" fill="#72917e" /><path d="M250 58v164M175 141h151" stroke="#f2e6d4" strokeWidth="7" /><rect x="346" y="58" width="121" height="164" fill="#8f6145" /><rect x="346" y="238" width="121" height="171" fill="#895a42" /><circle cx="439" cy="326" r="7" fill="#edc584" /><rect x="363" y="21" width="65" height="36" rx="10" fill="#2f3938" /><circle cx="395" cy="38" r="9" fill="#8be0c5" /><circle cx="395" cy="38" r="23" fill="none" stroke="#fff" strokeWidth="2" opacity=".65" /><rect x="38" y="79" width="157" height="259" rx="24" fill="#252c2b" /><rect x="49" y="94" width="135" height="228" rx="16" fill="#f9f8f4" /><rect x="86" y="100" width="61" height="6" rx="3" fill="#333" /><text x="64" y="135" fontSize="11" fontFamily="Arial" fontWeight="700" fill="#283831">Someone’s at</text><text x="64" y="151" fontSize="11" fontFamily="Arial" fontWeight="700" fill="#283831">your front door</text><rect x="61" y="164" width="111" height="75" rx="5" fill="#bed0c3" /><circle cx="131" cy="189" r="13" fill="#d0a17e" /><path d="M116 222q15-32 34 0" fill="#526f61" /><circle cx="86" cy="270" r="15" fill="#dfefe6" /><path d="m79 270 5 5 10-11" stroke="#548369" strokeWidth="2" fill="none" /><text x="108" y="274" fontSize="9" fontFamily="Arial" fill="#47534b">Live video</text><rect x="64" y="291" width="103" height="16" rx="8" fill="#e5f0e8" />
      </>}
      {variant === 'camera' && <>
        <rect width="640" height="440" fill={`url(#security-night-${variant})`} /><circle cx="488" cy="88" r="37" fill="#edd8b3" opacity=".8" /><path d="M0 266 124 142l107 107 94-90 154 131 90-62 71 72v140H0z" fill="#384e47" /><path d="M0 319 101 224l96 74 83-60 107 97 96-94 157 108v91H0z" fill="#243a35" /><rect x="77" y="248" width="222" height="122" fill="#d9b98c" /><path d="m51 253 136-116 138 116" fill="#a67755" /><rect x="107" y="277" width="65" height="93" fill="#71513e" /><rect x="196" y="274" width="72" height="53" fill="#a9cdbb" /><path d="M196 301h72M232 274v53" stroke="#fff" strokeWidth="4" /><rect x="382" y="93" width="204" height="145" rx="9" fill="#fbf8f0" opacity=".94" /><rect x="393" y="105" width="182" height="121" rx="5" fill={`url(#security-screen-${variant})`} /><path d="m393 194 49-47 35 31 30-24 68 50v22H393z" fill="#557967" /><circle cx="555" cy="118" r="5" fill="#d04b41" /><text x="402" y="249" fontSize="10" fontFamily="Arial" fill="#34413a">LIVE · FRONT PORCH</text><circle cx="516" cy="314" r="69" fill="#dce9df" opacity=".1" /><rect x="460" y="302" width="121" height="32" rx="16" fill="#fff" opacity=".95" /><circle cx="480" cy="318" r="8" fill="#75aa8c" /><path d="m477 318 3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" /><text x="495" y="322" fontSize="10" fontFamily="Arial" fill="#354239">Recording saved</text>
      </>}
      {variant === 'sensors' && <>
        <rect width="640" height="440" fill="#ebe5d8" /><path d="M84 192 320 43l236 149v187H84z" fill="#faf7ef" /><path d="m48 204 272-175 272 175" fill="none" stroke="#647a6d" strokeWidth="17" strokeLinejoin="round" /><path d="M320 45v335" stroke="#d5cec0" strokeWidth="5" /><rect x="131" y="223" width="88" height="156" rx="3" fill="#a77a5a" /><rect x="258" y="224" width="48" height="40" fill="#a8c3b3" /><rect x="334" y="224" width="48" height="40" fill="#a8c3b3" /><rect x="411" y="223" width="86" height="156" rx="3" fill="#a77a5a" /><rect x="440" y="213" width="29" height="13" rx="5" fill="#344440" /><circle cx="454" cy="219" r="3" fill="#82d0ad" /><rect x="151" y="213" width="28" height="12" rx="5" fill="#344440" /><circle cx="165" cy="219" r="3" fill="#82d0ad" /><path d="M89 380h469" stroke="#b8aa94" strokeWidth="5" /><rect x="213" y="312" width="51" height="42" rx="9" fill="#fff" /><path d="M238 319v25M225 331h26" stroke="#69947c" strokeWidth="3" /><circle cx="237" cy="332" r="22" fill="none" stroke="#8bb69c" strokeWidth="2" /><rect x="354" y="295" width="47" height="46" rx="9" fill="#fff" /><path d="M378 304v28M364 318h28" stroke="#69947c" strokeWidth="3" /><circle cx="378" cy="318" r="22" fill="none" stroke="#8bb69c" strokeWidth="2" /><rect x="37" y="55" width="160" height="61" rx="12" fill="#fff" /><circle cx="64" cy="85" r="12" fill="#fff1e1" /><path d="M64 77v9l6 3" stroke="#bd7950" strokeWidth="2" fill="none" /><text x="86" y="82" fontSize="11" fontFamily="Arial" fontWeight="700" fill="#35423a">Window opened</text><text x="86" y="99" fontSize="9" fontFamily="Arial" fill="#717971">Living room · just now</text><path d="M183 116q16 35 22 87M424 258q-20 21-39 45" fill="none" stroke="#72a286" strokeWidth="2" strokeDasharray="5 7" />
      </>}
      {variant === 'tv' && <>
        <rect width="640" height="440" fill="#e9e4db" /><rect x="103" y="74" width="434" height="274" rx="13" fill="#242a29" /><rect x="117" y="88" width="406" height="246" rx="6" fill={`url(#security-screen-${variant})`} /><path d="M117 255q95-101 198-29t208-82v190H117z" fill="#567968" /><path d="m117 239 127-82 72 65 56-44 151 91v65H117z" fill="#96ad95" /><circle cx="414" cy="149" r="31" fill="#f1d6a8" /><path d="M232 347v43M412 347v43M197 392h250" stroke="#3a403c" strokeWidth="10" /><rect x="45" y="298" width="96" height="51" rx="7" fill="#fff" /><circle cx="65" cy="318" r="7" fill="#4eab84" /><text x="80" y="321" fontSize="9" fontFamily="Arial" fill="#34413a">Front door</text><text x="80" y="337" fontSize="8" fontFamily="Arial" fill="#68716a">Live camera</text><rect x="447" y="288" width="149" height="67" rx="11" fill="#fff" /><circle cx="474" cy="321" r="15" fill="#ebf4ed" /><path d="m469 321 4 4 7-8" stroke="#598369" strokeWidth="2" fill="none" /><text x="499" y="316" fontSize="10" fontFamily="Arial" fontWeight="700" fill="#36423a">Camera online</text><text x="499" y="333" fontSize="8" fontFamily="Arial" fill="#68716a">All clear at home</text>
      </>}
      {variant === 'support' && <>
        <rect width="640" height="440" fill="#dce5dd" /><circle cx="486" cy="76" r="61" fill="#f5d2aa" /><path d="M380 347q26-154 125-164 100 10 126 164v93H380z" fill="#526b5d" /><ellipse cx="502" cy="160" rx="50" ry="59" fill="#bd8866" /><path d="M450 161q-13-74 49-76 60 2 58 72l-18-27-72 2Z" fill="#3c3b35" /><path d="M463 244q41 27 81 0" fill="none" stroke="#e6eee8" strokeWidth="4" /><rect x="414" y="269" width="57" height="42" rx="5" fill="#f4f1e8" /><rect x="421" y="276" width="43" height="28" rx="3" fill="#93b1a0" /><path d="m431 294 7-8 8 8 7-5 11 10h-33z" fill="#4e7060" /><rect x="58" y="130" width="293" height="206" rx="14" fill="#fff" /><path d="m58 190 146-101 147 101" fill="#957056" /><path d="M82 188h244v132H82z" fill="#faf7ee" /><rect x="116" y="209" width="61" height="111" fill="#b07e5b" /><rect x="204" y="207" width="81" height="58" fill="#a9c7b5" /><path d="M204 236h81M245 207v58" stroke="#fff" strokeWidth="4" /><rect x="217" y="285" width="45" height="33" rx="7" fill="#263635" /><circle cx="239" cy="301" r="5" fill="#80d5b5" /><rect x="350" y="119" width="25" height="8" rx="4" fill="#293631" /><circle cx="363" cy="123" r="8" fill="#74bc93" /><path d="M340 105q23-19 46 0M332 96q31-29 62 0" fill="none" stroke="#5c9a77" strokeWidth="3" />
      </>}
    </svg>
  </div>
}

function PlanCard({ plan, featured, onAdd }: { plan: (typeof catalog)[keyof typeof catalog]; featured: boolean; onAdd: () => void }) {
  return <article className={`plan-card ${featured ? 'plan-featured' : ''}`}>{featured && <span className="plan-badge">A little more to love</span>}<span className="plan-eyebrow">{plan.label}</span><h3>{plan.description.split('.')[0]}</h3><p className="plan-desc">{plan.detail}</p><div className="plan-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div><ul>{plan.features.map((feature) => <li key={feature}><Icon name="check" size={15} /> {feature}</li>)}</ul><button className={featured ? 'button-primary' : 'button-outline'} onClick={onAdd}>Choose this option <Icon name="arrow" size={15} /></button></article>
}

function DevicesPage({ onAdd }: { onAdd: (label: string, monthlyPrice?: number | null) => void }) {
  const [filter, setFilter] = useState('All phones')
  const [query, setQuery] = useState('')
  const visiblePhones = productCards.filter((product) => (filter === 'All phones' || product.line === filter) && `${product.line} ${product.name}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <section className="devices-hero"><div className="page-width devices-hero-inner"><div><span className="eyebrow">DEVICES, YOUR WAY</span><h1>Find the phone<br />that feels <em>like you.</em></h1><p>Explore the latest phones, flexible payment options and offers to make your next upgrade feel even better.</p><button className="button-primary" onClick={() => document.getElementById('phone-catalog')?.scrollIntoView({ behavior: 'smooth' })}>Shop phones <Icon name="arrow" size={16} /></button></div><div className="device-hero-art" aria-hidden="true"><div className="device-blob" /><div className="device-hero-phone phone-back"><span /></div><div className="device-hero-phone phone-front"><i /><span>16:09</span><b /></div><span className="device-star">✦</span></div></div></section>
    <section className="section-block page-width device-catalog" id="phone-catalog"><div className="section-heading"><div><span className="eyebrow eyebrow-red">THE LATEST & GREATEST</span><h2>Let’s find your next phone.</h2><p>Great devices. Flexible ways to make them yours.</p></div><span className="pricing-note">Flexible financing options</span></div><div className="phone-catalog-tools"><div className="device-filters" role="group" aria-label="Filter phones by brand">{['All phones', 'Apple', 'Samsung', 'Google'].map((option) => <button className={filter === option ? 'filter-active' : ''} aria-pressed={filter === option} onClick={() => setFilter(option)} key={option}>{option}</button>)}</div><label className="phone-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search phones" aria-label="Search phones" /></label></div><div className="product-grid">{visiblePhones.map((product) => <article className="product-card" key={product.name}><span className="product-badge">{product.badge ?? 'Explore'} </span><div className={`product-art ${product.swatch}`} aria-hidden="true"><div className="product-phone"><i /><b /><span /></div></div><div className="product-info"><span>{product.line}</span><h3>{product.name}</h3>{product.monthlyPrice ? <><strong>{product.monthlyPrice}</strong><small>{product.priceNote}</small>{product.details?.map((detail) => <small className="phone-detail" key={detail}>{detail}</small>)}</> : <><strong className="phone-price-prompt">See pricing options</strong><small>Financing and trade-in offers may be available.</small></>}<button className="button-outline" onClick={() => onAdd(product.name, deviceMonthlyPrice(product))}>Choose device <Icon name="arrow" size={15} /></button></div></article>)}</div>{visiblePhones.length === 0 && <p className="phone-empty-state">No phones match “{query}”. Try another search or choose a different brand.</p>}<p className="legal-copy">Device pricing is a snapshot of spectrum.com/phones captured {devicePricingCapturedAt}, not a live Spectrum feed. Prices and offers vary by plan, storage, trade-in and eligibility. Taxes extra; terms apply.</p></section>
    <section className="trade-section"><div className="page-width trade-inner"><span className="trade-icon"><Icon name="phone" size={25} /></span><div><span className="eyebrow eyebrow-red">A GOOD PHONE CAN GO FURTHER</span><h2>Trade in. Get more back.</h2><p>Your current phone may be worth more than you think. Get an estimate and put it toward something new.</p></div><button className="button-primary" onClick={() => onAdd('Phone upgrade & trade-in')}>Explore trade-in <Icon name="arrow" size={16} /></button></div></section>
  </>
}

function SupportPage({ onNavigate, onChat }: { onNavigate: (page: Page) => void; onChat: () => void }) {
  const [topic, setTopic] = useState('')
  const topics = [{ label: 'Internet & WiFi', icon: 'wifi' as IconName, prompt: 'My internet is not working properly' }, { label: 'Billing & payments', icon: 'cart' as IconName, prompt: 'I need help understanding my bill' }, { label: 'Mobile & devices', icon: 'phone' as IconName, prompt: 'I need help with my mobile phone' }, { label: 'TV & streaming', icon: 'play' as IconName, prompt: 'I need help with my TV service' }, { label: 'Account & profile', icon: 'person' as IconName, prompt: 'I need help with my Spectrum account' }, { label: 'Moving services', icon: 'home' as IconName, prompt: 'I am moving and need to move my Spectrum services' }]
  return <><section className="support-hero"><div className="page-width support-hero-inner"><div><span className="eyebrow">HERE WHEN YOU NEED US</span><h1>Let’s get you<br /><em>back to good.</em></h1><p>Find an answer, get step-by-step help or connect with someone who can help.</p><button className="support-search" onClick={() => setTopic('')}><Icon name="search" /><input aria-label="Search support" placeholder="Search for help with anything" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { onChat(); setTimeout(() => window.dispatchEvent(new CustomEvent('spectra-message', { detail: topic })), 0) } }} /><Icon name="arrow" size={16} /></button></div><div className="support-visual"><div className="support-sun" /><div className="support-person"><i /><b /></div><span>WE’RE<br />HERE.</span><div className="support-orbit" /></div></div></section><section className="section-block page-width support-topics"><div className="section-heading"><div><span className="eyebrow eyebrow-red">HOW CAN WE HELP?</span><h2>Let’s start with what you need.</h2></div></div><div className="support-topic-grid">{topics.map((item) => <button key={item.label} onClick={() => { onChat(); setTimeout(() => window.dispatchEvent(new CustomEvent('spectra-message', { detail: item.prompt })), 0) }}><span className="support-topic-icon"><Icon name={item.icon} size={20} /></span><strong>{item.label}</strong><Icon name="arrow" size={16} /></button>)}</div></section><section className="support-contact"><div className="page-width support-contact-inner"><div><span className="eyebrow eyebrow-red">A REAL PERSON IS HERE, TOO</span><h2>Let’s talk it through.</h2><p>Spectra can help right now, or visit My Spectrum App for support with your account.</p></div><div className="support-contact-actions"><button className="button-primary" onClick={onChat}><Icon name="spark" size={16} /> Chat with Spectra</button><button className="button-outline" onClick={() => onNavigate('account')}>Go to My Spectrum App <Icon name="arrow" size={15} /></button></div></div></section></>
}

function AccountPage({ signedIn, email, setEmail, onSignIn, onChat }: { signedIn: boolean; email: string; setEmail: (email: string) => void; onSignIn: () => void; onChat: () => void }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  function submit(event: FormEvent) { event.preventDefault(); onSignIn() }
  return <section className="account-page"><div className="account-panel"><button className="account-wordmark" aria-label="Spectrum"><SpectrumLogo /></button>{signedIn ? <div className="account-welcome"><span className="account-success"><Icon name="check" size={24} /></span><span className="eyebrow eyebrow-red">MYSPECTRUM</span><h1>You’re in,<br /><em>welcome back.</em></h1><p>Your connected life, all in one place.</p><div className="account-summary"><div><span>Account</span><strong>{email || 'Customer account'}</strong></div><div><span>Services</span><strong>Mobile · Internet</strong></div><div><span>Amount due</span><strong>$126.40</strong></div></div><button className="button-primary" onClick={onChat}>Get help with your account <Icon name="arrow" size={15} /></button></div> : <><span className="eyebrow eyebrow-red">MYSPECTRUM</span><h1>Good to see<br /><em>you again.</em></h1><p>Sign in to manage your services, check your usage, pay your bill and more.</p><form className="signin-form" onSubmit={submit}><label htmlFor="signin-email">Username or email</label><input id="signin-email" type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your username or email" required /><label htmlFor="signin-password">Password</label><div className="password-field"><input id="signin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div><button className="button-primary signin-button">Sign in <Icon name="arrow" size={16} /></button></form><div className="signin-help"><button>Forgot username?</button><span>·</span><button>Forgot password?</button></div><div className="create-account">New to My Spectrum App? <button onClick={() => setEmail('')}>Create an account <Icon name="arrow" size={14} /></button></div></>}</div><div className="account-side"><span className="account-side-glow" /><div className="account-side-content"><span className="eyebrow">YOUR SPECTRUM LIFE, TOGETHER</span><h2>Everything you need,<br /><em>right where you need it.</em></h2><p>One simple place to stay on top of your services, your way.</p><div className="account-feature"><Icon name="phone" /><span><strong>Manage your services</strong><small>See your Spectrum services at a glance.</small></span></div><div className="account-feature"><Icon name="cart" /><span><strong>Stay on top of your bill</strong><small>Review, pay and manage your account.</small></span></div><div className="account-feature"><Icon name="spark" /><span><strong>Get help when it matters</strong><small>Find answers and support, all in one place.</small></span></div></div></div></section>
}

function CartPage({ count, label, monthlyPrice, onNavigate, onRemove }: { count: number; label: string; monthlyPrice: number | null; onNavigate: (page: Page) => void; onRemove: () => void }) {
  const total = monthlyPrice === null ? null : monthlyPrice * count
  const displayPrice = monthlyPrice === null ? 'Price confirmed during activation' : `$${monthlyPrice.toFixed(2)}/mo.`
  return <section className="cart-page page-width">
    <div className="breadcrumbs"><button onClick={() => onNavigate('home')}>Home</button><span>/</span><span>Your cart</span></div>
    <h1>Your cart<span className="cart-heading-count">({count})</span></h1>
    {count === 0 ? <div className="empty-cart"><span className="empty-cart-icon"><Icon name="cart" size={27} /></span><h2>Nothing here just yet.</h2><p>Your next great connection is only a click away.</p><div className="empty-cart-actions"><button className="button-primary" onClick={() => onNavigate('mobile')}>Explore mobile plans <Icon name="arrow" size={15} /></button><button className="button-outline" onClick={() => onNavigate('devices')}>Shop devices</button></div></div>
      : <div className="cart-content"><div className="cart-items">
        <div className="cart-item"><span className="cart-product-image"><Icon name={label.toLowerCase().includes('internet') ? 'wifi' : label.toLowerCase().includes('phone') || /iphone|pixel|galaxy|samsung/i.test(label) ? 'phone' : 'spark'} size={26} /></span><div><span className="eyebrow eyebrow-red">SPECTRUM · SELECTED FOR YOU</span><h2>{label}</h2><p>New activation · Choose your details at checkout</p><button className="remove-item" onClick={onRemove}>Remove</button></div><strong>{displayPrice}</strong></div>
        <div className="cart-promo"><Icon name="spark" size={17} /><span><b>There may be more to love.</b> Eligible bundle discounts and offers are applied when you shop.</span><button onClick={() => onNavigate('internet')}>Explore bundles <Icon name="arrow" size={14} /></button></div>
      </div><aside className="order-summary"><h2>Order summary</h2><div><span>Monthly services</span><strong>{total === null ? 'To be confirmed' : `$${total.toFixed(2)}/mo.`}</strong></div><div><span>One-time charges</span><strong>To be confirmed</strong></div><div className="summary-total"><span>Estimated monthly total</span><strong>{total === null ? 'To be confirmed' : `$${total.toFixed(2)}/mo.`}</strong></div><small>Plus taxes and applicable fees. Final device price depends on the available offer and eligibility.</small><button className="button-primary" onClick={() => onNavigate('checkout')}>Continue to checkout <Icon name="arrow" size={15} /></button><div className="secure-note"><Icon name="shield" size={15} /> Secure demo checkout · No obligation</div></aside></div>}
  </section>
}

function CheckoutPage({ step, label, monthlyPrice, setStep }: { step: number; label: string; monthlyPrice: number | null; setStep: (step: number) => void }) {
  const price = monthlyPrice === null ? 'To be confirmed' : `$${monthlyPrice.toFixed(2)}/mo.`
  if (step === 4) return <section className="checkout-page page-width"><div className="checkout-confirmation"><span className="account-success"><Icon name="check" size={24} /></span><span className="eyebrow eyebrow-red">DEMO ORDER COMPLETE</span><h1>You’re one step<br />closer to <em>connected.</em></h1><p>This interactive demo doesn’t place a real order. In a live Spectrum checkout, you’d receive a confirmation and next steps here.</p><button className="button-primary" onClick={() => setStep(1)}>Back to checkout <Icon name="arrow" size={15} /></button></div></section>
  return <section className="checkout-page page-width"><div className="breadcrumbs"><button onClick={() => setStep(1)}>Your cart</button><span>/</span><span>Checkout</span></div><div className="checkout-heading"><span className="eyebrow eyebrow-red">A FEW MORE DETAILS</span><h1>Let’s make it <em>yours.</em></h1><p>We’ll guide you through the next steps. You can review everything before confirming.</p></div><div className="checkout-progress">{['Your details', 'Choose your plan', 'Review & confirm'].map((stepLabel, index) => <button key={stepLabel} className={step === index + 1 ? 'step-current' : step > index + 1 ? 'step-done' : ''} onClick={() => setStep(index + 1)}><span>{step > index + 1 ? <Icon name="check" size={14} /> : `0${index + 1}`}</span>{stepLabel}</button>)}</div><div className="checkout-layout"><div className="checkout-form-card"><span className="eyebrow eyebrow-red">STEP 0{step} OF 03</span><h2>{step === 1 ? 'Let’s start with you.' : step === 2 ? 'Your plan, your way.' : 'One last look.'}</h2><p>{step === 1 ? 'Tell us how to reach you. We’ll use this to help set up your Spectrum service.' : step === 2 ? 'Choose how you’d like to get started with Spectrum.' : 'Make sure everything looks right before you continue.'}</p>{step === 1 ? <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); setStep(2) }}><label htmlFor="first-name">First name</label><input id="first-name" required placeholder="First name" /><label htmlFor="last-name">Last name</label><input id="last-name" required placeholder="Last name" /><label htmlFor="checkout-email">Email address</label><input id="checkout-email" type="email" required placeholder="you@example.com" /><label htmlFor="postal-code">Postal code</label><input id="postal-code" required maxLength={7} placeholder="A1A 1A1" /><button className="button-primary checkout-next">Continue <Icon name="arrow" size={15} /></button></form> : step === 2 ? <div className="checkout-options"><button className="checkout-choice selected-choice" onClick={(event) => event.currentTarget.classList.toggle('selected-choice')}><span className="choice-radio" /><span><strong>Bring your number to Spectrum</strong><small>Keep the number you already know and love.</small></span></button><button className="checkout-choice" onClick={(event) => event.currentTarget.classList.toggle('selected-choice')}><span className="choice-radio" /><span><strong>Get a new number</strong><small>We’ll help you find a new number when you activate.</small></span></button><button className="button-primary checkout-next" onClick={() => setStep(3)}>Continue <Icon name="arrow" size={15} /></button></div> : <><div className="review-line"><span>{label}</span><strong>{price}</strong></div><div className="review-line"><span>Selected offer</span><strong>Illustrative</strong></div><div className="review-note"><Icon name="shield" size={16} /> This is a demo; it doesn’t place a real order.</div><button className="button-primary checkout-next" onClick={() => setStep(1)}>Continue to secure activation <Icon name="arrow" size={15} /></button></>}</div><aside className="checkout-summary"><span className="eyebrow eyebrow-red">YOUR SELECTION</span><h3>{label}</h3><p>Based on the plan you selected with Spectra.</p><div className="summary-total"><span>Monthly plan</span><strong>{price}</strong></div><small>Plus taxes and applicable fees. This demo does not place an order.</small></aside></div></section>
}

function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <footer className="site-footer"><div className="page-width"><div className="footer-top"><div className="footer-brand"><button className="wordmark wordmark-footer" onClick={() => onNavigate('home')} aria-label="Spectrum home"><SpectrumLogo /></button><p>Connection, made for you.</p></div><div className="footer-column"><strong>Explore</strong>{[['Mobile plans', 'mobile'], ['Internet', 'internet'], ['TV & Streaming', 'tv'], ['Smart Home', 'smartHome'], ['Devices & Phones', 'devices']].map(([label, target]) => <button key={label} onClick={() => onNavigate(target as Page)}>{label}</button>)}</div><div className="footer-column"><strong>We’re here to help</strong><button onClick={() => onNavigate('support')}>Support centre</button><button onClick={() => onNavigate('support')}>Contact us</button><button onClick={() => onNavigate('support')}>Accessibility</button><button onClick={() => onNavigate('support')}>Community forums</button></div><div className="footer-newsletter"><span className="eyebrow">LET’S STAY CONNECTED</span><strong>Good things, in your inbox.</strong><p>Get the latest offers and a little Spectrum inspiration.</p><div><input aria-label="Email address for newsletter" placeholder="Email address" /><button aria-label="Subscribe"><Icon name="arrow" size={16} /></button></div></div></div><div className="footer-bottom"><span>© 2026 Spectrum</span><div><button>Privacy</button><button>Terms</button><button>Accessibility</button></div><span>Made for connection in America</span></div></div></footer>
}

export default App
