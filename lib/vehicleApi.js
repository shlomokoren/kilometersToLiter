// Free, keyless external fallback for makes/models not in our built-in catalog.
const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';

async function fetchModelsForMake(make) {
  try {
    const url = `${NHTSA_BASE}/GetModelsForMake/${encodeURIComponent(make)}?format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const names = (data.Results || [])
      .map((r) => r.Model_Name)
      .filter(Boolean);
    return [...new Set(names)];
  } catch (err) {
    console.error('NHTSA vPIC lookup failed:', err.message);
    return [];
  }
}

module.exports = { fetchModelsForMake };
