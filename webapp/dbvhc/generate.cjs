// dbvhc/generate.js  — Run: node dbvhc/generate.js
// Parses "Car Dataset 1945-2020.csv" → outputs src/vehicleAPI.js
const fs = require('fs');
const path = require('path');

// ── CSV parser ────────────────────────────────────────────────
function parseLine(line) {
  const r = []; let cur = '', q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === ',' && !q) { r.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  r.push(cur.trim());
  return r;
}

// ── Fuel mapping ──────────────────────────────────────────────
function mapFuel(engType, fuelGr, batCap) {
  const et = (engType || '').toLowerCase();
  const fg = (fuelGr || '').toString().trim();
  if (et.includes('electric') || parseFloat(batCap) > 0) return 'Electrique';
  if (et.includes('diesel')) return 'Diesel';
  if (fg === '98') return 'SP98';
  return 'SP95';
}

// ── Slug ──────────────────────────────────────────────────────
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// ── Brand config (CSV name → app config) ─────────────────────
const BRANDS = {
  'Acura':       { id:'acura',    name:'Acura',        color:'#DC2626', abbr:'AC', domain:'acura.com' },
  'Alfa Romeo':  { id:'alfa',     name:'Alfa Romeo',   color:'#DC2626', abbr:'AR', domain:'alfaromeo.com' },
  'Alpine':      { id:'alpine',   name:'Alpine',       color:'#1D4ED8', abbr:'AL', domain:'alpinecars.com' },
  'Alpina':      { id:'alpina',   name:'Alpina',       color:'#1E3A8A', abbr:'AP', domain:'alpina-automobiles.com' },
  'Aston Martin':{ id:'aston',    name:'Aston Martin', color:'#16A34A', abbr:'AM', domain:'astonmartin.com' },
  'Audi':        { id:'audi',     name:'Audi',         color:'#DC2626', abbr:'AU', domain:'audi.com' },
  'Bentley':     { id:'bentley',  name:'Bentley',      color:'#16A34A', abbr:'BT', domain:'bentley.com' },
  'BMW':         { id:'bmw',      name:'BMW',          color:'#1D4ED8', abbr:'BM', domain:'bmw.com' },
  'Bugatti':     { id:'bugatti',  name:'Bugatti',      color:'#1D4ED8', abbr:'BU', domain:'bugatti.com' },
  'Cadillac':    { id:'cadillac', name:'Cadillac',     color:'#374151', abbr:'CA', domain:'cadillac.com' },
  'Chevrolet':   { id:'chevy',    name:'Chevrolet',    color:'#FBBF24', abbr:'CH', domain:'chevrolet.com' },
  'Chrysler':    { id:'chrysler', name:'Chrysler',     color:'#374151', abbr:'CR', domain:'chrysler.com' },
  'Citroen':     { id:'citroen',  name:'Citroën',      color:'#DC2626', abbr:'CI', domain:'citroen.com' },
  'Cupra':       { id:'cupra',    name:'CUPRA',        color:'#B45309', abbr:'CU', domain:'cupraofficial.com' },
  'Dacia':       { id:'dacia',    name:'Dacia',        color:'#1E3A5F', abbr:'DC', domain:'dacia.com' },
  'Datsun':      { id:'datsun',   name:'Datsun',       color:'#374151', abbr:'DT', domain:'datsun.com' },
  'Dodge':       { id:'dodge',    name:'Dodge',        color:'#991B1B', abbr:'DO', domain:'dodge.com' },
  'DS':          { id:'ds',       name:'DS',           color:'#7C3AED', abbr:'DS', domain:'dsautomobiles.com' },
  'Ferrari':     { id:'ferrari',  name:'Ferrari',      color:'#DC2626', abbr:'FE', domain:'ferrari.com' },
  'Fiat':        { id:'fiat',     name:'Fiat',         color:'#DC2626', abbr:'FI', domain:'fiat.com' },
  'Ford':        { id:'ford',     name:'Ford',         color:'#1D4ED8', abbr:'FD', domain:'ford.com' },
  'Genesis':     { id:'genesis',  name:'Genesis',      color:'#374151', abbr:'GN', domain:'genesis.com' },
  'GMC':         { id:'gmc',      name:'GMC',          color:'#B91C1C', abbr:'GM', domain:'gmc.com' },
  'Honda':       { id:'honda_c',  name:'Honda',        color:'#DC2626', abbr:'HO', domain:'honda.com' },
  'Hyundai':     { id:'hyundai',  name:'Hyundai',      color:'#1E3A8A', abbr:'HY', domain:'hyundai.com' },
  'Infiniti':    { id:'infiniti', name:'Infiniti',     color:'#374151', abbr:'IN', domain:'infiniti.com' },
  'Isuzu':       { id:'isuzu',    name:'Isuzu',        color:'#374151', abbr:'IS', domain:'isuzu.com' },
  'Jaguar':      { id:'jaguar',   name:'Jaguar',       color:'#374151', abbr:'JA', domain:'jaguar.com' },
  'Jeep':        { id:'jeep',     name:'Jeep',         color:'#374151', abbr:'JP', domain:'jeep.com' },
  'Kia':         { id:'kia',      name:'Kia',          color:'#0F172A', abbr:'KI', domain:'kia.com' },
  'Lamborghini': { id:'lambo',    name:'Lamborghini',  color:'#FBBF24', abbr:'LB', domain:'lamborghini.com' },
  'Lancia':      { id:'lancia',   name:'Lancia',       color:'#1D4ED8', abbr:'LA', domain:'lancia.com' },
  'Land Rover':  { id:'land',     name:'Land Rover',   color:'#16A34A', abbr:'LR', domain:'landrover.com' },
  'Lexus':       { id:'lexus',    name:'Lexus',        color:'#374151', abbr:'LX', domain:'lexus.com' },
  'Lincoln':     { id:'lincoln',  name:'Lincoln',      color:'#374151', abbr:'LN', domain:'lincoln.com' },
  'Lotus':       { id:'lotus',    name:'Lotus',        color:'#FBBF24', abbr:'LO', domain:'lotuscars.com' },
  'Maserati':    { id:'maserati', name:'Maserati',     color:'#1D4ED8', abbr:'MS', domain:'maserati.com' },
  'Mazda':       { id:'mazda',    name:'Mazda',        color:'#991B1B', abbr:'MA', domain:'mazda.com' },
  'McLaren':     { id:'mclaren',  name:'McLaren',      color:'#EA580C', abbr:'MC', domain:'mclaren.com' },
  'Mercedes-Benz':{ id:'mercedes',name:'Mercedes',     color:'#374151', abbr:'MB', domain:'mercedes-benz.com' },
  'MG':          { id:'mg',       name:'MG',           color:'#DC2626', abbr:'MG', domain:'mgmotor.co.uk' },
  'Mini':        { id:'mini',     name:'MINI',         color:'#374151', abbr:'MN', domain:'mini.com' },
  'Mitsubishi':  { id:'mitsu',    name:'Mitsubishi',   color:'#991B1B', abbr:'MI', domain:'mitsubishi-motors.com' },
  'Nissan':      { id:'nissan',   name:'Nissan',       color:'#374151', abbr:'NI', domain:'nissan.com' },
  'Opel':        { id:'opel',     name:'Opel',         color:'#374151', abbr:'OP', domain:'opel.com' },
  'Pagani':      { id:'pagani',   name:'Pagani',       color:'#374151', abbr:'PG', domain:'pagani.com' },
  'Peugeot':     { id:'peugeot',  name:'Peugeot',      color:'#1E3A5F', abbr:'PE', domain:'peugeot.com' },
  'Porsche':     { id:'porsche',  name:'Porsche',      color:'#B45309', abbr:'PO', domain:'porsche.com' },
  'RAM':         { id:'ram',      name:'RAM',          color:'#B91C1C', abbr:'RM', domain:'ramtrucks.com' },
  'Renault':     { id:'renault',  name:'Renault',      color:'#FBBF24', abbr:'RN', domain:'renault.com' },
  'Rolls-Royce': { id:'rr',       name:'Rolls-Royce',  color:'#374151', abbr:'RR', domain:'rolls-roycemotorcars.com' },
  'Saab':        { id:'saab',     name:'Saab',         color:'#1D4ED8', abbr:'SA', domain:'saabcars.com' },
  'SEAT':        { id:'seat',     name:'SEAT',         color:'#475569', abbr:'SE', domain:'seat.com' },
  'Skoda':       { id:'skoda',    name:'Škoda',        color:'#16A34A', abbr:'SK', domain:'skoda-auto.com' },
  'Smart':       { id:'smart',    name:'Smart',        color:'#16A34A', abbr:'SM', domain:'smart.com' },
  'SsangYong':   { id:'ssang',    name:'SsangYong',    color:'#1E3A8A', abbr:'SY', domain:'ssangyong.co.uk' },
  'Subaru':      { id:'subaru',   name:'Subaru',       color:'#1D4ED8', abbr:'SB', domain:'subaru.com' },
  'Suzuki':      { id:'suzuki_c', name:'Suzuki',       color:'#B45309', abbr:'SZ', domain:'suzuki.com' },
  'Tesla':       { id:'tesla',    name:'Tesla',        color:'#EF4444', abbr:'TS', domain:'tesla.com' },
  'Toyota':      { id:'toyota',   name:'Toyota',       color:'#B91C1C', abbr:'TO', domain:'toyota.com' },
  'Volkswagen':  { id:'vw',       name:'Volkswagen',   color:'#1E3A8A', abbr:'VW', domain:'volkswagen.com' },
  'Volvo':       { id:'volvo',    name:'Volvo',        color:'#1D4ED8', abbr:'VO', domain:'volvocars.com' },
};

// ── Parse CSV ─────────────────────────────────────────────────
const csvPath = path.join(__dirname, 'Car Dataset 1945-2020.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
const hdr = parseLine(lines[0]);
const col = k => hdr.indexOf(k);

const I = {
  make:    col('Make'),
  model:   col('Modle'),
  gen:     col('Generation'),
  yearF:   col('Year_from'),
  yearT:   col('Year_to'),
  hp:      col('engine_hp'),
  tank:    col('fuel_tank_capacity_l'),
  engType: col('engine_type'),
  fuelGr:  col('fuel_grade'),
  bat:     col('battery_capacity_KW_per_h'),
};
console.log('Column indices:', I);

// brand → modelName → [{yearF, hp, tank, fuel, gen}]
const db = {};

for (let i = 1; i < lines.length; i++) {
  const ln = lines[i];
  if (!ln.trim()) continue;
  const c = parseLine(ln);
  const make = c[I.make];
  if (!BRANDS[make]) continue;

  const model  = (c[I.model] || '').trim();
  if (!model) continue;

  const yearF  = parseInt(c[I.yearF]) || 0;
  const yearT  = parseInt(c[I.yearT]) || 2025;
  const hp     = parseInt(c[I.hp]) || 0;
  const tank   = parseFloat(c[I.tank]) || 0;
  const bat    = parseFloat(c[I.bat]) || 0;
  const fuel   = mapFuel(c[I.engType], c[I.fuelGr], bat);
  const tankFinal = fuel === 'Electrique' && bat > 0 ? bat : tank;

  // Only include generations ending after 2000 or starting after 1990
  if (yearT < 2000 && yearF < 1990) continue;

  if (!db[make]) db[make] = {};
  if (!db[make][model]) db[make][model] = [];
  db[make][model].push({ yearF, yearT, hp, tank: tankFinal, fuel });
}

// ── Select best trim per model ────────────────────────────────
function pickBest(trims) {
  // Prefer trims with both hp and tank data from most recent year
  const sorted = [...trims].sort((a, b) => b.yearF - a.yearF || b.hp - a.hp);
  return sorted.find(t => t.hp > 0 && t.tank > 0) ||
         sorted.find(t => t.hp > 0) ||
         sorted.find(t => t.tank > 0) ||
         sorted[0];
}

// ── Build output ──────────────────────────────────────────────
const OUT_BRANDS = [];
const OUT_MODELS = {};

// Sort brands alphabetically by display name
const sortedBrandKeys = Object.keys(BRANDS).sort((a, b) =>
  BRANDS[a].name.localeCompare(BRANDS[b].name)
);

for (const csvName of sortedBrandKeys) {
  const cfg = BRANDS[csvName];
  if (!db[csvName]) continue; // brand not in CSV

  const logo = `https://www.google.com/s2/favicons?domain=${cfg.domain}&sz=64`;
  OUT_BRANDS.push({ id: cfg.id, name: cfg.name, color: cfg.color, abbr: cfg.abbr, logo });

  const modelEntries = db[csvName];
  const modelList = [];

  for (const [modelName, trims] of Object.entries(modelEntries)) {
    const best = pickBest(trims);
    if (!best) continue;

    const hp   = best.hp   > 0 ? best.hp   : 100;
    const tank = best.tank > 0 ? best.tank  : 50;
    const year = best.yearF > 0 ? best.yearF.toString() : '2015';
    const id   = `${cfg.id}_${slug(modelName)}_${year}`;

    modelList.push({ id, name: modelName, year, fuel: best.fuel, tank, hp });
  }

  // Sort by name, cap at 30 models
  modelList.sort((a, b) => a.name.localeCompare(b.name));

  // Deduplicate by name (keep first = alphabetically first year)
  const seen = new Set();
  OUT_MODELS[cfg.id] = modelList
    .filter(m => { if (seen.has(m.name)) return false; seen.add(m.name); return true; })
    .slice(0, 30);
}

// ── Motorcycle data (not in CSV, kept manually) ───────────────
const MOTO_BRANDS_DATA = [
  {id:'honda_m',  name:'Honda',        color:'#DC2626', abbr:'HO', logo:'https://www.google.com/s2/favicons?domain=honda.com&sz=64'},
  {id:'yamaha',   name:'Yamaha',       color:'#1D4ED8', abbr:'YA', logo:'https://www.google.com/s2/favicons?domain=yamaha-motor.com&sz=64'},
  {id:'kawasaki', name:'Kawasaki',     color:'#16A34A', abbr:'KW', logo:'https://www.google.com/s2/favicons?domain=kawasaki.com&sz=64'},
  {id:'suzuki',   name:'Suzuki',       color:'#B45309', abbr:'SZ', logo:'https://www.google.com/s2/favicons?domain=suzuki.com&sz=64'},
  {id:'ducati',   name:'Ducati',       color:'#991B1B', abbr:'DU', logo:'https://www.google.com/s2/favicons?domain=ducati.com&sz=64'},
  {id:'bmw_m',    name:'BMW Moto',     color:'#1D4ED8', abbr:'BM', logo:'https://www.google.com/s2/favicons?domain=bmw-motorrad.com&sz=64'},
  {id:'harley',   name:'Harley-D.',    color:'#F59E0B', abbr:'HD', logo:'https://www.google.com/s2/favicons?domain=harley-davidson.com&sz=64'},
  {id:'ktm',      name:'KTM',          color:'#EA580C', abbr:'KT', logo:'https://www.google.com/s2/favicons?domain=ktm.com&sz=64'},
  {id:'triumph',  name:'Triumph',      color:'#1E3A8A', abbr:'TR', logo:'https://www.google.com/s2/favicons?domain=triumphmotorcycles.com&sz=64'},
  {id:'aprilia',  name:'Aprilia',      color:'#DC2626', abbr:'AP', logo:'https://www.google.com/s2/favicons?domain=aprilia.com&sz=64'},
  {id:'benelli',  name:'Benelli',      color:'#374151', abbr:'BE', logo:'https://www.google.com/s2/favicons?domain=benelli.com&sz=64'},
  {id:'royal',    name:'Royal Enfield',color:'#7C3AED', abbr:'RE', logo:'https://www.google.com/s2/favicons?domain=royalenfield.com&sz=64'},
];

const MOTO_MODELS_DATA = `{
  honda_m: [
    {id:'cbr600rr',  name:'CBR600RR',       year:'2021', fuel:'SP98',      tank:18,   hp:120},
    {id:'cbr1000rr', name:'CBR1000RR-R',    year:'2023', fuel:'SP98',      tank:16,   hp:217},
    {id:'cb500f',    name:'CB500F',          year:'2022', fuel:'SP95',      tank:17.7, hp:47},
    {id:'cb650r',    name:'CB650R',          year:'2023', fuel:'SP95',      tank:15.4, hp:95},
    {id:'cb1000r',   name:'CB1000R',         year:'2021', fuel:'SP95',      tank:16.1, hp:145},
    {id:'nc750x',    name:'NC750X',          year:'2023', fuel:'SP95',      tank:14.1, hp:58},
    {id:'africa',    name:'Africa Twin',     year:'2023', fuel:'SP95',      tank:24.8, hp:101},
    {id:'cmx500',    name:'CMX500 Rebel',    year:'2022', fuel:'SP95',      tank:11.1, hp:46},
    {id:'hornet750', name:'Hornet 750',      year:'2023', fuel:'SP95',      tank:15.2, hp:91},
    {id:'cbr300r',   name:'CBR300R',         year:'2020', fuel:'SP95',      tank:13,   hp:30},
  ],
  yamaha: [
    {id:'yzfr1',     name:'YZF-R1',          year:'2023', fuel:'SP98',      tank:17,   hp:200},
    {id:'yzfr6',     name:'YZF-R6',          year:'2020', fuel:'SP98',      tank:17,   hp:117},
    {id:'yzfr3',     name:'YZF-R3',          year:'2023', fuel:'SP95',      tank:14,   hp:42},
    {id:'mt07',      name:'MT-07',            year:'2023', fuel:'SP95',      tank:13,   hp:73},
    {id:'mt09',      name:'MT-09',            year:'2023', fuel:'SP95',      tank:14,   hp:119},
    {id:'mt10',      name:'MT-10',            year:'2022', fuel:'SP98',      tank:17,   hp:166},
    {id:'tracer9',   name:'Tracer 9 GT',      year:'2023', fuel:'SP95',      tank:18,   hp:119},
    {id:'tener700',  name:'Ténéré 700',       year:'2023', fuel:'SP95',      tank:16,   hp:72},
    {id:'xmax300',   name:'XMAX 300',         year:'2023', fuel:'SP95',      tank:13,   hp:28},
    {id:'fz8',       name:'FZ-8',             year:'2016', fuel:'SP95',      tank:17,   hp:106},
  ],
  kawasaki: [
    {id:'zx10r',     name:'ZX-10R',           year:'2023', fuel:'SP98',      tank:17,   hp:203},
    {id:'zx6r',      name:'ZX-6R',            year:'2023', fuel:'SP98',      tank:17,   hp:130},
    {id:'z900',      name:'Z900',             year:'2023', fuel:'SP95',      tank:17,   hp:125},
    {id:'z650',      name:'Z650',             year:'2023', fuel:'SP95',      tank:15,   hp:68},
    {id:'ninja650',  name:'Ninja 650',        year:'2023', fuel:'SP95',      tank:15,   hp:68},
    {id:'versys650', name:'Versys 650',       year:'2023', fuel:'SP95',      tank:21,   hp:68},
    {id:'z1000',     name:'Z1000',            year:'2020', fuel:'SP95',      tank:15,   hp:142},
    {id:'w800',      name:'W800',             year:'2021', fuel:'SP95',      tank:14.5, hp:47},
  ],
  suzuki: [
    {id:'gsxs1000',  name:'GSX-S1000',        year:'2023', fuel:'SP98',      tank:19,   hp:152},
    {id:'hayabusa',  name:'Hayabusa',          year:'2023', fuel:'SP98',      tank:20,   hp:190},
    {id:'gsxr750',   name:'GSX-R750',         year:'2017', fuel:'SP98',      tank:17.5, hp:148},
    {id:'sv650',     name:'SV650',             year:'2023', fuel:'SP95',      tank:14.5, hp:76},
    {id:'vstrom650', name:'V-Strom 650',       year:'2023', fuel:'SP95',      tank:20,   hp:71},
    {id:'vstrom1050',name:'V-Strom 1050',      year:'2023', fuel:'SP95',      tank:20,   hp:107},
    {id:'burgman400',name:'Burgman 400',       year:'2022', fuel:'SP95',      tank:13.5, hp:31},
    {id:'gsxs125',   name:'GSX-S125',          year:'2021', fuel:'SP95',      tank:11.4, hp:15},
  ],
  ducati: [
    {id:'paniV4',    name:'Panigale V4',       year:'2023', fuel:'SP98',      tank:17.5, hp:215},
    {id:'monster937',name:'Monster 937',       year:'2023', fuel:'SP98',      tank:14.5, hp:111},
    {id:'multiV4',   name:'Multistrada V4',    year:'2023', fuel:'SP95',      tank:22,   hp:170},
    {id:'diavel',    name:'Diavel V4',          year:'2023', fuel:'SP98',      tank:17.5, hp:168},
    {id:'scramb1100',name:'Scrambler 1100',    year:'2023', fuel:'SP95',      tank:15,   hp:86},
    {id:'supersport',name:'SuperSport 950',    year:'2023', fuel:'SP95',      tank:16,   hp:110},
    {id:'desertx',   name:'DesertX',            year:'2023', fuel:'SP95',      tank:21,   hp:110},
    {id:'hyperm698', name:'Hypermotard 698',   year:'2024', fuel:'SP98',      tank:10,   hp:77},
  ],
  bmw_m: [
    {id:'s1000rr',   name:'S1000RR',           year:'2023', fuel:'SP98',      tank:16.5, hp:210},
    {id:'r1250gs',   name:'R1250GS',           year:'2023', fuel:'SP95',      tank:20,   hp:136},
    {id:'r1250rt',   name:'R1250RT',           year:'2023', fuel:'SP95',      tank:25,   hp:136},
    {id:'f900r',     name:'F900R',             year:'2023', fuel:'SP95',      tank:13,   hp:105},
    {id:'f850gs',    name:'F850GS',            year:'2023', fuel:'SP95',      tank:15,   hp:95},
    {id:'g310r',     name:'G310R',             year:'2021', fuel:'SP95',      tank:11,   hp:34},
    {id:'r18',       name:'R18',               year:'2023', fuel:'SP95',      tank:16,   hp:91},
    {id:'m1000rr',   name:'M1000RR',           year:'2023', fuel:'SP98',      tank:16.5, hp:212},
  ],
  harley: [
    {id:'sportsterS',name:'Sportster S',       year:'2023', fuel:'SP95',      tank:11.8, hp:121},
    {id:'fatboy114', name:'Fat Boy 114',        year:'2023', fuel:'SP95',      tank:18.9, hp:93},
    {id:'streetGlide',name:'Street Glide',     year:'2023', fuel:'SP95',      tank:22.7, hp:93},
    {id:'roadKing',  name:'Road King',          year:'2023', fuel:'SP95',      tank:22.7, hp:93},
    {id:'panamerica',name:'Pan America 1250',   year:'2023', fuel:'SP95',      tank:21.1, hp:150},
    {id:'nightster', name:'Nightster 975',      year:'2023', fuel:'SP95',      tank:13.1, hp:90},
    {id:'softailStd',name:'Softail Standard',  year:'2023', fuel:'SP95',      tank:13.2, hp:95},
    {id:'lowriderS', name:'Low Rider S',        year:'2023', fuel:'SP95',      tank:18.9, hp:121},
  ],
  ktm: [
    {id:'duke390',   name:'390 Duke',           year:'2023', fuel:'SP95',      tank:13.4, hp:44},
    {id:'duke690',   name:'690 Duke',           year:'2023', fuel:'SP95',      tank:14.5, hp:74},
    {id:'duke890',   name:'890 Duke',           year:'2023', fuel:'SP95',      tank:14.5, hp:121},
    {id:'duke1290',  name:'1290 Super Duke',    year:'2023', fuel:'SP98',      tank:16,   hp:180},
    {id:'adv1290',   name:'1290 Adventure',     year:'2023', fuel:'SP95',      tank:23,   hp:160},
    {id:'adv890',    name:'890 Adventure',      year:'2023', fuel:'SP95',      tank:20,   hp:105},
    {id:'rc390',     name:'RC 390',             year:'2022', fuel:'SP95',      tank:13.4, hp:44},
    {id:'exc500',    name:'500 EXC-F',          year:'2023', fuel:'SP95',      tank:9.5,  hp:63},
  ],
  triumph: [
    {id:'bonT120',   name:'Bonneville T120',    year:'2023', fuel:'SP95',      tank:14.5, hp:80},
    {id:'tiger900',  name:'Tiger 900',          year:'2023', fuel:'SP95',      tank:20,   hp:95},
    {id:'tiger1200', name:'Tiger 1200',         year:'2023', fuel:'SP95',      tank:30,   hp:150},
    {id:'speed3RS',  name:'Speed Triple RS',    year:'2023', fuel:'SP98',      tank:15.5, hp:180},
    {id:'street3RS', name:'Street Triple RS',   year:'2023', fuel:'SP98',      tank:17.4, hp:130},
    {id:'daytona660',name:'Daytona 660',        year:'2024', fuel:'SP98',      tank:14.5, hp:95},
    {id:'scramb1200',name:'Scrambler 1200',     year:'2023', fuel:'SP95',      tank:18,   hp:90},
    {id:'speedmaster',name:'Speedmaster',       year:'2023', fuel:'SP95',      tank:14.5, hp:80},
  ],
  aprilia: [
    {id:'rsv4',      name:'RSV4 Factory',       year:'2023', fuel:'SP98',      tank:18.5, hp:217},
    {id:'tuonoV4',   name:'Tuono V4',            year:'2023', fuel:'SP98',      tank:18.5, hp:175},
    {id:'rs660',     name:'RS660',               year:'2023', fuel:'SP95',      tank:15,   hp:100},
    {id:'tuono660',  name:'Tuono 660',           year:'2023', fuel:'SP95',      tank:15,   hp:95},
    {id:'dorsoduro', name:'Dorsoduro 900',       year:'2020', fuel:'SP95',      tank:15,   hp:95},
    {id:'shiver',    name:'Shiver 900',          year:'2020', fuel:'SP95',      tank:15,   hp:95},
    {id:'rx125',     name:'RX 125',              year:'2022', fuel:'SP95',      tank:5.8,  hp:15},
    {id:'srx160',    name:'SX 160',              year:'2022', fuel:'SP95',      tank:6.2,  hp:16},
  ],
  benelli: [
    {id:'trk502',    name:'TRK 502',             year:'2022', fuel:'SP95',      tank:20,   hp:47},
    {id:'trk800',    name:'TRK 800',             year:'2023', fuel:'SP95',      tank:20,   hp:80},
    {id:'leoncino500',name:'Leoncino 500',       year:'2022', fuel:'SP95',      tank:18,   hp:47},
    {id:'leoncino800',name:'Leoncino 800',       year:'2023', fuel:'SP95',      tank:18,   hp:80},
    {id:'bn302',     name:'BN 302',              year:'2022', fuel:'SP95',      tank:15,   hp:38},
    {id:'752s',      name:'752 S',               year:'2023', fuel:'SP95',      tank:18.5, hp:80},
    {id:'trk251',    name:'TRK 251',             year:'2022', fuel:'SP95',      tank:18.5, hp:26},
    {id:'trk502x',   name:'TRK 502X',            year:'2022', fuel:'SP95',      tank:18.5, hp:47},
  ],
  royal: [
    {id:'meteor350', name:'Meteor 350',          year:'2023', fuel:'SP95',      tank:15,   hp:20},
    {id:'classic350',name:'Classic 350',         year:'2023', fuel:'SP95',      tank:13,   hp:20},
    {id:'himalayan', name:'Himalayan 450',       year:'2024', fuel:'SP95',      tank:17,   hp:40},
    {id:'hunter350', name:'Hunter 350',          year:'2023', fuel:'SP95',      tank:13,   hp:20},
    {id:'guerrilla', name:'Guerrilla 450',       year:'2024', fuel:'SP95',      tank:13,   hp:40},
    {id:'superMet',  name:'Super Meteor 650',    year:'2023', fuel:'SP95',      tank:15.7, hp:47},
    {id:'contGT',    name:'Continental GT 650',  year:'2023', fuel:'SP95',      tank:12.5, hp:47},
    {id:'intercept', name:'Interceptor 650',     year:'2023', fuel:'SP95',      tank:13.7, hp:47},
  ],
}`;

// ── Generate vehicleAPI.js ─────────────────────────────────────
let out = `// vehicleAPI.js — Auto-generated from Car Dataset 1945-2020.csv\n// Run: node dbvhc/generate.js to regenerate\n\n`;

// CAR_BRANDS
out += `export const CAR_BRANDS = [\n`;
for (const b of OUT_BRANDS) {
  out += `  {id:'${b.id}', name:'${b.name.replace(/'/g,"\\'")}', color:'${b.color}', abbr:'${b.abbr}', logo:'${b.logo}'},\n`;
}
out += `];\n\n`;

// MOTO_BRANDS
out += `export const MOTO_BRANDS = [\n`;
for (const b of MOTO_BRANDS_DATA) {
  out += `  {id:'${b.id}', name:'${b.name}', color:'${b.color}', abbr:'${b.abbr}', logo:'${b.logo}'},\n`;
}
out += `];\n\n`;

// CAR_MODELS
out += `export const CAR_MODELS = {\n`;
for (const brandId of Object.keys(OUT_MODELS)) {
  const models = OUT_MODELS[brandId];
  if (!models.length) continue;
  out += `  ${brandId}: [\n`;
  for (const m of models) {
    const name = m.name.replace(/'/g, "\\'");
    out += `    {id:'${m.id}', name:'${name}', year:'${m.year}', fuel:'${m.fuel}', tank:${Math.round(m.tank * 10) / 10}, hp:${m.hp}},\n`;
  }
  out += `  ],\n`;
}
out += `};\n\n`;

// MOTO_MODELS
out += `export const MOTO_MODELS = ${MOTO_MODELS_DATA};\n\n`;

// Helper functions
out += `export function getBrands(type = 'car') {
  return type === 'motorcycle' ? MOTO_BRANDS : CAR_BRANDS;
}

export function getModels(brandId, type = 'car') {
  const db = type === 'motorcycle' ? MOTO_MODELS : CAR_MODELS;
  return db[brandId] || [];
}

export function getYearRange(from = 2000) {
  const years = [];
  const cur = new Date().getFullYear();
  for (let y = cur; y >= from; y--) years.push(y);
  return years;
}
`;

const outPath = path.join(__dirname, '../src/vehicleAPI.js');
fs.writeFileSync(outPath, out, 'utf8');

// ── Stats ─────────────────────────────────────────────────────
let total = 0;
for (const v of Object.values(OUT_MODELS)) total += v.length;
console.log(`\n✓ Generated src/vehicleAPI.js`);
console.log(`  Car brands : ${OUT_BRANDS.length}`);
console.log(`  Car models : ${total}`);
console.log(`  Avg/brand  : ${(total / OUT_BRANDS.length).toFixed(1)}`);
console.log(`\nTop brands by model count:`);
Object.entries(OUT_MODELS).sort((a,b) => b[1].length - a[1].length).slice(0,10).forEach(([k,v]) => {
  console.log(`  ${k.padEnd(12)} ${v.length} models`);
});
