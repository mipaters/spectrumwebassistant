const config = require('../config')

const systemPrompt = `You are Chris, Spectrum's friendly, knowledgeable customer experience assistant.
Help with mobile and home internet plans, device upgrades, roaming, billing, TV and streaming,
smart home, home phone, promotions, troubleshooting, and account support. Be concise, warm, and
clear. Never claim to access private account details or perform an account action. Ask a focused
follow-up when needed. If a problem needs account verification or a human agent, say so plainly.`

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
      context.res = { headers: jsonHeaders, status: 502, body: { error: 'Chris is temporarily unavailable. Please try again.', debug: { azureStatus: response.status, azureBody: azureError } } }
      return
    }
    const data = await response.json()
    context.res = { headers: jsonHeaders, status: 200, body: { reply: data.choices?.[0]?.message?.content || '' } }
  } catch (error) {
    context.log.error('Azure OpenAI request failed.', error)
    context.res = { headers: jsonHeaders, status: 502, body: { error: 'Chris is temporarily unavailable. Please try again.' } }
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
  if (/internet|wifi|wi-fi|slow|connection|router/.test(text)) {
    return 'Let’s get your connection back on track. First, check that your modem’s power and online lights are on, then unplug it for 30 seconds and reconnect it. Is the issue affecting all your devices or just one?'
  }
  if (/phone|iphone|device|upgrade/.test(text)) {
    return 'Ready for a new phone? I can help narrow it down. Consider what matters most: camera, battery life, screen size or a lower monthly payment. Are you looking for an iPhone or Android, and what’s your budget?'
  }
  if (/plan|data|mobile|recommend/.test(text)) {
    return 'Let’s find a plan that fits. Spectrum plans offer 5G+ access, with data options for different needs. How much data do you usually use each month, and do you need coverage for more than one line?'
  }
  if (/tv|stream|channel/.test(text)) {
    return 'With Spectrum TV, you can bring live channels and streaming apps together. What do you like to watch most—sports, news, movies or family shows? I can point you toward the right TV experience.'
  }
  if (/smart home|security|camera|home phone/.test(text)) {
    return 'I can help with home services, from connected home security to reliable home phone. Tell me a little about what you want to set up and I’ll suggest a good place to start.'
  }
  return 'Happy to help with plans, devices, roaming, billing, internet troubleshooting and home services. What would you like to figure out today?'
}
