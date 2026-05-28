import os

main_js_path = '/Users/devacc/Desktop/Optitank/webapp/src/main.js'

with open(main_js_path, 'r') as f:
    content = f.read()

get_loc_func = """
// ── Native Bridge Location ────────────────────────────────
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
    window.OptiTankBridge.postMessage({ type: 'requestLocation', callbackId: callbackId });
  } else {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback, { enableHighAccuracy: true });
    } else {
      if (errorCallback) errorCallback({ code: 2, message: "Geolocation not supported" });
    }
  }
};
"""

if "window.getAppLocation =" not in content:
    content = content.replace("document.addEventListener('DOMContentLoaded', () => {", get_loc_func + "\ndocument.addEventListener('DOMContentLoaded', () => {")

chunk1 = """  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => { 
      userLat = p.coords.latitude; 
      userLng = p.coords.longitude; 
      hasGeoloc = true;
      if (mapInstance && currentView === 'map') {
        mapInstance.flyTo([userLat, userLng], 13, { duration: 1 });
      }
    });
  }"""
new_chunk1 = """  if (!isFirstVisit) {
    window.getAppLocation(
      p => { 
        userLat = p.coords.latitude; 
        userLng = p.coords.longitude; 
        hasGeoloc = true;
        if (mapInstance && currentView === 'map') {
          mapInstance.flyTo([userLat, userLng], 13, { duration: 1 });
        }
      },
      err => { console.log('background location init failed', err); }
    );
  }"""
content = content.replace(chunk1, new_chunk1)

chunk2 = """    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; goToStep('ob-step-5', 'forward'); startSuccessAnim(); },
        ()  => { goToStep('ob-step-5', 'forward'); startSuccessAnim(); }
      );
    } else {
      goToStep('ob-step-5', 'forward'); startSuccessAnim();
    }"""
new_chunk2 = """    window.getAppLocation(
      pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; goToStep('ob-step-5', 'forward'); startSuccessAnim(); },
      ()  => { goToStep('ob-step-5', 'forward'); startSuccessAnim(); }
    );"""
content = content.replace(chunk2, new_chunk2)

chunk3 = """    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(p => {
        userLat = p.coords.latitude; userLng = p.coords.longitude;
        mapInstance.flyTo([userLat, userLng], 13, { animate: true, duration: 0.8 });
        if (window.userMarker) {
          window.userMarker.setLatLng([userLat, userLng]);
        } else {
          window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
        }
      }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
    }"""
new_chunk3 = """    if (!isFirstVisit) {
      window.getAppLocation(
        p => {
          userLat = p.coords.latitude; userLng = p.coords.longitude;
          mapInstance.flyTo([userLat, userLng], 13, { animate: true, duration: 0.8 });
          if (window.userMarker) {
            window.userMarker.setLatLng([userLat, userLng]);
          } else {
            window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
          }
        },
        () => {}
      );
    }"""
content = content.replace(chunk3, new_chunk3)

chunk4 = """      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
          userLat = p.coords.latitude; 
          userLng = p.coords.longitude;
          mapInstance.flyTo([userLat, userLng], 14, { animate: true, duration: 1.2 });
          
          if (window.userMarker) {
            window.userMarker.setLatLng([userLat, userLng]);
          } else {
            window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
          }
          setTimeout(() => ico.className = 'ph ph-crosshair', 1000);
        }, () => {
          ico.className = 'ph ph-crosshair';
        }, { enableHighAccuracy: true });
      }"""
new_chunk4 = """      window.getAppLocation(
        p => {
          userLat = p.coords.latitude; 
          userLng = p.coords.longitude;
          mapInstance.flyTo([userLat, userLng], 14, { animate: true, duration: 1.2 });
          
          if (window.userMarker) {
            window.userMarker.setLatLng([userLat, userLng]);
          } else {
            window.userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(mapInstance);
          }
          setTimeout(() => ico.className = 'ph ph-crosshair', 1000);
        },
        () => {
          ico.className = 'ph ph-crosshair';
        }
      );"""
content = content.replace(chunk4, new_chunk4)

chunk5 = """      if (exists && userProfile?.vehicleBrand) {
        obContainer.style.opacity = '0';
        setTimeout(() => { obContainer.style.display = 'none'; isFirstVisit = false; refreshProfile(); switchView('radar'); runRadarScan(); }, 400);
      } else {"""
new_chunk5 = """      if (exists && userProfile?.vehicleBrand) {
        goToStep('ob-step-4', 'forward');
      } else {"""
content = content.replace(chunk5, new_chunk5)

chunk6 = """    const top = scored.slice(0, 5);

    if (!top.length) {
      resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px">Aucune station trouvée.</p>';
      btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-brain"></i> Analyser';
      return;
    }"""
new_chunk6 = """    document.querySelector('.radar-container').style.display = 'block';

    const top = scored.slice(0, 5);

    if (!top.length) {
      resultsDiv.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px">Aucune station trouvée.</p>';
      btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-brain"></i> Analyser';
      return;
    }

    document.querySelector('.radar-container').style.display = 'none';"""
content = content.replace(chunk6, new_chunk6)

chunk7 = """        <div class="action-card" id="btn-add-widget">
          <i class="ph ph-squares-four"></i> Ajouter au widget
        </div>"""
new_chunk7 = ""
content = content.replace(chunk7, new_chunk7)

chunk8 = """          <div class="ob-btn-primary" id="ob-loc-allow">Autoriser</div>"""
new_chunk8 = """          <div class="ob-btn-primary" id="ob-loc-allow">Continuer</div>"""
content = content.replace(chunk8, new_chunk8)

with open(main_js_path, 'w') as f:
    f.write(content)

print(chunk1 in content, chunk2 in content, chunk3 in content, chunk4 in content, chunk5 in content, chunk6 in content, chunk7 in content, chunk8 in content)
