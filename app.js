const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:3000/api'
  : `http://${window.location.hostname}:3000/api`;
const DEFAULT_COORDS = { lat: -28.741, lng: 24.77 };

let leafletMapInstance = null;

function getCoordinatesForLocation(locationName) {
  const normalized = String(locationName || '').trim().toLowerCase();
  const locationMap = {
    'kimberley cbd': [-28.741, 24.77],
    beaconsfield: [-28.732, 24.757],
    galeshewe: [-28.759, 24.79],
    ritchie: [-28.765, 24.744],
    greenpoint: [-28.715, 24.753]
  };
  return locationMap[normalized] ? { lat: locationMap[normalized][0], lng: locationMap[normalized][1] } : null;
}

let state = {
  providers: [],
  events: [],
  leads: [],
  activeView: 'home',
  selectedProviderId: null,
  searchQuery: '',
  category: 'All',
  location: 'Any',
  timeFilter: 'Today',
  lastLeadMessage: '',
  onboardingComplete: false,
  showOnboardingSuccess: false,
  userLocation: null,
  userLocationStatus: 'checking',
  radiusKm: 20,
  currentRadiusUsed: 20,
  searchSummary: 'Detecting your location and loading nearby services...',
  analytics: {}
};

async function init() {
  bindEvents();
  render();
  await loadBackendData();
  requestUserLocation();
}

async function loadBackendData() {
  try {
    const [providersRes, eventsRes, analyticsRes] = await Promise.all([
      fetch(`${API_BASE}/providers?lat=${DEFAULT_COORDS.lat}&lng=${DEFAULT_COORDS.lng}&radiusKm=20`),
      fetch(`${API_BASE}/events?lat=${DEFAULT_COORDS.lat}&lng=${DEFAULT_COORDS.lng}`),
      fetch(`${API_BASE}/analytics`)
    ]);

    state.providers = await providersRes.json();
    state.events = await eventsRes.json();
    state.analytics = await analyticsRes.json();
    if (state.providers.length) state.selectedProviderId = state.providers[0].id;
    render();
  } catch (error) {
    state.searchSummary = 'Backend unavailable. Falling back to local UI.';
    render();
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeView = btn.dataset.view;
      render();
    });
  });

  document.getElementById('searchBtn').addEventListener('click', handleSearch);
  document.getElementById('searchInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  });

  document.getElementById('onboardForm').addEventListener('submit', handleOnboardSubmit);
  const enterButton = document.getElementById('enterLocalLinkBtn');
  if (enterButton) {
    enterButton.addEventListener('click', () => {
      state.activeView = 'home';
      state.showOnboardingSuccess = false;
      render();
    });
  }
  document.getElementById('categoryPills').addEventListener('click', handleCategoryClick);
  document.getElementById('providerResults').addEventListener('click', handleProviderResultsClick);
  document.getElementById('profileDetails').addEventListener('click', handleProfileDetailClick);
  document.getElementById('profileDetails').addEventListener('submit', handleQuoteSubmit);
}

function requestUserLocation() {
  if (!navigator.geolocation) {
    state.userLocationStatus = 'unsupported';
    state.searchSummary = 'Location unavailable. Showing Kimberley defaults.';
    render();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.userLocationStatus = 'ready';
      state.searchSummary = 'Live location enabled. Nearby providers are ranked by proximity.';
      render();
    },
    () => {
      state.userLocationStatus = 'denied';
      state.searchSummary = 'Location permission declined. Showing default Kimberley results.';
      render();
    }
  );
}

async function handleSearch() {
  state.searchQuery = document.getElementById('searchInput').value.trim();
  state.category = document.getElementById('categorySelect').value;
  state.location = document.getElementById('locationSelect').value;
  state.timeFilter = document.getElementById('timeSelect').value;
  state.radiusKm = 20;
  state.searchSummary = state.searchQuery
    ? `Searching for “${state.searchQuery}” within a ${state.radiusKm} km radius.`
    : `Showing nearby matches within ${state.radiusKm} km.`;
  render();
  await refreshFromBackend();
}

async function handleOnboardSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const signupLocation = formData.get('location');
  const providerPayload = {
    name: formData.get('name'),
    category: formData.get('category'),
    location: signupLocation,
    coordinates: getCoordinatesForLocation(signupLocation) || state.userLocation || DEFAULT_COORDS,
    rating: 4.8,
    priceRange: formData.get('priceRange'),
    availability: ['Fresh listing', 'New'],
    activity: 65,
    description: formData.get('description'),
    bio: formData.get('description'),
    images: ['📍'],
    actionType: formData.get('actionType'),
    whatsapp: formData.get('whatsapp') || '',
    contact: formData.get('contact'),
    email: formData.get('email'),
    serviceArea: formData.get('serviceArea'),
    serviceType: formData.get('serviceType'),
    isNew: true
  };

  try {
    const response = await fetch(`${API_BASE}/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerPayload)
    });
    const provider = await response.json();
    state.providers.unshift(provider);
    state.selectedProviderId = provider.id;
    state.onboardingComplete = true;
    state.showOnboardingSuccess = true;
    state.activeView = 'onboard';
    state.location = provider.location;
    state.searchSummary = `${provider.name} is now live on the LocalLink map.`;
    state.lastLeadMessage = `${provider.name} was added to the LocalLink discovery flow.`;
    event.currentTarget.reset();
    render();
    await refreshFromBackend();
  } catch (error) {
    state.lastLeadMessage = 'Your profile could not be saved right now.';
    render();
  }
}

function handleCategoryClick(event) {
  const pill = event.target.closest('[data-category]');
  if (!pill) return;
  state.category = pill.dataset.category;
  render();
}

async function handleProviderResultsClick(event) {
  const viewButton = event.target.closest('[data-action="view-profile"]');
  if (viewButton) {
    state.selectedProviderId = viewButton.dataset.providerId;
    await recordProviderView(viewButton.dataset.providerId);
    render();
    return;
  }

  const boostButton = event.target.closest('[data-action="boost"]');
  if (boostButton) {
    const provider = state.providers.find((item) => item.id === boostButton.dataset.providerId);
    if (provider) {
      const updatedProvider = await updateProvider(boostButton.dataset.providerId, { promotion: !provider.promotion });
      state.providers = state.providers.map((item) => (item.id === updatedProvider.id ? updatedProvider : item));
      state.lastLeadMessage = `${updatedProvider.name} ${updatedProvider.promotion ? 'is now boosted' : 'is back to organic ranking'}.`;
      render();
    }
  }
}

async function handleProfileDetailClick(event) {
  const cta = event.target.closest('[data-action="cta"]');
  if (cta) {
    const provider = state.providers.find((item) => item.id === state.selectedProviderId);
    if (!provider) return;

    if (provider.actionType === 'whatsapp' && provider.whatsapp) {
      window.open(provider.whatsapp, '_blank', 'noopener');
      await logLead({
        channel: 'whatsapp',
        providerId: provider.id,
        serviceType: provider.category
      });
      state.lastLeadMessage = `WhatsApp opened for ${provider.name}.`;
      render();
    } else {
      state.lastLeadMessage = `Quote form ready for ${provider.name}.`;
      render();
    }
  }
}

async function handleQuoteSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const providerId = event.currentTarget.dataset.providerId;
  const provider = state.providers.find((item) => item.id === providerId);
  await logLead({
    channel: 'quote',
    providerId,
    customerName: formData.get('name'),
    serviceType: formData.get('serviceType') || provider?.category || 'service'
  });
  state.lastLeadMessage = provider ? `Quote request sent to ${provider.name}.` : 'Quote request sent.';
  render();
}

function render() {
  updateNav();
  renderCategoryPills();
  renderMap();
  renderHomeView();
  renderEventsView();
  renderOnboardView();
  renderDashboardView();
  syncSearchControls();
  updateHeroHighlights();
}

function updateHeroHighlights() {
  const liveStatusText = document.getElementById('liveStatusText');
  const heroProviderCount = document.getElementById('heroProviderCount');
  const heroTimeText = document.getElementById('heroTimeText');

  if (liveStatusText) {
    const label = state.userLocationStatus === 'ready'
      ? 'Live location on'
      : state.userLocationStatus === 'denied'
        ? 'Default Kimberley view'
        : 'Locating you…';
    liveStatusText.textContent = label;
  }

  if (heroProviderCount) {
    const featuredCount = state.providers.filter((provider) => provider.promotion || provider.featured).length;
    heroProviderCount.textContent = `${state.providers.length} curated providers · ${featuredCount} featured`;
  }

  if (heroTimeText) {
    const now = new Date();
    heroTimeText.textContent = now.toLocaleTimeString('en-ZA', { hour: 'numeric', minute: '2-digit' }) + ' · local time';
  }
}

function syncSearchControls() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = state.searchQuery;
  const categorySelect = document.getElementById('categorySelect');
  if (categorySelect) categorySelect.value = state.category;
  const locationSelect = document.getElementById('locationSelect');
  if (locationSelect) locationSelect.value = state.location;
  const timeSelect = document.getElementById('timeSelect');
  if (timeSelect) timeSelect.value = state.timeFilter;
}

function updateNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.activeView);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `${state.activeView}View`);
  });
}

function renderCategoryPills() {
  const categories = ['All', 'Beauty', 'Home', 'Learning', 'Events'];
  const pills = document.getElementById('categoryPills');
  pills.innerHTML = categories.map((cat) => `
    <button class="pill ${state.category === cat ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');
}

function createLocalLinkIcon(type = 'default', label = 'LL') {
  const iconClass = type === 'focus' ? 'focus' : type === 'boost' ? 'boost' : type === 'new' ? 'new' : 'default';
  const markerHtml = `
    <div class="local-link-avatar ${iconClass}">
      <span>${label}</span>
    </div>
  `;

  return window.L.divIcon({
    html: markerHtml,
    className: 'local-link-avatar-wrapper',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -36]
  });
}

function renderMap() {
  const map = document.getElementById('kimberleyMap');
  if (!map) return;
  const locations = [
    { name: 'Kimberley CBD', coords: [-28.741, 24.77] },
    { name: 'Beaconsfield', coords: [-28.732, 24.757] },
    { name: 'Galeshewe', coords: [-28.759, 24.79] },
    { name: 'Ritchie', coords: [-28.765, 24.744] },
    { name: 'Greenpoint', coords: [-28.715, 24.753] }
  ];
  const selectedLocation = locations.find((location) => location.name === state.location) || locations[0];
  const googleMapsUrl = 'https://www.google.com/maps/@-28.7461227,24.7745017,14.85z?entry=tts&g_ep=EgoyMDI2MDYyMy4wIPu8ASoASAFQAw==&skid=e3892a41-9b27-4e2f-ab4b-b71384435c61';
  const visibleProviders = getFilteredProviders().filter((provider) => provider.coordinates?.lat && provider.coordinates?.lng);

  map.innerHTML = `
    <div class="map-frame">
      <div class="map-toolbar">
        <div>
          <strong>Live Kimberley map</strong>
          <p>Branded LocalLink pins for live listings and nearby discovery</p>
        </div>
        <div class="map-toolbar-actions">
          <a class="map-link" href="${googleMapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
          <div class="map-pill">Showing ${state.location === 'Any' ? 'Kimberley' : selectedLocation.name}</div>
        </div>
      </div>
      <div class="map-grid" id="kimberleyLeafletMap"></div>
      <div class="map-marker-list">
        ${locations.map((location) => `
          <button class="pill ${state.location === location.name ? 'active' : ''}" data-location="${location.name}">${location.name}</button>
        `).join('')}
      </div>
    </div>
  `;

  window.requestAnimationFrame(() => {
    if (!window.L || !document.getElementById('kimberleyLeafletMap')) return;

    if (leafletMapInstance) {
      leafletMapInstance.remove();
      leafletMapInstance = null;
    }

    leafletMapInstance = window.L.map('kimberleyLeafletMap', {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true
    }).setView(selectedLocation.coords, 13);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMapInstance);

    window.L.marker(selectedLocation.coords, { icon: createLocalLinkIcon('focus', 'K') })
      .addTo(leafletMapInstance)
      .bindPopup(`LocalLink focus • ${selectedLocation.name}`);

    visibleProviders.forEach((provider) => {
      const initials = String(provider.name || 'LL').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
      const marker = window.L.marker([provider.coordinates.lat, provider.coordinates.lng], {
        icon: createLocalLinkIcon(provider.isNew ? 'new' : provider.promotion || provider.featured ? 'boost' : 'default', initials)
      })
        .addTo(leafletMapInstance)
        .bindPopup(`<strong>${provider.name}</strong><br>${provider.category} • ${provider.location}`);

      marker.on('click', () => {
        state.selectedProviderId = provider.id;
        render();
      });
    });

    if (visibleProviders.length) {
      const bounds = window.L.latLngBounds(visibleProviders.map((provider) => [provider.coordinates.lat, provider.coordinates.lng]));
      leafletMapInstance.fitBounds(bounds.pad(0.2));
    }
  });

  map.querySelectorAll('[data-location]').forEach((button) => {
    button.addEventListener('click', () => {
      state.location = button.dataset.location;
      state.activeView = 'home';
      render();
    });
  });
}

function renderHomeView() {
  const providers = getFilteredProviders();
  const eventResults = document.getElementById('eventResults');
  const providerResults = document.getElementById('providerResults');
  const profileDetails = document.getElementById('profileDetails');
  const welcomeBanner = document.getElementById('welcomeBanner');
  const searchStatus = document.getElementById('searchStatus');

  if (searchStatus) {
    searchStatus.textContent = state.searchSummary;
  }

  welcomeBanner.innerHTML = state.onboardingComplete
    ? '<div class="message">Welcome to LocalLink! Your new Kimberley profile is part of the live discovery flow.</div>'
    : '';

  providerResults.innerHTML = providers.length
    ? providers.map((provider) => `
        <article class="card" data-provider-id="${provider.id}">
          <div class="card-top">
            <div class="card-title-wrap">
              <div class="thumb">${provider.images[0] || '📍'}</div>
              <div>
                <h3>${provider.name}</h3>
                <p class="meta">${provider.category} · ${provider.location}</p>
              </div>
            </div>
            <span class="tag alt">★ ${provider.rating}</span>
          </div>
          <p>${provider.description}</p>
          <div class="tags">
            <span class="tag">${provider.priceRange}</span>
            <span class="tag">${provider.distanceDisplay}</span>
            ${provider.availability.map((item) => `<span class="tag warn">${item}</span>`).join('')}
            ${provider.promotion ? '<span class="tag">Featured</span>' : ''}
          </div>
          <div class="action-row">
            <button class="primary-btn" data-action="view-profile" data-provider-id="${provider.id}">View profile</button>
            <button class="secondary-btn" data-action="boost" data-provider-id="${provider.id}">Boost</button>
          </div>
        </article>
      `).join('')
    : '<div class="card">No matches yet. Try a broader Kimberley search.</div>';

  eventResults.innerHTML = getFilteredEvents().length
    ? getFilteredEvents().map((event) => `
        <article class="event-card">
          <p class="eyebrow">${event.date}</p>
          <h3>${event.title}</h3>
          <p>${event.location} · ${event.time}</p>
          <p>${event.description}</p>
          <div class="tags">
            <span class="tag">${event.category}</span>
            <span class="tag">${event.organizer}</span>
          </div>
        </article>
      `).join('')
    : '<div class="card">No events match your current filters.</div>';

  const selectedProvider = providers.find((provider) => provider.id === state.selectedProviderId) || providers[0] || null;
  if (selectedProvider) {
    state.selectedProviderId = selectedProvider.id;
    profileDetails.innerHTML = renderProfile(selectedProvider);
  } else {
    profileDetails.innerHTML = '<p>Choose a result to see the profile flow.</p>';
  }
}

function renderProfile(provider) {
  return `
    <div class="profile-hero">
      <p class="eyebrow">${provider.category}</p>
      <h3>${provider.name}</h3>
      <p>${provider.bio}</p>
      <div class="tags">
        <span class="tag">★ ${provider.rating}</span>
        <span class="tag">${provider.reviews} reviews</span>
        <span class="tag">${provider.verified ? 'Verified' : 'Pending verification'}</span>
      </div>
    </div>
    <p><strong>Distance:</strong> ${provider.distanceDisplay}</p>
    <p><strong>Location:</strong> ${provider.location}</p>
    <p><strong>Availability:</strong> ${provider.availability.join(', ')}</p>
    <p><strong>Services:</strong> ${provider.serviceList.join(', ')}</p>
    <p><strong>Pricing:</strong> ${provider.priceRange}</p>
    <div class="gallery-row">${(provider.images || []).map((image) => `<span class="gallery-pill">${image}</span>`).join('')}</div>
    <div class="map-preview">Nearby map preview • ${provider.location}</div>
    <div class="action-row">
      <button class="primary-btn" data-action="cta">${provider.actionType === 'whatsapp' ? 'Open WhatsApp' : 'Request quote'}</button>
    </div>
    ${state.lastLeadMessage ? `<div class="message">${state.lastLeadMessage}</div>` : ''}
    ${provider.actionType === 'quote' ? renderQuoteForm(provider.id) : ''}
  `;
}

function renderQuoteForm(providerId) {
  return `
    <form class="quote-form" data-provider-id="${providerId}">
      <input name="name" placeholder="Your name" required />
      <input name="email" placeholder="Email" required />
      <input name="serviceType" placeholder="Service needed" value="${state.searchQuery || ''}" />
      <textarea name="details" rows="3" placeholder="Tell us what you need"></textarea>
      <button class="primary-btn" type="submit">Submit lead</button>
    </form>
  `;
}

function renderEventsView() {
  const eventsContainer = document.getElementById('eventsList');
  if (!eventsContainer) return;
  const events = getFilteredEvents();
  eventsContainer.innerHTML = events.length
    ? events.map((event) => `
        <article class="event-card">
          <p class="eyebrow">${event.date}</p>
          <h3>${event.title}</h3>
          <p>${event.location} · ${event.time}</p>
          <p>${event.description}</p>
          <div class="tags">
            <span class="tag">${event.category}</span>
            <span class="tag">${event.organizer}</span>
          </div>
        </article>
      `).join('')
    : '<div class="card">No event matches yet. Try a wider search.</div>';
}

function renderOnboardView() {
  const form = document.getElementById('onboardForm');
  const success = document.getElementById('onboardSuccess');
  if (!form || !success) return;

  const showForm = state.activeView === 'onboard' && !state.showOnboardingSuccess;
  const showSuccess = state.activeView === 'onboard' && state.showOnboardingSuccess;
  form.classList.toggle('hidden', !showForm);
  success.classList.toggle('hidden', !showSuccess);
}

async function renderDashboardView() {
  const metrics = document.getElementById('metricsGrid');
  const dashboardProviders = document.getElementById('dashboardProviders');
  const analytics = state.analytics || {};

  metrics.innerHTML = [
    { label: 'Profile views', value: analytics.profileViews || 0 },
    { label: 'Search appearances', value: analytics.searchAppearances || 0 },
    { label: 'WhatsApp leads', value: analytics.whatsappClicks || 0 },
    { label: 'Conversion estimate', value: `${analytics.conversionEstimate || 0}%` }
  ].map((metric) => `
    <div class="metric-card">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
    </div>
  `).join('');

  dashboardProviders.innerHTML = state.providers.map((provider) => `
    <article class="card">
      <div class="card-top">
        <div>
          <h3>${provider.name}</h3>
          <p class="meta">${provider.category} · ${provider.location}</p>
        </div>
        <span class="tag ${provider.promotion || provider.featured ? 'alt' : 'warn'}">${provider.promotion || provider.featured ? 'Boosted' : 'Organic'}</span>
      </div>
      <p>${provider.description}</p>
      <div class="action-row">
        <button class="primary-btn" data-action="toggle-boost" data-provider-id="${provider.id}">
          ${provider.promotion ? 'Remove boost' : 'Boost listing'}
        </button>
        <button class="secondary-btn" data-action="toggle-feature" data-provider-id="${provider.id}">
          ${provider.featured ? 'Remove feature' : 'Feature listing'}
        </button>
      </div>
    </article>
  `).join('');

  dashboardProviders.querySelectorAll('[data-action="toggle-boost"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const provider = state.providers.find((item) => item.id === btn.dataset.providerId);
      if (provider) {
        const updatedProvider = await updateProvider(btn.dataset.providerId, { promotion: !provider.promotion });
        state.providers = state.providers.map((item) => (item.id === updatedProvider.id ? updatedProvider : item));
        state.lastLeadMessage = `${updatedProvider.name} ${updatedProvider.promotion ? 'is boosted' : 'is no longer boosted'}.`;
        await refreshFromBackend();
      }
    });
  });

  dashboardProviders.querySelectorAll('[data-action="toggle-feature"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const provider = state.providers.find((item) => item.id === btn.dataset.providerId);
      if (provider) {
        const updatedProvider = await updateProvider(btn.dataset.providerId, { featured: !provider.featured });
        state.providers = state.providers.map((item) => (item.id === updatedProvider.id ? updatedProvider : item));
        state.lastLeadMessage = `${updatedProvider.name} ${updatedProvider.featured ? 'is featured' : 'is no longer featured'}.`;
        await refreshFromBackend();
      }
    });
  });
}

function getFilteredProviders() {
  const query = normalizeQuery(state.searchQuery);
  const userCoords = state.userLocation || DEFAULT_COORDS;
  const radiusUsed = state.radiusKm;
  const matches = state.providers
    .filter((provider) => matchesQuery(provider, query) && matchesCategory(provider) && matchesLocation(provider))
    .map((provider) => ({
      ...provider,
      distanceKm: calculateDistanceKm(userCoords, provider.coordinates || DEFAULT_COORDS),
      distanceDisplay: formatDistance(calculateDistanceKm(userCoords, provider.coordinates || DEFAULT_COORDS)),
      profileScore: getProfileScore(provider)
    }))
    .filter((provider) => provider.distanceKm <= radiusUsed)
    .sort((a, b) => b.profileScore - a.profileScore);

  state.currentRadiusUsed = radiusUsed;
  return matches;
}

function getFilteredEvents() {
  const query = normalizeQuery(state.searchQuery);
  const userCoords = state.userLocation || DEFAULT_COORDS;

  return state.events
    .filter((event) => matchesEventQuery(event, query) && matchesCategory(event) && matchesLocation(event) && matchesTime(event))
    .map((event) => ({
      ...event,
      distanceKm: calculateDistanceKm(userCoords, event.coordinates || DEFAULT_COORDS),
      distanceDisplay: formatDistance(calculateDistanceKm(userCoords, event.coordinates || DEFAULT_COORDS))
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function matchesQuery(provider, query) {
  if (!query) return true;
  const haystack = [provider.name, provider.category, provider.description, provider.bio, provider.location, ...(provider.tags || []), ...(provider.serviceList || [])].join(' ').toLowerCase();
  return haystack.includes(query);
}

function matchesCategory(item) {
  return state.category === 'All' || item.category === state.category;
}

function matchesLocation(item) {
  return state.location === 'Any' || item.location === state.location;
}

function matchesTime(event) {
  return state.timeFilter === 'Any' || event.date === state.timeFilter || (state.timeFilter === 'Today' && event.date === 'Today');
}

function matchesEventQuery(event, query) {
  if (!query) return true;
  const haystack = [event.title, event.description, event.organizer, event.location, ...(event.tags || [])].join(' ').toLowerCase();
  return haystack.includes(query);
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function calculateDistanceKm(from, to) {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 'Distance pending';
  return `${distanceKm.toFixed(1)} km`;
}

function getProfileScore(provider) {
  const proximityScore = Math.max(0, 120 - (provider.distanceKm || 0) * 6);
  const ratingScore = provider.rating * 16;
  const completenessScore = provider.profileCompleteness * 0.5;
  const responseScore = provider.responseSpeed * 8;
  const activityScore = provider.activity * 0.25;
  const boostScore = provider.promotion ? 22 : 0;
  const featuredScore = provider.featured ? 24 : 0;
  return proximityScore + ratingScore + completenessScore + responseScore + activityScore + boostScore + featuredScore;
}

async function refreshFromBackend() {
  const queryParams = new URLSearchParams({
    q: state.searchQuery,
    category: state.category,
    location: state.location,
    radiusKm: state.radiusKm,
    lat: state.userLocation?.lat || DEFAULT_COORDS.lat,
    lng: state.userLocation?.lng || DEFAULT_COORDS.lng
  });

  const [providersRes, eventsRes, analyticsRes] = await Promise.all([
    fetch(`${API_BASE}/providers?${queryParams.toString()}`),
    fetch(`${API_BASE}/events?${new URLSearchParams({ q: state.searchQuery, category: state.category, location: state.location, timeFilter: state.timeFilter, lat: state.userLocation?.lat || DEFAULT_COORDS.lat, lng: state.userLocation?.lng || DEFAULT_COORDS.lng }).toString()}`),
    fetch(`${API_BASE}/analytics`)
  ]);

  state.providers = await providersRes.json();
  state.events = await eventsRes.json();
  state.analytics = await analyticsRes.json();
  if (state.providers.length && !state.providers.some((provider) => provider.id === state.selectedProviderId)) {
    state.selectedProviderId = state.providers[0].id;
  }
  render();
}

async function recordProviderView(providerId) {
  await fetch(`${API_BASE}/providers/${providerId}/view`, { method: 'POST' });
  await refreshFromBackend();
}

async function updateProvider(providerId, updates) {
  const response = await fetch(`${API_BASE}/providers/${providerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return response.json();
}

async function logLead(leadPayload) {
  const response = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadPayload)
  });
  state.leads = [await response.json(), ...state.leads];
  await refreshFromBackend();
}

init();
