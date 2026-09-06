# Semantic DOM Anchor Grounding Reference

## Anchor Extraction Function (Content Script)

```javascript
function extractInteractiveAnchors() {
  const selectors = [
    "a[href]",
    "button",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "[role='button']",
    "[onclick]"
  ];

  const elements = document.querySelectorAll(selectors.join(", "));
  const anchors = [];
  let index = 1;

  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom < 0 || rect.top > vpH || rect.right < 0 || rect.left > vpW) continue;

    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") continue;

    const cx = (rect.left + rect.width / 2) / vpW;
    const cy = (rect.top + rect.height / 2) / vpH;

    anchors.push({
      idx: index++,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 40),
      center_norm: [parseFloat(cx.toFixed(4)), parseFloat(cy.toFixed(4))],
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    });
  }

  return anchors;
}
```

## Proximity Snapping Algorithm

```javascript
function snapToAnchor(targetNormX, targetNormY, targetIndex, anchors, vpWidth, vpHeight) {
  if (targetIndex != null) {
    const found = anchors.find(a => a.idx === targetIndex);
    if (found) {
      return {
        x: found.rect.left + found.rect.width / 2,
        y: found.rect.top + found.rect.height / 2,
        snapped: true,
        anchor: found
      };
    }
  }

  let best = null;
  let minDist = 0.08; // 8% viewport radius

  for (const a of anchors) {
    const dx = a.center_norm[0] - targetNormX;
    const dy = a.center_norm[1] - targetNormY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      best = a;
    }
  }

  if (best) {
    return {
      x: best.rect.left + best.rect.width / 2,
      y: best.rect.top + best.rect.height / 2,
      snapped: true,
      anchor: best
    };
  }

  return {
    x: targetNormX * vpWidth,
    y: targetNormY * vpHeight,
    snapped: false
  };
}
```\n