// vehicles.js — DB marques / modèles / motorisations
// Structure: { marque: { modèle: [{ label, fuel, tank }] } }

export const VEHICLES = {
  'Volkswagen': {
    'Golf': [
      { label: 'Golf 1.0 TSI (Essence)', fuel: 'SP95', tank: 45 },
      { label: 'Golf 1.5 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Golf 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
      { label: 'Golf GTE (Hybride)', fuel: 'SP95', tank: 37 },
    ],
    'Polo': [
      { label: 'Polo 1.0 MPI (Essence)', fuel: 'SP95', tank: 40 },
      { label: 'Polo 1.0 TSI (Essence)', fuel: 'SP95', tank: 40 },
    ],
    'Tiguan': [
      { label: 'Tiguan 1.4 TSI (Essence)', fuel: 'SP95', tank: 58 },
      { label: 'Tiguan 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 58 },
      { label: 'Tiguan eHybrid (Hybride)', fuel: 'SP95', tank: 45 },
    ],
    'Passat': [
      { label: 'Passat 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 66 },
      { label: 'Passat GTE (Hybride)', fuel: 'SP95', tank: 55 },
    ],
    'T-Roc': [
      { label: 'T-Roc 1.0 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'T-Roc 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
  },
  'BMW': {
    'Série 1': [
      { label: '118i (Essence)', fuel: 'SP95', tank: 42 },
      { label: '116d (Diesel)', fuel: 'Diesel', tank: 42 },
      { label: '120d (Diesel)', fuel: 'Diesel', tank: 42 },
    ],
    'Série 3': [
      { label: '320i (Essence)', fuel: 'SP95', tank: 59 },
      { label: '318d (Diesel)', fuel: 'Diesel', tank: 59 },
      { label: '330e (Hybride)', fuel: 'SP95', tank: 45 },
    ],
    'X1': [
      { label: 'xDrive18i (Essence)', fuel: 'SP95', tank: 51 },
      { label: 'xDrive18d (Diesel)', fuel: 'Diesel', tank: 51 },
      { label: 'xDrive30e (Hybride)', fuel: 'SP95', tank: 40 },
    ],
    'X3': [
      { label: 'xDrive20i (Essence)', fuel: 'SP95', tank: 65 },
      { label: 'xDrive20d (Diesel)', fuel: 'Diesel', tank: 65 },
      { label: 'xDrive30e (Hybride)', fuel: 'SP95', tank: 52 },
    ],
  },
  'Mercedes-Benz': {
    'Classe A': [
      { label: 'A 180 (Essence)', fuel: 'SP95', tank: 43 },
      { label: 'A 180 d (Diesel)', fuel: 'Diesel', tank: 43 },
      { label: 'A 250 e (Hybride)', fuel: 'SP95', tank: 35 },
    ],
    'Classe C': [
      { label: 'C 180 (Essence)', fuel: 'SP95', tank: 66 },
      { label: 'C 220 d (Diesel)', fuel: 'Diesel', tank: 66 },
      { label: 'C 300 e (Hybride)', fuel: 'SP95', tank: 52 },
    ],
    'GLC': [
      { label: 'GLC 200 (Essence)', fuel: 'SP95', tank: 62 },
      { label: 'GLC 220 d (Diesel)', fuel: 'Diesel', tank: 62 },
      { label: 'GLC 300 e (Hybride)', fuel: 'SP95', tank: 50 },
    ],
  },
  'Audi': {
    'A1': [
      { label: 'A1 25 TFSI (Essence)', fuel: 'SP95', tank: 40 },
      { label: 'A1 30 TFSI (Essence)', fuel: 'SP95', tank: 40 },
    ],
    'A3': [
      { label: 'A3 30 TFSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'A3 35 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
      { label: 'A3 45 TFSIe (Hybride)', fuel: 'SP95', tank: 40 },
    ],
    'A4': [
      { label: 'A4 35 TFSI (Essence)', fuel: 'SP95', tank: 58 },
      { label: 'A4 35 TDI (Diesel)', fuel: 'Diesel', tank: 58 },
    ],
    'Q3': [
      { label: 'Q3 35 TFSI (Essence)', fuel: 'SP95', tank: 60 },
      { label: 'Q3 35 TDI (Diesel)', fuel: 'Diesel', tank: 60 },
    ],
    'Q5': [
      { label: 'Q5 40 TFSI (Essence)', fuel: 'SP95', tank: 65 },
      { label: 'Q5 40 TDI (Diesel)', fuel: 'Diesel', tank: 65 },
      { label: 'Q5 55 TFSIe (Hybride)', fuel: 'SP95', tank: 54 },
    ],
  },
  'Toyota': {
    'Yaris': [
      { label: 'Yaris 1.0 (Essence)', fuel: 'SP95', tank: 36 },
      { label: 'Yaris Hybrid (Hybride)', fuel: 'SP95', tank: 36 },
    ],
    'Corolla': [
      { label: 'Corolla 1.8 Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
      { label: 'Corolla 2.0 Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
    ],
    'RAV4': [
      { label: 'RAV4 2.5 Hybrid (Hybride)', fuel: 'SP95', tank: 55 },
      { label: 'RAV4 2.5 PHEV (Plug-in Hybride)', fuel: 'SP95', tank: 50 },
    ],
    'C-HR': [
      { label: 'C-HR 1.8 Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
      { label: 'C-HR 2.0 Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
    ],
  },
  'Renault': {
    'Clio': [
      { label: 'Clio 1.0 SCe (Essence)', fuel: 'SP95', tank: 42 },
      { label: 'Clio 1.0 TCe (Essence)', fuel: 'SP95', tank: 42 },
      { label: 'Clio E-Tech Hybrid (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Mégane': [
      { label: 'Mégane 1.3 TCe (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Mégane 1.5 Blue dCi (Diesel)', fuel: 'Diesel', tank: 50 },
      { label: 'Mégane E-Tech (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Captur': [
      { label: 'Captur 1.0 TCe (Essence)', fuel: 'SP95', tank: 48 },
      { label: 'Captur 1.5 dCi (Diesel)', fuel: 'Diesel', tank: 48 },
      { label: 'Captur E-Tech PHEV (Hybride)', fuel: 'SP95', tank: 40 },
    ],
  },
  'Peugeot': {
    '208': [
      { label: '208 1.2 PureTech (Essence)', fuel: 'SP95', tank: 44 },
      { label: '208 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 44 },
    ],
    '308': [
      { label: '308 1.2 PureTech (Essence)', fuel: 'SP95', tank: 52 },
      { label: '308 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 52 },
      { label: '308 Plugin Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
    ],
    '3008': [
      { label: '3008 1.2 PureTech (Essence)', fuel: 'SP95', tank: 52 },
      { label: '3008 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 52 },
      { label: '3008 Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
    ],
    '5008': [
      { label: '5008 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 56 },
      { label: '5008 Plugin Hybrid (Hybride)', fuel: 'SP95', tank: 43 },
    ],
  },
  'Skoda': {
    'Octavia': [
      { label: 'Octavia 1.5 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Octavia 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
      { label: 'Octavia iV (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Kodiaq': [
      { label: 'Kodiaq 1.5 TSI (Essence)', fuel: 'SP95', tank: 58 },
      { label: 'Kodiaq 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 58 },
    ],
    'Karoq': [
      { label: 'Karoq 1.0 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Karoq 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
  },
  'Hyundai': {
    'Tucson': [
      { label: 'Tucson 1.6 T-GDi (Essence)', fuel: 'SP95', tank: 54 },
      { label: 'Tucson 1.6 CRDi (Diesel)', fuel: 'Diesel', tank: 54 },
      { label: 'Tucson PHEV (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Kona': [
      { label: 'Kona 1.0 T-GDi (Essence)', fuel: 'SP95', tank: 42 },
      { label: 'Kona Hybrid (Hybride)', fuel: 'SP95', tank: 38 },
    ],
    'i30': [
      { label: 'i30 1.0 T-GDi (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'i30 1.5 CRDi (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
  },
  'Citroën': {
    'C3': [
      { label: 'C3 1.2 PureTech (Essence)', fuel: 'SP95', tank: 45 },
    ],
    'C4': [
      { label: 'C4 1.2 PureTech (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'C4 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
    'C5 Aircross': [
      { label: 'C5 Aircross 1.5 BlueHDi (Diesel)', fuel: 'Diesel', tank: 52 },
      { label: 'C5 Aircross PHEV (Hybride)', fuel: 'SP95', tank: 43 },
    ],
  },
  'Seat': {
    'Ibiza': [
      { label: 'Ibiza 1.0 MPI (Essence)', fuel: 'SP95', tank: 40 },
      { label: 'Ibiza 1.0 TSI (Essence)', fuel: 'SP95', tank: 40 },
    ],
    'Leon': [
      { label: 'Leon 1.0 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Leon 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
      { label: 'Leon e-Hybrid (Hybride)', fuel: 'SP95', tank: 40 },
    ],
    'Ateca': [
      { label: 'Ateca 1.0 TSI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Ateca 2.0 TDI (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
  },
  'Ford': {
    'Focus': [
      { label: 'Focus 1.0 EcoBoost (Essence)', fuel: 'SP95', tank: 52 },
      { label: 'Focus 1.5 EcoBlue (Diesel)', fuel: 'Diesel', tank: 52 },
    ],
    'Puma': [
      { label: 'Puma 1.0 EcoBoost (Essence)', fuel: 'SP95', tank: 42 },
      { label: 'Puma Hybrid mHEV (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Kuga': [
      { label: 'Kuga 2.5 PHEV (Hybride)', fuel: 'SP95', tank: 54 },
      { label: 'Kuga 1.5 EcoBlue (Diesel)', fuel: 'Diesel', tank: 54 },
    ],
  },
  'Opel': {
    'Corsa': [
      { label: 'Corsa 1.2 (Essence)', fuel: 'SP95', tank: 40 },
      { label: 'Corsa 1.5 Diesel', fuel: 'Diesel', tank: 40 },
    ],
    'Astra': [
      { label: 'Astra 1.2 (Essence)', fuel: 'SP95', tank: 52 },
      { label: 'Astra 1.5 Diesel', fuel: 'Diesel', tank: 52 },
    ],
    'Mokka': [
      { label: 'Mokka 1.2 (Essence)', fuel: 'SP95', tank: 44 },
    ],
    'Grandland': [
      { label: 'Grandland 1.2 (Essence)', fuel: 'SP95', tank: 53 },
      { label: 'Grandland 1.5 Diesel', fuel: 'Diesel', tank: 53 },
      { label: 'Grandland PHEV (Hybride)', fuel: 'SP95', tank: 43 },
    ],
  },
  'Kia': {
    'Sportage': [
      { label: 'Sportage 1.6 T-GDI (Essence)', fuel: 'SP95', tank: 54 },
      { label: 'Sportage 1.6 CRDi (Diesel)', fuel: 'Diesel', tank: 54 },
      { label: 'Sportage PHEV (Hybride)', fuel: 'SP95', tank: 42 },
    ],
    'Stonic': [
      { label: 'Stonic 1.0 T-GDI (Essence)', fuel: 'SP95', tank: 45 },
    ],
    'Ceed': [
      { label: 'Ceed 1.0 T-GDI (Essence)', fuel: 'SP95', tank: 50 },
      { label: 'Ceed 1.6 CRDi (Diesel)', fuel: 'Diesel', tank: 50 },
    ],
  },
  'Volvo': {
    'XC40': [
      { label: 'XC40 B3 (Essence)', fuel: 'SP95', tank: 54 },
      { label: 'XC40 D3 (Diesel)', fuel: 'Diesel', tank: 54 },
      { label: 'XC40 T4 PHEV (Hybride)', fuel: 'SP95', tank: 44 },
    ],
    'XC60': [
      { label: 'XC60 B4 (Essence)', fuel: 'SP95', tank: 71 },
      { label: 'XC60 D4 (Diesel)', fuel: 'Diesel', tank: 71 },
      { label: 'XC60 T6 PHEV (Hybride)', fuel: 'SP95', tank: 60 },
    ],
  },
  'Tesla': {
    'Model 3': [ { label: 'Model 3 Standard (Électrique)', fuel: null, tank: 0 } ],
    'Model Y': [ { label: 'Model Y Long Range (Électrique)', fuel: null, tank: 0 } ],
    'Model S': [ { label: 'Model S (Électrique)', fuel: null, tank: 0 } ],
  },
  'Nissan': {
    'Juke': [
      { label: 'Juke 1.0 DIG-T (Essence)', fuel: 'SP95', tank: 46 },
      { label: 'Juke Hybrid (Hybride)', fuel: 'SP95', tank: 41 },
    ],
    'Qashqai': [
      { label: 'Qashqai 1.3 DIG-T (Essence)', fuel: 'SP95', tank: 55 },
      { label: 'Qashqai e-POWER (Hybride)', fuel: 'SP95', tank: 55 },
    ],
    'Leaf': [ { label: 'Leaf (Électrique)', fuel: null, tank: 0 } ],
  },
  'Mazda': {
    'Mazda3': [
      { label: 'Mazda3 SKYACTIV-G (Essence)', fuel: 'SP95', tank: 51 },
      { label: 'Mazda3 e-SKYACTIV X (Essence)', fuel: 'SP95', tank: 51 },
    ],
    'CX-5': [
      { label: 'CX-5 2.0 SKYACTIV-G (Essence)', fuel: 'SP95', tank: 56 },
      { label: 'CX-5 2.2 SKYACTIV-D (Diesel)', fuel: 'Diesel', tank: 56 },
    ],
    'CX-30': [
      { label: 'CX-30 2.0 SKYACTIV-G (Essence)', fuel: 'SP95', tank: 48 },
    ],
  },
  'Fiat': {
    '500': [
      { label: '500 1.0 BSG (Essence)', fuel: 'SP95', tank: 35 },
      { label: '500e (Électrique)', fuel: null, tank: 0 },
    ],
    'Panda': [
      { label: 'Panda 1.0 (Essence)', fuel: 'SP95', tank: 37 },
    ],
    '500X': [
      { label: '500X 1.0 (Essence)', fuel: 'SP95', tank: 48 },
      { label: '500X 1.3 MultiJet (Diesel)', fuel: 'Diesel', tank: 48 },
    ],
  },
  'Autre / Saisie manuelle': {
    'Saisir mon modèle': [
      { label: 'Petite citadine Essence (≈ 40L)', fuel: 'SP95', tank: 40 },
      { label: 'Compacte Essence (≈ 50L)', fuel: 'SP95', tank: 50 },
      { label: 'Berline/SUV Essence (≈ 65L)', fuel: 'SP95', tank: 65 },
      { label: 'Petite citadine Diesel (≈ 40L)', fuel: 'Diesel', tank: 40 },
      { label: 'Compacte Diesel (≈ 50L)', fuel: 'Diesel', tank: 50 },
      { label: 'Berline/SUV Diesel (≈ 65L)', fuel: 'Diesel', tank: 65 },
      { label: 'Hybride Rechargeable PHEV (≈ 40L)', fuel: 'SP95', tank: 40 },
      { label: 'Moto / Scooter (≈ 15L)', fuel: 'SP95', tank: 15 },
      { label: '100% Électrique', fuel: null, tank: 0 },
    ]
  }
};

export const FUEL_CONSUMPTION = {
  'SP95': 7.5, 'SP98': 7.5, 'Diesel': 6.0,
  'Diesel Premium': 6.0, 'GPL': 10, 'GNC': 7,
  'Ethanol 85': 9.5, 'H2': 1,
};
