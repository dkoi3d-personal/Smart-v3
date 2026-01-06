# Free APIs Reference

Use these free, no-auth APIs instead of paid ones. NEVER use APIs that require API keys!

---

## Weather & Location

### Open-Meteo (Weather) - USE THIS, not OpenWeatherMap!
```tsx
const res = await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m`
);
const data = await res.json();
// data.current_weather.temperature, data.current_weather.windspeed
```

### Nominatim (Geocoding) - USE THIS, not Google Maps!
```tsx
const res = await fetch(
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=5`,
  { headers: { 'User-Agent': 'MyApp/1.0' } }
);
const cities = await res.json();
// cities[0].lat, cities[0].lon, cities[0].display_name
```

### IP/Location
```tsx
const res = await fetch('https://ipapi.co/json/');
const data = await res.json();
// data.city, data.country, data.latitude, data.longitude
```

---

## Data & Content

### JSONPlaceholder (Mock REST API)
```tsx
// Posts, comments, users, todos, albums, photos
const res = await fetch('https://jsonplaceholder.typicode.com/posts');
const posts = await res.json();
```

### Random User Generator
```tsx
const res = await fetch('https://randomuser.me/api/?results=10');
const data = await res.json();
// data.results[0].name, .email, .picture
```

### Quotable (Random Quotes)
```tsx
const res = await fetch('https://api.quotable.io/random');
const quote = await res.json();
// quote.content, quote.author
```

### REST Countries
```tsx
const res = await fetch('https://restcountries.com/v3.1/all');
const countries = await res.json();
// countries[0].name.common, .flags.svg, .population
```

---

## Images

### Picsum Photos (Random Images)
```tsx
// Random image
<img src="https://picsum.photos/400/300" alt="Random" />

// Specific image by ID
<img src="https://picsum.photos/id/237/400/300" alt="Dog" />

// Grayscale
<img src="https://picsum.photos/400/300?grayscale" alt="Grayscale" />
```

---

## Crypto/Finance

### CoinCap (Cryptocurrency)
```tsx
const res = await fetch('https://api.coincap.io/v2/assets');
const data = await res.json();
// data.data[0].name, .priceUsd, .changePercent24Hr
```

---

## Error Handling Pattern

Always add error handling for external APIs:
```tsx
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error('API request failed');
  const data = await res.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  return null; // Show fallback UI
}
```

---

## APIs to AVOID (require keys)
- OpenWeatherMap
- Google Maps/Places
- Twitter/X API
- Stripe (use mock for demos)
- Any API requiring `Authorization` header
