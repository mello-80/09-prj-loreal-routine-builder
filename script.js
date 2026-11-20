// ⚠️ Replace with your deployed Cloudflare Worker URL
const WORKER_URL = "https://loreal-chatbot.maryamcontentw.workers.dev/";

const SYSTEM_PROMPT = `You are a friendly L'Oréal beauty advisor. You ONLY discuss skincare, haircare, makeup, fragrance, grooming and the user's generated routine. Politely decline anything else and steer back to beauty.
When given selected products, build a clear routine: order of steps, morning vs evening, and why each product fits. Use only the products provided unless suggesting optional additions. Keep answers concise and cite links when you use web search.`;

const $ = (id) => document.getElementById(id);
const container = $("productsContainer"),
  categorySel = $("categoryFilter"),
  search = $("searchInput"),
  selectedList = $("selectedList"),
  chatWindow = $("chatWindow");

let products = [];
let selected = JSON.parse(localStorage.getItem("selectedProducts") || "[]"); // array of ids
let history = [{ role: "system", content: SYSTEM_PROMPT }];

const key = (p) => p.id ?? p.name;
const save = () =>
  localStorage.setItem("selectedProducts", JSON.stringify(selected));

async function init() {
  const res = await fetch("products.json");
  const data = await res.json();
  products = data.products || data;
  [...new Set(products.map((p) => p.category))].sort().forEach((c) => {
    categorySel.add(new Option(c, c));
  });
  render();
  renderSelected();
  if (localStorage.getItem("dir") === "rtl") setDir("rtl");
}

function render() {
  const cat = categorySel.value,
    q = search.value.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (!q ||
        [p.name, p.brand, p.category, p.description]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  container.innerHTML = "";
  if (!list.length)
    container.innerHTML =
      '<p class="empty">No products match. Try another keyword or category.</p>';
  list.forEach((p) => {
    const on = selected.includes(key(p));
    const card = document.createElement("div");
    card.className = "card" + (on ? " on" : "");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-pressed", on);
    card.innerHTML = `<img src="${p.image}" alt="${p.name}">
      <span class="brand">${p.brand}</span><h3>${p.name}</h3>
      <button class="more" aria-expanded="false">Details</button>
      <p class="desc">${p.description}</p>`;
    const toggle = () => {
      toggleSelect(key(p));
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        toggle();
      }
    });
    card.querySelector(".more").addEventListener("click", (e) => {
      e.stopPropagation();
      const open = card.classList.toggle("open");
      e.target.setAttribute("aria-expanded", open);
      e.target.textContent = open ? "Hide details" : "Details";
    });
    container.appendChild(card);
  });
}

function toggleSelect(k) {
  selected = selected.includes(k)
    ? selected.filter((x) => x !== k)
    : [...selected, k];
  save();
  render();
  renderSelected();
}

function renderSelected() {
  selectedList.innerHTML = "";
  const items = products.filter((p) => selected.includes(key(p)));
  if (!items.length)
    selectedList.innerHTML =
      '<li class="empty" style="background:none">Nothing selected yet. Click a product to add it.</li>';
  items.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${p.name}</span><button aria-label="Remove ${p.name}">×</button>`;
    li.querySelector("button").onclick = () => toggleSelect(key(p));
    selectedList.appendChild(li);
  });
}

function addMsg(text, who) {
  const d = document.createElement("div");
  d.className = "msg " + who;
  // Escape, then turn URLs into links
  d.innerHTML = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(
      /(https?:\/\/[^\s)]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>',
    );
  chatWindow.appendChild(d);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return d;
}

async function askAI() {
  const thinking = addMsg("Thinking…", "ai");
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    const reply =
      data.reply ||
      data.choices?.[0]?.message?.content ||
      "Sorry, something went wrong. Please try again.";
    history.push({ role: "assistant", content: reply });
    thinking.remove();
    addMsg(reply, "ai");
  } catch (e) {
    thinking.textContent =
      "Couldn't reach the advisor. Check your connection and try again.";
  }
}

$("generateRoutine").onclick = () => {
  const items = products
    .filter((p) => selected.includes(key(p)))
    .map(({ name, brand, category, description }) => ({
      name,
      brand,
      category,
      description,
    }));
  if (!items.length) return addMsg("Select at least one product first.", "ai");
  const content =
    "Create a personalized routine using these products:\n" +
    JSON.stringify(items, null, 2);
  history.push({ role: "user", content });
  addMsg(
    "Generate a routine for my " + items.length + " selected product(s).",
    "user",
  );
  askAI();
};

$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("userInput").value.trim();
  if (!text) return;
  $("userInput").value = "";
  history.push({ role: "user", content: text });
  addMsg(text, "user");
  askAI();
};

$("clearAll").onclick = () => {
  selected = [];
  save();
  render();
  renderSelected();
};
categorySel.onchange = render;
search.oninput = render;

function setDir(d) {
  document.documentElement.dir = d;
  document.documentElement.lang = d === "rtl" ? "ar" : "en";
  $("rtlToggle").textContent = d === "rtl" ? "Switch to LTR" : "Switch to RTL";
  $("rtlToggle").setAttribute("aria-pressed", d === "rtl");
  localStorage.setItem("dir", d);
}
$("rtlToggle").onclick = () =>
  setDir(document.documentElement.dir === "rtl" ? "ltr" : "rtl");

init();
