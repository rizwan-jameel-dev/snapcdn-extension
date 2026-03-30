const fromInput   = document.getElementById("fromUrl");
const toInput     = document.getElementById("toUrl");
const btnAdd      = document.getElementById("btnAdd");
const autoRules   = document.getElementById("autoRules");
const manualRules = document.getElementById("manualRules");
const status      = document.getElementById("status");

function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith("http")) url = "https://" + url;
  try { return new URL(url).origin; } catch { return url; }
}

function showStatus(msg, color = "#10b981") {
  status.style.color = color;
  status.textContent = msg;
  setTimeout(() => status.textContent = "", 2000);
}

function renderRule(rule, index) {
  const div = document.createElement("div");
  div.className = "rule-item";
  div.innerHTML = `
    <div class="rule-body">
      <span class="rule-badge ${rule.auto ? 'badge-auto' : 'badge-manual'}">
        ${rule.auto ? "AUTO" : "MANUAL"}
      </span>
      <div class="rule-from">${rule.from}</div>
      <div class="rule-arrow">↓</div>
      <div class="rule-to">${rule.to}</div>
    </div>
    <button class="btn-del" data-index="${index}">✕</button>
  `;
  return div;
}

function renderRules(rules) {
  autoRules.innerHTML   = "";
  manualRules.innerHTML = "";

  const auto   = rules.filter(r => r.auto);
  const manual = rules.filter(r => !r.auto);

  if (!auto.length) {
    autoRules.innerHTML = '<div class="empty">No auto rules yet — visit a site with broken images</div>';
  } else {
    auto.forEach((rule, i) => {
      const index = rules.indexOf(rule);
      autoRules.appendChild(renderRule(rule, index));
    });
  }

  if (!manual.length) {
    manualRules.innerHTML = '<div class="empty">No manual rules yet</div>';
  } else {
    manual.forEach((rule) => {
      const index = rules.indexOf(rule);
      manualRules.appendChild(renderRule(rule, index));
    });
  }

  // Delete buttons
  document.querySelectorAll(".btn-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      chrome.storage.sync.get("rules", ({ rules = [] }) => {
        rules.splice(idx, 1);
        chrome.storage.sync.set({ rules }, () => renderRules(rules));
      });
    });
  });
}

// Load on open
chrome.storage.sync.get("rules", ({ rules = [] }) => renderRules(rules));

// Manual add
btnAdd.addEventListener("click", () => {
  const from = normalizeUrl(fromInput.value);
  const to   = normalizeUrl(toInput.value);

  if (!fromInput.value.trim() || !toInput.value.trim()) {
    showStatus("Both fields are required", "#f87171"); return;
  }
  if (from === to) {
    showStatus("URLs are the same", "#f87171"); return;
  }

  chrome.storage.sync.get("rules", ({ rules = [] }) => {
    if (rules.some(r => r.from === from)) {
      showStatus("Rule already exists", "#f87171"); return;
    }
    rules.push({ from, to, auto: false });
    chrome.storage.sync.set({ rules }, () => {
      renderRules(rules);
      fromInput.value = "";
      toInput.value   = "";
      showStatus("✓ Rule saved! Refresh the page.");
    });
  });
});
