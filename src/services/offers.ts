import { devicePriceNote, formatMonthly, newPhones } from './device-pricing'

export type Offer = {
  id: string
  eyebrow: string
  title: string
  description: string
  price: string
  priceNote: string
  tag: string
  category: 'mobile' | 'internet' | 'devices' | 'tv' | 'home'
  tone: string
}

export type FeaturePromotion = {
  id: string
  eyebrow: string
  title: string
  description: string
  action: string
  category: Offer['category']
}

export type MobilePlan = {
  id: string
  name: string
  data: string
  bundlePrice: number
  mobileOnlyPrice: number
  priceBeforeIncentives: number
  features: string[]
  perks: string[]
  mixAndMatch: boolean
  badge?: string
}

export type PhoneProduct = {
  name: string
  line: 'Apple' | 'Samsung' | 'Google'
  swatch: string
  badge?: string
  monthlyPrice?: string
  priceNote?: string
  details?: string[]
}

export const homeWifiOffer = {
  name: 'Advanced WiFi & Invincible WiFi',
  startingPrice: 10,
  priceCadence: '/mo.',
  priceNote: 'Advanced WiFi is $10/mo. (included free with Internet 1 Gig). Invincible WiFi is $30/mo. (included free with Internet 2 Gig).',
  benefits: [
    'Whole-home mesh coverage with WiFi range extenders',
    'Real-time network monitoring and device management',
    'Automatic security updates and a built-in firewall',
    'Family-friendly content filters and device pause controls',
  ],
  features: [
    { title: 'Manage it all from the My Spectrum App', description: 'See every connected device, run a speed test, pause WiFi for the kids, and manage your network from your phone.', art: 'app' },
    { title: 'Coverage in every corner', description: 'Add WiFi range extenders to eliminate dead zones in bigger homes, garages and basements.', art: 'door' },
    { title: 'Built-in security', description: 'Advanced WiFi includes a security suite with ad blocking, antivirus for connected devices and automatic firmware updates.', art: 'camera' },
    { title: 'Smart notifications', description: 'Get alerts about new devices joining your network and unusual activity, right from the app.', art: 'sensors' },
    { title: 'Built for streaming households', description: 'Invincible WiFi is tuned for multi-gig speeds across dozens of simultaneous 4K streams, video calls and gaming sessions.', art: 'tv' },
  ] as const,
}

export const spectrumPerks = [
  {
    id: 'no-contracts',
    name: 'No annual contracts',
    tier: 'Included with every plan',
    headline: 'Switch, pause or cancel anytime',
    cashBack: 'No early termination fees',
    usd: 'Keep your current phone number when you switch',
    qualification: 'Available to residential customers in service areas',
    insurance: '30-day money-back guarantee on most services',
    style: 'red',
  },
  {
    id: 'bundle-savings',
    name: 'Bundle & save',
    tier: 'Internet + TV + Mobile',
    headline: 'More value the more you bundle',
    cashBack: 'Save when you combine services',
    usd: 'One simple bill for everything',
    qualification: 'Pricing varies by market and available services',
    insurance: 'Price-for-life guarantee on select Internet plans',
    style: 'world',
  },
  {
    id: 'mobile-save',
    name: 'Spectrum Mobile savings',
    tier: 'Requires Spectrum Internet',
    headline: 'Save up to 40% vs. the other big carriers',
    cashBack: 'Plans from $20/mo. per line',
    usd: 'Bring your own phone or finance a new one at 0% APR',
    qualification: 'Requires an active Spectrum Internet plan',
    insurance: 'Unlimited Plus and Premium include device upgrade benefits',
    style: 'elite',
  },
  {
    id: 'business',
    name: 'Spectrum Business',
    tier: 'For your business',
    headline: 'Internet, mobile and voice for business',
    cashBack: 'Scalable plans for growing teams',
    usd: 'Dedicated business support',
    qualification: 'For eligible business applicants in service areas',
    insurance: 'See spectrum.com/business for plan details and eligibility',
    style: 'business',
  },
] as const

export const offerSnapshotDate = 'October 3, 2026'

export const offers: Offer[] = [
  {
    id: 'mobile',
    eyebrow: 'SPECTRUM MOBILE',
    title: 'More of what you love.',
    description: 'Get unlimited data with no overage fees, plus nationwide 5G on America’s most reliable network.',
    price: '$30',
    priceNote: '/mo. per line with Spectrum Internet and Auto Pay',
    tag: 'Limited-time offer',
    category: 'mobile',
    tone: 'pink',
  },
  {
    id: 'internet',
    eyebrow: 'SPECTRUM INTERNET',
    title: 'Make room for more.',
    description: 'Power your whole home with fast, reliable internet and WiFi that goes further.',
    price: '$60',
    priceNote: '/mo. for 12 months, 1 Gig speeds',
    tag: 'Popular choice',
    category: 'internet',
    tone: 'violet',
  },
  {
    id: 'iphone',
    eyebrow: 'NEW & NOTEWORTHY',
    title: 'A little more you.',
    description: 'Discover the latest phones, with flexible financing and great trade-in value.',
    price: '$0',
    priceNote: 'down on select phones',
    tag: 'Shop new devices',
    category: 'devices',
    tone: 'blue',
  },
  {
    id: 'bundle',
    eyebrow: 'MORE TO LOVE',
    title: 'Bring it all together.',
    description: 'Bundle mobile and home services for a better-connected everyday.',
    price: 'Save',
    priceNote: 'when you bundle',
    tag: 'Bundle & save',
    category: 'tv',
    tone: 'orange',
  },
]

export const featuredPromotions: FeaturePromotion[] = [
  {
    id: 'streaming-apps-included',
    eyebrow: 'SPECTRUM TV',
    title: 'Disney+, Paramount+ and ViX Premium included with Signature',
    description: 'Stream TV Signature now bundles top streaming apps right alongside your live channels.',
    action: 'Shop TV plans',
    category: 'tv',
  },
]

export const catalog = {
  mobile: {
    title: 'Mobile plans',
    description: 'Nationwide 5G plans with room for what matters.',
    detail: 'Compare By the Gig, Unlimited, Unlimited Plus and Unlimited Plus Premium, with flexible options for bringing your own phone.',
    features: ['Nationwide 5G network access', 'Unlimited nationwide talk and text', 'No contracts, cancel anytime'],
    price: '$20',
    cadence: '/mo. per line with Spectrum Internet',
    label: 'By the Gig',
  },
  internet: {
    title: 'Internet that keeps up',
    description: 'A connection for everything life brings.',
    detail: 'Stream, game and video call with fast, reliable internet and WiFi coverage throughout your home. No data caps, no contracts.',
    features: ['Fast, reliable speeds up to 2 Gbps', 'Free modem, no equipment fees', '24/7 online and phone support'],
    price: '$60',
    cadence: '/mo. for 12 months',
    label: 'Spectrum Internet 1 Gig',
  },
  tv: {
    title: 'TV, on your terms',
    description: 'The shows you love, all in one place.',
    detail: 'Find live TV, on-demand favourites and your go-to streaming apps in one easy experience — no equipment or contract required.',
    features: ['Flexible channel packs', 'Stream on your devices with the Spectrum TV App', 'Included streaming apps on select plans'],
    price: '$40',
    cadence: '/mo.',
    label: 'Stream TV Lite',
  },
  smartHome: {
    title: 'A smarter, more connected home',
    description: 'Feel more connected to the place you love.',
    detail: 'Keep your whole home online with Advanced WiFi and Invincible WiFi — whole-home mesh coverage, network security and parental controls.',
    features: ['Whole-home mesh WiFi coverage', 'Network security and ad blocking', 'Manage it all in the My Spectrum App'],
    price: '$10',
    cadence: '/mo.',
    label: 'Advanced WiFi',
  },
  homePhone: {
    title: 'A home phone that feels like home',
    description: 'Keep in touch with the people who matter.',
    detail: 'Enjoy dependable home phone service with the calling features you use every day.',
    features: ['Unlimited nationwide calling', 'Caller ID and voicemail', 'Easy to set up, works with your current phone'],
    price: '$10',
    cadence: '/mo.',
    label: 'Spectrum Voice',
  },
}

export const mobilePlans: MobilePlan[] = [
  {
    id: 'byTheGig',
    name: 'By the Gig',
    data: '1 GB of shared high-speed data',
    bundlePrice: 20,
    mobileOnlyPrice: 20,
    priceBeforeIncentives: 20,
    features: [
      'Great for light data users and secondary lines',
      'Unlimited talk and text, nationwide 5G',
      'Requires an active Spectrum Internet plan',
    ],
    perks: ['Pay only for the data you use', 'Add more data anytime in the My Spectrum App'],
    mixAndMatch: true,
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    data: 'Unlimited data, 5GB mobile hotspot',
    bundlePrice: 30,
    mobileOnlyPrice: 30,
    priceBeforeIncentives: 30,
    features: [
      'Unlimited talk, text and data on nationwide 5G',
      '5GB of mobile hotspot data',
      'Requires an active Spectrum Internet plan',
    ],
    perks: ['Price drops to $25/line with 4+ lines', 'Unlimited texting from Mexico and Canada'],
    mixAndMatch: true,
  },
  {
    id: 'unlimitedPlus',
    name: 'Unlimited Plus',
    data: 'Unlimited data, 10GB mobile hotspot',
    bundlePrice: 40,
    mobileOnlyPrice: 40,
    priceBeforeIncentives: 40,
    features: [
      'Unlimited talk, text and data on nationwide 5G',
      '10GB of mobile hotspot data',
      'Unlimited calling and texting to 215+ countries',
      'Device upgrade benefits',
    ],
    perks: ['Free international roaming in 215+ countries (10GB high-speed)', 'Device upgrade eligibility after 12 months'],
    mixAndMatch: true,
    badge: 'Most popular',
  },
  {
    id: 'unlimitedPlusPremium',
    name: 'Unlimited Plus Premium',
    data: 'Unlimited data, 50GB mobile hotspot',
    bundlePrice: 50,
    mobileOnlyPrice: 60,
    priceBeforeIncentives: 60,
    features: [
      'Unlimited talk, text and 4K UHD streaming on nationwide 5G',
      '50GB of mobile hotspot data',
      'Free international roaming in 215+ countries (20GB high-speed)',
      'One free Spectrum Mobile smartwatch line',
    ],
    perks: ['$50/line with 2+ lines, $60 for a single line', 'Priority data on the network'],
    mixAndMatch: true,
  },
]

export const additionalLinePrices = {
  byTheGig: [20, 20, 20],
  unlimited: [30, 25, 25],
  unlimitedPlus: [40, 40, 40],
  unlimitedPlusPremium: [50, 50, 50],
}

const phoneSwatches = ['phone-purple', 'phone-silver', 'phone-green']
const phoneBrandOrder: PhoneProduct['line'][] = ['Apple', 'Samsung', 'Google']

export const productCards: PhoneProduct[] = phoneBrandOrder.flatMap((line) => newPhones(line)
  .sort((a, b) => b.fullPrice - a.fullPrice)
  .filter((device, index, devices) => devices.findIndex((item) => item.name === device.name) === index)
  .map((device, index): PhoneProduct => ({
    name: device.name.replace(/^Samsung /, '').replace(/^Apple /, ''),
    line,
    swatch: phoneSwatches[index % phoneSwatches.length],
    badge: device.availability === 'PREORDER_RESERVE' ? 'New' : undefined,
    monthlyPrice: formatMonthly(device),
    priceNote: devicePriceNote(device),
    details: [device.storage, `Full price: $${device.fullPrice.toFixed(2)}`],
  })))
