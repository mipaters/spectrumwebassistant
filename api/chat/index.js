const config = require('../config')

const systemPrompt = `You are Spectra, Spectrum's friendly, knowledgeable customer experience assistant.
Spectrum is an Internet-first company: home Internet and WiFi are the foundation of the business,
and Mobile is a complementary add-on for Internet customers. In every conversation, lead with
Internet — availability, speeds, pricing, and WiFi — before discussing Mobile, devices, or other
services, and look for natural opportunities to suggest bundling Mobile with Internet rather than
leading with Mobile on its own. Help with home internet plans, mobile and device upgrades, roaming,
billing, TV and streaming, smart home, home phone, promotions, troubleshooting, and account support.
Be concise, warm, and clear. Never claim to access private account details or perform an account
action. Ask a focused follow-up when needed. If a problem needs account verification or a human
agent, say so plainly.`

const jsonHeaders = { 'Content-Type': 'application/json' }

module.exports = async function (context, req) {
  const messages = req.body && req.body.messages
  const profile = req.body && req.body.profile
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    context.res = { headers: jsonHeaders, status: 400, body: { error: 'Send between 1 and 30 chat messages.' } }
    return
  }
  if (!messages.every((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')) {
    context.res = { headers: jsonHeaders, status: 400, body: { error: 'Each chat message must include a valid role and text content.' } }
    return
  }

  if (!config.azureOpenAIEndpoint || !config.azureOpenAIAPIKey) {
    context.res = {
      headers: jsonHeaders,
      status: 200,
      body: { reply: demoReply(String(messages[messages.length - 1].content || '')) },
    }
    return
  }

  const endpoint = config.azureOpenAIEndpoint.replace(/\/+$/, '')
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(config.azureOpenAIDeployment)}/chat/completions?api-version=${encodeURIComponent(config.azureOpenAIAPIVersion)}`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.azureOpenAIAPIKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nMaintain continuity using the full conversation history. Never restart with a greeting mid-conversation or ask again for information the customer has already provided. Known profile values for this session: ${JSON.stringify(safeProfile(profile))}.`,
          },
          ...messages.slice(-20).map(({ role, content }) => ({
            role: role === 'assistant' ? 'assistant' : 'user',
            content: String(content).slice(0, 4000),
          })),
        ],
        max_tokens: 500,
        temperature: 0.6,
      }),
    })
    if (!response.ok) {
      const azureError = await response.text()
      context.log.error(`Azure OpenAI request failed (${response.status}).`)
      context.res = { headers: jsonHeaders, status: 502, body: { error: 'Spectra is temporarily unavailable. Please try again.', debug: { azureStatus: response.status, azureBody: azureError } } }
      return
    }
    const data = await response.json()
    context.res = { headers: jsonHeaders, status: 200, body: { reply: data.choices?.[0]?.message?.content || '' } }
  } catch (error) {
    context.log.error('Azure OpenAI request failed.', error)
    context.res = { headers: jsonHeaders, status: 502, body: { error: 'Spectra is temporarily unavailable. Please try again.' } }
  }
}

function safeProfile(profile) {
  if (!profile || typeof profile !== 'object') return {}
  const allowed = [
    'lineCount',
    'dataUsage',
    'currentProvider',
    'deviceAge',
    'deviceOwnership',
    'phoneUseCases',
    'travelFrequency',
    'travelDestinations',
    'homeInternetCustomer',
    'homeInternetProvider',
    'homeTvProvider',
    'interestedInBundling',
    'budgetPreference',
    'journeyAnswers',
  ]
  return Object.fromEntries(allowed.filter((key) => profile[key] !== undefined).map((key) => [key, profile[key]]))
}

function demoReply(message) {
  const text = message.toLowerCase()
  if (/roam|travel|international|abroad|europe/.test(text)) {
    return 'Planning a trip? Spectrum Mobile international roaming lets you use your plan’s talk, text and data while travelling for a daily fee in eligible destinations. Where are you headed, and for how long? I can help you check what to consider before you go.'
  }
  if (/bill|charge|payment|invoice/.test(text)) {
    return 'I can help you understand your bill. Start with My Spectrum App to see a breakdown of monthly services, one-time charges and payments. Are you looking at a particular charge or trying to make a payment?'
  }
  if (/slow|not working|outage|router|modem|troubleshoot/.test(text)) {
    return 'Let’s get your connection back on track. First, check that your modem’s power and online lights are on, then unplug it for 30 seconds and reconnect it. Is the issue affecting all your devices or just one?'
  }
  if (/internet|wifi|wi-fi|availability|address|speed|gig\b/.test(text)) {
    return 'Great, let’s start with Internet — it’s the foundation of everything Spectrum offers. Can I get your address to check availability and speeds in your area? Once we find the right Internet plan, I can also show you how adding Spectrum Mobile can save you more.'
  }
  if (/phone|iphone|device|upgrade/.test(text) && !/plan|wireless|mobile/.test(text)) {
    return 'Ready for a new phone? I can help narrow it down. Consider what matters most: camera, battery life, screen size or a lower monthly payment. Are you looking for an iPhone or Android, and what’s your budget? By the way, Spectrum Mobile line pricing is best when paired with Spectrum Internet.'
  }
  if (/plan|data|mobile|wireless|recommend/.test(text)) {
    return 'Happy to help with a mobile plan — Spectrum Mobile pairs great with Spectrum Internet for the best pricing. Do you already have Spectrum Internet at home, or would you like me to check that first? Also, how much data do you usually use each month, and how many lines do you need?'
  }
  if (/tv|stream|channel/.test(text)) {
    return 'With Spectrum TV, you can bring live channels and streaming apps together. What do you like to watch most—sports, news, movies or family shows? I can point you toward the right TV experience.'
  }
  if (/smart home|security|camera|home phone/.test(text)) {
    return 'I can help with home services, from connected home security to reliable home phone. Tell me a little about what you want to set up and I’ll suggest a good place to start.'
  }
  return 'Happy to help! Most customers start with Spectrum Internet — want me to check availability and pricing at your address? I can also help with Mobile, TV, devices, billing and troubleshooting.'
}
