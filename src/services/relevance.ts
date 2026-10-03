const journeyVocabulary = /\b(spectrum|plan|plans|mobile|wireless|cell|phone|phones|iphone|samsung|galaxy|pixel|android|apple|device|upgrade|data|gb|gigabytes?|lines?|bill|billing|charge|price|cost|budget|cheap|afford|roam|roaming|travel|trip|internet|wifi|wi-fi|router|modem|gateway|tv|stream|streaming|bundle|bundling|home|security|smart|xfinity|comcast|verizon|at&t|att|t-mobile|tmobile|cox|optimum|carrier|provider|switch|offer|deal|promo|promotion|signal|slow|speed|buffer|buffering|outage|camera|battery|gaming|usa|u\.s\.|mexico|canada|europe|support|specialist|technician|extenders?|restart|reboot|checkout|cart)\b/i
const generalQuestionOpener = /^\s*(tell me|what|who|whom|whose|why|how|when|where|which|explain|define|write|translate|calculate|solve|recite|sing|joke|can you tell|do you know|is it true)\b/i
const journeyReply = /^\s*(yes|no|yeah|yep|nope|nah|skip|none|not sure|maybe|ok|okay|sure|actually|i meant|instead|change|correction)\b/i

export function isRelevantToJourney(message: string, currentOptions: string[] = []): boolean {
  const text = message.trim()
  if (!text) return true
  const lower = text.toLowerCase()
  if (currentOptions.some((option) => option.trim().toLowerCase() === lower)) return true
  if (journeyVocabulary.test(text) || journeyReply.test(text)) return true
  if (/\d/.test(text) && text.split(/\s+/).length <= 8) return true
  const words = text.split(/\s+/).length
  if (generalQuestionOpener.test(text) || text.endsWith('?')) return false
  return words <= 5
}
