const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
// GSAP drives the motion layer; without it (CDN blocked) or with reduced motion, the page stays static and complete
const hasGsap = Boolean(window.gsap && window.ScrollTrigger) && !reduceMotion;
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('gsap');
}

// Lenis smooths wheel and trackpad scrolling (touch keeps native scrolling) and drives ScrollTrigger
let lenis = null;
if (hasGsap && window.Lenis) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Every heading slides up line by line. Headings with <br>s split there; single-line text is split
// into the lines the browser actually wraps it to.
const splitLines = (el) => {
  const wrap = (parts) => parts.map((part) => `<span class="line"><span>${part.trim()}</span></span>`).join('');
  if (el.querySelector(':scope > :not(br)')) {
    el.innerHTML = wrap(el.innerHTML.split(/<br\s*\/?>/i));
    return;
  }
  const segments = el.innerHTML.split(/<br\s*\/?>/i);
  const lines = [];
  segments.forEach((segment) => {
    el.innerHTML = segment.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    let top = null;
    let current = [];
    el.querySelectorAll('.w').forEach((w) => {
      if (top !== null && Math.abs(w.offsetTop - top) > 4) { lines.push(current.join(' ')); current = []; }
      top = w.offsetTop;
      current.push(w.innerHTML);
    });
    if (current.length) lines.push(current.join(' '));
  });
  el.innerHTML = wrap(lines);
};
document.querySelectorAll('main h2:not(.visually-hidden):not(.spin__title):not(.cta__title):not(.bag__title), main h3:not(#goalTitle):not(.ctabs__name):not(.prod__name)')
  .forEach((h) => h.setAttribute('data-lines', ''));
document.querySelectorAll('[data-lines]').forEach(splitLines);

// ---------- Nav: background on scroll, hide on scroll down, progress, current section ----------
const nav = document.getElementById('nav');
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
const progressBar = document.getElementById('progressBar');
const navLinks = [...links.querySelectorAll('a')];
const navSections = navLinks.map((a) => document.querySelector(a.getAttribute('href')));

let lastY = window.scrollY;
let activeLink = null;
let ticking = false;

const updateActive = () => {
  const line = window.innerHeight * 0.4;
  let current = null;
  navSections.forEach((s, i) => {
    if (s && s.getBoundingClientRect().top <= line) current = navLinks[i];
  });
  if (current === activeLink) return;
  activeLink = current;
  navLinks.forEach((a) => {
    a.classList.toggle('is-active', a === current);
    if (a === current) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
};

const onScroll = () => {
  const y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 20);
  if (!links.classList.contains('is-open')) {
    nav.classList.toggle('is-hidden', y > 400 && y > lastY);
  }
  lastY = y;
  updateActive();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  ticking = false;
};
window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(onScroll);
  }
}, { passive: true });
onScroll();

// Mobile menu
const setMenu = (open) => {
  links.classList.toggle('is-open', open);
  nav.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
toggle.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
navLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
// In-page links glide through Lenis when it is running
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!lenis || !target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -76 });
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && links.classList.contains('is-open')) {
    setMenu(false);
    toggle.focus();
  }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

// ---------- Colour theme: the toggle cycles Volt → Light → Classic, remembered per browser ----------
const themeToggle = document.getElementById('themeToggle');
const THEMES = ['volt', 'light', 'classic'];
const THEME_NAMES = { volt: 'Volt', light: 'Light', classic: 'Classic' };

const currentTheme = () => root.dataset.theme || 'light';
const applyTheme = (theme) => {
  if (theme === 'light') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const label = `Theme: ${THEME_NAMES[theme]}. Switch to ${THEME_NAMES[next]}`;
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  if (hasGsap) ScrollTrigger.refresh(); // Classic uses a different typeface, so heights change
};
applyTheme(currentTheme());

themeToggle.addEventListener('click', () => {
  const theme = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  try { localStorage.setItem('fx-theme-v2', theme); } catch (e) {}
  if (reduceMotion || !document.startViewTransition) {
    applyTheme(theme);
    return;
  }
  // New theme grows out of the button as a circle
  const r = themeToggle.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => applyTheme(theme)).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
});

// ---------- Shop by goal: pick a goal, read its stack ----------
const goals = {
  muscle: {
    title: 'Build Muscle',
    desc: 'Hit your protein target, train with progressive overload and recover properly. This stack covers the basics.',
    stack: [
      ['Whey Protein', '25–30g post-workout to hit daily protein'],
      ['Creatine Monohydrate', '3–5g daily for strength and size'],
      ['Mass Gainer', 'For hard-gainers struggling to eat enough calories'],
      ['Multivitamin', 'Cover micronutrient gaps while you grow'],
    ],
  },
  fat: {
    title: 'Lose Fat',
    desc: 'A calorie deficit does the heavy lifting. These help you keep muscle, stay full and stay energised while cutting.',
    stack: [
      ['Whey Isolate', 'High protein, low carb and fat — protects lean mass'],
      ['L-Carnitine / Fat Burner', 'Support energy and fat metabolism'],
      ['BCAA / EAA', 'Sip during training on low-calorie days'],
      ['Omega-3', 'Supports heart health and recovery'],
    ],
  },
  perform: {
    title: 'Performance',
    desc: 'For athletes and lifters chasing PRs, endurance and better sessions every time.',
    stack: [
      ['Pre-Workout', 'Energy, focus and pump before training'],
      ['Creatine Monohydrate', 'More power output on heavy sets'],
      ['EAA + Electrolytes', 'Hydration and endurance intra-workout'],
      ['Whey Protein', 'Faster recovery between sessions'],
    ],
  },
  health: {
    title: 'Everyday Health',
    desc: 'Not training for a stage? These essentials support energy, immunity and long-term wellbeing.',
    stack: [
      ['Multivitamin', 'Daily foundation for micronutrients'],
      ['Omega-3 Fish Oil', 'Heart, joint and brain support'],
      ['Vitamin D3 + K2', 'Bone health and immunity'],
      ['Protein Powder', 'An easy way to meet daily protein needs'],
    ],
  },
};

const tabs = [...document.querySelectorAll('.goal-tab')];
const goalTitle = document.getElementById('goalTitle');
const goalDesc = document.getElementById('goalDesc');
const goalStack = document.getElementById('goalStack');

const renderGoal = (key, animate = false) => {
  const g = goals[key];
  goalTitle.textContent = g.title;
  goalDesc.textContent = g.desc;
  goalStack.innerHTML = g.stack.map(([name, note]) => `<tr><td>${name}</td><td>${note}</td></tr>`).join('');
  tabs.forEach((t) => {
    const active = t.dataset.goal === key;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
    t.tabIndex = active ? 0 : -1;
  });
  if (animate && hasGsap) {
    gsap.from([goalTitle, goalDesc], { y: 18, opacity: 0, duration: .5, stagger: .06, ease: 'power3.out' });
    gsap.from(goalStack.children, { x: 28, opacity: 0, duration: .5, stagger: .06, ease: 'power3.out' });
  }
};

tabs.forEach((t, i) => {
  t.addEventListener('click', () => {
    if (!t.classList.contains('is-active')) renderGoal(t.dataset.goal, true);
  });
  // Arrow keys move between tabs (WAI-ARIA tabs pattern)
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus();
    renderGoal(next.dataset.goal, true);
  });
});
renderGoal('muscle');

document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Outlets: the stat always matches the list — add an outlet to the HTML and the number updates itself ----------
const outletCount = document.querySelector('[data-outlet-count]');
if (outletCount) {
  const n = document.querySelectorAll('.outlet').length;
  outletCount.dataset.count = n;
  outletCount.textContent = String(n).padStart(2, '0');
}

// WhatsApp is the one way to order. Number with country code, digits only (e.g. '919876543210').
// While empty, all WhatsApp buttons stay hidden.
const WHATSAPP_NUMBER = '918921852071';
const WHATSAPP_MESSAGE = "Hi Fuel X Pro Nutrition, I'd like to order / get a recommendation.";
const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

if (WHATSAPP_NUMBER) {
  document.querySelectorAll('[data-wa]').forEach((a) => { a.href = waLink(WHATSAPP_MESSAGE); });
  // "Order this stack" sends the goal and its products
  const goalOrder = document.getElementById('goalOrder');
  if (goalOrder) goalOrder.addEventListener('click', () => {
    const items = [...goalStack.querySelectorAll('td:first-child')].map((td) => td.textContent).join(', ');
    goalOrder.href = waLink(`Hi Fuel X Pro Nutrition, I'd like the ${goalTitle.textContent} stack: ${items}. Please share the price and availability.`);
  });
} else {
  document.querySelectorAll('[data-wa]').forEach((el) => el.remove());
}

// ---------- Shop: search, category and brand filters; "All" starts with the first 12 ----------
const shop = document.querySelector('.shop');
if (shop) {
  const SHOP_PAGE = 12;
  const cards = [...shop.querySelectorAll('.prod')];
  const chips = shop.querySelectorAll('.shop__chip');
  const search = shop.querySelector('.shop__search input');
  const brandSelect = shop.querySelector('.shop__brand select');
  const countEl = shop.querySelector('.shop__count span');
  const empty = shop.querySelector('.shop__empty');
  const more = shop.querySelector('.shop__more');
  const state = { cat: 'all', brand: '', q: '', expanded: false };
  let refreshTimer;

  const renderShop = () => {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = cards.filter((c) => {
      if (state.cat !== 'all' && c.dataset.cat !== state.cat) return false;
      if (state.brand && c.dataset.brand !== state.brand) return false;
      const text = c.textContent.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    const browsing = state.cat === 'all' && !state.brand && !words.length;
    const limit = browsing && !state.expanded ? SHOP_PAGE : Infinity;
    cards.forEach((c) => { c.hidden = true; });
    matches.forEach((c, i) => { c.hidden = i >= limit; });
    countEl.textContent = matches.length;
    empty.hidden = matches.length > 0;
    more.hidden = matches.length <= limit;
    more.querySelector('span').textContent = `Show all ${matches.length} products`;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 150);
  };

  const setCat = (cat) => {
    state.cat = cat;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    renderShop();
  };

  chips.forEach((btn) => btn.addEventListener('click', () => setCat(btn.dataset.cat)));
  search.addEventListener('input', () => { state.q = search.value.trim(); renderShop(); });
  brandSelect.addEventListener('change', () => { state.brand = brandSelect.value; renderShop(); });
  more.addEventListener('click', () => { state.expanded = true; renderShop(); });
  // Category cards above jump here already filtered
  document.querySelectorAll('[data-shop-cat]').forEach((a) => a.addEventListener('click', () => {
    search.value = ''; state.q = '';
    brandSelect.value = ''; state.brand = '';
    setCat(a.dataset.shopCat);
  }));
  renderShop();

  // ---------- Order bag: kept in this browser, sent to WhatsApp with the customer's details ----------
  const bag = document.getElementById('bag');
  const fab = document.querySelector('.bag-fab');
  const navCart = document.querySelector('.nav__cart');
  const navCount = navCart && navCart.querySelector('.nav__cart-count');
  const list = bag.querySelector('.bag__list');
  const waBtn = bag.querySelector('.bag__wa');
  const form = bag.querySelector('.bag__form');
  const totalEl = bag.querySelector('.bag__total-value');
  const totalNote = bag.querySelector('.bag__total-note');
  const toast = document.querySelector('.toast');
  const PRICES = window.FX_PRICES || {};
  const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;
  const priceOf = (id) => Number(PRICES[id]) || 0;
  const cardFor = (id) => shop.querySelector(`.prod[data-id="${id}"]`);
  const flavourOf = (card) => {
    const select = card.querySelector('.prod__flavour select');
    const one = card.querySelector('.prod__flavour--one');
    return select ? select.value : (one ? one.textContent : '');
  };
  let lastFocus = null;

  let items = [];
  try { items = JSON.parse(localStorage.getItem('fx-bag')) || []; } catch (e) {}
  items = items.filter((it) => cardFor(it.id));
  const save = () => { try { localStorage.setItem('fx-bag', JSON.stringify(items)); } catch (e) {} };
  const find = (id, flavour) => items.find((it) => it.id === id && it.flavour === flavour);
  const change = (id, flavour, step) => {
    const it = find(id, flavour);
    if (it) it.qty += step;
    else if (step > 0) items.push({ id, flavour, qty: step });
    items = items.filter((x) => x.qty > 0);
    save();
    renderBag();
  };

  // Prices from prices.js; products left at 0 stay "Price on request"
  shop.querySelectorAll('.prod').forEach((card) => {
    const price = priceOf(card.dataset.id);
    if (price) {
      const el = card.querySelector('.prod__price');
      el.textContent = rupees(price);
      el.classList.add('has-price');
    }
  });

  // Outlets in the form come from the Visit section, so a new outlet appears here too
  const outletSelect = form.querySelector('[name="outlet"]');
  document.querySelectorAll('.outlet__name').forEach((n) => {
    const o = document.createElement('option');
    o.textContent = n.textContent.trim();
    outletSelect.appendChild(o);
  });

  // Customer details are remembered in this browser for next time
  const fields = ['name', 'outlet', 'address', 'note'];
  try {
    const saved = JSON.parse(localStorage.getItem('fx-customer')) || {};
    fields.forEach((f) => { if (saved[f]) form.elements[f].value = saved[f]; });
    if (saved.method) form.querySelector(`[name="method"][value="${saved.method}"]`).checked = true;
  } catch (e) {}
  const method = () => form.querySelector('[name="method"]:checked').value;
  const showMethod = () => form.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== method(); });
  const saveCustomer = () => {
    const data = { method: method() };
    fields.forEach((f) => { data[f] = form.elements[f].value.trim(); });
    try { localStorage.setItem('fx-customer', JSON.stringify(data)); } catch (e) {}
  };

  const totals = () => {
    let sum = 0;
    let onRequest = 0;
    items.forEach((it) => { const p = priceOf(it.id); if (p) sum += p * it.qty; else onRequest += it.qty; });
    return { sum, onRequest };
  };

  const orderText = () => {
    const { sum, onRequest } = totals();
    const lines = items.map((it, i) => {
      const p = priceOf(it.id);
      return `${i + 1}. ${cardFor(it.id).dataset.name}${it.flavour ? ` (${it.flavour})` : ''} × ${it.qty}${p ? ` = ${rupees(p * it.qty)}` : ''}`;
    });
    const name = form.elements.name.value.trim();
    const how = method() === 'pickup'
      ? `Pick up at: ${form.elements.outlet.value || '-'} outlet`
      : `Home delivery to: ${form.elements.address.value.trim() || '-'}`;
    const note = form.elements.note.value.trim();
    return [
      "Hi Fuel X Pro Nutrition, I'd like to order:",
      ...lines,
      sum ? `Total: ${rupees(sum)}${onRequest ? ` (+ ${onRequest} item${onRequest > 1 ? 's' : ''} price on request)` : ''}` : '',
      '',
      name ? `Name: ${name}` : '',
      how,
      note ? `Note: ${note}` : '',
      '',
      'Please confirm stock and the final price.',
    ].join('\n').replace(/\n{3,}/g, '\n\n');
  };

  // Each card shows Add, or a − qty + stepper once that product (in the chosen flavour) is in the bag
  const syncCard = (card) => {
    const it = find(card.dataset.id, flavourOf(card));
    card.querySelector('.prod__add').hidden = Boolean(it);
    const qty = card.querySelector('.prod__qty');
    qty.hidden = !it;
    if (it) qty.querySelector('span').textContent = it.qty;
  };

  const renderBag = () => {
    const count = items.reduce((n, it) => n + it.qty, 0);
    fab.hidden = count === 0;
    fab.querySelector('.bag-fab__count').textContent = count;
    if (navCount) { navCount.hidden = count === 0; navCount.textContent = count; }
    bag.classList.toggle('is-empty', count === 0);
    list.innerHTML = '';
    items.forEach((it) => {
      const card = cardFor(it.id);
      const p = priceOf(it.id);
      const li = document.createElement('li');
      li.className = 'bag__item';
      li.innerHTML = `<img src="${card.querySelector('img').getAttribute('src')}" alt="">
        <div><p class="bag__item-name"></p><p class="bag__item-meta"></p></div>
        <div class="bag__qty"><button type="button" data-step="-1" aria-label="One less">−</button><span>${it.qty}</span><button type="button" data-step="1" aria-label="One more">+</button></div>`;
      li.querySelector('.bag__item-name').textContent = card.dataset.name;
      li.querySelector('.bag__item-meta').textContent = [it.flavour, p ? rupees(p * it.qty) : 'Price on request'].filter(Boolean).join(' · ');
      li.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => change(it.id, it.flavour, Number(b.dataset.step))));
      list.appendChild(li);
    });
    const { sum, onRequest } = totals();
    totalEl.textContent = sum ? rupees(sum) : 'On request';
    totalNote.hidden = !(sum && onRequest);
    totalNote.textContent = `+ ${onRequest} item${onRequest > 1 ? 's' : ''} with price on request`;
    shop.querySelectorAll('.prod').forEach(syncCard);
    if (WHATSAPP_NUMBER) waBtn.href = waLink(orderText());
  };

  // "Added" message with a shortcut to the bag
  let toastTimer;
  const showToast = (text) => {
    toast.querySelector('.toast__text').textContent = text;
    toast.hidden = false;
    toast.classList.remove('is-in'); void toast.offsetWidth; toast.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  };

  const openBag = () => {
    lastFocus = document.activeElement;
    toast.hidden = true;
    bag.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    if (navCart) navCart.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    bag.querySelector('.bag__close').focus();
  };
  const closeBag = () => {
    bag.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    if (navCart) navCart.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
    if (lastFocus && document.contains(lastFocus) && lastFocus.offsetParent) lastFocus.focus();
  };

  shop.querySelectorAll('.prod').forEach((card) => {
    const name = card.dataset.name;
    card.querySelector('.prod__add').addEventListener('click', () => {
      change(card.dataset.id, flavourOf(card), 1);
      card.querySelector('.prod__qty [data-step="1"]').focus();
      showToast(`Added: ${name}`);
      fab.classList.remove('is-bump'); void fab.offsetWidth; fab.classList.add('is-bump');
    });
    card.querySelectorAll('.prod__qty [data-step]').forEach((b) => b.addEventListener('click', () => {
      change(card.dataset.id, flavourOf(card), Number(b.dataset.step));
      if (card.querySelector('.prod__add').hidden === false) card.querySelector('.prod__add').focus();
    }));
    const select = card.querySelector('.prod__flavour select');
    if (select) select.addEventListener('change', () => syncCard(card));
  });

  // Send: the name and the pickup outlet or address are needed first
  form.addEventListener('input', () => { saveCustomer(); renderBag(); });
  form.addEventListener('change', () => { showMethod(); saveCustomer(); renderBag(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  waBtn.addEventListener('click', (e) => {
    const need = [form.elements.name, method() === 'pickup' ? form.elements.outlet : form.elements.address];
    let firstBad = null;
    form.querySelectorAll('.field__error').forEach((er) => { er.hidden = true; });
    need.forEach((el) => {
      const bad = !el.value.trim();
      el.setAttribute('aria-invalid', String(bad));
      el.closest('.field').querySelector('.field__error').hidden = !bad;
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) { e.preventDefault(); firstBad.focus(); return; }
    waBtn.href = waLink(orderText());
  });

  [fab, navCart].forEach((b) => b && b.addEventListener('click', openBag));
  toast.querySelector('.toast__view').addEventListener('click', openBag);
  bag.querySelectorAll('[data-bag-close]').forEach((el) => el.addEventListener('click', closeBag));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bag.hidden) closeBag(); });
  bag.querySelector('.bag__clear').addEventListener('click', () => { items = []; save(); renderBag(); });

  showMethod();
  renderBag();
}

// ---------- Category tabs: picking a category cross-fades its photo and swaps the text (arrow keys move between tabs) ----------
const ctabs = [...document.querySelectorAll('.ctabs__tab')];
if (ctabs.length) {
  const pics = [...document.querySelectorAll('.ctabs__pic img')];
  const txt = document.querySelector('.ctabs__txt');
  const panel = document.getElementById('ctabs-panel');
  const num = txt.querySelector('.ctabs__num');
  const name = txt.querySelector('.ctabs__name');
  const desc = txt.querySelector('.ctabs__desc');
  const cta = txt.querySelector('.ctabs__cta');
  let current = 0;
  let swap;
  const selectTab = (i) => {
    if (i === current) return;
    current = i;
    const tab = ctabs[i];
    ctabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    pics.forEach((img, k) => img.classList.toggle('is-active', k === i));
    panel.setAttribute('aria-labelledby', tab.id);
    txt.classList.add('is-out');
    clearTimeout(swap);
    swap = setTimeout(() => {
      num.textContent = `${String(i + 1).padStart(2, '0')} / ${String(ctabs.length).padStart(2, '0')}`;
      name.textContent = tab.textContent;
      desc.textContent = tab.dataset.desc;
      cta.dataset.shopCat = tab.dataset.cat;
      txt.classList.remove('is-out');
    }, reduceMotion ? 0 : 280);
  };
  ctabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(i));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = (i + step + ctabs.length) % ctabs.length;
      ctabs[next].focus();
      selectTab(next);
    });
  });
}

// ---------- Hero slideshow: four products take turns in the light; the numbers jump to one ----------
let heroShow = null;
const heroSlides = [...document.querySelectorAll('.hero__product')];
if (heroSlides.length > 1) {
  const dots = [...document.querySelectorAll('.hero__dot')];
  const brandEl = document.querySelector('.hero__caption-brand');
  const nameEl = document.querySelector('.hero__caption-name');
  const DELAY = 4200;
  let current = 0;
  let timer = null;
  let running = false;
  document.documentElement.style.setProperty('--hero-delay', `${DELAY}ms`);

  const go = (next) => {
    if (next === current) return;
    const out = heroSlides[current];
    const inn = heroSlides[next];
    if (hasGsap) {
      gsap.killTweensOf([out, inn]);
      gsap.to(out, { opacity: 0, y: -24, scale: 0.94, duration: 0.7, ease: 'power2.in', onComplete: () => out.classList.remove('is-active') });
      gsap.fromTo(inn, { opacity: 0, y: 46, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, delay: 0.35, ease: 'power3.out', onStart: () => inn.classList.add('is-active') });
      gsap.fromTo([brandEl, nameEl], { yPercent: 0, opacity: 1 }, { yPercent: -40, opacity: 0, duration: 0.35, ease: 'power2.in', stagger: 0.04,
        onComplete: () => {
          brandEl.textContent = inn.dataset.brand;
          nameEl.textContent = inn.dataset.name;
          gsap.fromTo([brandEl, nameEl], { yPercent: 50, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.06 });
        } });
    } else {
      out.classList.remove('is-active');
      inn.classList.add('is-active');
      brandEl.textContent = inn.dataset.brand;
      nameEl.textContent = inn.dataset.name;
    }
    current = next;
    dots.forEach((d, i) => d.classList.toggle('is-active', i === current));
  };
  const tick = () => {
    dots.forEach((d) => d.classList.remove('is-playing'));
    if (!running) return;
    const dot = dots[current];
    void dot.offsetWidth;
    dot.classList.add('is-playing');
    timer = setTimeout(() => { go((current + 1) % heroSlides.length); tick(); }, DELAY);
  };
  heroShow = {
    start() { if (reduceMotion || running) return; running = true; tick(); },
    stop() { running = false; clearTimeout(timer); dots.forEach((d) => d.classList.remove('is-playing')); },
  };
  dots.forEach((dot, i) => dot.addEventListener('click', () => { clearTimeout(timer); go(i); if (running) tick(); }));
  // Without the motion layer, the slideshow starts straight away (unless motion is reduced)
  if (!hasGsap) heroShow.start();
}

// ---------- Motion layer (GSAP + ScrollTrigger) ----------
const countUp = (el) => {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const pad = Number(el.dataset.pad || 0);
  const counter = { v: 0 };
  gsap.to(counter, {
    v: target,
    duration: target > 10 ? 1.6 : 1.1,
    ease: 'power3.out',
    onUpdate: () => { el.textContent = String(Math.round(counter.v)).padStart(pad, '0') + suffix; },
  });
};

// After the entrance the tub hovers gently and its shadow breathes with it
let floating = null;
const startFloat = () => {
  if (floating) return;
  floating = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 2.6, ease: 'sine.inOut' } })
    .to('.hero__float', { y: -14 }, 0)
    .to('.hero__shadow', { scaleX: 0.86, opacity: 0.65 }, 0);
};

// The product rises out of the glow with a small bounce, the headline slides up line by line behind a mask,
// then the copy and the button. `quick` runs the same moves faster for repeat visits.
let heroLive = false; // set once the entrance has run, so the hover and slideshow can start
const buildHeroIn = (quick) => {
  const k = quick ? 0.55 : 1;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' }, onComplete: () => { heroLive = true; startFloat(); if (heroShow) heroShow.start(); } });
  tl.fromTo('.hero__glow', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.4 * k, ease: 'power2.out' }, 0)
    .fromTo('.hero__ring', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6 * k, ease: 'power3.out' }, 0.1 * k)
    .fromTo('.hero__caption', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 * k, ease: 'power3.out' }, 0.9 * k)
    .fromTo('.hero__lift', { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1 * k, ease: 'back.out(1.35)' }, 0)
    .fromTo('.hero__shadow', { scaleX: 0.35, opacity: 0 }, { scaleX: 1, opacity: 0.9, duration: 1.1 * k, ease: 'power3.out' }, 0.1 * k)
    .from('.hero__title .line > span', { yPercent: 110, duration: 0.9 * k, stagger: 0.14 * k }, 0.25 * k)
    .from('.hero__copy [data-r]', { y: 26, opacity: 0, duration: 0.7 * k, stagger: 0.1 * k, ease: 'power3.out' }, 0.85 * k)
    .add(() => document.querySelectorAll('.hero [data-count]').forEach(countUp), 0.9 * k);
  return tl;
};

const setUpScroll = () => {
  const mm = gsap.matchMedia();

  // Hero: on desktop it stays pinned while the tub slowly turns and steps back and the headline fades;
  // phones get the same moves on a plain scrub, without pinning
  mm.add('(min-width: 901px)', () => {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=90%', pin: true, scrub: 1 } })
      .to('.hero__slides', { rotate: -12, scale: 0.74, yPercent: 6, ease: 'none' }, 0)
      .fromTo('.hero__ring', { scale: 1, opacity: 1 }, { scale: 1.25, opacity: 0.2, ease: 'none', immediateRender: false }, 0)
      .fromTo('.hero__caption', { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.4, immediateRender: false }, 0)
      .fromTo('.hero__glow', { scale: 1, opacity: 1 }, { scale: 0.8, opacity: 0.55, ease: 'none', immediateRender: false }, 0)
      .to('.hero__copy', { y: -60, opacity: 0, ease: 'none', duration: 0.6 }, 0);
  });
  mm.add('(max-width: 900px)', () => {
    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 } })
      .to('.hero__slides', { rotate: -10, scale: 0.8, ease: 'none' }, 0)
      .to('.hero__copy', { y: -30, opacity: 0, ease: 'none' }, 0.25);
  });
  // Sparks and the hover only run while the hero is on screen
  ScrollTrigger.create({
    trigger: '.hero', start: 'top bottom', end: 'bottom top',
    onToggle: (self) => {
      if (!heroLive) return;
      if (floating) self.isActive ? floating.resume() : floating.pause();
      if (heroShow) self.isActive ? heroShow.start() : heroShow.stop();
    },
  });

  // Stats count up once as the band arrives
  ScrollTrigger.create({
    trigger: '.stats',
    start: 'top 80%',
    once: true,
    onEnter: () => document.querySelectorAll('.stats [data-count]').forEach(countUp),
  });
  gsap.from('.stat', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: '.stats', start: 'top 80%', once: true } });

  // Products: the tabs rise in, then the photo frame opens upward the first time it arrives
  gsap.from('.ctabs__tab', { y: 18, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.ctabs', start: 'top 80%', once: true } });
  gsap.from('.ctabs__view', { clipPath: 'inset(100% 0 0 0)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath', scrollTrigger: { trigger: '.ctabs', start: 'top 75%', once: true } });

  // Spin: the logo stamps down out of a blur, an accent glint sweeps across it, the X turns behind it and the words light up in turn
  gsap.set('.spin__title span', { opacity: 0.14 });
  const spinWords = (tl) => {
    gsap.utils.toArray('.spin__title span').forEach((word, i) => tl.to(word, { opacity: 1, ease: 'none', duration: 0.25 }, i * 0.3));
    return tl;
  };
  mm.add('(min-width: 901px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.spin', start: 'top top', end: '+=120%', pin: true, scrub: 1 } })
      .fromTo('.spin__logo', { scale: 1.6, opacity: 0, filter: 'blur(14px)', rotate: -5 }, { scale: 1, opacity: 1, filter: 'blur(0px)', rotate: 0, ease: 'back.out(1.6)', duration: 0.45 }, 0)
      .fromTo('.spin__shine', { backgroundPosition: '150% 0' }, { backgroundPosition: '-50% 0', ease: 'none', duration: 0.35 }, 0.5)
      .to('.spin__logo', { scale: 1.05, ease: 'none', duration: 0.2 }, 0.8)
      .fromTo('.spin__x', { rotate: 30, scale: 0.85 }, { rotate: -60, scale: 1.05, ease: 'none', duration: 1 }, 0)
      .from('.spin__note', { y: 30, opacity: 0, ease: 'none', duration: 0.25 }, 0.7);
    spinWords(tl);
  });
  mm.add('(max-width: 900px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '.spin', start: 'top 75%', end: 'bottom 40%', scrub: 1 } })
      .fromTo('.spin__logo', { scale: 1.4, opacity: 0, rotate: -5 }, { scale: 1, opacity: 1, rotate: 0, ease: 'back.out(1.6)', duration: 0.5 }, 0)
      .fromTo('.spin__shine', { backgroundPosition: '150% 0' }, { backgroundPosition: '-50% 0', ease: 'none', duration: 0.4 }, 0.55)
      .fromTo('.spin__x', { rotate: 20 }, { rotate: -40, ease: 'none', duration: 1 }, 0);
    spinWords(tl);
  });

  // CTA: the circle draws itself around "pro"
  const circle = document.querySelector('.circled__svg path');
  const len = circle.getTotalLength();
  gsap.set(circle, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(circle, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.cta', start: 'top 60%', once: true } });
  gsap.from('.cta__title', { y: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.cta', start: 'top 75%', once: true } });

  // Footer: FUEL X rises letter by letter
  gsap.from('.footer__mark span', {
    yPercent: 105, duration: 1.1, stagger: 0.07, ease: 'power4.out',
    scrollTrigger: { trigger: '.footer__mark', start: 'top 95%', once: true },
  });

  // Section headings: each line slides up out of its mask as the heading arrives
  gsap.utils.toArray('main section:not(.hero) [data-lines]').forEach((h) => {
    gsap.from(h.querySelectorAll('.line > span'), {
      yPercent: 115,
      duration: 1,
      stagger: 0.1,
      ease: 'power4.out',
      scrollTrigger: { trigger: h, start: 'top 86%', once: true },
    });
  });

  // Everything else that carries data-r rises in, staggered in the order it enters
  const items = gsap.utils.toArray('main section:not(.hero) [data-r]');
  gsap.set(items, { y: 28, opacity: 0 });
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      y: 0,
      opacity: 1,
      duration: 0.85,
      stagger: 0.08,
      ease: 'power3.out',
      overwrite: true,
      clearProps: 'transform,opacity', // hand transforms back to CSS (slanted buttons, hovers)
    }),
  });

  // Pictures move slower than the page
  gsap.fromTo('.coach__photo img', { yPercent: -6, scale: 1.14 }, {
    yPercent: 6, scale: 1.14, ease: 'none',
    scrollTrigger: { trigger: '.coach', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.why__photo', { yPercent: -8 }, {
    yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.why', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.order__figure img', { scale: 1.18 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.order', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.cta__x', { rotate: -10 }, {
    rotate: 10, ease: 'none', transformOrigin: '50% 50%',
    scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // How to order: the slanted bar fills as you read down the three steps
  gsap.fromTo('.steps__bar span', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 55%', scrub: true },
  });

};

// ---------- Intro: the logo assembles itself from its parts, lands in the navbar, and the hero builds (~3 s) ----------
// Full version once per visit; after that a quick hero reveal. Click, Escape or "Skip intro" jumps to the end.
const cine = document.querySelector('.cine');
let heroIn = null;
if (hasGsap) {
  heroIn = buildHeroIn(root.dataset.intro === 'quick');
  setUpScroll();
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
// Starting positions are set, so the hero can be shown
root.classList.remove('hero-pre');

const handOff = () => {
  root.classList.remove('intro-on');
  if (cine) cine.remove();
  if (lenis) lenis.start();
  if (hasGsap) ScrollTrigger.refresh();
};

if (hasGsap && cine && root.classList.contains('intro-on')) {
  try { sessionStorage.setItem('fx-intro-seen', '1'); } catch (e) {}
  if (lenis) lenis.stop();
  const logo = cine.querySelector('.cine__logo');
  const target = [...document.querySelectorAll('.nav__logo img')].find((img) => img.offsetParent);
  const canDock = target && window.scrollY < 40;
  let dock = { x: 0, y: 0, scale: 0.9 };

  const master = gsap.timeline({ onComplete: handOff });
  const D = 1.3; // when the assembled logo starts its flight to the navbar
  master
    // The red X slams in with a flare...
    .fromTo('.cine__x', { scale: 2.6, rotate: -14, opacity: 0, filter: 'blur(14px)' }, { scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', transformOrigin: '67.4% 58.4%' }, 0)
    .fromTo('.cine__flare', { scale: 0.3, opacity: 0 }, { scale: 1.3, opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.12)
    .to('.cine__flare', { scale: 1.8, opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.47)
    // ...FUEL and PRO slide out from behind it...
    .fromTo('.cine__fuel', { xPercent: 22, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.75, ease: 'power4.out' }, 0.32)
    .fromTo('.cine__pro', { xPercent: -19, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.75, ease: 'power4.out' }, 0.32)
    // ...the athlete rises onto his base and settles into the pose...
    .fromTo('.cine__figure', { yPercent: 16, rotate: -7, opacity: 0 }, { yPercent: 0, rotate: 0, opacity: 1, duration: 0.85, ease: 'back.out(1.6)', transformOrigin: '18% 97%' }, 0.45)
    // ...NUTRITION opens out from its centre, and a red glint runs across the whole mark
    .fromTo('.cine__nutrition', { clipPath: 'inset(0% 37% 0% 63%)', opacity: 0.4 }, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.7, ease: 'power3.inOut' }, 0.6)
    .fromTo('.cine__shine', { backgroundPosition: '150% 0' }, { backgroundPosition: '-50% 0', duration: 0.6, ease: 'power2.inOut' }, 0.85)
    // Then the whole logo flies up and lands exactly on the navbar logo
    .add(() => {
      if (!canDock) return;
      const from = logo.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      dock = {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.width / from.width,
      };
    }, D - 0.01)
    .to(logo, { x: () => dock.x, y: () => dock.y, scale: () => dock.scale, opacity: canDock ? 1 : 0, duration: 0.85, ease: 'power3.inOut' }, D)
    .to('.cine__skip', { opacity: 0, duration: 0.3 }, D)
    .to('.cine__bg', { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, D + 0.15)
    .add(() => heroIn.play(), D + 0.25);
  // On the light themes the navbar is light, so the white logo turns dark as it lands
  if (root.dataset.theme !== 'volt') master.to('.cine__logo-dark', { opacity: 1, duration: 0.45 }, D + 0.35);

  const skip = () => {
    master.progress(1);
    heroIn.progress(1);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') skip(); };
  cine.addEventListener('click', skip);
  document.addEventListener('keydown', onKey);
} else {
  handOff();
  if (heroIn) heroIn.play();
}
document.body.classList.add('is-loaded');
