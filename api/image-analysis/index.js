const config = require('../config')

const jsonHeaders = { 'Content-Type': 'application/json' }
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 5 * 1024 * 1024
const modemPrompt = `Analyze this customer-provided modem, gateway, router, or home-network image for troubleshooting. Describe visible evidence only: lights, equipment condition, error indicators, connection clues, and cable configuration. Do not claim to run a live network test or infer unseen facts. Return JSON with issueSummary, likelyRootCause, confidence (integer 0-100), and recommendedAction. State uncertainty and give safe steps only.`
const billPrompt = `Analyze this image of a customer bill. Read clearly visible information only. Never repeat personal identifiers, account numbers, addresses, phone numbers, or payment details. Return JSON with exactly: issueSummary (short summary); likelyRootCause (explain visible charge changes or say unknown); confidence (integer 0-100); recommendedAction; provider (name or null); monthlyTotal (numeric recurring service total before tax, or null; never use amount due or one-time charges); services (array of mobile, internet, tv, home phone, other); lineCount (integer or null); includesDevicePayment (true only if a phone/device instalment or financing charge is visible, false if clearly none, else null); deviceModel (visible phone model or null); charges (up to 5 objects with label and numeric amount); suggestions (up to 3 concise non-speculative suggestions). Never guess unreadable amounts; use null.`
const tradeInPrompt = `Analyze this customer-provided photo of a smartphone being considered for trade-in. Assess visible physical condition only: cracked or shattered screen or back glass, dents, bent frame, deep scratches, missing parts, camera lens damage, water-damage indicators, swelling or screen lifting, and whether the photo clearly shows the phone. Never claim to test function, battery health, or software state, and do not quote a trade-in value. Return JSON with exactly: issueSummary (short condition summary); likelyRootCause (visible damage and its likely cause, or none visible); confidence (integer 0-100); recommendedAction (practical next step); deviceDescription (visible make or model if identifiable, else null); condition (one of: good, fair, damaged, unclear); damageFindings (up to 5 short visible findings); tradeInOutlook (one of: worth-trading-in, limited-value, not-recommended, need-better-photo). Use need-better-photo with condition unclear if no phone is clearly visible.`
const promptByType = { modem: modemPrompt, bill: billPrompt, tradeIn: tradeInPrompt }
const analysisTypes = new Set(['modem', 'bill', 'tradeIn'])
const assistantRoleByType = { modem: 'home-network troubleshooting', bill: 'billing support', tradeIn: 'device trade-in assessment' }

module.exports = async function (context, req) {
  const { image, mimeType } = req.body || {}
  const analysisType = !req.body?.analysisType ? 'modem' : analysisTypes.has(req.body.analysisType) ? req.body.analysisType : null
  if (typeof image !== 'string' || !allowedMimeTypes.has(mimeType) || !analysisType) {
    context.res = { headers: jsonHeaders, status: 400, body: { error: 'Provide a JPG, PNG, or WEBP image.' } }
    return
  }

  const base64 = image.replace(/^data:image\/(?:jpeg|jpg|png|webp);base64,/i, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length === 0) {
    context.res = { headers: jsonHeaders, status: 400, body: { error: 'The image data is invalid.' } }
    return
  }
  if (base64.length > Math.ceil(maxImageBytes / 3) * 4 + 4) {
    context.res = { headers: jsonHeaders, status: 413, body: { error: 'Images must be 5 MB or smaller.' } }
    return
  }
  const imageBuffer = Buffer.from(base64, 'base64')
  if (imageBuffer.length > maxImageBytes) {
    context.res = { headers: jsonHeaders, status: 413, body: { error: 'Images must be 5 MB or smaller.' } }
    return
  }
  const validSignature = mimeType === 'image/jpeg'
    ? imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff
    : mimeType === 'image/png'
      ? imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : imageBuffer.toString('ascii', 0, 4) === 'RIFF' && imageBuffer.toString('ascii', 8, 12) === 'WEBP'
  if (!validSignature) {
    context.res = { headers: jsonHeaders, status: 400, body: { error: 'The file contents do not match a supported image format.' } }
    return
  }
  if (!config.azureOpenAIEndpoint || !config.azureOpenAIAPIKey) {
    context.res = { headers: jsonHeaders, status: 503, body: { error: 'Image analysis is not configured.' } }
    return
  }

  const endpoint = config.azureOpenAIEndpoint.replace(/\/+$/, '')
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(config.azureOpenAIDeployment)}/chat/completions?api-version=${encodeURIComponent(config.azureOpenAIAPIVersion)}`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': config.azureOpenAIAPIKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: `You are Spectra, a careful ${assistantRoleByType[analysisType]} assistant. Analyze visible evidence only, protect privacy, never invent details, and return valid JSON only.` },
          { role: 'user', content: [
            { type: 'text', text: promptByType[analysisType] },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
          ] },
        ],
        max_tokens: 700,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      context.log.error(`Azure image analysis failed (${response.status}).`)
      context.res = { headers: jsonHeaders, status: 502, body: { error: 'Image analysis is temporarily unavailable.' } }
      return
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const analysis = typeof content === 'string' ? JSON.parse(content) : null
    if (!analysis || typeof analysis.issueSummary !== 'string' || typeof analysis.likelyRootCause !== 'string' || !Number.isFinite(Number(analysis.confidence)) || typeof analysis.recommendedAction !== 'string') {
      context.log.error('Azure image analysis returned an invalid response shape.')
      context.res = { headers: jsonHeaders, status: 502, body: { error: 'Image analysis returned an invalid result. Please try another image.' } }
      return
    }
    const body = {
      issueSummary: analysis.issueSummary,
      likelyRootCause: analysis.likelyRootCause,
      confidence: Math.max(0, Math.min(100, Math.round(Number(analysis.confidence)))),
      recommendedAction: analysis.recommendedAction,
    }
    if (analysisType === 'bill') {
      body.provider = typeof analysis.provider === 'string' ? analysis.provider.slice(0, 80) : null
      body.monthlyTotal = Number.isFinite(analysis.monthlyTotal) && analysis.monthlyTotal >= 0 ? analysis.monthlyTotal : null
      body.services = Array.isArray(analysis.services) ? analysis.services.filter((item) => ['mobile', 'internet', 'tv', 'home phone', 'other'].includes(item)).slice(0, 5) : []
      body.lineCount = Number.isInteger(analysis.lineCount) && analysis.lineCount > 0 && analysis.lineCount <= 20 ? analysis.lineCount : null
      body.includesDevicePayment = typeof analysis.includesDevicePayment === 'boolean' ? analysis.includesDevicePayment : null
      body.deviceModel = typeof analysis.deviceModel === 'string' ? analysis.deviceModel.slice(0, 80) : null
      body.charges = Array.isArray(analysis.charges) ? analysis.charges.filter((charge) => charge && typeof charge.label === 'string' && Number.isFinite(charge.amount)).slice(0, 5).map((charge) => ({ label: charge.label.slice(0, 100), amount: charge.amount })) : []
      body.suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions.filter((item) => typeof item === 'string').slice(0, 3).map((item) => item.slice(0, 240)) : []
    }
    if (analysisType === 'tradeIn') {
      body.deviceDescription = typeof analysis.deviceDescription === 'string' ? analysis.deviceDescription.slice(0, 80) : null
      body.condition = ['good', 'fair', 'damaged', 'unclear'].includes(analysis.condition) ? analysis.condition : 'unclear'
      body.damageFindings = Array.isArray(analysis.damageFindings) ? analysis.damageFindings.filter((item) => typeof item === 'string').slice(0, 5).map((item) => item.slice(0, 160)) : []
      body.tradeInOutlook = ['worth-trading-in', 'limited-value', 'not-recommended', 'need-better-photo'].includes(analysis.tradeInOutlook) ? analysis.tradeInOutlook : 'need-better-photo'
    }
    context.res = { headers: jsonHeaders, status: 200, body }
  } catch (error) {
    context.log.error('Azure image analysis request failed.', error)
    context.res = { headers: jsonHeaders, status: 502, body: { error: 'Image analysis is temporarily unavailable.' } }
  }
}
