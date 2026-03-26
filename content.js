(function () {

  const currentHost = window.location.hostname;
  const currentParts = currentHost.split(".");
  const currentTLD = "." + currentParts.slice(1).join(".");
  const currentBase = currentParts[0];


  function isRelatedCDN(imgSrc) {
    try {
      const imgHost = new URL(imgSrc).hostname;
      const imgBase = imgHost.split(".")[0];
      const imgTLD  = "." + imgHost.split(".").slice(1).join(".");

      const isRelated = imgBase.startsWith(currentBase);
      const isBroken  = imgTLD !== currentTLD;

      return isRelated && isBroken;
    } catch {
      return false;
    }
  }

  function fixURL(imgSrc) {
    try {
      const url     = new URL(imgSrc);
      url.hostname = window.location.hostname;
      return url.toString();
    } catch {
      return imgSrc;
    }
  }

  function fixImg(img) {
    if (img.src && isRelatedCDN(img.src)) {
      img.src = fixURL(img.src);
    }
    ["data-src", "data-lazy", "data-original", "data-lazy-src"].forEach(attr => {
      const val = img.getAttribute(attr);
      if (val && isRelatedCDN(val)) {
        img.setAttribute(attr, fixURL(val));
      }
    });
    if (img.srcset) {
      img.srcset = img.srcset
        .split(",")
        .map(part => {
          const [url, descriptor] = part.trim().split(/\s+/);
          return isRelatedCDN(url)
            ? `${fixURL(url)} ${descriptor || ""}`.trim()
            : part.trim();
        })
        .join(", ");
    }
  }

  function fixInlineStyles(el) {
    const bg = el.style.backgroundImage;
    if (!bg) return;
    const match = bg.match(/url\(["']?(.+?)["']?\)/);
    if (match && isRelatedCDN(match[1])) {
      el.style.backgroundImage = `url("${fixURL(match[1])}")`;
    }
  }

  function fixAll() {
    document.querySelectorAll("img").forEach(fixImg);
    document.querySelectorAll("[style*='background-image']").forEach(fixInlineStyles);
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach(node => {
        if (!node.querySelectorAll) return;
        if (node.tagName === "IMG") fixImg(node);
        node.querySelectorAll("img").forEach(fixImg);
        node.querySelectorAll("[style*='background-image']").forEach(fixInlineStyles);
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

})();