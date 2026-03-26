const fromInput = document.getElementById("fromUrl");
const toInput = document.getElementById("toUrl");
const btnAdd = document.getElementById("btnAdd");
const rulesList = document.getElementById("rulesList");
const status = document.getElementById("status");

function normalizeUrl(url) {
  url = url.trim();
  if (!url.startsWith("http")) url = "https://" + url;
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return url;
  }
}

function showStatus(msg, color = "#10b981") {
  status.style.color = color;
  status.textContent = msg;
  setTimeout(() => (status.textContent = ""), 2000);
}

function renderRules(rules) {
  rulesList.innerHTML = "";
  if (!rules.length) {
    rulesList.innerHTML = '<div class="empty">No rules yet</div>';
    return;
  }
  rules.forEach((rule, i) => {
    const div = document.createElement("div");
    div.className = "rule-item";
    div.innerHTML = `
      <div class="rule-text">
        <span class="rule-from">${rule.from}</span>
        <span class="rule-arrow">→</span>
        <span class="rule-to">${rule.to}</span>
      </div>
      <button class="btn-del" data-index="${i}" title="Delete">✕</button>
    `;
    rulesList.appendChild(div);
  });

  rulesList.querySelectorAll(".btn-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      chrome.storage.sync.get("rules", ({ rules = [] }) => {
        rules.splice(idx, 1);
        chrome.storage.sync.set({ rules }, () => renderRules(rules));
      });
    });
  });
}

chrome.storage.sync.get("rules", ({ rules = [] }) => renderRules(rules));

btnAdd.addEventListener("click", () => {
  const from = normalizeUrl(fromInput.value);
  const to = normalizeUrl(toInput.value);

  if (!fromInput.value.trim() || !toInput.value.trim()) {
    showStatus("Both fields are required", "#f87171");
    return;
  }
  if (from === to) {
    showStatus("URLs are the same", "#f87171");
    return;
  }

  chrome.storage.sync.get("rules", ({ rules = [] }) => {
    const exists = rules.some((r) => r.from === from);
    if (exists) {
      showStatus("Rule already exists", "#f87171");
      return;
    }

    rules.push({ from, to });
    chrome.storage.sync.set({ rules }, () => {
      renderRules(rules);
      fromInput.value = "";
      toInput.value = "";
      showStatus("Rule added! Refresh the page.");
    });
  });
});
