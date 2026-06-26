const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      providers: [
        {
          id: 'p1',
          name: 'The Cut Lounge',
          category: 'Beauty',
          location: 'Beaconsfield',
          coordinates: { lat: -28.7425, lng: 24.7708 },
          rating: 4.9,
          priceRange: 'R120-R260',
          availability: ['Open now', 'Walk-ins'],
          activity: 88,
          promotion: true,
          featured: true,
          description: 'Precision cuts, grooming, and same-day styling in the Beaconsfield area.',
          bio: 'A locally loved barbershop and beauty studio focused on quality service and quick booking.',
          images: ['✂️', '🪒'],
          reviews: 214,
          actionType: 'whatsapp',
          whatsapp: 'https://wa.me/27551234567?text=Hi%20I%20would%20like%20to%20book%20a%20service',
          tags: ['barber', 'haircut', 'styling', 'beauty', 'grooming'],
          serviceList: ['Haircuts', 'Beard trims', 'Styling'],
          profileCompleteness: 92,
          responseSpeed: 4,
          verified: true
        },
        {
          id: 'p2',
          name: 'Ritchie Learning Hub',
          category: 'Learning',
          location: 'Ritchie',
          coordinates: { lat: -28.7361, lng: 24.7854 },
          rating: 4.7,
          priceRange: 'R80-R180',
          availability: ['Today', 'Online'],
          activity: 71,
          promotion: false,
          featured: false,
          description: 'Homework help, maths support, and exam prep for local students.',
          bio: 'Friendly tutors helping learners build confidence in school and university prep.',
          images: ['📚', '🧠'],
          reviews: 132,
          actionType: 'quote',
          tags: ['tutor', 'learning', 'math', 'homework', 'exam'],
          serviceList: ['Math support', 'Exam prep', 'Homework help'],
          profileCompleteness: 86,
          responseSpeed: 3,
          verified: true
        },
        {
          id: 'p3',
          name: 'Fix-It Quick Plumbing',
          category: 'Home',
          location: 'Kimberley CBD',
          coordinates: { lat: -28.7395, lng: 24.7631 },
          rating: 4.8,
          priceRange: 'R180-R420',
          availability: ['Open late', 'Emergency'],
          activity: 92,
          promotion: true,
          featured: false,
          description: 'Fast repairs for leaks, installs, and drain clearing around Kimberley.',
          bio: 'Reliable plumbers with transparent pricing and thorough workmanship.',
          images: ['🛠️', '🚿'],
          reviews: 188,
          actionType: 'whatsapp',
          whatsapp: 'https://wa.me/27559876543?text=Hi%20I%20need%20a%20plumber%20for%20an%20urgent%20repair',
          tags: ['plumber', 'repair', 'home', 'urgent', 'drain'],
          serviceList: ['Leak repair', 'Drain clearance', 'Installations'],
          profileCompleteness: 94,
          responseSpeed: 5,
          verified: true
        },
        {
          id: 'p4',
          name: 'Galeshewe Community Music',
          category: 'Events',
          location: 'Galeshewe',
          coordinates: { lat: -28.7482, lng: 24.7815 },
          rating: 4.6,
          priceRange: 'R50-R150',
          availability: ['This week', 'Live events'],
          activity: 76,
          promotion: false,
          featured: false,
          description: 'Community music nights, youth showcases, and local entertainment bookings.',
          bio: 'An events-led business bringing music and culture closer to the community.',
          images: ['🎶', '🎤'],
          reviews: 94,
          actionType: 'quote',
          tags: ['music', 'events', 'community', 'live'],
          serviceList: ['Live shows', 'Community events', 'Bookings'],
          profileCompleteness: 79,
          responseSpeed: 3,
          verified: false
        }
      ],
      events: [
        {
          id: 'e1',
          title: 'Sunset Jazz Walk',
          category: 'Events',
          location: 'Kimberley CBD',
          coordinates: { lat: -28.7395, lng: 24.7631 },
          date: 'Today',
          time: '6:30 PM',
          organizer: 'Harbor Sounds',
          description: 'A neighborhood music crawl with food stalls and local performers.',
          tags: ['music', 'community', 'night']
        },
        {
          id: 'e2',
          title: 'Ritchie Community Market',
          category: 'Events',
          location: 'Ritchie',
          coordinates: { lat: -28.7361, lng: 24.7854 },
          date: 'This Week',
          time: 'Saturday · 11 AM',
          organizer: 'Local Makers Collective',
          description: 'Live workshops, handmade goods, and family-friendly demos.',
          tags: ['market', 'community', 'family']
        },
        {
          id: 'e3',
          title: 'Beaconsfield Night Market',
          category: 'Events',
          location: 'Beaconsfield',
          coordinates: { lat: -28.7425, lng: 24.7708 },
          date: 'Today',
          time: '7:00 PM',
          organizer: 'Beacon Eats',
          description: 'Food, music, and a casual evening of community networking.',
          tags: ['food', 'music', 'night']
        }
      ],
      leads: [],
      views: {}
    };
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/providers', (req, res) => {
  const data = readData();
  const { q = '', category = 'All', location = 'Any', radiusKm = 20, lat, lng } = req.query;
  const userCoords = lat && lng ? { lat: Number(lat), lng: Number(lng) } : { lat: -28.741, lng: 24.77 };
  const query = String(q).toLowerCase();
  let matches = data.providers.filter((provider) => {
    const matchesCategory = category === 'All' || provider.category === category;
    const matchesLocation = location === 'Any' || provider.location === location;
    const matchesQuery = !query || [provider.name, provider.category, provider.description, provider.bio, provider.location, ...(provider.tags || []), ...(provider.serviceList || [])].join(' ').toLowerCase().includes(query);
    return matchesCategory && matchesLocation && matchesQuery;
  });

  matches = matches.map((provider) => ({
    ...provider,
    distanceKm: calculateDistanceKm(userCoords, provider.coordinates || { lat: -28.741, lng: 24.77 }),
    distanceDisplay: formatDistance(calculateDistanceKm(userCoords, provider.coordinates || { lat: -28.741, lng: 24.77 }))
  })).filter((provider) => provider.distanceKm <= Number(radiusKm));

  matches.sort((a, b) => getProfileScore(b) - getProfileScore(a));
  res.json(matches);
});

app.get('/api/events', (req, res) => {
  const data = readData();
  const { q = '', category = 'All', location = 'Any', timeFilter = 'Today', lat, lng } = req.query;
  const query = String(q).toLowerCase();
  const userCoords = lat && lng ? { lat: Number(lat), lng: Number(lng) } : { lat: -28.741, lng: 24.77 };
  let events = data.events.filter((event) => {
    const matchesCategory = category === 'All' || event.category === category;
    const matchesLocation = location === 'Any' || event.location === location;
    const matchesQuery = !query || [event.title, event.description, event.organizer, event.location, ...(event.tags || [])].join(' ').toLowerCase().includes(query);
    const matchesTime = timeFilter === 'Any' || event.date === timeFilter || (timeFilter === 'Today' && event.date === 'Today');
    return matchesCategory && matchesLocation && matchesQuery && matchesTime;
  });

  events = events.map((event) => ({
    ...event,
    distanceKm: calculateDistanceKm(userCoords, event.coordinates || { lat: -28.741, lng: 24.77 }),
    distanceDisplay: formatDistance(calculateDistanceKm(userCoords, event.coordinates || { lat: -28.741, lng: 24.77 }))
  })).sort((a, b) => a.distanceKm - b.distanceKm);

  res.json(events);
});

app.post('/api/providers', (req, res) => {
  const data = readData();
  const provider = {
    id: `p${Date.now()}`,
    ...req.body,
    promotion: false,
    featured: false,
    reviews: 0,
    profileCompleteness: 88,
    responseSpeed: 4,
    verified: false,
    tags: [String(req.body.serviceType || req.body.category || 'service').toLowerCase()],
    serviceList: [String(req.body.serviceType || 'Service')]
  };
  data.providers.unshift(provider);
  saveData(data);
  res.status(201).json(provider);
});

app.post('/api/leads', (req, res) => {
  const data = readData();
  const lead = {
    id: `lead-${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString()
  };
  data.leads.push(lead);
  saveData(data);
  res.status(201).json(lead);
});

app.post('/api/providers/:id/view', (req, res) => {
  const data = readData();
  const provider = data.providers.find((item) => item.id === req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  data.views[provider.id] = (data.views[provider.id] || 0) + 1;
  saveData(data);
  res.json({ ok: true, views: data.views[provider.id] });
});

app.put('/api/providers/:id', (req, res) => {
  const data = readData();
  const provider = data.providers.find((item) => item.id === req.params.id);
  if (!provider) return res.status(404).json({ error: 'Provider not found' });
  Object.assign(provider, req.body);
  saveData(data);
  res.json(provider);
});

app.get('/api/analytics', (_req, res) => {
  const data = readData();
  const totalLeads = data.leads.length;
  const whatsappClicks = data.leads.filter((lead) => lead.channel === 'whatsapp').length;
  const quoteRequests = data.leads.filter((lead) => lead.channel === 'quote').length;
  const boostedListings = data.providers.filter((provider) => provider.promotion || provider.featured).length;
  const profileViews = Object.values(data.views).reduce((sum, value) => sum + value, 0);
  const searchAppearances = Math.max(8, profileViews + quoteRequests + whatsappClicks);
  res.json({ totalLeads, whatsappClicks, quoteRequests, boostedListings, profileViews, searchAppearances, conversionEstimate: totalLeads ? Math.round((quoteRequests / totalLeads) * 100) : 0 });
});

app.listen(PORT, () => console.log(`LocalLink backend listening on http://127.0.0.1:${PORT}`));

function calculateDistanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function formatDistance(distanceKm) {
  return `${distanceKm.toFixed(1)} km`;
}

function getProfileScore(provider) {
  const distanceKm = provider.distanceKm || 0;
  const proximityScore = Math.max(0, 120 - distanceKm * 6);
  const ratingScore = provider.rating * 16;
  const completenessScore = provider.profileCompleteness * 0.5;
  const responseScore = provider.responseSpeed * 8;
  const activityScore = provider.activity * 0.25;
  const boostScore = provider.promotion ? 22 : 0;
  const featuredScore = provider.featured ? 24 : 0;
  return proximityScore + ratingScore + completenessScore + responseScore + activityScore + boostScore + featuredScore;
}
