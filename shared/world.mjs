// One compact, intentionally simplified world. Node positions are in React Flow canvas coordinates.
export const SYSTEMS = [
  { id: 'climate', name: 'climate', emoji: '🌤️', category: 'nature', x: 100, y: 70, tint: 'peach', description: 'Weather patterns and temperature influence other natural systems.' },
  { id: 'power', name: 'energy', emoji: '⚡', category: 'infrastructure', x: 390, y: 38, tint: 'butter', description: 'Electricity makes modern infrastructure and businesses work.' },
  { id: 'nature', name: 'nature', emoji: '🌳', category: 'nature', x: 22, y: 250, tint: 'sage', description: 'Habitats, pollinators, and natural ecosystems.' },
  { id: 'water', name: 'water', emoji: '💧', category: 'infrastructure', x: 260, y: 216, tint: 'sky', description: 'Clean water is needed by homes, farms, and healthcare.' },
  { id: 'transport', name: 'transport', emoji: '🚗', category: 'infrastructure', x: 585, y: 222, tint: 'lilac', description: 'Roads and transport services move people and supplies.' },
  { id: 'farming', name: 'farming', emoji: '🌾', category: 'economy', x: 20, y: 452, tint: 'butter', description: 'Farms supply food and depend on water, nature, and transport.' },
  { id: 'industry', name: 'industry', emoji: '🏭', category: 'economy', x: 465, y: 416, tint: 'peach', description: 'Factories and businesses depend on energy and deliveries.' },
  { id: 'health', name: 'healthcare', emoji: '🏥', category: 'society', x: 288, y: 476, tint: 'rose', description: 'Hospitals and clinics rely on supplies and working infrastructure.' },
  { id: 'communications', name: 'comms', emoji: '📡', category: 'infrastructure', x: 685, y: 52, tint: 'sky', description: 'Networks support emergency coordination and daily life.' },
  { id: 'economy', name: 'economy', emoji: '💰', category: 'economy', x: 650, y: 470, tint: 'butter', description: 'Trade, wages, prices, and services affect everyday life.' },
  { id: 'education', name: 'schools', emoji: '🎒', category: 'society', x: 495, y: 610, tint: 'lilac', description: 'Education relies on people, transport, electricity, and communication.' },
  { id: 'people', name: 'people', emoji: '👥', category: 'society', x: 160, y: 635, tint: 'sage', description: 'Residents depend on healthcare, work, food, and essential services.' },
];

// Directed edges indicate POSSIBLE influence, never inevitable failure.
export const LINKS = [
  ['climate', 'water', 'Weather influences water supply'],
  ['climate', 'nature', 'Climate conditions influence habitats'],
  ['climate', 'farming', 'Weather affects growing conditions'],
  ['power', 'water', 'Water pumps rely on electricity'],
  ['power', 'transport', 'Signals and transit rely on electricity'],
  ['power', 'health', 'Medical equipment may depend on electricity'],
  ['power', 'industry', 'Production equipment needs power'],
  ['power', 'communications', 'Networks need energy'],
  ['nature', 'farming', 'Pollinators and soil support agriculture'],
  ['water', 'farming', 'Crops need irrigation'],
  ['water', 'health', 'Hospitals require water'],
  ['water', 'people', 'Households require clean water'],
  ['transport', 'industry', 'Goods must reach businesses'],
  ['transport', 'health', 'Patients and supplies need transport'],
  ['transport', 'economy', 'Logistics support commerce'],
  ['transport', 'education', 'Students need transportation'],
  ['industry', 'economy', 'Production contributes to commerce'],
  ['industry', 'people', 'Industry provides jobs and products'],
  ['farming', 'people', 'Farming supplies food'],
  ['farming', 'economy', 'Harvests influence trade'],
  ['health', 'people', 'Healthcare supports wellbeing'],
  ['communications', 'health', 'Coordination supports emergency services'],
  ['communications', 'education', 'Schools use communications networks'],
  ['communications', 'economy', 'Businesses depend on connectivity'],
  ['economy', 'people', 'Wages and prices affect households'],
  ['economy', 'education', 'Funding affects education'],
];

export const CAUSES = [
  { id: 'blackout', title: 'power outage', emoji: '⚡', target: 'power', tone: 'negative', description: 'The power supply suddenly fails.' },
  { id: 'drought', title: 'drought', emoji: '🌵', target: 'water', tone: 'negative', description: 'An extended drought reduces the water supply.' },
  { id: 'wildfire', title: 'forest fire', emoji: '🔥', target: 'nature', tone: 'negative', description: 'A wildfire damages nearby habitats.' },
  { id: 'strike', title: 'transport strike', emoji: '🚧', target: 'transport', tone: 'negative', description: 'Most transport services become unavailable.' },
  { id: 'discovery', title: 'new invention', emoji: '💡', target: 'industry', tone: 'positive', description: 'A low-cost technology improves factory efficiency.' },
  { id: 'signal', title: 'network failure', emoji: '📵', target: 'communications', tone: 'negative', description: 'Communication networks suddenly fail.' },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map(s => [s.id, s]));
export const EDGE_LIST = LINKS.map(([source, target, relation]) => ({ id: `${source}-${target}`, source, target, relation }));
