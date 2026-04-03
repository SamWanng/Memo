/**
 * 仅首页：主时间流图片 HalftoneDots（参数同源 dany.works，按显示宽度做窄栏/小图优化）
 */
import React from 'https://esm.sh/react@18';
import { createRoot } from 'https://esm.sh/react-dom@18/client';
import { HalftoneDots } from 'https://esm.sh/@paper-design/shaders-react@0.0.72?deps=react@18,react-dom@18';

/** 接近 dany.works 全宽图时的基准（大显示宽度） */
const shaderPropsWide = {
  contrast: 0.4, originalColors: false, inverted: false,
  grid: 'hex', radius: 1, size: 0.2, scale: 1,
  grainSize: 0.5, type: 'gooey', fit: 'cover',
  grainMixer: 0.2, grainOverlay: 0.2,
  colorFront: '#2B2B2B', colorBack: '#00000000',
};

/** 中等栏宽：略放大网点、略减颗粒，避免糊成一团 */
const shaderPropsMedium = {
  ...shaderPropsWide,
  size: 0.26,
  scale: 1.04,
  contrast: 0.38,
  grainSize: 0.46,
  grainMixer: 0.14,
  grainOverlay: 0.14,
};

/** 窄栏 / 小图：更疏的网点 + 更轻的颗粒，报纸感仍可辨认 */
const shaderPropsCompact = {
  ...shaderPropsWide,
  size: 0.36,
  scale: 1.12,
  contrast: 0.34,
  grainSize: 0.4,
  grainMixer: 0.07,
  grainOverlay: 0.09,
};

function paperBackgroundColor() {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue('--paper-colour')
    .trim();
  return v || '#F2F1E8';
}

function isImageUrl(href) {
  if (!href) return false;
  try {
    const u = new URL(href, location.origin);
    return /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

function injectLightbox() {
  if (document.getElementById('nb-halftone-lightbox')) return;
  document.body.insertAdjacentHTML(
    'beforeend',
    `
<div class="nb-halftone-lightbox" id="nb-halftone-lightbox" role="dialog" aria-modal="true" aria-label="图片" hidden>
  <div class="nb-halftone-lightbox-inner">
    <button type="button" class="nb-halftone-lightbox-close" id="nb-halftone-lightbox-close">关闭 Esc</button>
    <img id="nb-halftone-lightbox-img" src="" alt="">
    <p class="nb-halftone-lightbox-hint">原图（无半色调）</p>
  </div>
</div>`
  );

  const lightbox = document.getElementById('nb-halftone-lightbox');
  const lightboxImg = document.getElementById('nb-halftone-lightbox-img');
  const closeBtn = document.getElementById('nb-halftone-lightbox-close');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
      lightbox.hidden = true;
      lightboxImg.src = '';
      lightboxImg.alt = '';
    }, 280);
  }

  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) closeLightbox();
  });

  window.__nbHalftoneOpenLightbox = openLightbox;
}

const shaderRegistry = new Map();

// Pause WebGL RAF when off-screen; rootMargin pre-renders ~150px before enter.
const visibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const data = shaderRegistry.get(target);
      if (!data) return;
      data.root.render(
        isIntersecting ? React.createElement(HalftoneDots, data.props) : null
      );
    });
  },
  { rootMargin: '150px' }
);

async function initShader(wrap) {
  if (wrap.dataset.shaderInit) return;
  wrap.dataset.shaderInit = '1';
  const img = wrap.querySelector('img.entry-img');
  const overlay = wrap.querySelector('.shader-overlay');
  if (!img || !overlay) return;

  await new Promise((r) => {
    if (img.complete && img.naturalWidth > 0) r();
    else img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  });

  if (img.naturalWidth < 16 || img.naturalHeight < 16) {
    overlay.remove();
    return;
  }

  await new Promise((r) => {
    requestAnimationFrame(() => requestAnimationFrame(r));
  });

  const displayW = wrap.getBoundingClientRect().width;
  const base =
    displayW < 300
      ? shaderPropsCompact
      : displayW < 440
        ? shaderPropsMedium
        : shaderPropsWide;

  try {
    const props = {
      ...base,
      image: img.src,
      style: {
        width: '100%',
        height: '100%',
        backgroundColor: paperBackgroundColor(),
      },
    };
    const root = createRoot(overlay);
    root.render(React.createElement(HalftoneDots, props));
    shaderRegistry.set(wrap, { root, props });
    visibilityObserver.observe(wrap);
  } catch (e) {
    console.warn('[nb-halftone] Shader failed:', e);
    overlay.remove();
  }
}

function wrapImage(img) {
  if (img.dataset.nbHalftoneWrapped) return null;
  if (img.closest('.img-wrap')) return null;

  const wrap = document.createElement('span');
  wrap.className = 'img-wrap';

  const overlay = document.createElement('div');
  overlay.className = 'shader-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  img.classList.add('entry-img');
  img.dataset.nbHalftoneWrapped = '1';

  const parent = img.parentNode;
  parent.insertBefore(wrap, img);
  wrap.appendChild(img);
  wrap.appendChild(overlay);

  const anchor = wrap.closest('a');
  const href = anchor?.getAttribute('href') || '';
  const opensLightbox = !anchor || isImageUrl(href);

  if (opensLightbox && typeof window.__nbHalftoneOpenLightbox === 'function') {
    wrap.setAttribute('role', 'button');
    wrap.tabIndex = 0;
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.__nbHalftoneOpenLightbox(img.currentSrc || img.src, img.alt || '');
    };
    wrap.addEventListener('click', open);
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  }

  return wrap;
}

function initTimeline() {
  const postsRoot = document.querySelector('.posts');
  if (!postsRoot) return;

  injectLightbox();

  const wraps = [];
  postsRoot.querySelectorAll('.paper .post img').forEach((img) => {
    const w = wrapImage(img);
    if (w) wraps.push(w);
  });

  wraps.forEach((w) => initShader(w));

  const touchRoot = postsRoot;

  let pressed = null;
  touchRoot.addEventListener(
    'touchstart',
    (e) => {
      const wrap = e.target.closest?.('.img-wrap');
      if (wrap && touchRoot.contains(wrap)) {
        pressed = wrap;
        wrap.classList.add('img-pressing');
      }
    },
    { passive: true }
  );
  const releasePress = () => {
    if (pressed) {
      pressed.classList.remove('img-pressing');
      pressed = null;
    }
  };
  touchRoot.addEventListener('touchend', releasePress, { passive: true });
  touchRoot.addEventListener('touchcancel', releasePress, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimeline);
} else {
  initTimeline();
}
