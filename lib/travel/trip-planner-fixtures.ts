// DEMO FIXTURES for the frontend-only Trip Planner.
//
// Everything in this file is illustrative sample content. Prices are rough USD
// figures used only to build estimates. Property and airline names are
// deliberately fictional ("Sample ...", "Demo Air") so nothing here can be
// mistaken for a real, bookable listing. Neighbourhoods, landmarks, and airport
// codes are real place names used to make the sample itinerary readable.
//
// When a backend arrives, this file is no longer needed by the UI.

export type DaySlot = 'day' | 'evening'

export type ActivityTemplate = {
  id: string
  title: string
  description: string
  /** Questionnaire interest labels this activity relates to. */
  interests: string[]
  /** Rough per-person cost in USD (0 = free). */
  costUsd: number
  slot: DaySlot
  bookAhead?: string
}

export type DestinationFixture = {
  id: string
  /** Main arrival airport code. */
  airport: string
  /** Relative cost multiplier for food / transport / stays. */
  costFactor: number
  /** Illustrative round-trip economy fare per traveler, in USD. */
  flightBaseUsd: number
  /** Illustrative one-way flight hours for a mid-haul trip. */
  flightHours: number
  weather: string[]
  /** Real neighbourhoods used for the sample accommodation locations. */
  areas: [string, string, string]
  highlights: ActivityTemplate[]
}

const CULTURE = 'Culture & history'
const FOOD = 'Food & nightlife'
const NATURE = 'Nature & outdoors'
const ADVENTURE = 'Adventure'
const LUXURY = 'Luxury'
const WELLNESS = 'Wellness'

const BOOK = 'Advance booking recommended — popular slots can sell out.'

function a(
  id: string,
  title: string,
  description: string,
  interests: string[],
  costUsd: number,
  slot: DaySlot = 'day',
  bookAhead?: string,
): ActivityTemplate {
  return { id, title, description, interests, costUsd, slot, bookAhead }
}

export const DESTINATION_FIXTURES: Record<string, DestinationFixture> = {
  tokyo: {
    id: 'tokyo',
    airport: 'HND',
    costFactor: 1.25,
    flightBaseUsd: 900,
    flightHours: 12,
    weather: ['Cool & mild', 'Warm & sunny'],
    areas: ['Shinjuku', 'Asakusa', 'Shibuya'],
    highlights: [
      a('tokyo-sensoji', 'Senso-ji & Asakusa stroll', 'Walk through Kaminarimon Gate and the Nakamise shopping street to Tokyo’s oldest temple.', [CULTURE], 0),
      a('tokyo-meiji', 'Meiji Shrine & Yoyogi Park', 'A forested shrine walk in the middle of the city, followed by an easy loop through the park.', [CULTURE, NATURE, WELLNESS], 0),
      a('tokyo-tsukiji', 'Tsukiji Outer Market food crawl', 'Graze on tamagoyaki, seafood skewers, and street snacks with a market-side lunch.', [FOOD], 30),
      a('tokyo-shibuya', 'Shibuya Crossing & rooftop views', 'See the famous crossing, then head up to an observation deck for a skyline view.', [CULTURE, ADVENTURE], 18, 'day', BOOK),
      a('tokyo-teamlab', 'teamLab digital art museum', 'An immersive, walk-through digital art experience — plan around a timed entry.', [CULTURE], 25, 'day', BOOK),
      a('tokyo-izakaya', 'Izakaya evening in Omoide Yokocho', 'Small grills, yakitori, and lantern-lit alleys for a classic Tokyo night out.', [FOOD], 35, 'evening'),
      a('tokyo-hakone', 'Hakone day trip with an onsen soak', 'Lake views and mountain scenery, finished with a relaxing hot-spring bath.', [NATURE, WELLNESS], 70),
      a('tokyo-takao', 'Mt. Takao hike', 'A half-day hike on well-marked trails just outside the city.', [ADVENTURE, NATURE], 10),
      a('tokyo-sento', 'Traditional bathhouse (sento) visit', 'A slow, restorative soak the way locals wind down after a day out.', [WELLNESS], 15, 'evening'),
      a('tokyo-omakase', 'Omakase sushi dinner', 'A chef-led tasting counter dinner — the special-occasion meal of the trip.', [LUXURY, FOOD], 120, 'evening', BOOK),
    ],
  },
  lisbon: {
    id: 'lisbon',
    airport: 'LIS',
    costFactor: 0.85,
    flightBaseUsd: 520,
    flightHours: 9,
    weather: ['Warm & sunny', 'Cool & mild'],
    areas: ['Alfama', 'Baixa', 'Bairro Alto'],
    highlights: [
      a('lisbon-alfama', 'Alfama & Sé Cathedral walk', 'Wander the steep lanes of the oldest district and ride the classic yellow tram.', [CULTURE], 3),
      a('lisbon-belem', 'Belém Tower & Jerónimos Monastery', 'Manueline architecture along the river; visit the monastery early to avoid queues.', [CULTURE], 15, 'day', BOOK),
      a('lisbon-pasteis', 'Pastéis de nata tasting', 'Warm custard tarts fresh from a Belém bakery.', [FOOD], 6),
      a('lisbon-fado', 'Fado dinner in Alfama', 'Live fado music with a traditional Portuguese dinner.', [FOOD, CULTURE], 45, 'evening', BOOK),
      a('lisbon-sintra', 'Sintra day trip: Pena Palace', 'Hilltop palaces and forest paths a short train ride from the city.', [CULTURE, NATURE, ADVENTURE], 45, 'day', BOOK),
      a('lisbon-cascais', 'Cascais coast & Cabo da Roca', 'Coastal towns, cliffs, and the westernmost point of mainland Europe.', [NATURE], 20),
      a('lisbon-miradouro', 'Sunset at a miradouro viewpoint', 'Pick a hilltop viewpoint, bring a drink, and watch the light change over the rooftops.', [CULTURE, NATURE], 0, 'evening'),
      a('lisbon-surf', 'Surf lesson at Costa da Caparica', 'A beginner-friendly lesson on the Atlantic coast, gear included.', [ADVENTURE, NATURE], 45),
      a('lisbon-spa', 'Spa afternoon', 'A slow afternoon with a thermal circuit and massage.', [WELLNESS, LUXURY], 60),
      a('lisbon-tasting', 'Tasting-menu dinner', 'A multi-course dinner built around Portuguese produce and wine.', [LUXURY, FOOD], 110, 'evening', BOOK),
    ],
  },
  bali: {
    id: 'bali',
    airport: 'DPS',
    costFactor: 0.6,
    flightBaseUsd: 780,
    flightHours: 11,
    weather: ['Warm & sunny'],
    areas: ['Ubud', 'Seminyak', 'Uluwatu'],
    highlights: [
      a('bali-monkey', 'Ubud Monkey Forest & Palace', 'Shaded forest paths and a look at Ubud’s royal palace.', [CULTURE, NATURE], 8),
      a('bali-tegallalang', 'Tegallalang rice terraces', 'Terraced paddies best seen in the morning light.', [NATURE], 5),
      a('bali-tirta', 'Tirta Empul water temple', 'A working spring temple with purification pools.', [CULTURE], 6),
      a('bali-batur', 'Mount Batur sunrise trek', 'A pre-dawn guided hike to the summit for sunrise over the caldera.', [ADVENTURE, NATURE], 45, 'day', BOOK),
      a('bali-uluwatu', 'Uluwatu Temple sunset', 'Clifftop temple at golden hour, with a traditional dance performance.', [CULTURE], 10, 'evening'),
      a('bali-yoga', 'Yoga & spa session', 'A morning class followed by a traditional Balinese massage.', [WELLNESS], 25),
      a('bali-cooking', 'Balinese cooking class', 'Market visit and a hands-on class covering local staples.', [FOOD, CULTURE], 35),
      a('bali-snorkel', 'Snorkeling day trip', 'A boat trip to reef sites, gear and lunch included.', [ADVENTURE, NATURE], 60, 'day', BOOK),
      a('bali-beachclub', 'Seminyak beach-club sunset', 'Cocktails and a sunset on the sand.', [FOOD], 30, 'evening'),
      a('bali-villa', 'Private villa spa day', 'A pampering day with treatments and a long lunch.', [LUXURY, WELLNESS], 120, 'day', BOOK),
    ],
  },
  queenstown: {
    id: 'queenstown',
    airport: 'ZQN',
    costFactor: 1.15,
    flightBaseUsd: 1300,
    flightHours: 16,
    weather: ['Cool & mild', 'Cold & snowy'],
    areas: ['Queenstown Central', 'Frankton', 'Arthurs Point'],
    highlights: [
      a('qt-gondola', 'Skyline Gondola & luge', 'Ride up for lake and mountain views, then race down the luge track.', [ADVENTURE], 55),
      a('qt-bungee', 'Bungee jump at Kawarau Bridge', 'The original commercial bungee site — book a slot in advance.', [ADVENTURE], 125, 'day', BOOK),
      a('qt-milford', 'Milford Sound day trip', 'A long but spectacular day to the fiord with a cruise included.', [NATURE], 170, 'day', BOOK),
      a('qt-lakewalk', 'Lake Wakatipu & Queenstown Gardens walk', 'An easy lakeside stroll with mountain backdrops.', [NATURE], 0),
      a('qt-benlomond', 'Ben Lomond track hike', 'A demanding day hike with panoramic views for experienced walkers.', [ADVENTURE, NATURE], 0),
      a('qt-arrowtown', 'Arrowtown historic village', 'Gold-rush era cottages and autumn-colour walks along the river.', [CULTURE, NATURE], 0),
      a('qt-wine', 'Gibbston Valley wine tasting', 'Cellar-door tastings in one of the world’s southernmost wine regions.', [FOOD, LUXURY], 40),
      a('qt-hotpools', 'Hot-pool soak with valley views', 'Unwind in a private outdoor hot pool.', [WELLNESS], 45, 'evening'),
      a('qt-scenic', 'Scenic flight', 'A short scenic flight over the Southern Alps.', [LUXURY, ADVENTURE], 250, 'day', BOOK),
    ],
  },
  reykjavik: {
    id: 'reykjavik',
    airport: 'KEF',
    costFactor: 1.35,
    flightBaseUsd: 620,
    flightHours: 7,
    weather: ['Cold & snowy', 'Cool & mild'],
    areas: ['Miðborg', 'Vesturbær', 'Hlíðar'],
    highlights: [
      a('rk-hallgrim', 'Hallgrímskirkja & Old Harbour', 'The landmark church tower, then a wander through the old harbour area.', [CULTURE], 9),
      a('rk-goldencircle', 'Golden Circle tour', 'Þingvellir National Park, the Geysir area, and Gullfoss waterfall.', [NATURE, ADVENTURE], 90, 'day', BOOK),
      a('rk-bluelagoon', 'Geothermal lagoon soak', 'A geothermal spa visit — reserve a time slot ahead.', [WELLNESS, LUXURY], 90, 'day', BOOK),
      a('rk-aurora', 'Northern lights tour', 'A night tour in search of the aurora. Season- and weather-dependent, so not guaranteed.', [NATURE, ADVENTURE], 85, 'evening', BOOK),
      a('rk-south', 'South Coast waterfalls', 'Seljalandsfoss and Skógafoss on a full-day route.', [NATURE], 95, 'day', BOOK),
      a('rk-harpa', 'Harpa concert hall & Sun Voyager', 'Reykjavik’s waterfront landmarks on an easy walk.', [CULTURE], 0),
      a('rk-food', 'Icelandic food tasting', 'Lamb soup, fresh seafood, and a famous harbour hot dog.', [FOOD], 25),
      a('rk-whales', 'Whale-watching cruise', 'A boat trip from the harbour; sightings are never guaranteed.', [NATURE, ADVENTURE], 95, 'day', BOOK),
      a('rk-tasting', 'Tasting-menu dinner', 'A multi-course dinner focused on Nordic ingredients.', [LUXURY, FOOD], 150, 'evening', BOOK),
    ],
  },
  dubai: {
    id: 'dubai',
    airport: 'DXB',
    costFactor: 1.4,
    flightBaseUsd: 480,
    flightHours: 6,
    weather: ['Warm & sunny'],
    areas: ['Downtown Dubai', 'Dubai Marina', 'Deira'],
    highlights: [
      a('dxb-burj', 'Burj Khalifa observation deck', 'Timed-entry views from one of the world’s tallest towers.', [CULTURE, LUXURY], 45, 'day', BOOK),
      a('dxb-fountain', 'Dubai Mall & fountain show', 'Browse the mall, then catch the evening fountain display.', [LUXURY], 0, 'evening'),
      a('dxb-olddubai', 'Old Dubai: souks & abra crossing', 'Al Fahidi district, spice and gold souks, and a creek crossing by traditional boat.', [CULTURE], 3),
      a('dxb-desert', 'Desert safari', 'Dune drive and a camp-style dinner. Choose an operator carefully and confirm inclusions.', [ADVENTURE], 60, 'day', BOOK),
      a('dxb-marina', 'Dubai Marina & JBR walk', 'Waterfront promenade and beach time.', [NATURE, WELLNESS], 0),
      a('dxb-emirati', 'Emirati breakfast', 'A traditional breakfast spread in a heritage setting.', [FOOD, CULTURE], 25),
      a('dxb-rooftop', 'Rooftop lounge evening', 'Skyline views with dinner and drinks.', [FOOD, LUXURY], 60, 'evening'),
      a('dxb-flamingo', 'Ras Al Khor flamingo viewing', 'A quiet wildlife stop in the middle of the city.', [NATURE], 0),
      a('dxb-hammam', 'Spa & hammam session', 'A traditional-style spa treatment.', [WELLNESS, LUXURY], 70),
      a('dxb-tea', 'Landmark hotel afternoon tea', 'A high-end dining reservation for a special afternoon.', [LUXURY, FOOD], 120, 'day', BOOK),
    ],
  },
  barcelona: {
    id: 'barcelona',
    airport: 'BCN',
    costFactor: 0.95,
    flightBaseUsd: 540,
    flightHours: 9,
    weather: ['Warm & sunny', 'Cool & mild'],
    areas: ['Gothic Quarter', 'Eixample', 'El Born'],
    highlights: [
      a('bcn-sagrada', 'Sagrada Família', 'Gaudí’s basilica — timed tickets sell out, so book ahead.', [CULTURE], 35, 'day', BOOK),
      a('bcn-guell', 'Park Güell', 'Mosaic terraces and city views.', [CULTURE, NATURE], 12, 'day', BOOK),
      a('bcn-gothic', 'Gothic Quarter & La Boqueria', 'Medieval lanes and the city’s best-known food market.', [CULTURE, FOOD], 15),
      a('bcn-tapas', 'Tapas crawl in El Born', 'Small plates and vermouth bar-hopping.', [FOOD], 45, 'evening'),
      a('bcn-beach', 'Barceloneta beach afternoon', 'Sand, sea, and a seafront lunch.', [NATURE], 0),
      a('bcn-montjuic', 'Montjuïc hill & Magic Fountain', 'Gardens and views by day, fountain show in the evening.', [CULTURE, NATURE], 0, 'evening'),
      a('bcn-montserrat', 'Montserrat day trip', 'Rack railway to a mountain monastery with hiking trails.', [NATURE, ADVENTURE], 35),
      a('bcn-batllo', 'Casa Batlló', 'An interior visit to one of Gaudí’s best-known houses.', [CULTURE], 40, 'day', BOOK),
      a('bcn-sail', 'Sailing or kayak outing', 'A guided outing along the coast.', [ADVENTURE, NATURE], 40),
      a('bcn-spa', 'Spa & thermal circuit', 'A relaxed spa afternoon.', [WELLNESS], 45),
      a('bcn-tasting', 'Tasting-menu dinner', 'A multi-course Catalan tasting menu.', [LUXURY, FOOD], 120, 'evening', BOOK),
    ],
  },
  'chiang-mai': {
    id: 'chiang-mai',
    airport: 'CNX',
    costFactor: 0.5,
    flightBaseUsd: 700,
    flightHours: 10,
    weather: ['Warm & sunny'],
    areas: ['Old City', 'Nimmanhaemin', 'Riverside'],
    highlights: [
      a('cnx-suthep', 'Doi Suthep temple', 'A hillside temple with views over the city.', [CULTURE, NATURE], 5),
      a('cnx-oldcity', 'Old City temple walk', 'Wat Phra Singh and Wat Chedi Luang on foot.', [CULTURE], 2),
      a('cnx-walkingstreet', 'Night market & street food', 'Browse stalls and snack your way through — the Sunday Walking Street only runs on Sundays.', [FOOD], 10, 'evening'),
      a('cnx-elephant', 'Elephant sanctuary visit', 'Choose an ethical, no-riding sanctuary and confirm its practices first.', [NATURE, ADVENTURE], 65, 'day', BOOK),
      a('cnx-cooking', 'Thai cooking class & market tour', 'Shop the market, then cook several classic dishes.', [FOOD, CULTURE], 30),
      a('cnx-inthanon', 'Doi Inthanon National Park', 'Thailand’s highest peak, waterfalls, and forest walks.', [NATURE, ADVENTURE], 45),
      a('cnx-massage', 'Thai massage & spa', 'A traditional massage to reset.', [WELLNESS], 12),
      a('cnx-zipline', 'Jungle zipline course', 'A guided canopy zipline experience.', [ADVENTURE], 55, 'day', BOOK),
      a('cnx-khaosoi', 'Khao soi tasting', 'Northern Thai curry noodle soup at a local favourite.', [FOOD], 6),
      a('cnx-meditation', 'Temple meditation session', 'A beginner-friendly meditation or monk-chat session.', [WELLNESS, CULTURE], 0),
      a('cnx-private', 'Private spa & fine-dining dinner', 'A treat-yourself evening.', [LUXURY, WELLNESS], 90, 'evening', BOOK),
    ],
  },
}

/** Fallback for a destination id that has no fixture (e.g. from a future backend). */
export function genericFixture(id: string, placeName: string): DestinationFixture {
  return {
    id,
    airport: '—',
    costFactor: 1,
    flightBaseUsd: 700,
    flightHours: 9,
    weather: [],
    areas: ['City Centre', 'Old Town', 'Waterfront'],
    highlights: [
      a(`${id}-old`, `${placeName} historic centre walk`, 'A self-guided walk through the main historic sights.', [CULTURE], 5),
      a(`${id}-food`, `Local food tasting in ${placeName}`, 'Sample regional dishes at a well-reviewed local spot.', [FOOD], 30),
      a(`${id}-nature`, 'Parks and viewpoints', 'An easy outdoor half-day around the area.', [NATURE], 0),
      a(`${id}-active`, 'Guided outdoor activity', 'A guided active outing suited to your fitness level.', [ADVENTURE], 55, 'day', BOOK),
      a(`${id}-spa`, 'Spa or wellness session', 'A relaxing treatment or class.', [WELLNESS], 45),
      a(`${id}-dinner`, 'Special dinner', 'A reservation at a higher-end restaurant.', [LUXURY, FOOD], 100, 'evening', BOOK),
      a(`${id}-night`, 'Evening out', 'A relaxed evening at a local bar or music venue.', [FOOD], 35, 'evening'),
    ],
  }
}

// --- Accommodation tiers --------------------------------------------------------

export type AccommodationTier = {
  id: 'budget' | 'mid' | 'comfort'
  type: string
  /** Base nightly price per room in USD before the destination cost factor. */
  baseUsd: number
  rating: number
  facilities: string[]
  cancellation?: string
}

export const ACCOMMODATION_TIERS: AccommodationTier[] = [
  {
    id: 'budget',
    type: 'Guesthouse',
    baseUsd: 45,
    rating: 4.1,
    facilities: ['Wi-Fi', 'Shared kitchen', 'Air conditioning'],
  },
  {
    id: 'mid',
    type: 'Boutique Hotel',
    baseUsd: 95,
    rating: 4.4,
    facilities: ['Wi-Fi', 'Breakfast option', 'Air conditioning', 'Front desk'],
    cancellation: 'Sample policy: free cancellation up to 3 days before check-in.',
  },
  {
    id: 'comfort',
    type: 'Grand Hotel',
    baseUsd: 170,
    rating: 4.6,
    facilities: ['Wi-Fi', 'Pool', 'Gym', 'Restaurant', 'Concierge'],
  },
]

// --- Flights ----------------------------------------------------------------------

export type FlightTemplate = {
  id: string
  airline: string
  departure: string
  /** Multiplier on the destination's illustrative base fare. */
  priceFactor: number
  /** Multiplier on illustrative flight hours (layovers add time). */
  durationFactor: number
  stops: number
}

export const FLIGHT_TEMPLATES: FlightTemplate[] = [
  { id: 'direct', airline: 'Demo Air', departure: '08:40', priceFactor: 1.25, durationFactor: 1, stops: 0 },
  { id: 'one-stop', airline: 'Sample Airways', departure: '13:15', priceFactor: 1, durationFactor: 1.35, stops: 1 },
  { id: 'two-stops', airline: 'Example Jet', departure: '22:05', priceFactor: 0.82, durationFactor: 1.8, stops: 2 },
]

/** Approximate, NOT live, conversion rates from USD used only for demo estimates. */
export const DEMO_RATES_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83,
  AUD: 1.5,
  CAD: 1.36,
}
