/* Crane placement notes: what to keep in mind when a tower crane, mobile crane or placing boom is put on a site.
 * A planning reminder, not legal advice and not a check: the tool does not judge where a crane stands.
 *
 * Two layers:
 *   bc      what applies on any site in British Columbia (WorkSafeBC, the Building Code, federal aviation rules,
 *           neighbour consent, the corridor owners). Shown for every address, and alone when there is none.
 *   cities  what a city adds: its street permits, hours, tree rules and local facts. The city is recognised from the
 *           site address typed in the title block (`match`); a city named in `known` but with no entry here is
 *           recognised and reported as "rules not loaded".
 * Each layer has, for a tower crane and for a mobile crane or placing boom:
 *   short   the few lines shown beside the cursor while a crane is being placed
 *   full    the longer list in the Drawing panel, [heading, [lines]]
 * plus `site` (any crane) and `confirm` (not settled by the research: ask before relying on an assumption).
 *
 * Sources: reports/Surrey crane placement rules.md and research_notes/ (public sources). The wording is plain-language
 * paraphrase; copy the clause itself from the bylaw or regulation before quoting it on a drawing. To update or add a
 * city, edit this file and rebuild.
 */
window.__CS_CRANE_NOTES = {
  kinds: { crane: 'tower', 'ss-crane': 'tower', 'mobile-crane': 'mobile', 'placing-boom': 'mobile' },
  titles: { tower: 'Tower crane', mobile: 'Mobile crane or placing boom' },
  // other places a site address may name: recognised, but their own rules are not loaded
  known: ['Port Coquitlam', 'Port Moody', 'North Vancouver', 'West Vancouver', 'Vancouver', 'Burnaby', 'Delta', 'White Rock',
    'Maple Ridge', 'Pitt Meadows', 'Abbotsford', 'Mission', 'Chilliwack', 'Anmore', 'Belcarra', 'Tsawwassen', 'Squamish', 'Victoria', 'Kelowna', 'Nanaimo', 'Kamloops'],
  // a name two municipalities share: the address has to say which before either one's rules are shown
  unsure: [{
    match: 'langley',
    short: 'Langley: say "City of Langley" or "Township of Langley" in the address; their rules differ.',
    say: '"Langley" is named in the site address, but that could be the City of Langley or the Township of Langley, and their rules differ. Write "City of Langley" or "Township of Langley" in the address (a Township neighbourhood such as Willoughby, Walnut Grove, Fort Langley, Murrayville, Brookswood or Aldergrove also works).',
  }],
  bc: {
    name: 'British Columbia',
    asOf: '16 Nov 2026',
    tower: {
      short: [
        'Full circle: jib and counter-jib must be free to swing 360°, 1 m above and 0.3 m beside anything.',
        'Neighbours: every private lot under either circle needs a signed agreement, loaded or not.',
        'Power lines: 3 m (to 75 kV), 4.5 m (to 250 kV), 6 m (above), measured to the load.',
        'Loads: not over people; the street is closed or covered before lifting over it.',
        'Another tower crane: avoid overlap; if they overlap, 3 m apart and written procedures.',
        'Over 60 m tall, or near a hospital helipad: Transport Canada, about 3 months ahead.',
        'WorkSafeBC notice 2 weeks before erecting, climbing, moving or dismantling.',
      ],
      full: [
        ['Swing', [
          'The crane must be able to swing a full 360° at all times unless the maker says otherwise, so draw the jib and the counter-jib as whole circles (WorkSafeBC OHS Regulation s. 14.85(2)).',
          'Every part of the jib and counter-jib clears any obstruction by 1 m vertically and 30 cm sideways, or the maker\'s figure if greater (s. 14.85(1)).',
          'Two tower cranes: avoid overlapping zones where practicable. If they overlap: 3 m between the cranes vertically, loads 3 m clear of the lower crane\'s cab, marked boundaries, written procedures, an anti-collision device if practicable, and 18 m clearance before a load passes over an occupied lower crane (s. 14.84.1).',
        ]],
        ['Base', [
          'A professional engineer certifies the foundation, bracing and any ties to the building, and the bearing capacity of the ground (s. 14.74).',
          'The regulation sets no minimum distance from the base to a property line, excavation or building.',
        ]],
        ['Notices', [
          'WorkSafeBC tower crane notice of project at least 2 weeks before each erection, climb, reposition or dismantle, posted on site (s. 14.73.3).',
          'The general construction notice of project (s. 20.2) is separate.',
        ]],
        ['Weather', [
          'Stop at the maker\'s wind limit, or 50 km/h where none is given; stop below -18 °C unless the maker or an engineer sets another limit (ss. 14.92, 14.93).',
        ]],
        ['Lifts and records', [
          'A critical lift needs a written lift plan on site and a documented pre-job meeting (s. 14.42.1). Every tandem lift needs a written plan, certified by an engineer if a tower crane is involved (s. 14.42).',
          'All records since the crane\'s structural certification stay on site while it is erected (s. 14.79).',
        ]],
      ],
    },
    mobile: {
      short: [
        'Ground: within one excavation depth of the excavation face, a qualified person picks the spot.',
        'Tail swing: 60 cm clear of anything, or the area barricaded.',
        'Power lines: 3 m (to 75 kV), 4.5 m (to 250 kV), 6 m (above), measured to the boom, line and load.',
        'Loads: not over people; the street is closed or covered before lifting over it.',
        'On a road, lane or sidewalk: the city\'s street permit comes first.',
        'Work on a road for over 15 minutes: a written risk assessment and traffic control plan (WorkSafeBC Part 18).',
        'A federal pipeline: written consent before setting up or driving across within 30 m.',
      ],
      full: [
        ['Ground', [
          'The surface must safely carry the crane and load, with mats or cribbing sized for it (WorkSafeBC OHS Regulation s. 14.69).',
          'Next to an excavation, slope or backfill, a qualified person determines the set-up location. "Next to" means within a horizontal distance equal to the excavation\'s depth, measured from the toe of the face (ss. 14.69(2), 20.1). There is no fixed set-back.',
          'The crane must be level within the maker\'s limits (s. 14.66).',
        ]],
        ['Swing', [
          'No moving part within 60 cm of an obstruction where a worker can get to, unless the area is barricaded: this governs the counterweight\'s tail swing (s. 14.41).',
          'Working in a tower crane\'s zone needs written procedures and marked boundaries (s. 14.84.1).',
        ]],
        ['Traffic and the road', [
          'Work on a road lasting over 15 minutes needs a written risk assessment and a written traffic control plan. Traffic control persons are the last resort, after closures, detours and devices (WorkSafeBC OHS Regulation ss. 18.3.1 to 18.3.3).',
          'On provincial highways a mobile crane travels under permit up to 3.8 m wide, 4.3 m high and 64,000 kg gross. A load over 3.2 m wide cannot use highways west of Abbotsford on weekdays 7 to 9 am or 3:30 to 6 pm. Provincial Permit Centre: 1-800-559-9688.',
          'Tower crane counterweight blocks are divisible loads: they travel at legal weight, with no overweight permit.',
          'A critical lift (for a mobile crane, over 90% of rated capacity beyond half the maximum radius, among other triggers) needs a written lift plan on site (ss. 14.1, 14.42.1).',
        ]],
      ],
    },
    site: [
      ['Neighbours', [
        'Swinging a jib, counter-jib or load over a private lot without the owner\'s consent has been held a trespass by the BC Supreme Court, with injunctions granted (2020 and 2023). One earlier decision went the other way.',
        'A signed crane swing agreement is the usual answer for every private lot inside either swing circle. No court or tribunal can order a neighbour to agree.',
      ]],
      ['Streets and the public', [
        'A load does not pass over any person where there is a practical alternative (WorkSafeBC OHS Regulation s. 14.44).',
        'Hoisting that endangers pedestrians who cannot be protected by a barricade or covered way does not proceed until the street is closed (BC Building Code 2024, Div. B, 8.2.3.2).',
        'A provincial highway is the Ministry\'s, not the city\'s: highway use permit (form H0020).',
      ]],
      ['Power lines', [
        'Keep the crane, load line, rigging and load 3 m from lines over 750 V to 75 kV, 4.5 m up to 250 kV, and 6 m up to 550 kV (WorkSafeBC OHS Regulation ss. 14.52.1, 19.24.1).',
        'Closer than that needs the line owner\'s signed assurance in writing (form 30M33) before work starts (s. 19.25).',
        'Street lines are usually 12 kV or 25 kV (the 3 m band). Hold 6 m from a transmission line until its owner confirms the voltage. BC Hydro Express Connect: 1 877 520 1355.',
      ]],
      ['Height and aircraft', [
        'Over 60 m above ground anywhere, or lower near an airport or helipad: Transport Canada aeronautical assessment, about 90 days ahead; the result is good for 18 months.',
        'Near a hospital helipad the trigger is a surface rising 4% from the pad out to 1,500 m: about 20 m above the pad at 500 m.',
        'NAV CANADA needs its own land-use submission, usually answered in 8 to 12 weeks.',
      ]],
      ['Corridors, where one is near', [
        'SkyTrain: TransLink consent within 10 m of the guideway or 25 m of a station; no loads over stations or guideway; a crane overswing agreement before any part swings near it.',
        'A federally regulated pipeline (Trans Mountain): written consent for ground disturbance within 30 m, and to drive or set up equipment across the pipe off a public road (SOR/2016-124).',
        'BC Hydro transmission right-of-way: approval at least 6 weeks ahead; 10 m from towers and poles.',
        'Railways: CN wants a flagger for work within 30 ft of the nearest rail; BNSF within 25 ft of the track centreline, or wherever a crane could reach the track if it tipped.',
        'Metro Vancouver mains: its consent before building near them.',
      ]],
    ],
    confirm: [
      'BC Hydro\'s lead time for a written assurance, cover-up or outage: BC Hydro Express Connect, 1 877 520 1355.',
      'FortisBC distances near high-pressure gas lines: FortisBC, 1-888-224-2710.',
    ],
  },
  cities: {
    surrey: {
      name: 'Surrey',
      match: ['surrey'],
      asOf: '16 Nov 2026',
      summary: 'Surrey has no crane bylaw. Cranes on or over a City road go through two general Engineering permits.',
      tower: {
        short: [
          'Jib over a City road or lane: declare it on a road-use permit (type CR1), $5 million insurance.',
          'Work 7 am to 10 pm, never Sunday, unless a Noise Extension permit is issued.',
        ],
      },
      mobile: {
        short: [
          'On a City road, lane, boulevard or sidewalk: Traffic Obstruction Permit ("Crane Parking"), $5 million insurance.',
          'Trees: no equipment inside a tree protection zone; a barrier within 10 m of a protected tree.',
          'City mains are not on BC 1 Call: locate them from the City\'s records.',
        ],
      },
      site: [
        ['City streets', [
          'Standing on a road, lane, boulevard or sidewalk needs a Traffic Obstruction Permit ("Crane Parking"), with a traffic management plan and $5 million insurance naming the City (Highway and Traffic By-law 13007, ss. 84 to 86.2).',
          'A jib over a City road or lane: declare it on a City Road and Right-of-Way Use Permit (type CR1, "crane use, aerial encroachments"), $5 million insurance.',
          'Published fees: Traffic Obstruction Permit $615 on an arterial or collector road, $300 on a local road, doubled if work starts without it; road-use permit $95 plus $350 inspection.',
          'Surrey Engineering: 604-591-4340.',
        ]],
        ['Getting the crane there', [
          'Oversize or overweight moves need a City permit, not valid 7 to 9 am and 3 to 6 pm on weekdays.',
          'Heavy trucks keep to truck routes, and stay on them in residential districts between 7 pm and 7 am (By-law 13007, ss. 87, 89).',
        ]],
        ['Hours and trees', [
          'Construction noise only between 7 am and 10 pm, and not on Sunday; a night or Sunday erection needs a Noise Extension permit from Business Licensing, 604-591-4370 (Noise Control By-law 7044).',
          'No heavy equipment or storage inside a tree protection zone, and a barrier where work is within 10 m of a protected tree. Every tree on City land is protected (Tree Protection Bylaw 16100).',
        ]],
        ['Local', [
          'Hospital helipad: Surrey Memorial. Assume a tower crane within 1.5 km of it needs a Transport Canada assessment.',
          'SkyTrain: the Expo Line stations (Scott Road, Gateway, Surrey Central, King George); the line along Fraser Highway to Langley is due to open in late 2029.',
          'Trans Mountain crosses north Surrey (Fraser Heights, Port Kells). Railways: CN, BNSF and Southern Railway of BC.',
          'The City of Surrey is not on BC 1 Call: a clear ticket says nothing about City water, sewer or drainage under a crane pad.',
          'Metro Vancouver: contact it within 15 m of a regional water main.',
        ]],
      ],
      confirm: [
        'Whether Surrey needs a permit for an unloaded jib passing over a City road, and on what terms: Surrey Engineering, 604-591-4340.',
        'Whether an airport height limit (Pitt Meadows, Boundary Bay) reaches the site, notably Fraser Heights and Port Kells: Transport Canada.',
      ],
    },
    coquitlam: {
      name: 'Coquitlam',
      match: ['coquitlam'],
      asOf: '16 Nov 2026',
      summary: 'Coquitlam has no crane swing permit. Its building permit checklist asks for the crane swing over property lines to be shown, and a crane on or over a street goes through the general closure permit.',
      tower: {
        short: [
          'Building permit: show the crane base and its swing over property lines on the servicing and fire safety plans.',
          'Jib over a City street, lane or park: ask Engineering whether an encroachment agreement is needed (up to 6 weeks, $5 million insurance).',
          'Work 7 am to 8 pm weekdays, 9 am to 6 pm Saturday, never Sunday or holidays, without a noise exemption.',
        ],
      },
      mobile: {
        short: [
          'On or over a street, lane or sidewalk: Road and Sidewalk Closure Permit, 10 business days, $5 million insurance.',
          'Trees: keep machinery and storage 1 m outside the tree protection fence, which sits at the dripline.',
          'City mains do not appear on BC 1 Call tickets: get locates from the City.',
        ],
      },
      site: [
        ['City streets', [
          'A crane set up on, or lifting over, a street, lane or sidewalk needs a Road and Sidewalk Closure Permit: apply 10 business days ahead (5 for a renewal) with a traffic management plan, a prime contractor letter and the City\'s insurance certificate at $5 million liability plus $2 million auto (Street and Traffic Bylaw No. 5499, 2026, ss. 6.2, 6.3, 16.16).',
          'Fee: $153.30, renewal $76.65 in the fee bylaw (the City\'s form still shows $150 and $75). Street permits: StreetPermits@coquitlam.ca, 604-927-6250.',
          'Longer occupation of City land (hoarding, staging, trailers) is by a Temporary Encroachment Agreement: review up to 6 weeks, $5 million insurance, $150 application fee plus a fee by area. The policy generally refuses encroachment into parkland or over utilities.',
          'No vehicle over 6.5 m long parked on a street between 8 pm and 7 am without a permit (s. 11.1); a permit for any cable or hose across a street or sidewalk (s. 16.3).',
        ]],
        ['Building permit', [
          'The City\'s building permit checklist asks the servicing plans to show "crane swing over property lines", and a traffic management plan is required.',
          'The Fire/Rescue construction fire safety plan guidelines ask for the crane base on the site plan.',
        ]],
        ['Getting the crane there', [
          'Vehicles over 11,800 kg keep to truck routes. Off-route for a local delivery only 7 am to 8 pm weekdays and 9 am to 6 pm Saturday, never Sundays or holidays (Bylaw 5499, s. 27).',
          'Truck route exemption $164.80; oversize or overweight permit $52.50 a trip or $314.90 a year, as well as any provincial permit.',
        ]],
        ['Hours and trees', [
          'Construction noise 7 am to 8 pm Monday to Friday and 9 am to 6 pm Saturday; none for profit on Sundays or holidays, and Easter Monday counts as a holiday (Noise Regulation Bylaw 1233).',
          'A noise exemption costs $79.70 (more at under 5 business days\' notice) and needs notices to neighbours 72 hours ahead.',
          'The City\'s standard tree fence goes at the dripline, with no machinery or storage within 1 m of the protected area. Boulevard trees are the City\'s. Urban Forestry: 604-927-3482.',
        ]],
        ['Local', [
          'SkyTrain: the Millennium Line stations in Coquitlam (Burquitlam, Coquitlam Central, Lincoln, Lafarge Lake-Douglas) and the guideway between them.',
          'Rail: the CPKC and West Coast Express corridor. Trans Mountain runs through Coquitlam: it is notified on locate tickets here.',
          'City water and sewer mains do not appear on BC 1 Call tickets: ask Engineering and Public Works, 604-927-3500, before designing a crane foundation or setting outriggers.',
        ]],
      ],
      confirm: [
        'Whether a jib passing over a street or lane with no closure needs an encroachment agreement or fee: Coquitlam Engineering and Public Works, 604-927-3500.',
        'Closure hours on arterial roads and any security deposit (set permit by permit): Traffic and Street Use, 604-927-6250.',
        'Whether a construction management plan must show the crane position and radius: Planning and Development, 604-927-3430.',
        'The tree bylaw\'s own clause and fines (Tree Management Bylaw 4091 could not be read): Urban Forestry, 604-927-3482.',
        'Whether the Pitt Meadows airport height limit reaches the site (low ground near the Pitt River), and the hospital helipads at Royal Columbian and Eagle Ridge: Transport Canada.',
      ],
    },
    newwest: {
      name: 'New Westminster',
      match: ['new westminster', 'new west'],
      asOf: '16 Nov 2026',
      summary: 'New Westminster has no separate crane bylaw, but its Street and Traffic Bylaw names cranes: carrying a crane load on or over any City land needs a Street Occupancy Permit.',
      tower: {
        short: [
          'Loads over any City street, lane, park or City land: Street Occupancy Permit.',
          'Jib over a City street: a Council airspace licence may be needed first. Ask Engineering early.',
          'Work 7 am to 8 pm weekdays, 9 am to 6 pm Saturday, never Sunday or holidays.',
          'Street power lines here are understood to be the City\'s own, not BC Hydro\'s: confirm who signs the assurance.',
        ],
      },
      mobile: {
        short: [
          'Lifting from or over a street: Street Occupancy Permit, $5 million insurance, a damage deposit, 5 to 10 business days.',
          'On major roads, street work only 9 am to 3 pm.',
          'Trees: no vehicles or heavy equipment inside a tree protection zone.',
          'City mains are not on BC 1 Call: ask the City to locate them.',
        ],
      },
      site: [
        ['City streets', [
          'A Street Occupancy Permit is required to "use a crane or forklift to pick up or carry a load on or over a Public Place": streets, lanes, parks and any City-owned or school land (Street and Traffic Bylaw No. 7664, s. 5.7.18).',
          'Occupying the airspace above a Public Place for construction is also a permit matter (s. 5.7.14), and the City Engineer cannot issue it until Council grants a licence (s. 5.9). Whether that reaches an unloaded tower crane jib is not clear from the bylaw.',
          'The permit needs a traffic management plan, $5 million insurance naming the City, a damage deposit ($2,600 to $20,500) and a prime contractor form; review takes 5 to 10 business days. Engineering: 604-527-4592, sop@newwestcity.ca.',
          'Fees: application $128, $256 or $528 by impact; occupancy $59.50 a block face a day on local streets, $91.00 on collectors, arterials and major roads.',
          'Work on major roads is limited to 9 am to 3 pm.',
        ]],
        ['Getting the crane there', [
          'Vehicles over 11,800 kg keep to truck routes. Royal Avenue, East Eighth Avenue, eastbound Tenth Avenue and part of Columbia Street East are open to trucks 7 am to 9 pm only.',
          'City oversize or overweight permit: $87 a trip or $291 a year.',
        ]],
        ['Hours and trees', [
          'Construction noise Monday to Friday 7 am to 8 pm and Saturday 9 am to 6 pm; nothing on Sundays or holidays (Construction Noise Bylaw 6063). An exemption costs $222; a Council variance takes 4 to 6 weeks.',
          'No vehicles or heavy equipment inside a tree protection zone, and City authorization for work within 4 m of a critical root zone (Tree Protection and Regulation Bylaw 7799, s. 8.5).',
        ]],
        ['Local', [
          'Railways in the city: CN, CPKC, BNSF and Southern Railway of BC, along the waterfront and Front Street.',
          'Royal Columbian Hospital has a rooftop helipad with approved flight paths: assume a tower crane within 1.5 km needs a Transport Canada assessment.',
          'SkyTrain runs through the city on both the Expo and Millennium Lines.',
          'The City does not appear on the BC 1 Call member list: confirm City water, sewer and electrical duct locations with Engineering before setting outriggers or a crane base.',
        ]],
      ],
      confirm: [
        'Whether an unloaded tower crane jib over a street needs a Street Occupancy Permit, a Council licence (s. 5.9), or neither: New Westminster Engineering, 604-527-4592.',
        'Who owns the street power lines and signs the written assurance (form 30M33) near them. The City is understood to run its own electric utility; start at City Hall, 604-521-3711.',
        'Which roads count as major roads for the 9 am to 3 pm rule: Engineering, 604-527-4592.',
        'Where the Royal Columbian helipad is now (it may have moved to the new tower) and what the hospital expects of nearby cranes: Fraser Health.',
        'Whether a crane or logistics plan is required with a building permit: City Hall, 604-521-3711.',
      ],
    },
    richmond: {
      name: 'Richmond',
      match: ['richmond'],
      asOf: '16 Nov 2026',
      summary: 'Richmond has a crane rule of its own: a Crane Swing Permit before a fixed crane swings over a City street or lane. The airport also caps height across much of the city.',
      tower: {
        short: [
          'Airport height limit: the crane\'s highest point stays under 47 m geodetic, lower near the runway approaches.',
          'Jib or counter-jib over a City street or lane: Crane Swing Permit, 30 days ahead, $10 million insurance, renewed every 12 months.',
          'Over a City park or lot: a separate City agreement. The permit covers streets only.',
          'Work 7 am to 8 pm weekdays, 10 am to 8 pm Saturday, never Sunday or holidays.',
        ],
      },
      mobile: {
        short: [
          'No Crane Swing Permit for mobile or crawler cranes, but on or closing a street: Lane Closure Request, 5 business days ahead.',
          'The boom also counts against the 47 m geodetic airport height limit.',
          'Trees: no heavy equipment over roots inside the drip line.',
          'City mains are not on BC 1 Call: ask City Engineering to locate them.',
        ],
      },
      site: [
        ['Crane Swing Permit', [
          'A Crane Swing Permit is required before a fixed construction crane, including a tower crane, swings its boom or other parts over a City street or lane (Construction Encroachment Bylaw No. 9833, as amended by Bylaw 10599 in October 2024). Wheel-mounted and crawler cranes are excluded.',
          'Apply at least 30 days ahead: $573, renewal $573 (2026), $10 million liability insurance, a security deposit, 12-month term. Engineering Planning: 604-276-4289, engineeringrequest@richmond.ca.',
          'Swinging over City land that is not a street needs a separate City agreement, and the permit gives no rights over private neighbours.',
          'Swinging without the permit: stop work and a double fee; fines up to $50,000 a day.',
        ]],
        ['Airport height limit', [
          'The Vancouver International Airport Zoning Regulations (SOR/80-902, s. 5) bar any building, structure or object above the airport\'s protected surfaces. The outer surface is 45 m above a 2 m reference elevation: 47 m geodetic.',
          'Approach surfaces rise 1 in 50 and transitional surfaces 1 in 7, so a site near the runways is limited lower than 47 m. Check the limit for the lot before choosing a crane height.',
        ]],
        ['City streets', [
          'No obstruction on, in, over or under a street without a permit (Traffic Bylaw No. 5870, s. 6.2). A mobile crane on a street, lane or sidewalk needs a Lane Closure Request: $115, 5 business days ahead; arterial and collector roads have time restrictions, and a full closure needs one week of public notice.',
          'A Traffic and Parking Plan, approved before the building permit on most sites, asks where crane trucks will stage.',
          'Traffic Operations: 604-204-8707.',
        ]],
        ['Getting the crane there', [
          'Oversize moves need a City permit: $28.75 a trip, 3 business days ahead, arterial roads only, not 7 to 9 am or 3:30 to 6 pm.',
        ]],
        ['Hours and trees', [
          'Construction noise Monday to Friday 7 am to 8 pm and Saturday 10 am to 8 pm; contractors do not work Sundays or holidays. Crane erection and dismantling count as construction (Noise Regulation Bylaw No. 8856).',
          'An exemption needs 3 weeks\' notice, lasts 48 hours at most, and residences within 100 m must be told.',
          'No heavy equipment over roots inside a tree\'s drip line; the barriers are inspected before work starts (Tree Protection Bylaw No. 8057).',
        ]],
        ['Local', [
          'Canada Line: the elevated guideway and stations along No. 3 Road. A crane near it needs TransLink first.',
          'The City of Richmond does not appear on the BC 1 Call member list; the airport fuel line owners and Trans Mountain do.',
          'A fence on City land needs a Construction Fence Permit under the same bylaw as the Crane Swing Permit.',
        ]],
      ],
      confirm: [
        'The Crane Swing Permit\'s security deposit, and whether loads may pass over the street (the bylaw is silent): Engineering Planning, 604-276-4289.',
        'Whether the site is under the outer, an approach or a transitional surface, the exact height limit there, and any relief for a temporary crane: Transport Canada Civil Aviation, Pacific Region.',
        'Whether new airport zoning regulations proposed in 2024 have been finalised: Transport Canada.',
        'Lane closure time windows on arterial roads: Traffic Operations, 604-204-8707.',
        'A night, Sunday or holiday crane erection: Building Inspections, 604-276-4014.',
      ],
    },
    langleycity: {
      name: 'City of Langley',
      match: ['city of langley', 'langley city'],
      asOf: '16 Nov 2026',
      summary: 'The City of Langley has no crane bylaw. A crane on a street goes through the general Highway Use Permit, and the building permit checklist asks for Langley Regional Airport approval for cranes.',
      tower: {
        short: [
          'Building permit: the checklist asks for Langley Regional Airport approval for cranes. Airport zoning caps height near 54 m above sea level.',
          'Swing over a street or lane: not written down. Ask Engineering whether a Highway Use Permit or agreement is needed.',
          'Work 7 am to 7 pm weekdays, 7 am to 5 pm Saturday, never Sunday or holidays (the City\'s papers disagree; these are the stricter hours).',
        ],
      },
      mobile: {
        short: [
          'On a street, lane or sidewalk: Highway Use Permit, $5 million insurance, a deposit; phone Engineering 48 hours before starting.',
          'Trees: nothing in a Tree Protection Zone, not travel, storage or access.',
          'The City is not on the BC 1 Call member list: get City main locations from Engineering.',
        ],
      },
      site: [
        ['City streets', [
          'A Highway Use Permit is needed to place a mechanical device or other thing on a street or obstruct traffic, or to cross a boulevard or sidewalk with more than 270 kg (Highway and Traffic Regulation Bylaw No. 2871, ss. 8, 9).',
          'Fee $200 plus GST; deposit $1,000, $5,000 or $10,000 by class; $5 million insurance for heavy equipment naming the City; a certified traffic plan for any closure; phone Engineering 48 hours before starting.',
          'Road work hours 7 am to 7 pm Monday to Friday and 7 am to 5 pm Saturday, no statutory holidays, unless the Director consents in writing.',
          'Engineering, Parks and Environment: 604-514-2997, engineering@langleycity.ca.',
        ]],
        ['Building permit', [
          'The multi-family building permit checklist asks for "Langley Regional Airport Approval (re building height and/or cranes)", and for proof of crane inspection in the construction fire safety plan.',
        ]],
        ['Getting the crane there', [
          'Trucks over 11,800 kg keep to the Truck Route except for the shortest leg to the site. An oversize or overweight move needs the City\'s own permit: $200 plus GST, $5 million insurance.',
          'No commercial vehicle over 5,600 kg parked on a street between midnight and 8 am.',
        ]],
        ['Hours and trees', [
          'No construction noise on Sundays or statutory holidays. An exemption goes to Engineering 7 days ahead, with neighbours told in writing 3 days before.',
          'The City\'s own documents give two sets of hours: to 7 pm (Saturday 5 pm) in the noise bylaw on its site, and to 8 pm (Saturday 6 pm) in its permit guides. The earlier ones are shown here.',
          'No travel, storage or site access in a Tree Protection Zone (Tree Protection and Management Bylaw No. 3321, adopted January 2026).',
        ]],
        ['Local', [
          'Langley Regional Airport is just east of the City. Its federal zoning caps anything, cranes included, at about 54 m above sea level on the outer surface, and very likely covers part of the City.',
          'The SkyTrain extension from Surrey is being built into the City centre (due late 2029): clear any swing near the guideway with the project before then, and TransLink after.',
          'The City of Langley does not appear on the BC 1 Call member list.',
        ]],
      ],
      confirm: [
        'Whether crane swing alone over a street, lane or sidewalk needs a Highway Use Permit, an agreement or nothing: Langley City Engineering, 604-514-2997.',
        'Which construction hours are in force (to 7 pm and Saturday 5 pm, or to 8 pm and Saturday 6 pm): Engineering, 604-514-2997.',
        'Whether the lot is inside the Langley airport zoning and the crane height allowed there: Langley Regional Airport, 604-534-7330, and Transport Canada.',
        'Which roads are provincial (Langley Bypass and others), where the Ministry\'s permit applies instead: Engineering.',
      ],
    },
    langleytownship: {
      name: 'Township of Langley',
      match: ['township of langley', 'langley township', 'fort langley', 'walnut grove', 'willoughby', 'murrayville', 'brookswood', 'aldergrove'],
      asOf: '16 Nov 2026',
      summary: 'The Township has no crane bylaw. A crane on a road goes through the general Highway Use Permit, and cranes near Langley Regional Airport need the Township\'s letter of no objection.',
      caution: 'Part of the Township\'s rules were confirmed on its own web pages: the working hours, the Highway Use Permit and the contacts. Its fees, lead times, truck route rules and the airport letter sit in PDFs that could not be read, and stay unconfirmed. Check those with the Township before relying on them.',
      tower: {
        short: [
          'Near Langley Regional Airport: federal zoning caps cranes at about 54 m above sea level, lower under the approaches; a Township letter of no objection.',
          'Jib or load over a Township road: Highway Use Permit; the lead time is unconfirmed.',
          'Work 7 am to 8 pm Monday to Saturday, never Sunday, holidays, Easter Monday or Boxing Day.',
        ],
      },
      mobile: {
        short: [
          'On a road, lane or sidewalk: Highway Use Permit, $5 million insurance; the lead time is unconfirmed.',
          'Commercial vehicles over 5,600 kg park on Township roads only 6 am to 9 pm.',
          'Trees: no heavy equipment or storage in a retained tree\'s root zone.',
          'The Township is listed as a BC 1 Call member, unlike its neighbours.',
        ],
      },
      site: [
        ['Airport height limit (confirmed)', [
          'The Langley Airport Zoning Regulations (C.R.C., c. 91, s. 5) bar any building, structure or object above the airport\'s protected surfaces. The outer surface is 150 ft above a 27 ft reference elevation, about 54 m above sea level.',
          'Approach surfaces rise 1 in 20 and transitional surfaces 1 in 7, so a site under an approach is limited lower. The boundary is described by survey, not by neighbourhood: ask whether the lot is inside it.',
          'Langley Regional Airport administration: 604-534-7330, ynjairport@tol.ca.',
        ]],
        ['Township roads (partly confirmed)', [
          'A Highway Use Permit from Engineering covers occupying or closing a road (Highway and Traffic Bylaw 2010 No. 4758), with $5 million liability insurance for heavy equipment and a traffic control plan. The lead time, reported as 5 business days, is unconfirmed, and the permit forms ask for two weeks\' notice to utilities.',
          'Commercial vehicles over 5,600 kg may park on Township roads only 6 am to 9 pm.',
          'Reported fee: $250 plus road usage at $1.50 per square metre per week, $150 minimum. Road work hours reported as 7 am to 9 pm Monday to Saturday.',
          'A letter of no objection for a crane that may affect the airport is reported at $500 a parcel.',
          'Engineering Division: 604-533-6006, enginfo@tol.ca.',
        ]],
        ['Getting the crane there (not confirmed)', [
          'Vehicles over 11,800 kg are reported to be kept to truck routes; an oversize or overweight permit to cost $100 plus trip fees, with $3 million vehicle insurance and two weeks\' notice to utilities.',
        ]],
        ['Hours and trees', [
          'Construction sound Monday to Saturday 7 am to 8 pm; none on Sundays, statutory holidays, Easter Monday or Boxing Day (Community Standards Bylaw 2019 No. 5448). Confirmed on the Township\'s site.',
          'A sound exemption is for pressing circumstances only, carries a fee and is not guaranteed. Its notice periods are unconfirmed.',
          'A site under a development application follows the tree protection schedule of the Subdivision and Development Servicing Bylaw, not the general Tree Protection Bylaw. Either way: fencing, and no heavy equipment or storage in a retained tree\'s root zone.',
        ]],
        ['Local', [
          'Fort Langley has a private airstrip and a water aerodrome.',
          'Trans Mountain crosses the north of the Township on two alignments: the older line under Walnut Grove and the newer one by 96 Avenue and the CN corridor.',
          'The SkyTrain extension from Surrey reaches Willowbrook at 196 Street and Fraser Highway (due 2029).',
        ]],
      ],
      confirm: [
        'The Township\'s permit fee, lead time, truck route rules and oversize permit terms, which sit in PDFs that were not read: Township Engineering, 604-533-6006.',
        'Whether a jib or load over a road with nothing on the ground needs a Highway Use Permit: Township Engineering, 604-533-6006.',
        'Whether the lot is inside the airport zoning, the height allowed, and how to get the crane letter: Langley Regional Airport, 604-534-7330.',
        'Whether the building permit wants a crane plan or the airport letter: Township Building Department, 604-533-6018.',
        'Which roads are provincial (Glover Road, 264 Street, parts of Fraser Highway): Township Engineering.',
      ],
    },
  },
};
