export type ImageAnalysis = {
  issueSummary: string
  likelyRootCause: string
  confidence: number
  recommendedAction: string
  provider?: string | null
  monthlyTotal?: number | null
  services?: string[]
  lineCount?: number | null
  includesDevicePayment?: boolean | null
  deviceModel?: string | null
  charges?: { label: string; amount: number }[]
  suggestions?: string[]
  deviceDescription?: string | null
  condition?: 'good' | 'fair' | 'damaged' | 'unclear'
  damageFindings?: string[]
  tradeInOutlook?: 'worth-trading-in' | 'limited-value' | 'not-recommended' | 'need-better-photo'
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 5 * 1024 * 1024

export type ImageAnalysisType = 'modem' | 'bill' | 'tradeIn'

export async function analyzeImage(file: File, previewDataUrl?: string, analysisType: ImageAnalysisType = 'modem'): Promise<{ dataUrl: string; analysis: ImageAnalysis }> {
  if (!allowedTypes.has(file.type)) throw new Error('Choose a JPG, JPEG, PNG, or WEBP image.')
  if (file.size > maxImageBytes) throw new Error('The image must be 5 MB or smaller.')
  const dataUrl = previewDataUrl ?? await readAsDataUrl(file)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const response = await fetch('/api/image-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType: file.type, analysisType }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(result?.error || 'Image analysis is temporarily unavailable.')
  if (!result || typeof result.issueSummary !== 'string' || typeof result.likelyRootCause !== 'string' || typeof result.recommendedAction !== 'string' || typeof result.confidence !== 'number') {
    throw new Error('Image analysis returned an invalid response. Please try again.')
  }
  return { dataUrl, analysis: result as ImageAnalysis }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image.'))
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}
