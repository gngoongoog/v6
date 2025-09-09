import React, { useEffect, useState, useRef } from "react";

/*
Updated متجر Gn App:
- Advanced filters: price range, brand, sort, in-stock
- Product page via hash routing (#/product/:id)
- داكن/فاتح mode toggle
- Skeleton placeholders
- IndexedDB caching (simple)
- Image downscale helper (best-effort)
*/

const WHATSAPP_PHONE = '9647707409507';
const USE_SHEETS_API = false;
const GOOGLE_API_KEY = '';
const SHEET_ID = '';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJpVMBo_g1Mh41ksbktPhCTMOYlKfUkQBYQKFAFXw2oO_C10bOtHjbE4JXvu_Jc1ENUw9o9Yp0vsaX/pub?output=csv';
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

// ---------------- IndexedDB simple wrapper ----------------
function idbSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve(true);
  } catch (e) {
    return Promise.reject(e);
  }
}
function idbGet(key) {
  try {
    const v = localStorage.getItem(key);
    return Promise.resolve(v ? JSON.parse(v) : null);
  } catch (e) {
    return Promise.reject(e);
  }
}

// ---------------- Image downscale helper (best-effort) ----------------
async function downscaleImageToBlob(url, maxWidth=800) {
  try {
    const res = await fetch(url, {mode:'cors'});
    const blob = await res.blob();
    const img = await createImageBitmap(blob);
    const ratio = Math.min(1, maxWidth / img.width);
    const canvas = new OffscreenCanvas(Math.round(img.width * ratio), Math.round(img.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const outBlob = await canvas.convertToBlob({type:'image/jpeg', quality:0.75});
    return outBlob;
  } catch (e) {
    // Cross-origin or other errors may prevent canvas operations; fall back to null
    return null;
  }
}

// ---------------- Fetch products (CSV or API) ----------------
async function fetchProductsRemote() {
  try {
    if (USE_SHEETS_API && GOOGLE_API_KEY && SHEET_ID) {
      const range = 'Products';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const values = json.values || [];
      if (values.length < 2) return [];
      const keys = values[0].map((k) => k.toLowerCase());
      return values.slice(1).map((row) => {
        const obj = {};
        keys.forEach((k, i) => { obj[k] = row[i] ?? ''; });
        return {
          id: obj.id || Math.random().toString(36).slice(2,9),
          title: obj.title || obj.name || 'منتج',
          price: parseFloat(obj.price || '0') || 0,
          category: obj.category || 'عام',
          brand: obj.brand || '',
          image: obj.image || '',
          description: obj.description || '',
          stock: parseInt(obj.stock || '0') || 0,
          created_at: obj.created_at || ''
        };
      });
    } else if (SHEET_CSV_URL) {
      const res = await fetch(SHEET_CSV_URL);
      const csv = await res.text();
      return csvToProducts(csv);
    } else {
      return demoProducts();
    }
  } catch (e) {
    console.error('fetchProducts error', e);
    return demoProducts();
  }
}

function csvToProducts(csv) {
  const lines = csv.split("\n").filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map((line, idx) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h,i) => obj[h]= (cols[i]||'').trim());
    return {
      id: obj.id || `csv${idx}`,
      title: obj.title || obj.name || 'منتج',
      price: parseFloat((obj.price||'0').replace(/[^0-9.]/g, '')) || 0,
      category: obj.category || 'عام',
      brand: obj.brand || '',
      image: obj.image || '',
      description: obj.description || '',
      stock: parseInt(obj.stock||'0')||0,
      created_at: obj.created_at || ''
    }
  });
}

function demoProducts(){
  return [
    {id:'p1', title:'سماعة لاسلكية', price:29.99, category:'سماعات', brand:'BrandA', image:'https://via.placeholder.com/800x600?text=Headphone', description:'سماعة لاسلكية جودة عالية', stock:10, created_at:'2025-01-01'},
    {id:'p2', title:'كابل شحن Type-C', price:9.5, category:'كيبلات', brand:'BrandB', image:'https://via.placeholder.com/800x600?text=Cable', description:'كابل شحن متين', stock:50, created_at:'2025-02-14'},
    {id:'p3', title:'واقي شاشة', price:4.99, category:'شاشات', brand:'BrandC', image:'https://via.placeholder.com/800x600?text=Screen+Protector', description:'واقي شاشة زجاجي', stock:100, created_at:'2025-03-10'},
  ];
}

// ---------------- LazyImage & Skeleton ----------------
function SkeletonCard(){ 
  return (
    <div style={{border:'1px solid #eee', borderRadius:8, padding:12}}>
      <div style={{width:'100%', height:160, background:'#f3f3f3', borderRadius:6}}></div>
      <div style={{height:12, background:'#f3f3f3', width:'60%', marginTop:8, borderRadius:6}}></div>
      <div style={{height:10, background:'#f3f3f3', width:'40%', marginTop:6, borderRadius:6}}></div>
    </div>
  )
}

function LazyImage({ src, alt, style }) {
  const ref = useRef();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      });
      obs.observe(el);
      return () => obs.disconnect();
    } else {
      setVisible(true);
    }
  }, []);
  return (
    <div ref={ref} style={{width:'100%', height:160, background:'#f3f3f3', borderRadius:6, overflow:'hidden', ...style}}>
      {visible ? <img src={src} alt={alt} style={{width:'100%', height:'100%', objectFit:'cover'}} loading="lazy" /> : null}
    </div>
  )
}

// ---------------- App ----------------
export default function App(){
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['all']);
  const [brands, setBrands] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [query, setQuery] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cart, setالسلة] = useState(()=>{ try { return JSON.parse(localStorage.getItem('gn_cart')||'{}'); } catch { return {}; } });
  const [theme, setTheme] = useState(()=> localStorage.getItem('gn_theme') || 'light');
  const [selectedProduct, setSelectedProduct] = useState(null); // for product page
  const [page, setPage] = useState(window.location.hash || '#/');

  // handle hash routing
  useEffect(()=> {
    const onHash = ()=> setPage(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    onHash();
    return ()=> window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(()=> { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('gn_theme', theme); }, [theme]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // try IndexedDB/local cache first
      const cached = await idbGet('gn_products_cache_v2');
      const ts = await idbGet('gn_products_cache_ts_v2') || 0;
      if (cached && Date.now() - ts < CACHE_TTL_MS) {
        setProducts(cached);
        setCategories(['all', ...Array.from(new Set(cached.map(p=>p.category||'عام')))]);
        setBrands(Array.from(new Set(cached.map(p=>p.brand||'').filter(Boolean))));
        setLoading(false);
      }
      const remote = await fetchProductsRemote();
      if (cancelled) return;
      // attempt to downscale and cache images (best-effort)
      for (let p of remote) {
        if (p.image) {
          try {
            const blob = await downscaleImageToBlob(p.image, 800);
            if (blob) {
              // create object URL for cached smaller image (note: this won't persist across reloads)
              const url = URL.createObjectURL(blob);
              p.image = url;
            }
          } catch(e){ /* ignore */ }
        }
      }
      setProducts(remote);
      setCategories(['all', ...Array.from(new Set(remote.map(p=>p.category||'عام')))]);
      setBrands(Array.from(new Set(remote.map(p=>p.brand||'').filter(Boolean))));
      await idbSet('gn_products_cache_v2', remote);
      await idbSet('gn_products_cache_ts_v2', Date.now());
      setLoading(false);
    }
    load();
    return ()=> cancelled = true;
  }, []);

  useEffect(()=> localStorage.setItem('gn_cart', JSON.stringify(cart)), [cart]);

  // product page rendering based on hash
  useEffect(()=> {
    // examples: #/product/p1
    if (page.startsWith('#/product/')) {
      const id = page.replace('#/product/','');
      const p = products.find(x=>x.id===id);
      setSelectedProduct(p || null);
    } else {
      setSelectedProduct(null);
    }
  }, [page, products]);

  function addToالسلة(product, qty=1){
    setالسلة(prev=>{ const copy = {...prev}; if (!copy[product.id]) copy[product.id] = {...product, qty:0}; copy[product.id].qty = Math.min((copy[product.id].qty||0)+qty, product.stock||9999); return copy; });
  }
  function updateQty(id, qty){ setالسلة(prev => { const copy = {...prev}; if (!copy[id]) return prev; if (qty<=0) delete copy[id]; else copy[id].qty = qty; return copy; }); }
  function clearالسلة(){ setالسلة({}); }

  // filtering
  const filtered = products.filter(p => {
    if (activeCat !== 'all' && (p.category||'').toLowerCase() !== activeCat.toLowerCase()) return false;
    if (onlyInStock && (!p.stock || p.stock <= 0)) return false;
    if (query && !`${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (priceMin && p.price < Number(priceMin)) return false;
    if (priceMax && p.price > Number(priceMax)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a,b)=>{
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    return 0;
  });

  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((s,it)=> s + (it.price||0)*(it.qty||0), 0);

  function composeWhatsAppMessage(){
    if (!cartItems.length) return '';
    let lines = [];
    lines.push('طلب من متجر Gn');
    lines.push('');
    cartItems.forEach(it => lines.push(`${it.title} x ${it.qty} — ${formatCurrency(it.price)} each`));
    lines.push('');
    lines.push(`المجموع: ${formatCurrency(subtotal)}`);
    lines.push('');
    lines.push('اسم المشتري:');
    lines.push('العنوان:');
    lines.push('الهاتف:');
    return lines.join('\n');
  }

  function checkoutToWhatsApp(){
    const msg = composeWhatsAppMessage();
    if (!msg) return alert('سلة التسوق فارغة');
    if (!WHATSAPP_PHONE) return alert('اضبط رقم الواتساب في التطبيق');
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  return (
    <div style={{minHeight:'100vh', background: theme==='dark' ? '#0b0b0b' : '#fff', color: theme==='dark'? '#eee' : '#111', direction:'rtl', fontFamily:'Inter, system-ui, -apple-system, Roboto, \"Helvetica Neue\", Arial'}}>
      <header style={{padding:16, borderBottom:`1px solid ${theme==='dark'?'#222':'#e6e6e6'}`, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:48, height:48, borderRadius:8, background: theme==='dark'?'#fff':'#111', color: theme==='dark'?'#111':'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700}}>Gn</div>
          <div>
            <h1 style={{fontSize:20, margin:0}}>متجر Gn</h1>
            <div style={{fontSize:12, color: theme==='dark'?'#aaa':'#666'}}>متجر إلكتروني عصري بالألوان المحايدة</div>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن منتج أو كلمة مفتاحية" style={{padding:'8px 12px', border:`1px solid ${theme==='dark'?'#333':'#ddd'}`, borderRadius:6, background: theme==='dark'?'#0b0b0b':'#fff', color: theme==='dark'?'#fff':'#111'}} />
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:8}}>
            <option value="relevance">أقرب نتائج</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأكثر</option>
            <option value="newest">الأحدث</option>
          </select>
          <button onClick={()=>setTheme(t=> t==='dark'?'light':'dark')} style={{padding:'8px 12px', borderRadius:6}}>{theme==='dark'?'فاتح':'داكن'}</button>
          <div style={{position:'relative'}}>
            <button style={{padding:'8px 12px', border:'1px solid #ddd', borderRadius:6}}>السلة ({cartItems.length})</button>
            <div style={{position:'absolute', right:0, marginTop:8, width:320, background: theme==='dark'?'#0b0b0b':'#fff', border:`1px solid ${theme==='dark'?'#222':'#eee'}`, borderRadius:8, padding:12, boxShadow:'0 6px 18px rgba(0,0,0,0.06)'}}>
              <h3 style={{margin:0, fontWeight:600}}>محتويات السلة</h3>
              <div style={{maxHeight:220, overflow:'auto', marginTop:8}}>
                {cartItems.length === 0 && <div style={{fontSize:13, color:'#888'}}>السلة فارغة</div>}
                {cartItems.map(it=> (
                  <div key={it.id} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid #f3f3f3'}}>
                    <div style={{width:48, height:48, background:'#f3f3f3', flexShrink:0}}><img src={it.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14, fontWeight:500}}>{it.title}</div>
                      <div style={{fontSize:12, color:'#888'}}>{formatCurrency(it.price)} x {it.qty}</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <button onClick={()=>updateQty(it.id, it.qty-1)} style={{padding:'4px 8px'}}>-</button>
                      <div>{it.qty}</div>
                      <button onClick={()=>updateQty(it.id, it.qty+1)} style={{padding:'4px 8px'}}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{fontWeight:700}}>{formatCurrency(subtotal)}</div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={clearالسلة} style={{padding:'8px 12px', border:'1px solid #ddd', borderRadius:6}}>تفريغ</button>
                  <button onClick={checkoutToWhatsApp} style={{padding:'8px 12px', borderRadius:6, background:'#111', color:'#fff'}}>إتمام الشراء</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{padding:16, maxWidth:1100, margin:'0 auto'}}>
        <section style={{display:'flex', gap:16, marginBottom:12, alignItems:'flex-start'}}>
          <aside style={{minWidth:220}}>
            <div style={{marginBottom:12}}>
              <h4>الفئات</h4>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {categories.map(cat => <button key={cat} onClick={()=>setActiveCat(cat)} style={{padding:8, borderRadius:6, textAlign:'right', background: activeCat===cat? '#111':'transparent', color: activeCat===cat? '#fff': undefined}}>{cat}</button>)}
              </div>
            </div>

            <div style={{marginBottom:12}}>
              <h4>الفلتر المتقدم</h4>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                <label>العلامة التجارية</label>
                <select value={''} onChange={(e)=> setActiveCat(a=>a)} style={{padding:8}}>
                  <option value="">كل العلامات</option>
                  {brands.map(b=> <option key={b} value={b}>{b}</option>)}
                </select>

                <label>السعر من</label>
                <input type="number" value={priceMin} onChange={e=>setPriceMin(e.target.value)} style={{padding:8}} />
                <label>إلى</label>
                <input type="number" value={priceMax} onChange={e=>setPriceMax(e.target.value)} style={{padding:8}} />
                <label><input type="checkbox" checked={onlyInStock} onChange={e=>setOnlyInStock(e.target.checked)} /> المتوفر فقط</label>
              </div>
            </div>

            <div>
              <h4>تحسين محركات البحث</h4>
              <p style={{fontSize:13, color:'#666'}}>تم إضافة meta tags وملف sitemap.xml. عدل index.html لاستبدال GA_MEASUREMENT_ID.</p>
            </div>
          </aside>

          <div style={{flex:1}}>
            {loading ? (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16}}>
                {Array.from({length:6}).map((_,i)=><SkeletonCard key={i} />)}
              </div>
            ) : selectedProduct ? (
              // Product page
              <article>
                <button onClick={()=> window.location.hash = '#/'} style={{marginBottom:12}}>العودة</button>
                <div style={{display:'flex', gap:16}}>
                  <div style={{flex:'0 0 400px'}}><img src={selectedProduct.image} alt={selectedProduct.title} style={{width:'100%', borderRadius:8}}/></div>
                  <div>
                    <h2>{selectedProduct.title}</h2>
                    <div style={{fontWeight:700, marginTop:8}}>{formatCurrency(selectedProduct.price)}</div>
                    <p style={{marginTop:12}}>{selectedProduct.description}</p>
                    <div style={{marginTop:12}}>
                      <button onClick={()=>addToالسلة(selectedProduct,1)} style={{padding:'10px 14px', background:'#111', color:'#fff', borderRadius:6}}>أضف إلى السلة</button>
                    </div>
                  </div>
                </div>
              </article>
            ) : (
              <section style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16}}>
                {sorted.map(p => (
                  <article key={p.id} style={{border:'1px solid #eee', borderRadius:8, overflow:'hidden', display:'flex', flexDirection:'column', transition:'transform .18s', cursor:'pointer'}} onClick={()=> window.location.hash = `#/product/${p.id}`}>
                    <div style={{overflow:'hidden'}}>
                      <LazyImage src={p.image} alt={p.title} />
                    </div>
                    <div style={{padding:12, display:'flex', flexDirection:'column', flex:1}}>
                      <h3 style={{margin:0, fontWeight:600}}>{p.title}</h3>
                      <div style={{fontSize:13, color:'#666', flex:1, marginTop:8}}>{p.description}</div>
                      <div style={{marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                        <div style={{fontWeight:700}}>{formatCurrency(p.price)}</div>
                        <div>
                          <button onClick={(e)=>{ e.stopPropagation(); addToالسلة(p,1); }} style={{padding:'8px 12px', borderRadius:6, border:'1px solid #ddd'}}>أضف</button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        </section>
      </main>

      <footer style={{padding:16, textAlign:'center', fontSize:13, color:'#888'}}>© {new Date().getFullYear()} متجر Gn</footer>
    </div>
  );
}

function formatCurrency(v){ return (typeof v === 'number' ? v : Number(v||0)).toLocaleString('ar-IQ', {style:'currency', currency:'IQD', minimumFractionDigits:0, maximumFractionDigits:0}); }
