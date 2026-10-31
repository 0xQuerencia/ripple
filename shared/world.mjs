// The canonical world: 55 systems in 12 areas, joined by directed links.
// A link means "a change here can plausibly reach there". It is a possibility, never a certainty.

export const DOMAINS = [
  { id: "energy", name: "energy", color: "#ecd878", col: 0, row: 0 },
  {
    id: "environment",
    name: "nature & climate",
    color: "#8fd68a",
    col: 1,
    row: 0,
  },
  { id: "food", name: "food", color: "#e6c874", col: 2, row: 0 },
  { id: "health", name: "health", color: "#e49a94", col: 3, row: 0 },
  { id: "transport", name: "getting around", color: "#86a6e6", col: 0, row: 1 },
  { id: "tech", name: "tech & internet", color: "#b38be0", col: 1, row: 1 },
  { id: "finance", name: "money & work", color: "#ecc678", col: 2, row: 1 },
  { id: "society", name: "everyday life", color: "#e49ac8", col: 3, row: 1 },
  { id: "industry", name: "industry", color: "#dcaa85", col: 0, row: 2 },
  { id: "government", name: "government", color: "#9fb0c8", col: 1, row: 2 },
  { id: "safety", name: "safety & law", color: "#e0a98a", col: 2, row: 2 },
  { id: "knowledge", name: "learning", color: "#9aa8ee", col: 3, row: 2 },
];

// id, name, domain, description, aliases (extra words that point at this system)
const S = (id, name, domain, description, aliases = "") => ({
  id,
  name,
  domain,
  description,
  aliases,
});

const RAW_SYSTEMS = [
  S(
    "power",
    "power grid",
    "energy",
    "The electricity grid that lights homes and quietly runs almost everything else.",
    "electricity blackout electric energy",
  ),
  S(
    "renewables",
    "solar & wind",
    "energy",
    "Wind farms and solar panels, plus the batteries that smooth out their ups and downs.",
    "solar wind battery green clean",
  ),
  S(
    "fuel",
    "oil & gas",
    "energy",
    "Petrol, diesel and gas, and the pipelines and tankers that carry them.",
    "petrol diesel gasoline pipeline opec",
  ),

  S(
    "climate",
    "climate",
    "environment",
    "Weather and long-term temperature patterns.",
    "weather heat storm flood temperature warming",
  ),
  S(
    "nature",
    "wildlife & forests",
    "environment",
    "Habitats, pollinators, forests and the animals that live in them.",
    "animals bees trees forest wildfire fire",
  ),
  S(
    "water",
    "water supply",
    "environment",
    "Reservoirs, pumps and pipes that bring clean water to homes, farms and hospitals.",
    "drought tap reservoir flood",
  ),
  S(
    "air",
    "air quality",
    "environment",
    "How clean or smoggy the air is where people live and breathe.",
    "smog pollution smoke",
  ),
  S(
    "oceans",
    "oceans",
    "environment",
    "Seas, coasts and the currents that shape weather.",
    "sea tsunami coast",
  ),
  S(
    "waste",
    "waste & recycling",
    "environment",
    "Rubbish collection, recycling and landfills.",
    "rubbish garbage plastic trash",
  ),

  S(
    "farming",
    "farming",
    "food",
    "Farms that grow crops and raise animals.",
    "crops harvest livestock",
  ),
  S(
    "food",
    "food supply",
    "food",
    "Warehouses, supermarkets and the cold chain that keep shelves stocked.",
    "supermarket groceries famine",
  ),
  S(
    "restaurants",
    "restaurants",
    "food",
    "Cafes, takeaways and canteens that feed people away from home.",
    "cafe cafes takeaway chef",
  ),
  S(
    "fisheries",
    "fishing",
    "food",
    "Fishing fleets, fish farms and the seafood trade.",
    "fish seafood",
  ),

  S(
    "health",
    "hospitals",
    "health",
    "Hospitals and clinics that treat the sick and injured.",
    "doctors nurses clinic patients",
  ),
  S(
    "pharma",
    "medicine",
    "health",
    "Drug makers, pharmacies and the supply of medicines and vaccines.",
    "drugs vaccine pharmacy",
  ),
  S(
    "publichealth",
    "public health",
    "health",
    "Disease tracking, vaccination programmes and sanitation.",
    "pandemic virus disease outbreak epidemic flu",
  ),
  S(
    "mental",
    "mental health",
    "health",
    "Wellbeing, stress, loneliness and the support around them.",
    "stress anxiety lonely wellbeing",
  ),

  S(
    "transport",
    "roads & traffic",
    "transport",
    "Roads, buses, cars and traffic signals.",
    "cars traffic roads buses strike",
  ),
  S(
    "rail",
    "trains",
    "transport",
    "Railways, metros and trams.",
    "railway metro subway tram",
  ),
  S(
    "aviation",
    "air travel",
    "transport",
    "Airlines, airports and air traffic control.",
    "planes flights airport airline",
  ),
  S(
    "shipping",
    "ports & shipping",
    "transport",
    "Cargo ships, ports and canals that move most of the world's goods.",
    "ships cargo port canal",
  ),
  S(
    "logistics",
    "delivery",
    "transport",
    "Trucks, warehouses and couriers that get goods from A to B.",
    "trucks couriers parcels amazon",
  ),

  S(
    "communications",
    "phones & internet",
    "tech",
    "Mobile networks, broadband and the cables behind them.",
    "wifi network phone mobile broadband online",
  ),
  S(
    "datacenters",
    "data centres",
    "tech",
    "Giant computer halls that run websites, apps and cloud services.",
    "cloud servers",
  ),
  S(
    "cyber",
    "cybersecurity",
    "tech",
    "The people and tools that defend computers and networks from attacks.",
    "security antivirus firewall defenders password passwords encryption",
  ),
  S(
    "software",
    "software & apps",
    "tech",
    "Apps, operating systems and the developers who build them.",
    "app apps code programmers developers",
  ),
  S(
    "ai",
    "AI",
    "tech",
    "Machine-learning systems, and the companies and chips behind them.",
    "robots chatbot gpt automation",
  ),
  S(
    "social",
    "social media",
    "tech",
    "Platforms where people chat, share and argue.",
    "tiktok instagram twitter facebook influencer",
  ),
  S(
    "chips",
    "chips & electronics",
    "tech",
    "Factories and supply chains for computer chips and gadgets.",
    "semiconductor electronics gadgets",
  ),

  S(
    "economy",
    "economy",
    "finance",
    "Trade, wages, prices and services that affect everyday life.",
    "recession inflation gdp trade",
  ),
  S(
    "banks",
    "banks & credit",
    "finance",
    "Banks, loans, savings and card payments.",
    "money loans mortgage credit",
  ),
  S(
    "markets",
    "stock markets",
    "finance",
    "Where shares are traded and investors set prices for companies.",
    "stocks shares crash investors crypto",
  ),
  S(
    "jobs",
    "jobs & wages",
    "finance",
    "Employment, pay and the daily commute to work.",
    "work unemployment salary layoffs",
  ),
  S(
    "business",
    "small businesses",
    "finance",
    "Local shops, startups and the people who run them.",
    "startup startups shop owners",
  ),
  S(
    "prices",
    "cost of living",
    "finance",
    "Prices of food, fuel, rent and everything else people buy.",
    "inflation expensive cheap rent",
  ),
  S(
    "retail",
    "shops & retail",
    "finance",
    "High streets, malls and online stores.",
    "stores shopping mall amazon",
  ),

  S(
    "people",
    "people",
    "society",
    "Households and communities.",
    "humans families everyone society",
  ),
  S(
    "housing",
    "housing",
    "society",
    "Homes, rent and the building trade that supplies them.",
    "homes houses rent landlords",
  ),
  S(
    "culture",
    "arts & sport",
    "society",
    "Music, film, games, festivals and sport.",
    "music movies games football festival art",
  ),
  S(
    "media",
    "news & media",
    "society",
    "Newspapers, TV and the way people find out what is happening.",
    "news tv journalists press",
  ),
  S(
    "trust",
    "public trust",
    "society",
    "How much people trust each other, experts and institutions.",
    "misinformation confidence",
  ),

  S(
    "industry",
    "factories",
    "industry",
    "Factories and businesses that make things.",
    "manufacturing factory production invention",
  ),
  S(
    "construction",
    "construction",
    "industry",
    "Builders, cement, cranes and roadworks.",
    "building builders cement",
  ),
  S(
    "mining",
    "mining & materials",
    "industry",
    "Mines, metals and raw materials.",
    "metal lithium coal minerals",
  ),

  S(
    "governance",
    "government",
    "government",
    "National and local leaders and the public services they run.",
    "politicians president policy law ministers",
  ),
  S(
    "elections",
    "elections",
    "government",
    "Voting, campaigns and who ends up in charge.",
    "vote voting campaign",
  ),
  S(
    "budget",
    "public money",
    "government",
    "Taxes and the budgets that fund schools, hospitals and roads.",
    "tax taxes spending funding",
  ),
  S(
    "diplomacy",
    "world affairs",
    "government",
    "Trade deals, alliances and relations between countries.",
    "war sanctions treaty countries",
  ),

  S(
    "crime",
    "crime",
    "safety",
    "Theft, fraud, violence and the gangs behind them.",
    "thieves gangs fraud theft criminals",
  ),
  S(
    "law",
    "police & courts",
    "safety",
    "Police, courts and the justice system.",
    "police courts justice judges",
  ),
  S(
    "military",
    "defence",
    "safety",
    "Armed forces and national security.",
    "army navy soldiers war weapons",
  ),
  S(
    "emergency",
    "emergency services",
    "safety",
    "Ambulance, fire and rescue crews.",
    "firefighters ambulance rescue 911 999",
  ),

  S(
    "education",
    "schools",
    "knowledge",
    "Teachers, classrooms and the children who fill them.",
    "teachers students classroom children",
  ),
  S(
    "universities",
    "universities",
    "knowledge",
    "Higher education and student life.",
    "college students campus",
  ),
  S(
    "research",
    "science",
    "knowledge",
    "Labs and researchers who invent new things.",
    "scientists lab discovery invention",
  ),
  S(
    "cybercrime",
    "hackers & scams",
    "safety",
    "Hackers, scammers and ransomware gangs who attack computers and trick people online.",
    "hackers hacker hacking ransomware malware scam scams scammers phishing attack cyberattack",
  ),
];

// [source>target, why a change at the source can reach the target]
const RAW_LINKS = [
  // the original 26
  ["climate>water", "Weather influences water supply"],
  ["climate>nature", "Climate conditions influence habitats"],
  ["climate>farming", "Weather affects growing conditions"],
  ["power>water", "Water pumps rely on electricity"],
  ["power>transport", "Signals and transit rely on electricity"],
  ["power>health", "Medical equipment may depend on electricity"],
  ["power>industry", "Production equipment needs power"],
  ["power>communications", "Networks need energy"],
  ["nature>farming", "Pollinators and soil support agriculture"],
  ["water>farming", "Crops need irrigation"],
  ["water>health", "Hospitals require water"],
  ["water>people", "Households require clean water"],
  ["transport>industry", "Goods must reach businesses"],
  ["transport>health", "Patients and supplies need transport"],
  ["transport>economy", "Logistics support commerce"],
  ["transport>education", "Students need transportation"],
  ["industry>economy", "Production contributes to commerce"],
  ["industry>people", "Industry provides jobs and products"],
  ["farming>people", "Farming supplies food"],
  ["farming>economy", "Harvests influence trade"],
  ["health>people", "Healthcare supports wellbeing"],
  ["communications>health", "Coordination supports emergency services"],
  ["communications>education", "Schools use communications networks"],
  ["communications>economy", "Businesses depend on connectivity"],
  ["economy>people", "Wages and prices affect households"],
  ["economy>education", "Funding affects education"],

  // energy
  ["renewables>power", "Wind and solar feed the grid"],
  ["fuel>power", "Gas plants burn fuel to make electricity"],
  ["fuel>transport", "Vehicles run on fuel"],
  ["fuel>aviation", "Jets burn kerosene"],
  ["fuel>shipping", "Ships burn heavy fuel"],
  ["fuel>prices", "Fuel costs feed into prices"],
  ["fuel>industry", "Factories burn fuel for heat"],
  ["fuel>air", "Burning fuel pollutes the air"],
  ["fuel>farming", "Tractors and fertiliser rely on fuel"],
  ["renewables>climate", "Clean power cuts emissions"],
  ["power>datacenters", "Servers need constant electricity"],
  ["power>rail", "Electric trains draw from the grid"],
  ["power>retail", "Shops need lights and tills"],
  ["power>housing", "Homes need power for heat and light"],
  ["power>emergency", "Dispatch centres and stations need power"],
  ["power>banks", "Banks and cash machines need power"],
  ["power>waste", "Treatment and sorting plants run on power"],
  ["power>food", "Fridges and cold stores need electricity"],
  ["power>restaurants", "Kitchens need power"],
  ["power>pharma", "Drug factories and fridges need power"],
  ["power>education", "Schools need lights and computers"],

  // nature and climate
  ["climate>oceans", "Warming changes sea levels and currents"],
  ["climate>air", "Heat and still weather trap smog"],
  ["climate>fisheries", "Warmer seas move fish stocks"],
  ["climate>publichealth", "Heatwaves and floods affect health"],
  ["climate>housing", "Floods and storms damage homes"],
  ["climate>renewables", "Wind and sun levels set the output"],
  ["nature>climate", "Forests soak up carbon"],
  ["nature>air", "Trees clean the air"],
  ["nature>water", "Wetlands and forests filter water"],
  ["oceans>fisheries", "Healthy seas mean more fish"],
  ["oceans>shipping", "Sea conditions affect ships"],
  ["oceans>climate", "Oceans store heat and carbon"],
  ["water>publichealth", "Clean water prevents disease"],
  ["water>restaurants", "Kitchens need clean water"],
  ["water>industry", "Factories use water to cool and clean"],
  ["water>power", "Hydro and cooling plants use water"],
  ["air>health", "Dirty air sends people to hospital"],
  ["waste>water", "Poor waste handling pollutes water"],
  ["waste>publichealth", "Rubbish piles attract disease"],
  ["waste>nature", "Litter harms wildlife"],
  ["transport>waste", "Trucks collect the rubbish"],
  ["transport>air", "Traffic exhaust pollutes the air"],

  // food
  ["farming>food", "Harvests stock the shelves"],
  ["farming>nature", "Farming reshapes habitats"],
  ["food>restaurants", "Restaurants buy ingredients"],
  ["food>people", "People rely on shops for food"],
  ["food>prices", "Food shortages raise prices"],
  ["fisheries>food", "Seafood joins the food supply"],
  ["restaurants>jobs", "Restaurants employ many people"],
  ["shipping>food", "Imports arrive by ship"],
  ["logistics>food", "Trucks keep shelves full"],
  ["mining>farming", "Fertiliser comes from mined minerals"],

  // health
  ["emergency>health", "Ambulances bring patients to hospital"],
  ["mental>health", "Distress fills clinics"],
  ["pharma>health", "Hospitals rely on medicine supplies"],
  ["pharma>publichealth", "Vaccines protect communities"],
  ["publichealth>health", "Outbreaks fill hospitals"],
  ["publichealth>jobs", "Illness keeps people from work"],
  ["mental>jobs", "Stress causes missed work"],
  ["mental>education", "Pupils struggle when unwell"],
  ["mental>people", "Wellbeing shapes daily life"],
  ["social>mental", "Online life shapes wellbeing"],
  ["health>budget", "Hospitals are a big public cost"],
  ["research>pharma", "Research produces new medicines"],
  ["chips>health", "Medical devices run on chips"],
  ["industry>pharma", "Factories make drugs"],
  ["logistics>pharma", "Medicine needs fast, cold delivery"],
  ["aviation>publichealth", "Planes carry diseases around the world"],

  // getting around
  ["transport>logistics", "Trucks use the roads"],
  ["transport>jobs", "People commute by road"],
  ["transport>emergency", "Ambulances need clear roads"],
  ["rail>transport", "Trains take cars off the road"],
  ["rail>jobs", "Commuters ride trains"],
  ["rail>logistics", "Freight trains carry cargo"],
  ["aviation>economy", "Air travel drives trade and tourism"],
  ["aviation>logistics", "Air freight moves urgent goods"],
  ["shipping>logistics", "Ports hand cargo to trucks and trains"],
  ["shipping>prices", "Shipping costs feed into prices"],
  ["shipping>industry", "Ships bring parts and materials"],
  ["logistics>business", "Small firms rely on couriers"],
  ["logistics>retail", "Deliveries stock the shops"],
  ["logistics>industry", "Factories get parts by truck"],
  ["communications>logistics", "Tracking and routing use networks"],
  ["chips>transport", "Modern vehicles need chips"],

  // tech and internet
  ["communications>social", "Social media needs connectivity"],
  ["communications>media", "News travels over networks"],
  ["communications>banks", "Card payments and apps need networks"],
  ["communications>emergency", "Emergency calls use phone networks"],
  ["communications>jobs", "Remote work needs the internet"],
  ["communications>business", "Shops sell online"],
  ["communications>retail", "Online shopping needs the internet"],
  ["communications>military", "Command systems use networks"],
  ["datacenters>communications", "Networks connect through data centres"],
  ["datacenters>software", "Apps run in the cloud"],
  ["datacenters>ai", "AI models train in data centres"],
  ["datacenters>banks", "Banks run on servers"],
  ["datacenters>social", "Platforms are hosted there"],
  ["datacenters>water", "Cooling uses a lot of water"],
  ["cyber>datacenters", "Weak defences let attacks knock servers offline"],
  ["cyber>banks", "Weak defences leave banks exposed"],
  ["cyber>health", "Weak defences let ransomware hit hospitals"],
  ["cyber>power", "Weak defences expose the grid"],
  ["cyber>business", "Breaches hit firms"],
  ["cyber>trust", "Breaches erode trust"],
  ["cyber>software", "Security flaws force updates"],
  ["cyber>military", "Cyber warfare is part of defence"],
  ["cyber>people", "Leaked data and scams reach ordinary people"],
  ["software>business", "Apps power modern business"],
  ["software>jobs", "Software is a big employer"],
  ["software>banks", "Banking runs on apps"],
  ["software>education", "Online learning uses software"],
  ["ai>jobs", "Automation changes jobs"],
  ["ai>media", "AI makes and moderates content"],
  ["ai>research", "AI speeds up research"],
  ["ai>cyber", "AI helps attackers and defenders"],
  ["ai>software", "AI writes and checks code"],
  ["social>media", "Platforms shape the news"],
  ["social>trust", "Arguments and rumours shape trust"],
  ["social>elections", "Campaigns run online"],
  ["social>culture", "Trends spread online"],
  ["social>business", "Influencers drive sales"],
  ["chips>ai", "AI needs chips"],
  ["chips>datacenters", "Servers need chips"],
  ["mining>chips", "Chips need rare metals"],

  // money and work
  ["economy>jobs", "A strong economy creates jobs"],
  ["economy>budget", "Growth fills the tax pot"],
  ["economy>housing", "Wages decide who can afford a home"],
  ["banks>business", "Banks lend to businesses"],
  ["banks>housing", "Mortgages and rent depend on credit"],
  ["banks>markets", "Banks and markets are tightly linked"],
  ["banks>economy", "Credit drives spending"],
  ["markets>economy", "Share prices shape confidence"],
  ["markets>business", "Companies raise money in markets"],
  ["markets>people", "Savings and pensions depend on markets"],
  ["jobs>people", "Wages pay the bills"],
  ["jobs>economy", "Workers spend their pay"],
  ["business>jobs", "Small firms employ most workers"],
  ["business>economy", "Small firms drive local trade"],
  ["business>retail", "Retail is full of small firms"],
  ["prices>people", "Rising prices squeeze households"],
  ["prices>elections", "Cost of living swings votes"],
  ["prices>mental", "Money worries weigh on people"],
  ["prices>crime", "Hardship can raise theft"],
  ["retail>jobs", "Shops employ many people"],
  ["retail>economy", "Shopping fuels the economy"],

  // industry
  ["industry>jobs", "Factories employ workers"],
  ["industry>air", "Factories emit pollution"],
  ["industry>waste", "Factories create waste"],
  ["construction>housing", "Builders make homes"],
  ["construction>jobs", "Building employs many"],
  ["construction>transport", "Roadworks and new roads"],
  ["mining>construction", "Cement and steel for building"],
  ["mining>industry", "Factories use raw materials"],
  ["mining>nature", "Mines scar habitats"],

  // everyday life
  ["people>economy", "People are customers and workers"],
  ["housing>people", "Where and how people live"],
  ["culture>mental", "Music and sport lift mood"],
  ["culture>economy", "Festivals and sport bring spending"],
  ["media>trust", "News shapes trust"],
  ["media>elections", "Voters get information from media"],
  ["trust>elections", "Trust decides who people vote for"],
  ["trust>governance", "Trust gives leaders legitimacy"],
  ["trust>publichealth", "People follow health advice if they trust it"],

  // government
  ["governance>budget", "Governments set taxes"],
  ["governance>law", "Laws are made by governments"],
  ["governance>military", "Governments direct defence"],
  ["elections>governance", "Elections change leaders"],
  ["budget>health", "Budgets fund hospitals"],
  ["budget>education", "Budgets fund schools"],
  ["budget>transport", "Budgets fund roads and trains"],
  ["budget>research", "Grants fund science"],
  ["budget>emergency", "Funds fire and ambulance crews"],
  ["budget>law", "Funds police and courts"],
  ["diplomacy>shipping", "Trade deals open ports"],
  ["diplomacy>economy", "Trade relations shape the economy"],
  ["diplomacy>fuel", "Politics sets oil and gas supply"],
  ["military>diplomacy", "Defence strength shapes diplomacy"],

  // safety and law
  ["crime>trust", "Crime erodes trust"],
  ["crime>business", "Theft hits shops"],
  ["crime>law", "Crime fills police time"],
  ["law>crime", "Policing deters crime"],
  ["law>trust", "Fair courts build trust"],
  ["law>business", "Courts enforce contracts"],
  ["emergency>people", "Rescue crews protect lives"],
  ["military>emergency", "Armed forces help in disasters"],
  ["military>industry", "Defence orders keep factories busy"],
  ["military>research", "Defence funds research"],

  // learning
  ["education>jobs", "Skills decide who gets hired"],
  ["education>research", "Students become researchers"],
  ["universities>research", "Universities do research"],
  ["universities>jobs", "Graduates fill jobs"],
  ["research>ai", "Research builds AI"],
  ["research>industry", "Inventions improve factories"],
  ["research>health", "Medical breakthroughs reach patients"],
  ["research>renewables", "Better batteries and panels"],
  // hackers and scams
  ["cybercrime>cyber", "Attackers keep defenders busy"],
  ["cybercrime>banks", "Fraud and theft hit banks"],
  ["cybercrime>people", "Scams target ordinary people"],
  ["cybercrime>business", "Ransomware and breaches hit firms"],
  ["cybercrime>health", "Ransomware locks up hospitals"],
  ["cybercrime>datacenters", "Attacks knock servers offline"],
  ["cybercrime>power", "Attacks on the grid"],
  ["cybercrime>trust", "Breaches and scams erode trust"],
  ["cybercrime>law", "Cases pile up for police and courts"],
  ["cybercrime>communications", "Attacks disrupt networks"],
  ["crime>cybercrime", "Criminal gangs move online"],
  ["ai>cybercrime", "AI makes scams and attacks easier"],
  ["cybercrime>jobs", "Security and recovery work employs many"],
];

// Layout: each area is a small block on a grid, so related systems sit together on the map.
const AREA = { w: 470, h: 450 };
const CELL = { w: 132, h: 136 };

function layout(systems) {
  const byDomain = new Map(DOMAINS.map((d) => [d.id, []]));
  for (const system of systems) byDomain.get(system.domain).push(system);
  const placed = [];
  for (const domain of DOMAINS) {
    const members = byDomain.get(domain.id);
    const columns = members.length <= 4 ? 2 : 3;
    const rows = Math.ceil(members.length / columns);
    const originX = domain.col * AREA.w + (AREA.w - columns * CELL.w) / 2;
    const originY =
      domain.row * AREA.h + 74 + (AREA.h - 74 - rows * CELL.h) / 4;
    members.forEach((system, i) => {
      // a little hand-placed wobble so blocks do not look like spreadsheets
      const wobble = [
        [0, 0],
        [10, 14],
        [-8, 6],
        [6, -8],
        [-4, 12],
        [12, 2],
      ][i % 6];
      placed.push({
        ...system,
        x: Math.round(originX + (i % columns) * CELL.w + wobble[0]),
        y: Math.round(originY + Math.floor(i / columns) * CELL.h + wobble[1]),
      });
    });
  }
  return systems.map((system) => placed.find((p) => p.id === system.id));
}

export const SYSTEMS = layout(RAW_SYSTEMS);
export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

/** Where each area's title sits on the map. */
export const DOMAIN_LABELS = DOMAINS.map((domain) => {
  const members = SYSTEMS.filter((s) => s.domain === domain.id);
  return {
    ...domain,
    x: Math.min(...members.map((s) => s.x)),
    y: Math.min(...members.map((s) => s.y)) - 62,
  };
});

// Directed edges indicate POSSIBLE influence, never inevitable failure.
export const LINKS = RAW_LINKS.map(([pair, relation]) => {
  const [source, target] = pair.split(">");
  return [source, target, relation];
});

export const CAUSES = [
  {
    id: "blackout",
    title: "power outage",
    target: "power",
    tone: "negative",
    description: "The power supply suddenly fails.",
  },
  {
    id: "drought",
    title: "drought",
    target: "water",
    tone: "negative",
    description: "An extended drought reduces the water supply.",
  },
  {
    id: "wildfire",
    title: "forest fire",
    target: "nature",
    tone: "negative",
    description: "A wildfire damages nearby habitats.",
  },
  {
    id: "strike",
    title: "transport strike",
    target: "transport",
    tone: "negative",
    description: "Most transport services become unavailable.",
  },
  {
    id: "discovery",
    title: "new invention",
    target: "industry",
    tone: "positive",
    description: "A low-cost technology improves factory efficiency.",
  },
  {
    id: "signal",
    title: "network failure",
    target: "communications",
    tone: "negative",
    description: "Communication networks suddenly fail.",
  },
  {
    id: "cyberattack",
    title: "ransomware attack",
    target: "cybercrime",
    tone: "negative",
    description: "A criminal gang locks up computer systems and demands money.",
  },
  {
    id: "pandemic",
    title: "new virus",
    target: "publichealth",
    tone: "negative",
    description: "A fast-spreading illness appears.",
  },
  {
    id: "crash",
    title: "market crash",
    target: "markets",
    tone: "negative",
    description: "Share prices plunge in a single week.",
  },
  {
    id: "heatwave",
    title: "record heatwave",
    target: "climate",
    tone: "negative",
    description: "Temperatures stay far above normal for weeks.",
  },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
export const EDGE_LIST = LINKS.map(([source, target, relation]) => ({
  id: `${source}-${target}`,
  source,
  target,
  relation,
}));
