const config = require('../config')

const jsonHeaders = { 'Content-Type': 'application/json' }

module.exports = async function (context) {
  console.log('[Chris Debug] AZURE_SPEECH_KEY exists:', Boolean(config.azureSpeechKey))
  console.log('[Chris Debug] AZURE_SPEECH_REGION exists:', Boolean(config.azureSpeechRegion))
  if (!config.azureSpeechKey || !config.azureSpeechRegion) {
    context.res = { headers: jsonHeaders, status: 503, body: { error: 'Speech is not configured.' } }
    return
  }
  try {
    const tokenBase = config.azureSpeechEndpoint ? config.azureSpeechEndpoint.replace(/\/+$/, '') : `https://${encodeURIComponent(config.azureSpeechRegion)}.api.cognitive.microsoft.com`
    const response = await fetch(`${tokenBase}/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': config.azureSpeechKey, 'Content-Length': '0' },
    })
    if (!response.ok) {
      const azureBody = await response.text()
      console.log('[Chris Debug] Azure Speech token failed:', response.status, azureBody)
      context.res = { headers: jsonHeaders, status: 502, body: { error: 'Speech is temporarily unavailable.', debug: { azureStatus: response.status, azureBody, region: config.azureSpeechRegion, endpoint: config.azureSpeechEndpoint || null } } }
      return
    }
    context.res = { headers: jsonHeaders, status: 200, body: { token: await response.text(), region: config.azureSpeechRegion } }
  } catch (error) {
    console.log('[Chris Debug] Azure Speech token error:', String(error))
    context.res = { headers: jsonHeaders, status: 502, body: { error: 'Speech is temporarily unavailable.', debug: { exception: String(error), region: config.azureSpeechRegion, endpoint: config.azureSpeechEndpoint || null } } }
  }
}
