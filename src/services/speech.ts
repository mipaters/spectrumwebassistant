import type * as SdkTypes from 'microsoft-cognitiveservices-speech-sdk'

const loadSdk = () => import('microsoft-cognitiveservices-speech-sdk')

type SpeechToken = { token: string; region: string }

let cached: { value: SpeechToken; expires: number } | null = null

async function getToken(): Promise<SpeechToken> {
  if (cached && cached.expires > Date.now()) return cached.value
  const response = await fetch('/api/speech-token', { method: 'POST' })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.token) throw new Error(data?.error || 'Speech is not available right now.')
  cached = { value: data, expires: Date.now() + 8 * 60 * 1000 }
  return data
}

export async function isSpeechAvailable(): Promise<boolean> {
  try {
    await getToken()
    return true
  } catch {
    return false
  }
}

export class SpeechNoMatchError extends Error {}
export class SpeechCancelledError extends Error {}

let listenGeneration = 0
let cancelListen: (() => void) | null = null

export function stopListening() {
  listenGeneration += 1
  cancelListen?.()
  cancelListen = null
}

export async function listenOnce(): Promise<string> {
  stopListening()
  const generation = listenGeneration
  const { token, region } = await getToken()
  const sdk = await loadSdk()
  if (generation !== listenGeneration) throw new SpeechCancelledError()
  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
  speechConfig.speechRecognitionLanguage = 'en-CA'
  const recognizer = new sdk.SpeechRecognizer(speechConfig, sdk.AudioConfig.fromDefaultMicrophoneInput())
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (action: () => void) => {
      if (settled) return
      settled = true
      cancelListen = null
      try { recognizer.close() } catch { /* already closed */ }
      action()
    }
    cancelListen = () => finish(() => reject(new SpeechCancelledError()))
    recognizer.recognizeOnceAsync(
      (result) => finish(() => {
        if (result.reason === sdk.ResultReason.RecognizedSpeech && result.text) resolve(result.text)
        else if (result.reason === sdk.ResultReason.NoMatch) reject(new SpeechNoMatchError())
        else reject(new Error('Microphone is not available. Check your browser’s microphone permission.'))
      }),
      (error) => finish(() => reject(new Error(typeof error === 'string' ? error : 'Microphone is not available.'))),
    )
  })
}
let activeSynthesizer: SdkTypes.SpeechSynthesizer | null = null
let activePlayer: SdkTypes.SpeakerAudioDestination | null = null
let speakGeneration = 0

export function stopSpeaking() {
  speakGeneration += 1
  // Closing the synthesizer alone does not halt audio already queued to the
  // speaker, which is what caused replies to overlap. Pausing/closing the
  // underlying player stops sound immediately.
  try { activePlayer?.pause() } catch { /* already stopped */ }
  try { activePlayer?.close() } catch { /* already stopped */ }
  try { activeSynthesizer?.close() } catch { /* already closed */ }
  activeSynthesizer = null
  activePlayer = null
}

export async function speak(text: string): Promise<void> {
  stopSpeaking()
  const generation = speakGeneration
  const { token, region } = await getToken()
  const sdk = await loadSdk()
  if (generation !== speakGeneration) return
  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
  speechConfig.speechSynthesisVoiceName = 'en-CA-ClaraNeural'
  const player = new sdk.SpeakerAudioDestination()
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, sdk.AudioConfig.fromSpeakerOutput(player))
  activeSynthesizer = synthesizer
  activePlayer = player
  await new Promise<void>((resolve) => {
    const finish = () => {
      try { synthesizer.close() } catch { /* already closed */ }
      if (activeSynthesizer === synthesizer) activeSynthesizer = null
      if (activePlayer === player) activePlayer = null
      resolve()
    }
    synthesizer.speakTextAsync(
      text.slice(0, 1500),
      () => finish(),
      () => finish(),
    )
  })
}
