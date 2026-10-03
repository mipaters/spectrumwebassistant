type Status = 'live' | 'mock' | 'future'

type Component = { name: string; detail: string; status: Status }
type Layer = { title: string; summary: string; components: Component[] }

const statusLabel: Record<Status, string> = {
  live: 'Live in this demo',
  mock: 'Simulated in this demo',
  future: 'Production only — not built',
}

const layers: Layer[] = [
  {
    title: '1. Customer channels',
    summary: 'Where customers meet Spectra.',
    components: [
      { name: 'Responsive web storefront', detail: 'React + TypeScript site with shop, support and account journeys.', status: 'live' },
      { name: 'Spectra chat panel', detail: 'Persistent assistant with guided journeys, quick replies and hands-free voice.', status: 'live' },
      { name: 'Native app, IVR and in-store tools', detail: 'Same Spectra orchestration reused across My Spectrum App app, contact centre and retail.', status: 'future' },
    ],
  },
  {
    title: '2. Edge and application hosting',
    summary: 'Secure delivery of the experience and APIs.',
    components: [
      { name: 'Azure Static Web Apps + managed Functions', detail: 'Hosts the site and the /api/chat, /api/image-analysis and speech-token endpoints.', status: 'live' },
      { name: 'Front Door, WAF and API Management', detail: 'Global routing, bot and DDoS protection, throttling and API governance.', status: 'future' },
      { name: 'Microsoft Entra External ID (customer identity)', detail: 'Real My Spectrum App sign-in, MFA and consent. The demo uses a simulated sign-in.', status: 'future' },
    ],
  },
  {
    title: '3. Spectra orchestration',
    summary: 'Decides what the customer needs and which tools and data to use.',
    components: [
      { name: 'Guided journey engine', detail: 'Plan, upgrade, trade-in, roaming, troubleshooting, bill review and competitor comparison state machines.', status: 'live' },
      { name: 'Journey routing and off-topic handling', detail: 'Keeps a journey on track and sends general questions to GPT without losing state.', status: 'live' },
      { name: 'Agent / tool-calling layer (Azure AI Foundry Agent Service)', detail: 'Lets the model call account, catalogue and ticketing tools with audited, permission-checked actions.', status: 'future' },
      { name: 'Human hand-off to care agents', detail: 'Warm transfer with conversation summary to Dynamics 365 Contact Center or the existing agent desktop.', status: 'future' },
    ],
  },
  {
    title: '4. AI and cognitive services',
    summary: 'Language, vision and voice intelligence.',
    components: [
      { name: 'Azure AI Foundry — GPT-4.1-mini chat', detail: 'Conversational answers through the /api/chat function.', status: 'live' },
      { name: 'Vision analysis (same GPT-4.1-mini deployment)', detail: 'Reads modem photos, bills and trade-in phone photos through /api/image-analysis.', status: 'live' },
      { name: 'Azure AI Speech — speech to text and text to speech', detail: 'Voice conversation with browser-side token exchange.', status: 'live' },
      { name: 'Retrieval-augmented generation (RAG)', detail: 'Azure AI Search index of plans, policies, device specs, support articles and troubleshooting guides so answers are grounded and cited.', status: 'future' },
      { name: 'Production model tier (for example GPT-4o-mini, with larger models for complex cases)', detail: 'Model routing, evaluation sets, prompt versioning and cost controls.', status: 'future' },
      { name: 'Azure AI Content Safety and prompt shields', detail: 'Filters harmful content, jailbreaks and personal data leakage on input and output.', status: 'future' },
      { name: 'Live video and screen-share troubleshooting', detail: 'Azure Communication Services video with real-time vision analysis.', status: 'future' },
    ],
  },
  {
    title: '5. Data and knowledge',
    summary: 'What Spectra knows and remembers.',
    components: [
      { name: 'Spectrum phone pricing snapshot', detail: 'Static JSON captured from the public catalogue, refreshed by a script.', status: 'mock' },
      { name: 'Offer and plan service layer', detail: 'Typed service ready to swap for a live promotions and pricing feed.', status: 'mock' },
      { name: 'Product, pricing and promotion APIs', detail: 'Live catalogue and eligibility from the commerce platform.', status: 'future' },
      { name: 'Azure AI Search + Blob Storage', detail: 'Indexed knowledge sources feeding RAG, with scheduled re-ingestion.', status: 'future' },
      { name: 'Cosmos DB conversation memory', detail: 'Session history, customer preferences and journey state across channels.', status: 'future' },
    ],
  },
  {
    title: '6. Integration layer to Spectrum OSS / BSS',
    summary: 'Spectra can only act on a real account through these systems. None are connected in this demo.',
    components: [
      { name: 'Billing and rating', detail: 'Invoices, charges, credits, payments and usage so Spectra can explain a real bill.', status: 'future' },
      { name: 'CRM and customer master', detail: 'Profile, entitlements, households, consent and case history.', status: 'future' },
      { name: 'Order management and provisioning', detail: 'Plan changes, device orders, SIM and eSIM activation, roaming add-ons.', status: 'future' },
      { name: 'Product catalogue and eligibility', detail: 'Plans, bundles, upgrade eligibility, device financing and trade-in values.', status: 'future' },
      { name: 'Network, service assurance and device management', detail: 'Modem and gateway status, outage checks, remote diagnostics and restarts (TR-069).', status: 'future' },
      { name: 'Inventory and logistics', detail: 'Device stock, shipping, technician scheduling and field service.', status: 'future' },
      { name: 'Payments and fraud', detail: 'Tokenised payment capture, credit checks and fraud screening for checkout.', status: 'future' },
    ],
  },
  {
    title: '7. Security, governance and operations',
    summary: 'What makes it safe to run at scale.',
    components: [
      { name: 'Managed secrets for Azure keys', detail: 'Keys held server-side in app settings, never shipped to the browser.', status: 'live' },
      { name: 'Key Vault, managed identity and private networking', detail: 'No static keys, private endpoints to AI and data services.', status: 'future' },
      { name: 'Privacy, consent and PII redaction', detail: 'Redaction of account and payment details before model calls, retention rules and audit trails.', status: 'future' },
      { name: 'Monitoring, evaluation and analytics', detail: 'Application Insights, quality and safety evaluations, conversation analytics and cost dashboards.', status: 'future' },
      { name: 'CI/CD', detail: 'GitHub Actions deploys the site and API to Azure Static Web Apps.', status: 'live' },
    ],
  },
]

const demoFlow = [
  { label: 'Customer', status: 'live' as Status },
  { label: 'Web + Spectra panel', status: 'live' as Status },
  { label: 'Static Web Apps + Functions', status: 'live' as Status },
  { label: 'Azure AI Foundry GPT-4.1-mini / Speech', status: 'live' as Status },
]

const productionFlow = [
  { label: 'Customer', status: 'live' as Status },
  { label: 'Web, app, voice, store', status: 'live' as Status },
  { label: 'API gateway + identity', status: 'future' as Status },
  { label: 'Spectra orchestration + tools', status: 'future' as Status },
  { label: 'Foundry models + RAG', status: 'future' as Status },
  { label: 'OSS / BSS integrations', status: 'future' as Status },
]

function Flow({ title, steps, note }: { title: string; steps: { label: string; status: Status }[]; note: string }) {
  return (
    <div className="arch-flow">
      <h3>{title}</h3>
      <ol>{steps.map((step) => <li className={`arch-step arch-${step.status}`} key={step.label}>{step.label}</li>)}</ol>
      <p>{note}</p>
    </div>
  )
}

export function ArchitecturePage({ onChat }: { onChat: () => void }) {
  const counts = layers.flatMap((layer) => layer.components).reduce<Record<Status, number>>((acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }), { live: 0, mock: 0, future: 0 })
  return (
    <div className="architecture-page">
      <section className="arch-hero">
        <div className="page-width">
          <span className="eyebrow">SOLUTION ARCHITECTURE</span>
          <h1>How Spectra works in production — and what you’re seeing today</h1>
          <p>Spectra is a conversational layer on top of Spectrum’ digital channels. To go beyond answering questions and actually look up bills, change plans or arrange a technician, it needs grounded knowledge (RAG) and secure integrations into Spectrum’ OSS/BSS systems. This demo proves the experience, the AI and the voice; the grey blocks below are what a production build adds.</p>
          <div className="arch-legend" aria-label="Legend">
            {(['live', 'mock', 'future'] as Status[]).map((status) => <span className={`arch-chip arch-${status}`} key={status}>{statusLabel[status]} <b>{counts[status]}</b></span>)}
          </div>
        </div>
      </section>

      <section className="page-width arch-flows" aria-label="Demo and production request flow">
        <Flow title="Built for this demo" steps={demoFlow} note="Spectra answers from GPT-4.1-mini and guided journeys. Plans, prices and accounts are reference data; nothing is read from or written to Spectrum systems." />
        <Flow title="Production target" steps={productionFlow} note="Every answer is grounded in Spectrum knowledge and every action is authorised, audited and executed through the OSS/BSS integration layer." />
      </section>

      <section className="page-width arch-layers" aria-label="Architecture layers">
        {layers.map((layer) => (
          <article className="arch-layer" key={layer.title}>
            <header><h2>{layer.title}</h2><p>{layer.summary}</p></header>
            <div className="arch-grid">
              {layer.components.map((item) => (
                <div className={`arch-card arch-${item.status}`} key={item.name}>
                  <span className={`arch-chip arch-${item.status}`}>{statusLabel[item.status]}</span>
                  <strong>{item.name}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="page-width arch-cta">
        <div>
          <h2>What’s needed to move from demo to production</h2>
          <p>Stand up the RAG knowledge index, connect billing, CRM, provisioning and catalogue APIs behind an API gateway, add customer identity, and put safety, monitoring and human hand-off around the model.</p>
        </div>
        <button className="button-primary" onClick={onChat}>Talk to Spectra</button>
      </section>
    </div>
  )
}
