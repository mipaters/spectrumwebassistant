# Spectrum consumer experience

A responsive React and TypeScript consumer storefront built with Vite. The UI is backed by a small, replaceable offers catalog (`src/services/offers.ts`) and a text-assistant service (`src/services/assistant.ts`). Promotional content and pricing can be moved to a live feed without coupling the pages to its transport.

## Run locally

```sh
npm install
npm run dev
```

Vite serves the storefront. When the Static Web Apps `/api/chat` endpoint is not available locally, Chris uses the built-in demo responder. Run with the Azure Static Web Apps CLI to exercise the Functions API locally.

## Azure Static Web Apps and Chris

Deploy the repository as the Static Web Apps app and set its API location to `api`. The `api/chat` HTTP-triggered Function calls an Azure OpenAI chat-completions deployment when configured; otherwise, it returns the deterministic demo response. Set these application settings in the Static Web Apps resource (see `.env.example`):

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (for example, a deployment named `gpt-4.1-mini`)
- `AZURE_OPENAI_API_VERSION`
- `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` (used by /api/speech-token to issue short-lived tokens for voice input and spoken replies; the key never reaches the browser)

Keep credentials out of frontend build-time variables. The browser only calls `/api/chat`, so Azure OpenAI secrets stay in the server-side Function configuration. The Chris client and capability flags are separated so speech, uploads, video and live support can be added without changing the chat surface.

## Build

```sh
npm run build
```

The static site is emitted to `dist`, suitable for Azure Static Web Apps.

## Chris conversation flow

Chris retains the chat transcript, customer profile, completed journey questions and current stage in app state while the chat session is open, including when the panel is closed and reopened. The mobile-plan journey collects line count and data use, mobile provider, device ownership and age, common phone use, travel frequency and destinations, home Internet/TV providers, bundling interest and budget preference. Each answer is saved against its stage before Chris advances; a completed stage is not asked again, and explicit corrections update the profile. Console logs show the current stage for debugging. Typical data-use, phone-activity and roaming-destination quick replies are available during the relevant stages. The API receives the recent conversation and known profile values so the Azure OpenAI experience can continue with the same context.

When Chris provides a plan recommendation, **Add this plan to cart** transfers the recommended plan, line count, data allowance and estimated monthly price into the storefront cart and checkout summary. Checkout is a frontend demo and does not place a real Spectrum order.

The **Device Upgrade Journey** walkthrough and upgrade requests in chat launch a dedicated guided flow. Chris asks about the current phone brand, upgrade priorities and comfortable monthly budget, then recommends a matching phone from the device catalog. The recommendation can be added directly to the cart or opened in the phone catalog. Only catalog-listed financing prices are carried as estimates; otherwise the cart and checkout clearly mark device pricing as to be confirmed. Checkout remains a non-purchasing demo.

Personalized offers, roaming, technical support, and multimodal care use three-step scripted flows. Customer Care and Compare with Competitors launch bill-image journeys that use Azure OpenAI vision.

## Chris Internet and home-service troubleshooting

Common outage, slow Internet, WiFi coverage, TV/streaming, device connectivity and smart-home reports automatically open a session-persistent troubleshooting journey. Chris stores the reported issue, room, symptom, simulated diagnostic results, tried steps and customer responses. The staged flow identifies the issue, shows a simulated network/gateway/WiFi/streaming/device check, presents a likely cause and walks through one resolution step at a time. Customers can confirm resolution or continue to technician, WiFi Pods, specialist or advanced-diagnostic options. Bedroom WiFi coverage includes an illustrative 74% to 96% WiFi Pods projection. Diagnostics and escalation actions are demonstrations only; no live network test, appointment, transfer or order is initiated.

The Chris panel includes a **Demo Walkthrough** that runs the poor-bedroom-WiFi scenario from report through simulated diagnosis, WiFi Pods recommendation and resolved outcome. Modem photos, error screenshots, video and voice are shown as disabled future-capability placeholders.

## Offer, device, security, card and company pages

Mobile plans, phone catalog entries, Home WiFi features and Spectrum Perks summaries are stored in `src/services/offers.ts` so future product feeds can replace the reference data without changing page components. The home page’s Spectrum Mobile “See mobile plans” action opens the mobile plans page, and the "Learn more" link in About Spectrum opens the in-app About Spectrum landing page. Pricing, financing and perk benefits reflect public information captured on October 3, 2026; they are not live offers. Confirm current pricing, eligibility and terms with Spectrum.

#### Modem image troubleshooting

During an active Chris troubleshooting journey, customers can take a gateway/modem photo or upload a JPG/JPEG, PNG, or WEBP image (maximum 5 MB). The separate POST /api/image-analysis Azure Function sends the image to the configured Azure OpenAI deployment and returns a visual issue summary, likely cause, confidence, and recommended next step. Images are shown inline in chat with Chris's analysis. The endpoint requires the existing server-side AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, and API version settings; it never stores or logs image data. This is visual guidance only, not a live network diagnostic.

#### Bill review and competitor comparison journeys

Chris can start a bill review when a customer asks to understand or explain a bill, then prompt for a photo upload. The Executive Demo Customer Care tile starts this bill-review flow. Compare with Competitors asks provider and service details, then analyzes a bill image and compares the visible recurring monthly total with illustrative Spectrum reference rates. Annual savings are shown only when a recurring total is clearly detected; otherwise no savings number is invented. Bill image analysis uses the isolated image endpoint, redacts personal identifiers from model output by instruction, and asks customers to cover personal details before upload. Estimates are not quotes and require verification against current offers, eligibility, taxes, fees, discounts and equipment.

## Spectrum device pricing snapshot

Monthly device pricing comes from `src/data/spectrum-device-pricing.json`, captured from the public Spectrum catalog behind https://www.spectrum.com/phones (new activation). It drives the Devices page, upgrade recommendations and the competitor-bill comparison. Refresh it with `node scripts/refresh-spectrum-device-pricing.mjs`. Prices are after any bill credit; plan eligibility is not exposed by the feed, so figures are shown as references.
