(function () {
  const currentHost = window.location.hostname;
  const currentParts = currentHost.split(".");
  const currentTLD = "." + currentParts.slice(1).join(".");
  const currentBase = currentParts[0];

  // ─────────────────────────────────────────
  // LAYER 1 — Fix using saved rules instantly
  // ─────────────────────────────────────────
  function setupStorageRules(rules) {
    if (!rules.length) return;

    function needsFix(src) {
      if (!src) return false;
      return rules.some((rule) => src.startsWith(rule.from));
    }

    function fixURL(src) {
      try {
        for (const rule of rules) {
          if (src.startsWith(rule.from)) {
            return rule.to + src.slice(rule.from.length);
          }
        }
      } catch {}
      return src;
    }

    // Intercept img.src = "..."
    const nativeDesc = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    );
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      set(value) {
        if (needsFix(value)) value = fixURL(value);
        nativeDesc.set.call(this, value);
      },
      get() {
        return nativeDesc.get.call(this);
      },
    });

    // Intercept setAttribute("src", "...")
    const nativeSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (
        this.tagName === "IMG" &&
        [
          "src",
          "data-src",
          "data-lazy",
          "data-original",
          "data-lazy-src",
        ].includes(name) &&
        needsFix(value)
      ) {
        value = fixURL(value);
      }
      nativeSet.call(this, name, value);
    };

    // Fix all existing images
    function fixImg(img) {
      if (needsFix(img.src)) img.src = fixURL(img.src);

      ["data-src", "data-lazy", "data-original", "data-lazy-src"].forEach(
        (attr) => {
          const val = img.getAttribute(attr);
          if (needsFix(val)) img.setAttribute(attr, fixURL(val));
        },
      );

      if (img.srcset) {
        img.srcset = img.srcset
          .split(",")
          .map((part) => {
            const [url, desc] = part.trim().split(/\s+/);
            return needsFix(url)
              ? `${fixURL(url)} ${desc || ""}`.trim()
              : part.trim();
          })
          .join(", ");
      }
    }

    function fixInlineStyles(el) {
      const bg = el.style.backgroundImage;
      if (!bg) return;
      const match = bg.match(/url\(["']?(.+?)["']?\)/);
      if (match && needsFix(match[1])) {
        el.style.backgroundImage = `url("${fixURL(match[1])}")`;
      }
    }

    function fixAll() {
      document.querySelectorAll("img").forEach(fixImg);
      document
        .querySelectorAll("[style*='background-image']")
        .forEach(fixInlineStyles);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (!node.querySelectorAll) return;
          if (node.tagName === "IMG") fixImg(node);
          node.querySelectorAll("img").forEach(fixImg);
          node
            .querySelectorAll("[style*='background-image']")
            .forEach(fixInlineStyles);
        });
      });
    });

    if (document.body) {
      fixAll();
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        fixAll();
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // ─────────────────────────────────────────
  // LAYER 2 — Auto detect broken images
  //           guess fix → test → save rule
  // ─────────────────────────────────────────
  function setupAutoDetect(existingRules) {
    function isRelatedCDN(src) {
      try {
        const imgHost = new URL(src).hostname;
        const imgBase = imgHost.split(".")[0];
        const imgTLD = "." + imgHost.split(".").slice(1).join(".");
        return imgBase.startsWith(currentBase) && imgTLD !== currentTLD;
      } catch {
        return false;
      }
    }

    function guessFixedURL(src) {
      try {
        const url = new URL(src);
        const base = url.hostname.split(".")[0];
        url.hostname = base + currentTLD;
        return url.toString();
      } catch {
        return null;
      }
    }

    function ruleExists(from) {
      return existingRules.some((r) => r.from === from);
    }

    function saveAutoRule(from, to) {
      chrome.storage.sync.get("rules", ({ rules = [] }) => {
        // double check it still doesn't exist
        if (rules.some((r) => r.from === from)) return;
        rules.push({ from, to, auto: true });
        chrome.storage.sync.set({ rules });
      });
    }

    function tryAutoFix(img, brokenSrc) {
      // Skip if not related CDN
      if (!isRelatedCDN(brokenSrc)) return;

      // Skip if we already have a rule for this
      const from = new URL(brokenSrc).origin;
      if (ruleExists(from)) return;

      const fixedSrc = guessFixedURL(brokenSrc);
      if (!fixedSrc) return;

      // Test if guessed URL actually loads
      const testImg = new Image();
      testImg.onload = () => {
        // ✅ Guess worked → apply and save
        img.src = fixedSrc;
        const to = new URL(fixedSrc).origin;
        saveAutoRule(from, to);
      };
      testImg.onerror = () => {
        // ❌ Guess failed → user must add manually via popup
      };
      testImg.src = fixedSrc;
    }

    // Listen for any broken image on the page
    document.addEventListener(
      "error",
      (e) => {
        if (e.target.tagName !== "IMG") return;
        const src = e.target.src;
        if (!src || src.startsWith("data:")) return;
        tryAutoFix(e.target, src);
      },
      true,
    );
  }

  // ─────────────────────────────────────────
  // START — load rules then run both layers
  // ─────────────────────────────────────────
  chrome.storage.sync.get("rules", ({ rules = [] }) => {
    setupStorageRules(rules); // Layer 1 — instant fix from storage
    setupAutoDetect(rules); // Layer 2 — catch anything Layer 1 missed
    // Layer 3 — manual input handled by popup.js + storage
  });
})();
