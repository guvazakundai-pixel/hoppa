import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";
import L from "leaflet";

/* ═══════════════════════════════════════════════════════════════════════════════
   HOPPA — Find Rides, Shops & Services in Harare
   "Hoppa ride. Hoppa shop. Hoppa deal."
   ═══════════════════════════════════════════════════════════════════════════════ */

const CFG = { name: "Hoppa", tagline: "Find Rides, Shops & Services", wa: "263785629712", adminPw: "hoppa2024" };
const waLink = (m) => `https://wa.me/${CFG.wa}?text=${encodeURIComponent(m)}`;
const waDriver = (d) => `https://wa.me/${d.phone}?text=${encodeURIComponent(`Hi ${d.name}, I need a ride from ${d.from} to ${d.to}. Are you available?`)}`;
const waShop = (s) => `https://wa.me/${s.phone}?text=${encodeURIComponent(`Hi, I found ${s.name} on Hoppa. I'd like to know more about your services.`)}`;

// ─── Local Storage ────────────────────────────────────────────────────────────
const ls = {
  get: (k, d) => { try { const v = localStorage.getItem(`hoppa_${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`hoppa_${k}`, JSON.stringify(v)); } catch {} },
};

// ─── Sample Data (empty — user fills via admin) ──────────────────────────────
const DEFAULT_ROUTES = [
  { id: 1, from: "Town (CBD)", to: "Chitungwiza", rank: "Fourth Street / Charge Office", fare: 1.00, fareZig: 13, via: "Seke Road, Simon Mazorodze", stops: "Southerton, Hunyani, St Marys, Zengeza, Unit L", time: "45 mins", peak: "6-8am, 4-6pm", notes: "Last kombi ~9pm" },
  { id: 2, from: "Town (CBD)", to: "Budiriro", rank: "Charge Office", fare: 0.50, fareZig: 7, via: "Marimba", stops: "Kambuzuma, Marimba, Budiriro 1-5", time: "30 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 3, from: "Town (CBD)", to: "Glen View", rank: "Charge Office", fare: 0.50, fareZig: 7, via: "Kambuzuma", stops: "Kambuzuma, Glen View 1-8", time: "30 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 4, from: "Town (CBD)", to: "Highfield", rank: "Copa Cabana", fare: 0.50, fareZig: 7, via: "Machipisa", stops: "Machipisa, Lusaka, Engineering", time: "25 mins", peak: "6-8am, 5-6pm", notes: "" },
  { id: 5, from: "Town (CBD)", to: "Mbare", rank: "Market Square", fare: 0.50, fareZig: 7, via: "Direct", stops: "Mbare Musika", time: "10 mins", peak: "All day", notes: "Very frequent" },
  { id: 6, from: "Town (CBD)", to: "Epworth", rank: "Fourth Street", fare: 0.50, fareZig: 7, via: "Chiremba Road", stops: "Hatfield, Epworth", time: "35 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 7, from: "Town (CBD)", to: "Borrowdale", rank: "Rezende Street", fare: 0.50, fareZig: 7, via: "Enterprise Road", stops: "Newlands, Borrowdale", time: "25 mins", peak: "7-8am, 5-6pm", notes: "" },
  { id: 8, from: "Town (CBD)", to: "Mt Pleasant", rank: "Rezende Street", fare: 0.50, fareZig: 7, via: "UA", stops: "Avondale, Mt Pleasant", time: "20 mins", peak: "7-9am, 4-6pm", notes: "" },
  { id: 9, from: "Town (CBD)", to: "Norton", rank: "Copa Cabana", fare: 2.00, fareZig: 26, via: "Western Road", stops: "Ruwa turn, Norton", time: "60 mins", peak: "6am, 5pm", notes: "Longer route" },
  { id: 10, from: "Town (CBD)", to: "Ruwa", rank: "Fourth Street", fare: 1.00, fareZig: 13, via: "Mutare Road", stops: "Hatfield, Ruwa", time: "40 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 11, from: "Town (CBD)", to: "Dzivarasekwa", rank: "Angwa Street", fare: 0.50, fareZig: 7, via: "Lomagundi Road", stops: "Marlborough, Dzivarasekwa", time: "25 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 12, from: "Town (CBD)", to: "Warren Park", rank: "Market Square / Mbare", fare: 0.50, fareZig: 7, via: "Mbare", stops: "Mbare, Warren Park D, Warren Park 1", time: "30 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 13, from: "Town (CBD)", to: "Hatfield", rank: "Rezende Street", fare: 0.50, fareZig: 7, via: "Airport Road", stops: "Hatfield, Rangemore", time: "20 mins", peak: "7-8am, 5-6pm", notes: "" },
  { id: 14, from: "Town (CBD)", to: "Waterfalls", rank: "Copa Cabana", fare: 0.50, fareZig: 7, via: "Ardbennie", stops: "Ardbennie, Waterfalls", time: "25 mins", peak: "6-8am, 4-6pm", notes: "" },
  { id: 15, from: "Town (CBD)", to: "Greendale", rank: "Rezende Street", fare: 0.50, fareZig: 7, via: "Mutare Road", stops: "Eastlea, Greendale", time: "20 mins", peak: "7-8am, 5-6pm", notes: "" },
];

const DEFAULT_DRIVERS = [];
const DEFAULT_SHOPS = [];

// ─── Context ──────────────────────────────────────────────────────────────────
const Ctx = createContext();
function Provider({ children }) {
  const [routes, setRoutes] = useState(() => ls.get("routes", DEFAULT_ROUTES));
  const [drivers, setDrivers] = useState(() => ls.get("drivers", DEFAULT_DRIVERS));
  const [shops, setShops] = useState(() => ls.get("shops", DEFAULT_SHOPS));
  const [dark, setDark] = useState(() => ls.get("dark", false));
  const [toast, setToast] = useState(null);

  useEffect(() => { ls.set("routes", routes); }, [routes]);
  useEffect(() => { ls.set("drivers", drivers); }, [drivers]);
  useEffect(() => { ls.set("shops", shops); }, [shops]);
  useEffect(() => { ls.set("dark", dark); document.body.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); } }, [toast]);

  return <Ctx.Provider value={{ routes, setRoutes, drivers, setDrivers, shops, setShops, dark, setDark, toast, setToast }}>{children}</Ctx.Provider>;
}
const useApp = () => useContext(Ctx);

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  return <Provider><Router /></Provider>;
}

function Router() {
  const [view, setView] = useState("home");
  const [adminAuth, setAdminAuth] = useState(false);

  if (view === "admin") {
    if (!adminAuth) return <Login onAuth={() => setAdminAuth(true)} onBack={() => setView("home")} />;
    return <AdminPanel onLogout={() => { setAdminAuth(false); setView("home"); }} />;
  }
  return <Main view={view} setView={setView} />;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN SITE
// ═════════════════════════════════════════════════════════════════════════════
function Main({ view, setView }) {
  const { dark, setDark, toast } = useApp();
  const [searchTo, setSearchTo] = useState("");

  return (
    <div className="fade-in">
      <nav className="nav">
        <div className="nav__inner">
          <div className="nav__logo" onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="14" fill="url(#lg)"/>
              <circle cx="32" cy="22" r="8" stroke="#fff" strokeWidth="3" fill="none"/>
              <path d="M32 30C18 30 14 44 14 48h36c0-4-4-18-18-18z" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M32 14v-2M30 14h4l-2-3z" fill="#fff"/>
              <defs><linearGradient id="lg" x1="0" y1="0" x2="64" y2="64"><stop stopColor="#0056D2"/><stop offset="1" stopColor="#2563EB"/></linearGradient></defs>
            </svg>
            Hoppa <span>Harare</span>
          </div>
          <div className="nav__spacer" />
          {["home", "rides", "drivers", "shops", "routes"].map(v => (
            <button key={v} className={`nav__link hide-mobile ${view === v ? "nav__link--active" : ""}`} onClick={() => setView(v)}>
              {v === "home" ? "Home" : v === "rides" ? "Find Ride" : v === "drivers" ? "Drivers" : v === "shops" ? "Shops" : "Routes"}
            </button>
          ))}
          <button className="nav__icon-btn" onClick={() => setDark(!dark)}>{dark ? "\u2600" : "\u263E"}</button>
          <button className="nav__link hide-mobile" onClick={() => setView("register")}>Register</button>
          <button className="nav__link hide-mobile" onClick={() => setView("admin")} style={{ fontSize: 12, color: "#9ca3af" }}>Admin</button>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: dark ? "#1a1a2e" : "#fff", borderTop: `1px solid ${dark ? "#2d2d44" : "#eee"}`, display: "flex", padding: "6px 0" }} className="show-mobile-only">
        {[{ id: "home", icon: "\u2302", label: "Home" }, { id: "rides", icon: "\uD83D\uDE90", label: "Rides" }, { id: "routes", icon: "\uD83D\uDDFA", label: "Routes" }, { id: "shops", icon: "\uD83C\uDFEA", label: "Shops" }, { id: "register", icon: "\u270E", label: "Join" }].map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 600, color: view === t.id ? "#0056D2" : "#9ca3af", background: "none", border: "none", padding: "4px 0" }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ paddingBottom: 70 }}>
        {view === "home" && <HomePage setView={setView} setSearchTo={setSearchTo} />}
        {view === "rides" && <RidesPage initialTo={searchTo} />}
        {view === "drivers" && <DriversPage />}
        {view === "shops" && <ShopsPage />}
        {view === "routes" && <RoutesPage initialSearch={searchTo} />}
        {view === "register" && <RegisterPage />}
      </div>

      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__col">
            <h4>Hoppa</h4>
            <a href="#">Find rides in Harare</a>
            <a href="#">Local shops & services</a>
            <a href="#">Kombi routes & fares</a>
          </div>
          <div className="footer__col">
            <h4>For Drivers</h4>
            <a href="#" onClick={e => { e.preventDefault(); setView("register"); }}>Register as driver</a>
            <a href="#">How it works</a>
          </div>
          <div className="footer__col">
            <h4>For Business</h4>
            <a href="#" onClick={e => { e.preventDefault(); setView("register"); }}>List your business</a>
            <a href="#">Advertise with us</a>
          </div>
          <div className="footer__col">
            <h4>Contact</h4>
            <a href={waLink("Hi Hoppa!")} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a href="#" onClick={e => { e.preventDefault(); setView("admin"); }}>Admin</a>
          </div>
        </div>
        <div className="footer__bottom">&copy; 2026 Hoppa. Made in Zimbabwe.</div>
      </footer>

      <a className="wa-float" href={waLink("Hi Hoppa! I need help.")} target="_blank" rel="noopener noreferrer">&#128172;</a>
      {toast && <div className="toast">{toast}</div>}

      <style>{`
        @media (min-width: 769px) { .show-mobile-only { display: none !important; } }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ setView, setSearchTo }) {
  const { routes, drivers, shops } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const destinations = useMemo(() => [...new Set(routes.map(r => r.to))].sort(), [routes]);
  const origins = useMemo(() => [...new Set(routes.map(r => r.from))].sort(), [routes]);

  const search = () => { setSearchTo(to); setView("rides"); };

  return (
    <>
      <div className="hero">
        <div className="hero__badge">HARARE, ZIMBABWE</div>
        <h1>Hoppa <em>ride.</em> Hoppa <em>shop.</em> Hoppa <em>deal.</em></h1>
        <p className="hero__sub">Find kombi routes, available drivers, and local shops & services — all in one place.</p>
      </div>

      <div className="search-box">
        <div className="search-box__row">
          <div className="search-box__field">
            <span className="search-box__label">From</span>
            <select className="search-box__input" value={from} onChange={e => setFrom(e.target.value)}>
              <option value="">Select pickup</option>
              {origins.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="search-box__field">
            <span className="search-box__label">To</span>
            <select className="search-box__input" value={to} onChange={e => setTo(e.target.value)}>
              <option value="">Where to?</option>
              {destinations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <button className="search-box__btn" onClick={search}>
          Find Route &#8594;
        </button>
      </div>

      {/* Stats */}
      <div className="stats" style={{ marginTop: 32 }}>
        <div className="stat-card"><div className="stat-card__value">{routes.length}</div><div className="stat-card__label">Routes</div></div>
        <div className="stat-card"><div className="stat-card__value">{drivers.length}</div><div className="stat-card__label">Drivers</div></div>
        <div className="stat-card"><div className="stat-card__value">{shops.length}</div><div className="stat-card__label">Shops</div></div>
        <div className="stat-card"><div className="stat-card__value">Harare</div><div className="stat-card__label">City</div></div>
      </div>

      {/* Categories */}
      <div className="categories">
        <div className="categories__title">What are you looking for?</div>
        <div className="categories__grid">
          <div className="cat-card" onClick={() => setView("routes")}><div className="cat-card__icon">&#128652;</div><div className="cat-card__name">Kombi Routes</div><div className="cat-card__count">{routes.length} routes</div></div>
          <div className="cat-card" onClick={() => setView("drivers")}><div className="cat-card__icon">&#128663;</div><div className="cat-card__name">Available Drivers</div><div className="cat-card__count">{drivers.length} drivers</div></div>
          <div className="cat-card" onClick={() => setView("shops")}><div className="cat-card__icon">&#127978;</div><div className="cat-card__name">Shops & Food</div><div className="cat-card__count">{shops.filter(s => s.type === "shop" || s.type === "food").length} listings</div></div>
          <div className="cat-card" onClick={() => setView("shops")}><div className="cat-card__icon">&#9986;</div><div className="cat-card__name">Services</div><div className="cat-card__count">{shops.filter(s => s.type === "service").length} listings</div></div>
          <div className="cat-card" onClick={() => setView("register")}><div className="cat-card__icon">&#128100;</div><div className="cat-card__name">Register as Driver</div><div className="cat-card__count">Start earning</div></div>
          <div className="cat-card" onClick={() => setView("register")}><div className="cat-card__icon">&#128188;</div><div className="cat-card__name">List Your Business</div><div className="cat-card__count">Get customers</div></div>
        </div>
      </div>

      {/* How It Works */}
      <div className="how-it-works">
        <div className="how-it-works__title">How Hoppa Works</div>
        <div className="how-it-works__grid">
          <div className="how-step"><div className="how-step__num">1</div><div className="how-step__title">Search</div><div className="how-step__desc">Tell us where you're going. We show you kombi routes, available drivers, and shops along the way.</div></div>
          <div className="how-step"><div className="how-step__num">2</div><div className="how-step__title">Choose</div><div className="how-step__desc">Pick a kombi route or a private driver. See fares, ratings, and availability before you decide.</div></div>
          <div className="how-step"><div className="how-step__num">3</div><div className="how-step__title">Hoppa!</div><div className="how-step__desc">Contact the driver on WhatsApp, arrange your ride, and go. Pay cash or EcoCash directly.</div></div>
        </div>
      </div>

      {/* Recent Drivers */}
      {drivers.length > 0 && (
        <div className="listings">
          <div className="listings__header">
            <div className="listings__title">Available Drivers</div>
            <button className="nav__link" onClick={() => setView("drivers")}>See all &#8594;</button>
          </div>
          <div className="listings__grid">
            {drivers.filter(d => d.status === "online").slice(0, 3).map(d => <DriverCard key={d.id} driver={d} />)}
          </div>
        </div>
      )}
    </>
  );
}

// ─── ROUTES PAGE ──────────────────────────────────────────────────────────────
function RoutesPage({ initialSearch = "" }) {
  const { routes } = useApp();
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter(r => r.from.toLowerCase().includes(q) || r.to.toLowerCase().includes(q) || r.via.toLowerCase().includes(q) || r.stops.toLowerCase().includes(q));
  }, [routes, search]);

  return (
    <div className="listings" style={{ paddingTop: 24 }}>
      <div className="listings__header">
        <div className="listings__title">Kombi Routes ({filtered.length})</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <input className="search-box__input" placeholder="Search routes, destinations, stops..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 500 }} />
      </div>
      <div className="listings__grid">
        {filtered.map(r => <RouteCard key={r.id} route={r} />)}
      </div>
      {filtered.length === 0 && <div className="empty"><div className="empty__icon">&#128652;</div><div className="empty__text">No routes found. Try a different search.</div></div>}
    </div>
  );
}

// ─── RIDES / FIND RIDE PAGE ───────────────────────────────────────────────────
function RidesPage({ initialTo = "" }) {
  const { drivers, routes } = useApp();
  const [to, setTo] = useState(initialTo);

  const destinations = useMemo(() => [...new Set([...routes.map(r => r.to), ...drivers.map(d => d.to)])].sort(), [routes, drivers]);
  const available = useMemo(() => {
    let list = drivers.filter(d => d.status === "online");
    if (to) list = list.filter(d => d.to.toLowerCase().includes(to.toLowerCase()));
    return list;
  }, [drivers, to]);

  const matchingRoutes = useMemo(() => {
    if (!to) return [];
    return routes.filter(r => r.to.toLowerCase().includes(to.toLowerCase()));
  }, [routes, to]);

  return (
    <div className="listings" style={{ paddingTop: 24 }}>
      <div className="listings__header"><div className="listings__title">Find a Ride</div></div>

      <div className="search-box" style={{ maxWidth: 500, marginBottom: 24 }}>
        <div className="search-box__field">
          <span className="search-box__label">Where are you going?</span>
          <select className="search-box__input" value={to} onChange={e => setTo(e.target.value)}>
            <option value="">All destinations</option>
            {destinations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Matching kombi routes */}
      {matchingRoutes.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>&#128652; Kombi Routes</h3>
          <div className="listings__grid" style={{ marginBottom: 24 }}>
            {matchingRoutes.map(r => <RouteCard key={r.id} route={r} />)}
          </div>
        </>
      )}

      {/* Available drivers */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>&#128663; Available Drivers ({available.length})</h3>
      {available.length > 0 ? (
        <div className="listings__grid">
          {available.map(d => <DriverCard key={d.id} driver={d} />)}
        </div>
      ) : (
        <div className="empty"><div className="empty__icon">&#128663;</div><div className="empty__text">{drivers.length === 0 ? "No drivers registered yet. Be the first!" : "No drivers available for this route right now."}</div></div>
      )}
    </div>
  );
}

// ─── DRIVER CARD ──────────────────────────────────────────────────────────────
function DriverCard({ driver: d }) {
  return (
    <div className="ride-card">
      <div className="ride-card__top">
        <div className="ride-card__driver">
          <div className="ride-card__avatar">{d.name.charAt(0)}</div>
          <div><div className="ride-card__name">{d.name}</div><div className="ride-card__car">{d.car}</div></div>
        </div>
        <span className={`ride-card__status ride-card__status--${d.status === "online" ? "online" : d.seats === 0 ? "full" : "offline"}`}>
          {d.status === "online" ? "Available" : d.seats === 0 ? "Full" : "Offline"}
        </span>
      </div>
      <div className="ride-card__route">
        <span className="ride-card__from">{d.from}</span>
        <span className="ride-card__arrow">&#8594;</span>
        <span className="ride-card__to">{d.to}</span>
      </div>
      <div className="ride-card__details">
        <span className="ride-card__detail">&#128176; ${d.fare?.toFixed(2) || "0.00"}</span>
        <span className="ride-card__detail">&#128186; {d.seats || 0} seats</span>
        {d.time && <span className="ride-card__detail">&#9200; {d.time}</span>}
        {d.rating && <span className="ride-card__detail">&#11088; {d.rating}</span>}
      </div>
      <div className="ride-card__actions">
        <a className="ride-card__wa" href={waDriver(d)} target="_blank" rel="noopener noreferrer">&#128172; WhatsApp</a>
        {d.phone && <a className="ride-card__call" href={`tel:${d.phone}`}>Call</a>}
      </div>
    </div>
  );
}

// ─── ROUTE CARD (with inline Leaflet map) ─────────────────────────────────────
const AREA_COORDS = {
  "Chitungwiza": [-18.0127, 31.0755],
  "Budiriro": [-17.8650, 30.9830],
  "Glen View": [-17.8700, 30.9700],
  "Highfield": [-17.8560, 30.9900],
  "Mbare": [-17.8530, 31.0420],
  "Epworth": [-17.8900, 31.1200],
  "Borrowdale": [-17.7600, 31.0900],
  "Mt Pleasant": [-17.7800, 31.0500],
  "Norton": [-17.8830, 30.7000],
  "Ruwa": [-17.8900, 31.2300],
  "Dzivarasekwa": [-17.8000, 30.9400],
  "Warren Park": [-17.8300, 30.9700],
  "Hatfield": [-17.8200, 31.0700],
  "Waterfalls": [-17.8600, 31.0200],
  "Greendale": [-17.8000, 31.1000],
  "Marlborough": [-17.7700, 30.9600],
  "Avondale": [-17.7900, 31.0300],
  "Town (CBD)": [-17.8292, 31.0522],
};
const CBD = [-17.8292, 31.0522];

function RouteMap({ from, to }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const origin = AREA_COORDS[from] || CBD;
  const dest = AREA_COORDS[to] || CBD;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);

    // Origin marker (blue)
    L.circleMarker(origin, { radius: 8, color: "#fff", fillColor: "#0056D2", fillOpacity: 1, weight: 3 })
      .addTo(map).bindPopup(`<b>Pickup:</b> ${from}`);

    // Destination marker (green)
    L.circleMarker(dest, { radius: 8, color: "#fff", fillColor: "#059669", fillOpacity: 1, weight: 3 })
      .addTo(map).bindPopup(`<b>Destination:</b> ${to}`);

    // Fetch actual road route from OSRM (free)
    const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          L.polyline(coords, { color: "#0056D2", weight: 4, opacity: 0.8 }).addTo(map);
          map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
        } else {
          // Fallback: straight line
          L.polyline([origin, dest], { color: "#0056D2", weight: 3, dashArray: "8,8" }).addTo(map);
          map.fitBounds(L.latLngBounds([origin, dest]), { padding: [30, 30] });
        }
      })
      .catch(() => {
        // Fallback if OSRM is down
        L.polyline([origin, dest], { color: "#0056D2", weight: 3, dashArray: "8,8" }).addTo(map);
        map.fitBounds(L.latLngBounds([origin, dest]), { padding: [30, 30] });
      });

    // Temp bounds while route loads
    map.fitBounds(L.latLngBounds([origin, dest]), { padding: [30, 30] });
    L.control.zoom({ position: "bottomright" }).addTo(map);

    return () => { map.remove(); mapRef.current = null; };
  }, [from, to]);

  return <div ref={containerRef} style={{ width: "100%", height: 250, borderRadius: 10 }} />;
}

function RouteCard({ route: r }) {
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="route-card">
      <div className="route-card__header">
        <div className="route-card__route">{r.from} &#8594; {r.to}</div>
        <div className="route-card__fare">${r.fare?.toFixed(2)}</div>
      </div>
      <div className="route-card__rank">&#128205; Rank: {r.rank}</div>
      {r.via && <div className="route-card__stops">Via: {r.via}</div>}
      {r.stops && <div className="route-card__stops">Stops: {r.stops}</div>}
      <div className="route-card__meta">
        <span>&#9200; {r.time}</span>
        {r.peak && <span>&#128293; Peak: {r.peak}</span>}
        {r.fareZig > 0 && <span>ZiG {r.fareZig}</span>}
      </div>
      {r.notes && <div style={{ fontSize: 12, color: "#0056D2", marginTop: 6, fontWeight: 600 }}>{r.notes}</div>}

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setShowMap(!showMap)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1.5px solid #e5e7eb", background: showMap ? "#EEF4FF" : "#fff", color: showMap ? "#0056D2" : "#4b5563", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
          &#128506; {showMap ? "Hide Map" : "View Route on Map"}
        </button>
      </div>

      {showMap && (
        <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <RouteMap from={r.from} to={r.to} />
          <div style={{ padding: "8px 12px", background: "#f8fafc", display: "flex", gap: 8, fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#0056D2", display: "inline-block" }} /> Pickup</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#059669", display: "inline-block" }} /> Destination</span>
            <span style={{ marginLeft: "auto", color: "#0056D2", borderBottom: "1px dashed #0056D2" }}>- - Route</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DRIVERS PAGE ─────────────────────────────────────────────────────────────
function DriversPage() {
  const { drivers } = useApp();
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (filter === "online") return drivers.filter(d => d.status === "online");
    return drivers;
  }, [drivers, filter]);

  return (
    <div className="listings" style={{ paddingTop: 24 }}>
      <div className="listings__header"><div className="listings__title">Drivers ({filtered.length})</div></div>
      <div className="filter-bar">
        <button className={`filter-chip ${filter === "all" ? "filter-chip--active" : ""}`} onClick={() => setFilter("all")}>All</button>
        <button className={`filter-chip ${filter === "online" ? "filter-chip--active" : ""}`} onClick={() => setFilter("online")}>Available Now</button>
      </div>
      {filtered.length > 0 ? (
        <div className="listings__grid">{filtered.map(d => <DriverCard key={d.id} driver={d} />)}</div>
      ) : (
        <div className="empty"><div className="empty__icon">&#128663;</div><div className="empty__text">No drivers registered yet.</div></div>
      )}
    </div>
  );
}

// ─── SHOPS PAGE ───────────────────────────────────────────────────────────────
function ShopsPage() {
  const { shops } = useApp();
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...shops];
    if (type !== "all") list = list.filter(s => s.type === type);
    if (search) { const q = search.toLowerCase(); list = list.filter(s => s.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q)); }
    return list;
  }, [shops, type, search]);

  return (
    <div className="listings" style={{ paddingTop: 24 }}>
      <div className="listings__header"><div className="listings__title">Shops & Services ({filtered.length})</div></div>
      <div className="filter-bar">
        {["all", "food", "shop", "service"].map(t => (
          <button key={t} className={`filter-chip ${type === t ? "filter-chip--active" : ""}`} onClick={() => setType(t)}>
            {t === "all" ? "All" : t === "food" ? "&#127860; Food" : t === "shop" ? "&#128717; Shops" : "&#128736; Services"}
          </button>
        ))}
        <input className="search-box__input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 200, height: 34, fontSize: 13 }} />
      </div>
      {filtered.length > 0 ? (
        <div className="listings__grid">
          {filtered.map(s => (
            <div key={s.id} className="shop-card">
              <div className="shop-card__top">
                <div className="shop-card__icon">{s.type === "food" ? "&#127860;" : s.type === "shop" ? "&#128717;" : "&#128736;"}</div>
                <div><div className="shop-card__name">{s.name}</div><div className="shop-card__type">{s.type}</div></div>
              </div>
              {s.location && <div className="shop-card__location">&#128205; {s.location}</div>}
              {s.description && <div className="shop-card__desc">{s.description}</div>}
              {s.rating && <div className="shop-card__rating"><span className="shop-card__stars">{"\u2605".repeat(Math.round(s.rating))}{"\u2606".repeat(5 - Math.round(s.rating))}</span> {s.rating}</div>}
              <div className="shop-card__actions">
                {s.phone && <a className="ride-card__wa" href={waShop(s)} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>&#128172; WhatsApp</a>}
                {s.phone && <a className="ride-card__call" href={`tel:${s.phone}`}>Call</a>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><div className="empty__icon">&#127978;</div><div className="empty__text">No listings yet. Be the first to list your business!</div></div>
      )}
    </div>
  );
}

// ─── REGISTER PAGE ────────────────────────────────────────────────────────────
function RegisterPage() {
  const { setDrivers, setShops, setToast } = useApp();
  const [tab, setTab] = useState("driver");
  const [form, setForm] = useState({ name: "", phone: "", car: "", from: "Town (CBD)", to: "", fare: "", seats: "4", type: "food", location: "", description: "" });
  const u = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setToast("Name and phone required"); return; }

    if (tab === "driver") {
      const driver = { id: Date.now(), name: form.name, phone: form.phone.startsWith("263") ? form.phone : `263${form.phone.replace(/^0/, "")}`, car: form.car, from: form.from, to: form.to, fare: Number(form.fare) || 0, seats: Number(form.seats) || 4, status: "online", rating: 0, time: "" };
      setDrivers(prev => [...prev, driver]);
      setToast("Driver registered! You're now visible to passengers.");
    } else {
      const shop = { id: Date.now(), name: form.name, phone: form.phone.startsWith("263") ? form.phone : `263${form.phone.replace(/^0/, "")}`, type: form.type, location: form.location, description: form.description, rating: 0 };
      setShops(prev => [...prev, shop]);
      setToast("Business listed! Customers can now find you.");
    }
    setForm({ name: "", phone: "", car: "", from: "Town (CBD)", to: "", fare: "", seats: "4", type: "food", location: "", description: "" });
  };

  return (
    <div className="register">
      <div className="register__card">
        <div className="register__title">Join Hoppa</div>
        <div className="register__sub">Register as a driver or list your business</div>

        <div className="tabs">
          <button className={`tab ${tab === "driver" ? "tab--active" : ""}`} onClick={() => setTab("driver")}>&#128663; Driver</button>
          <button className={`tab ${tab === "vendor" ? "tab--active" : ""}`} onClick={() => setTab("vendor")}>&#128188; Business</button>
        </div>

        <form onSubmit={submit}>
          <div className="form__group">
            <label className="form__label">{tab === "driver" ? "Your Name" : "Business Name"}</label>
            <input className="form__input" value={form.name} onChange={e => u("name", e.target.value)} required placeholder={tab === "driver" ? "e.g. Tindo Moyo" : "e.g. Mama's Kitchen"} />
          </div>
          <div className="form__group">
            <label className="form__label">WhatsApp Number</label>
            <input className="form__input" value={form.phone} onChange={e => u("phone", e.target.value)} required placeholder="e.g. 0771234567" />
          </div>

          {tab === "driver" ? (
            <>
              <div className="form__group"><label className="form__label">Vehicle</label><input className="form__input" value={form.car} onChange={e => u("car", e.target.value)} placeholder="e.g. Toyota Hiace, Honda Fit" /></div>
              <div className="form__row">
                <div className="form__group"><label className="form__label">From</label><input className="form__input" value={form.from} onChange={e => u("from", e.target.value)} /></div>
                <div className="form__group"><label className="form__label">To</label><input className="form__input" value={form.to} onChange={e => u("to", e.target.value)} placeholder="e.g. Chitungwiza" /></div>
              </div>
              <div className="form__row">
                <div className="form__group"><label className="form__label">Fare (USD)</label><input className="form__input" type="number" step="0.5" value={form.fare} onChange={e => u("fare", e.target.value)} placeholder="1.00" /></div>
                <div className="form__group"><label className="form__label">Seats Available</label><input className="form__input" type="number" value={form.seats} onChange={e => u("seats", e.target.value)} /></div>
              </div>
            </>
          ) : (
            <>
              <div className="form__group">
                <label className="form__label">Business Type</label>
                <select className="form__select" value={form.type} onChange={e => u("type", e.target.value)}>
                  <option value="food">Food & Restaurant</option>
                  <option value="shop">Shop / Retail</option>
                  <option value="service">Service Provider</option>
                </select>
              </div>
              <div className="form__group"><label className="form__label">Location</label><input className="form__input" value={form.location} onChange={e => u("location", e.target.value)} placeholder="e.g. Near Fourth Street Rank" /></div>
              <div className="form__group"><label className="form__label">Description</label><textarea className="form__textarea" value={form.description} onChange={e => u("description", e.target.value)} placeholder="What do you sell or offer?" /></div>
            </>
          )}

          <button className="form__btn" type="submit">
            {tab === "driver" ? "Register as Driver" : "List My Business"}
          </button>
        </form>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═════════════════════════════════════════════════════════════════════════════
function Login({ onAuth, onBack }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="login">
      <form className="login__card" onSubmit={e => { e.preventDefault(); pw === CFG.adminPw ? onAuth() : setErr("Wrong password"); }}>
        <div className="login__logo" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="36" height="36" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="url(#lg2)"/><circle cx="32" cy="22" r="8" stroke="#fff" strokeWidth="3" fill="none"/><path d="M32 30C18 30 14 44 14 48h36c0-4-4-18-18-18z" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/><defs><linearGradient id="lg2" x1="0" y1="0" x2="64" y2="64"><stop stopColor="#0056D2"/><stop offset="1" stopColor="#2563EB"/></linearGradient></defs></svg>
          Hoppa
        </div>
        <div className="login__sub">Admin Panel</div>
        <input className="form__input" type="password" placeholder="Password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} style={{ textAlign: "center", marginBottom: 16 }} autoFocus />
        <button className="form__btn" type="submit">Login</button>
        {err && <div className="login__error">{err}</div>}
        <button type="button" style={{ marginTop: 16, color: "#9ca3af", fontSize: 13 }} onClick={onBack}>&larr; Back</button>
      </form>
    </div>
  );
}

const ADMIN_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "routes", label: "Routes" },
  { id: "drivers", label: "Drivers" },
  { id: "shops", label: "Shops" },
  { id: "settings", label: "Settings" },
];

function AdminPanel({ onLogout }) {
  const { dark, setDark } = useApp();
  const [section, setSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const render = () => {
    switch (section) {
      case "dashboard": return <AdminDash />;
      case "routes": return <AdminRoutes />;
      case "drivers": return <AdminDrivers />;
      case "shops": return <AdminShops />;
      case "settings": return <AdminSettings />;
      default: return <AdminDash />;
    }
  };

  return (
    <div className="admin">
      <aside className={`admin__sidebar ${sidebarOpen ? "admin__sidebar--open" : ""}`}>
        <div className="admin__sidebar-header"><div className="admin__sidebar-logo">Hoppa</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Admin Panel</div></div>
        <nav className="admin__nav">
          {ADMIN_TABS.map(t => (
            <button key={t.id} className={`admin__nav-item ${section === t.id ? "admin__nav-item--active" : ""}`} onClick={() => { setSection(t.id); setSidebarOpen(false); }}>{t.label}</button>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid #eee" }}>
          <button className="admin__nav-item" onClick={() => setDark(!dark)}>{dark ? "Light Mode" : "Dark Mode"}</button>
          <button className="admin__nav-item" style={{ color: "#dc2626" }} onClick={onLogout}>&larr; Exit</button>
        </div>
      </aside>
      <main className="admin__content">{render()}</main>
      <button className="admin__mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? "\u2715" : "\u2630"}</button>
    </div>
  );
}

function AdminDash() {
  const { routes, drivers, shops } = useApp();
  return (
    <div className="fade-in">
      <div className="admin__header"><h1 className="admin__title">Dashboard</h1></div>
      <div className="admin__stats">
        <div className="admin__stat-card"><div className="admin__stat-label">Routes</div><div className="admin__stat-value">{routes.length}</div></div>
        <div className="admin__stat-card"><div className="admin__stat-label">Drivers</div><div className="admin__stat-value">{drivers.length}</div></div>
        <div className="admin__stat-card"><div className="admin__stat-label">Online Drivers</div><div className="admin__stat-value" style={{ color: "#059669" }}>{drivers.filter(d => d.status === "online").length}</div></div>
        <div className="admin__stat-card"><div className="admin__stat-label">Shops/Services</div><div className="admin__stat-value">{shops.length}</div></div>
      </div>
    </div>
  );
}

function AdminRoutes() {
  const { routes, setRoutes, setToast } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ from: "Town (CBD)", to: "", rank: "", fare: "", fareZig: "", via: "", stops: "", time: "", peak: "", notes: "" });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    if (!form.to) return;
    const route = { ...form, id: editing?.id || Date.now(), fare: Number(form.fare) || 0, fareZig: Number(form.fareZig) || 0 };
    if (editing) {
      setRoutes(prev => prev.map(r => r.id === editing.id ? route : r));
      setToast("Route updated");
    } else {
      setRoutes(prev => [...prev, route]);
      setToast("Route added");
    }
    setEditing(null);
    setForm({ from: "Town (CBD)", to: "", rank: "", fare: "", fareZig: "", via: "", stops: "", time: "", peak: "", notes: "" });
  };

  const edit = (r) => { setEditing(r); setForm({ ...r }); };
  const del = (id) => { setRoutes(prev => prev.filter(r => r.id !== id)); setToast("Route deleted"); };

  return (
    <div className="fade-in">
      <div className="admin__header"><h1 className="admin__title">Routes ({routes.length})</h1></div>

      {/* Add/Edit Form */}
      <div className="admin__stat-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editing ? "Edit Route" : "Add Route"}</h3>
        <div className="form__row"><div className="form__group"><label className="form__label">From</label><input className="form__input" value={form.from} onChange={e => u("from", e.target.value)} /></div><div className="form__group"><label className="form__label">To</label><input className="form__input" value={form.to} onChange={e => u("to", e.target.value)} placeholder="e.g. Chitungwiza" /></div></div>
        <div className="form__group"><label className="form__label">Rank / Pickup Point</label><input className="form__input" value={form.rank} onChange={e => u("rank", e.target.value)} placeholder="e.g. Fourth Street" /></div>
        <div className="form__row"><div className="form__group"><label className="form__label">Fare (USD)</label><input className="form__input" type="number" step="0.25" value={form.fare} onChange={e => u("fare", e.target.value)} /></div><div className="form__group"><label className="form__label">Fare (ZiG)</label><input className="form__input" type="number" value={form.fareZig} onChange={e => u("fareZig", e.target.value)} /></div></div>
        <div className="form__group"><label className="form__label">Via</label><input className="form__input" value={form.via} onChange={e => u("via", e.target.value)} placeholder="e.g. Seke Road" /></div>
        <div className="form__group"><label className="form__label">Stops</label><input className="form__input" value={form.stops} onChange={e => u("stops", e.target.value)} placeholder="e.g. Stop1, Stop2, Stop3" /></div>
        <div className="form__row"><div className="form__group"><label className="form__label">Travel Time</label><input className="form__input" value={form.time} onChange={e => u("time", e.target.value)} placeholder="e.g. 45 mins" /></div><div className="form__group"><label className="form__label">Peak Hours</label><input className="form__input" value={form.peak} onChange={e => u("peak", e.target.value)} placeholder="e.g. 6-8am, 4-6pm" /></div></div>
        <div className="form__group"><label className="form__label">Notes</label><input className="form__input" value={form.notes} onChange={e => u("notes", e.target.value)} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--primary" onClick={save}>{editing ? "Update" : "Add Route"}</button>
          {editing && <button className="btn btn--outline" onClick={() => { setEditing(null); setForm({ from: "Town (CBD)", to: "", rank: "", fare: "", fareZig: "", via: "", stops: "", time: "", peak: "", notes: "" }); }}>Cancel</button>}
        </div>
      </div>

      <div className="admin__table-wrap">
        <table className="admin__table">
          <thead><tr><th>From</th><th>To</th><th>Rank</th><th>Fare</th><th>Time</th><th>Actions</th></tr></thead>
          <tbody>
            {routes.map(r => (
              <tr key={r.id}>
                <td>{r.from}</td><td style={{ fontWeight: 600 }}>{r.to}</td><td>{r.rank}</td><td style={{ color: "#0056D2", fontWeight: 700 }}>${r.fare?.toFixed(2)}</td><td>{r.time}</td>
                <td><button className="btn btn--sm btn--outline" onClick={() => edit(r)}>Edit</button> <button className="btn btn--sm btn--danger" onClick={() => del(r.id)}>Del</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminDrivers() {
  const { drivers, setDrivers, setToast } = useApp();

  const toggle = (id) => { setDrivers(prev => prev.map(d => d.id === id ? { ...d, status: d.status === "online" ? "offline" : "online" } : d)); };
  const del = (id) => { setDrivers(prev => prev.filter(d => d.id !== id)); setToast("Driver removed"); };

  return (
    <div className="fade-in">
      <div className="admin__header"><h1 className="admin__title">Drivers ({drivers.length})</h1></div>
      {drivers.length === 0 ? (
        <div className="empty"><div className="empty__icon">&#128663;</div><div className="empty__text">No drivers registered yet.</div></div>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Route</th><th>Fare</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td><td>{d.phone}</td><td>{d.car}</td><td>{d.from} &#8594; {d.to}</td><td>${d.fare?.toFixed(2)}</td>
                  <td><span className={`ride-card__status ride-card__status--${d.status}`}>{d.status}</span></td>
                  <td><button className="btn btn--sm btn--outline" onClick={() => toggle(d.id)}>{d.status === "online" ? "Set Offline" : "Set Online"}</button> <button className="btn btn--sm btn--danger" onClick={() => del(d.id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminShops() {
  const { shops, setShops, setToast } = useApp();
  const del = (id) => { setShops(prev => prev.filter(s => s.id !== id)); setToast("Listing removed"); };

  return (
    <div className="fade-in">
      <div className="admin__header"><h1 className="admin__title">Shops & Services ({shops.length})</h1></div>
      {shops.length === 0 ? (
        <div className="empty"><div className="empty__icon">&#127978;</div><div className="empty__text">No businesses listed yet.</div></div>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
              {shops.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td><td>{s.type}</td><td>{s.phone}</td><td>{s.location}</td>
                  <td><button className="btn btn--sm btn--danger" onClick={() => del(s.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminSettings() {
  const { setToast } = useApp();
  return (
    <div className="fade-in">
      <div className="admin__header"><h1 className="admin__title">Settings</h1></div>
      <div className="admin__stat-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Data Management</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn--outline" onClick={() => {
            const data = { routes: JSON.parse(localStorage.getItem("hoppa_routes") || "[]"), drivers: JSON.parse(localStorage.getItem("hoppa_drivers") || "[]"), shops: JSON.parse(localStorage.getItem("hoppa_shops") || "[]") };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "hoppa-backup.json"; a.click(); URL.revokeObjectURL(url);
            setToast("Backup downloaded");
          }}>Export Backup</button>
          <button className="btn btn--outline" onClick={() => {
            const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
            input.onchange = (e) => { const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader(); reader.onload = (ev) => { try { const d = JSON.parse(ev.target.result);
                if (d.routes) localStorage.setItem("hoppa_routes", JSON.stringify(d.routes));
                if (d.drivers) localStorage.setItem("hoppa_drivers", JSON.stringify(d.drivers));
                if (d.shops) localStorage.setItem("hoppa_shops", JSON.stringify(d.shops));
                setToast("Restored! Refreshing..."); setTimeout(() => window.location.reload(), 1000);
              } catch { setToast("Invalid file"); } }; reader.readAsText(file); }; input.click();
          }}>Import Backup</button>
          <button className="btn btn--danger" onClick={() => {
            if (!confirm("Clear ALL data?")) return;
            Object.keys(localStorage).filter(k => k.startsWith("hoppa_")).forEach(k => localStorage.removeItem(k));
            window.location.reload();
          }}>Factory Reset</button>
        </div>
      </div>
    </div>
  );
}
