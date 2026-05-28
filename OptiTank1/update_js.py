import sys

with open('/Users/devacc/Desktop/Optitank/OptiTank1/src/main.js', 'r') as f:
    content = f.read()

# 1. Add getAppLocation
header_replacement = """import L from 'leaflet';
import 'leaflet.markercluster';

window.getAppLocation = function(successCallback, errorCallback) {
  if (window.isOptiTankApp && window.OptiTankBridge) {
    const callbackId = 'loc_' + Date.now();
    window[callbackId] = function(lat, lng) {
      delete window[callbackId];
      if (lat && lng) {
        successCallback({ coords: { latitude: lat, longitude: lng } });
      } else {
        if (errorCallback) errorCallback({ code: 1, message: "Location denied" });
      }
    };
    window.OptiTankBridge.post({ type: 'requestLocation', callbackId: callbackId });
  } else {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback, { enableHighAccuracy: true });
    } else {
      if (errorCallback) errorCallback({ code: 2, message: "Geolocation not supported" });
    }
  }
};"""

content = content.replace("import L from 'leaflet';\nimport 'leaflet.markercluster';", header_replacement)

# 2. Fix the button
content = content.replace(
    '<button class="ob-btn-accent" id="ob-loc-allow">📍 Autoriser la localisation</button>\n          <button class="ob-btn-ghost" id="ob-loc-skip">Plus tard</button>',
    '<button class="ob-btn-accent" id="ob-loc-allow">Continuer</button>'
)

# 3. Replace the 4 geolocation chunks precisely
chunk1_old = """  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => { 
      userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
      findNearestStation();
    }, err => {
      console.warn("Location denied:", err);
    }, { enableHighAccuracy: true });
  }"""
chunk1_new = """  window.getAppLocation(p => { 
    userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
    findNearestStation();
  }, err => {
    console.warn("Location denied:", err);
  });"""
content = content.replace(chunk1_old, chunk1_new)

chunk2_old = """    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
          const savedHomeId = localStorage.getItem('opti_homeStationId');
          if (!savedHomeId && stationsData.length > 0) {
            const nearest = findNearestStationTo(userLocation.lat, userLocation.lng);
            if (nearest) {
              localStorage.setItem('opti_homeStationId', nearest.id);
              homeStationData = nearest;
            }
          }
          await updateSavingsPotential();
        },
        (err) => { console.warn("Loc err:", err); updateSavingsPotential(); },
        { enableHighAccuracy: true }
      );
    }"""
chunk2_new = """    window.getAppLocation(
      async (p) => {
        userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
        const savedHomeId = localStorage.getItem('opti_homeStationId');
        if (!savedHomeId && stationsData.length > 0) {
          const nearest = findNearestStationTo(userLocation.lat, userLocation.lng);
          if (nearest) {
            localStorage.setItem('opti_homeStationId', nearest.id);
            homeStationData = nearest;
          }
        }
        await updateSavingsPotential();
      },
      (err) => { console.warn("Loc err:", err); updateSavingsPotential(); }
    );"""
content = content.replace(chunk2_old, chunk2_new)

chunk3_old = """    if (navigator.geolocation) {
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
chunk3_new = """    window.getAppLocation(p => {
      userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
      const n = findNearestStationTo(userLocation.lat, userLocation.lng);
      if (n) {
        document.getElementById('ob-loc-skip')?.click();
      }
    }, err => {
      document.getElementById('ob-loc-skip')?.click();
    });"""
content = content.replace(chunk3_old, chunk3_new)

chunk4_old = """      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
          userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
          if (map) { map.setView([userLocation.lat, userLocation.lng], 13); }
          btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
        }, err => {
          btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
        });
      }"""
chunk4_new = """      window.getAppLocation(p => {
        userLocation = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (map) { map.setView([userLocation.lat, userLocation.lng], 13); }
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
      }, err => {
        btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
      });"""
content = content.replace(chunk4_old, chunk4_new)

with open('/Users/devacc/Desktop/Optitank/OptiTank1/src/main.js', 'w') as f:
    f.write(content)
