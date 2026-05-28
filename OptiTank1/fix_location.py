import os

filepath = '/Users/devacc/Desktop/Optitank/OptiTank1/src/main.js'
with open(filepath, 'r') as f:
    content = f.read()

# Chunk 1: Lines 383-392
chunk1_old = """  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => { 
      userLat = p.coords.latitude; 
      userLng = p.coords.longitude; 
      hasGeoloc = true;
      if (mapInstance && currentView === 'map') {
        mapInstance.flyTo([userLat, userLng], 13, { duration: 1 });
      }
    });
  }"""
chunk1_new = """  window.getAppLocation(
    p => { 
      userLat = p.coords.latitude; 
      userLng = p.coords.longitude; 
      hasGeoloc = true;
      if (mapInstance && currentView === 'map') {
        mapInstance.flyTo([userLat, userLng], 13, { duration: 1 });
      }
    },
    err => { console.log('background location init failed', err); }
  );"""

# Chunk 2: Lines 3371
chunk2_old = """    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => {
        userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
        const n = findNearestStationTo(userLocation.lat, userLocation.lng);
        if (n) {
          document.getElementById('ob-loc-skip')?.click();
        }
      }, err => {
        document.getElementById('ob-loc-skip')?.click();
      }, { enableHighAccuracy: true });
    } else {
      document.getElementById('ob-loc-skip')?.click();
    }"""
chunk2_new = """    window.getAppLocation(p => {
      userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
      const n = findNearestStationTo(userLocation.lat, userLocation.lng);
      if (n) {
        document.getElementById('ob-loc-skip')?.click();
      }
    }, err => {
      document.getElementById('ob-loc-skip')?.click();
    });"""

# Chunk 3: Lines 3394
chunk3_old = """      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
          userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
          if (map) { map.setView([userLocation.lat, userLocation.lng], 13); }
          btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
        }, err => {
          btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
        });
      }"""
chunk3_new = """      window.getAppLocation(p => {
        userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (map) { map.setView([userLocation.lat, userLocation.lng], 13); }
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
      }, err => {
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
      });"""

content = content.replace(chunk1_old, chunk1_new)
content = content.replace(chunk2_old, chunk2_new)
content = content.replace(chunk3_old, chunk3_new)

with open(filepath, 'w') as f:
    f.write(content)

print(chunk1_old in content) # True if not replaced
print(chunk2_old in content)
print(chunk3_old in content)
