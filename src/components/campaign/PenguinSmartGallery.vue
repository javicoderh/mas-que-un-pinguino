<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import dsc05278Thumb from "../../assets/gallery/thumb/DSC05278.webp";
import dsc05293Thumb from "../../assets/gallery/thumb/DSC05293.webp";
import dsc05345Thumb from "../../assets/gallery/thumb/DSC05345.webp";
import dsc05810Thumb from "../../assets/gallery/thumb/DSC05810.webp";
import dsc05812Thumb from "../../assets/gallery/thumb/DSC05812.webp";
import dsc05923Thumb from "../../assets/gallery/thumb/DSC05923.webp";
import dsc06074Thumb from "../../assets/gallery/thumb/DSC06074.webp";
import dsc06391Thumb from "../../assets/gallery/thumb/DSC06391.webp";
import dsc06418Thumb from "../../assets/gallery/thumb/DSC06418.webp";
import dsc06460Thumb from "../../assets/gallery/thumb/DSC06460.webp";
import dsc06464Thumb from "../../assets/gallery/thumb/DSC06464.webp";
import dsc05278Large from "../../assets/gallery/large/DSC05278.webp";
import dsc05293Large from "../../assets/gallery/large/DSC05293.webp";
import dsc05345Large from "../../assets/gallery/large/DSC05345.webp";
import dsc05810Large from "../../assets/gallery/large/DSC05810.webp";
import dsc05812Large from "../../assets/gallery/large/DSC05812.webp";
import dsc05923Large from "../../assets/gallery/large/DSC05923.webp";
import dsc06074Large from "../../assets/gallery/large/DSC06074.webp";
import dsc06391Large from "../../assets/gallery/large/DSC06391.webp";
import dsc06418Large from "../../assets/gallery/large/DSC06418.webp";
import dsc06460Large from "../../assets/gallery/large/DSC06460.webp";
import dsc06464Large from "../../assets/gallery/large/DSC06464.webp";

const getAssetSrc = (asset) => (typeof asset === "string" ? asset : asset?.src || "");
const toGalleryImage = (id, thumb, large) => ({
  id,
  thumb: getAssetSrc(thumb),
  large: getAssetSrc(large)
});

const muralImages = [
  toGalleryImage("dsc05278", dsc05278Thumb, dsc05278Large),
  toGalleryImage("dsc05293", dsc05293Thumb, dsc05293Large),
  toGalleryImage("dsc05345", dsc05345Thumb, dsc05345Large),
  toGalleryImage("dsc05810", dsc05810Thumb, dsc05810Large),
  toGalleryImage("dsc05812", dsc05812Thumb, dsc05812Large),
  toGalleryImage("dsc05923", dsc05923Thumb, dsc05923Large),
  toGalleryImage("dsc06074", dsc06074Thumb, dsc06074Large),
  toGalleryImage("dsc06391", dsc06391Thumb, dsc06391Large),
  toGalleryImage("dsc06418", dsc06418Thumb, dsc06418Large),
  toGalleryImage("dsc06460", dsc06460Thumb, dsc06460Large),
  toGalleryImage("dsc06464", dsc06464Thumb, dsc06464Large)
].filter((image) => image.thumb && image.large);
const initialPreloadCount = Math.min(5, muralImages.length);
const visibleCardCount = Math.min(4, muralImages.length || 4);
const currentIndex = ref(0);
const loadedImages = ref([]);
const isGalleryReady = ref(false);
const isGhostVisible = ref(true);
const isModalOpen = ref(false);
const isClosingModal = ref(false);
const modalImageIndex = ref(0);
const animatedPreview = ref(null);
const modalImageVisible = ref(false);
const modalDialog = ref(null);
const modalImageWrap = ref(null);
const cardElements = new Map();
const loadedImageSet = new Set();
const modalOpenDurationMs = 720;
const modalCloseDurationMs = 520;
let intervalId = 0;
let previewTimeoutId = 0;
let ghostTimeoutId = 0;
let revealTimeoutId = 0;

const cards = computed(() => {
  const pool = loadedImages.value.length
    ? loadedImages.value
    : muralImages.slice(0, visibleCardCount);

  return Array.from({ length: visibleCardCount }, (_, index) => {
    const imageIndex = (currentIndex.value + index) % pool.length;

    return {
      id: `penguin-smart-gallery-slot-${index + 1}-${pool[imageIndex].id}`,
      imageKey: `${imageIndex}-${pool[imageIndex].id}`,
      src: pool[imageIndex].thumb,
      alt: `Registro fotográfico de la campaña ${imageIndex + 1}`,
      className: `slot-${index + 1}`
    };
  });
});

const currentModalImage = computed(
  () => loadedImages.value[modalImageIndex.value]?.large || ""
);
const shouldGhostRightSlot = computed(() => isModalOpen.value || isClosingModal.value);

onMounted(() => {
  void initializeGallery();
});

onBeforeUnmount(() => {
  stopLoop();
  clearPreviewTimeout();
  clearGhostTimeout();
  clearRevealTimeout();
});

function startLoop() {
  stopLoop();

  intervalId = window.setInterval(() => {
    if (!isModalOpen.value && loadedImages.value.length) {
      currentIndex.value = (currentIndex.value + 1) % loadedImages.value.length;
    }
  }, 3000);
}

function stopLoop() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = 0;
  }
}

function clearPreviewTimeout() {
  if (previewTimeoutId) {
    window.clearTimeout(previewTimeoutId);
    previewTimeoutId = 0;
  }
}

function clearGhostTimeout() {
  if (ghostTimeoutId) {
    window.clearTimeout(ghostTimeoutId);
    ghostTimeoutId = 0;
  }
}

function clearRevealTimeout() {
  if (revealTimeoutId) {
    window.clearTimeout(revealTimeoutId);
    revealTimeoutId = 0;
  }
}

function revealGallery() {
  if (isGalleryReady.value || revealTimeoutId) return;

  isGalleryReady.value = true;
  startLoop();
  clearGhostTimeout();
  ghostTimeoutId = window.setTimeout(() => {
    isGhostVisible.value = false;
    ghostTimeoutId = 0;
  }, 260);
}

function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(src);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}

function registerLoadedImage(image) {
  if (loadedImageSet.has(image.id)) return;

  loadedImageSet.add(image.id);
  loadedImages.value.push(image);

  if (!isGalleryReady.value && loadedImages.value.length >= initialPreloadCount) {
    revealGallery();
  }
}

async function initializeGallery() {
  if (!muralImages.length) return;

  const initialBatch = muralImages.slice(0, initialPreloadCount);
  const initialResults = await Promise.allSettled(
    initialBatch.map((image) => preloadImage(image.thumb))
  );

  initialResults.forEach((result, index) => {
    if (result.status === "fulfilled") registerLoadedImage(initialBatch[index]);
  });

  if (!isGalleryReady.value && loadedImages.value.length) revealGallery();
  void preloadRemainingImages(initialPreloadCount);
}

async function preloadRemainingImages(startIndex) {
  for (const image of muralImages.slice(startIndex)) {
    try {
      await preloadImage(image.thumb);
      registerLoadedImage(image);
    } catch {
      continue;
    }
  }
}

function setCardRef(imageKey, element) {
  if (element instanceof HTMLElement) {
    cardElements.set(imageKey, element);
    return;
  }

  cardElements.delete(imageKey);
}

function syncGalleryToModal() {
  if (!loadedImages.value.length) return;

  currentIndex.value =
    (modalImageIndex.value - (visibleCardCount - 1) + loadedImages.value.length) %
    loadedImages.value.length;
}

function openModalFromGallery() {
  if (!isGalleryReady.value || !loadedImages.value.length) return;

  const rightmostCard = cards.value[cards.value.length - 1];
  if (!rightmostCard) return;

  const sourceElement = cardElements.get(rightmostCard.imageKey);
  modalImageIndex.value =
    (currentIndex.value + cards.value.length - 1) % loadedImages.value.length;
  isModalOpen.value = true;
  isClosingModal.value = false;
  modalImageVisible.value = false;
  stopLoop();

  if (window.innerWidth <= 760) {
    animatedPreview.value = null;
    nextTick(() => {
      modalImageVisible.value = true;
      modalDialog.value?.focus();
    });
    return;
  }

  if (!(sourceElement instanceof HTMLElement)) {
    nextTick(() => {
      modalImageVisible.value = true;
      modalDialog.value?.focus();
    });
    return;
  }

  const sourceRect = sourceElement.getBoundingClientRect();
  const sourceTransform = getComputedStyle(sourceElement).transform;
  const targetWidth = Math.min(window.innerWidth * 0.78, 960);
  const targetHeight = targetWidth * (9 / 16);
  const targetLeft = (window.innerWidth - targetWidth) / 2;
  const targetTop = (window.innerHeight - targetHeight) / 2;

  animatedPreview.value = {
    src: rightmostCard.src,
    start: {
      top: `${sourceRect.top}px`,
      left: `${sourceRect.left}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      transform: sourceTransform === "none" ? "translateZ(0)" : sourceTransform
    },
    end: {
      top: `${targetTop}px`,
      left: `${targetLeft}px`,
      width: `${targetWidth}px`,
      height: `${targetHeight}px`,
      transform: "translateZ(0) rotateY(0deg) rotateZ(0deg) scale(1)"
    }
  };

  requestAnimationFrame(() => {
    if (animatedPreview.value) {
      animatedPreview.value = { ...animatedPreview.value, active: true };
    }
  });

  clearPreviewTimeout();
  previewTimeoutId = window.setTimeout(() => {
    modalImageVisible.value = true;
    nextTick(() => {
      modalDialog.value?.focus();
      previewTimeoutId = 0;
    });
  }, modalOpenDurationMs);
}

function closeModal() {
  clearPreviewTimeout();
  isClosingModal.value = true;

  if (window.innerWidth <= 760) {
    finalizeModalClose();
    return;
  }

  const sourceRect =
    modalImageWrap.value instanceof HTMLElement
      ? modalImageWrap.value.getBoundingClientRect()
      : null;
  const targetCard = cards.value[cards.value.length - 1];
  const targetElement = targetCard ? cardElements.get(targetCard.imageKey) : null;
  const targetRect =
    targetElement instanceof HTMLElement ? targetElement.getBoundingClientRect() : null;
  const targetTransform =
    targetElement instanceof HTMLElement ? getComputedStyle(targetElement).transform : "none";

  modalImageVisible.value = false;

  if (!sourceRect || !targetRect) {
    finalizeModalClose();
    return;
  }

  animatedPreview.value = {
    src: loadedImages.value[modalImageIndex.value]?.thumb || currentModalImage.value,
    start: {
      top: `${sourceRect.top}px`,
      left: `${sourceRect.left}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      transform: "translateZ(0) rotateY(0deg) rotateZ(0deg) scale(1)"
    },
    end: {
      top: `${targetRect.top}px`,
      left: `${targetRect.left}px`,
      width: `${targetRect.width}px`,
      height: `${targetRect.height}px`,
      transform: targetTransform === "none" ? "translateZ(0)" : targetTransform
    }
  };

  requestAnimationFrame(() => {
    if (animatedPreview.value) {
      animatedPreview.value = { ...animatedPreview.value, active: true };
    }
  });

  previewTimeoutId = window.setTimeout(() => {
    finalizeModalClose();
  }, modalCloseDurationMs);
}

function finalizeModalClose() {
  clearPreviewTimeout();
  isClosingModal.value = false;
  isModalOpen.value = false;
  modalImageVisible.value = false;
  animatedPreview.value = null;
  startLoop();
}

function showNextImage() {
  if (!loadedImages.value.length) return;
  if (animatedPreview.value) animatedPreview.value = null;
  modalImageIndex.value = (modalImageIndex.value + 1) % loadedImages.value.length;
  if (window.innerWidth > 760) {
    syncGalleryToModal();
  }
}

function showPreviousImage() {
  if (!loadedImages.value.length) return;
  if (animatedPreview.value) animatedPreview.value = null;
  modalImageIndex.value =
    (modalImageIndex.value - 1 + loadedImages.value.length) % loadedImages.value.length;
  if (window.innerWidth > 760) {
    syncGalleryToModal();
  }
}

function handleModalKeydown(event) {
  if (!isModalOpen.value) return;

  if (event.key === "Escape") {
    closeModal();
  } else if (event.key === "ArrowRight") {
    showNextImage();
  } else if (event.key === "ArrowLeft") {
    showPreviousImage();
  }
}
</script>

<template>
  <div class="penguin-smart-gallery-shell">
    <section
      class="penguin-smart-gallery-stack"
      :class="{ 'is-ready': isGalleryReady, 'is-ghost-only': !isGalleryReady }"
      @click="openModalFromGallery"
    >
      <div v-if="isGhostVisible" class="penguin-smart-gallery-ghost" aria-hidden="true">
        <div
          v-for="slot in 4"
          :key="`ghost-${slot}`"
          class="penguin-smart-gallery-ghost-card"
          :class="`slot-${slot}`"
        ></div>
      </div>

      <TransitionGroup
        name="penguin-smart-gallery-shift"
        tag="div"
        class="penguin-smart-gallery-track"
      >
        <article
          v-for="card in cards"
          v-show="isGalleryReady"
          :key="card.imageKey"
          class="penguin-smart-gallery-card"
          :class="[card.className, shouldGhostRightSlot && card.className === 'slot-4' && 'is-source-hidden']"
          :ref="(element) => setCardRef(card.imageKey, element)"
        >
          <img :src="card.src" :alt="card.alt" loading="lazy" />
        </article>
      </TransitionGroup>
    </section>

    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="penguin-smart-gallery-modal"
        :class="{ 'is-closing': isClosingModal }"
        @keydown="handleModalKeydown"
      >
        <div class="penguin-smart-gallery-modal__backdrop" @click="closeModal"></div>
        <div class="penguin-smart-gallery-modal__lighthouse"></div>

        <img
          v-if="animatedPreview"
          class="penguin-smart-gallery-modal__preview"
          :class="{ 'is-active': animatedPreview.active }"
          :src="animatedPreview.src"
          alt=""
          :style="animatedPreview.active ? animatedPreview.end : animatedPreview.start"
        />

        <div
          ref="modalDialog"
          class="penguin-smart-gallery-modal__dialog"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-label="Galería fotográfica de la campaña"
          @click.self="closeModal"
        >
          <div
            class="penguin-smart-gallery-modal__frame"
            :class="{ 'is-visible': !isClosingModal }"
          >
            <button
              class="penguin-smart-gallery-modal__close"
              type="button"
              aria-label="Cerrar"
              @click="closeModal"
            >
              ×
            </button>
            <button
              class="penguin-smart-gallery-modal__nav is-prev"
              type="button"
              aria-label="Imagen anterior"
              @click="showPreviousImage"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <div
              ref="modalImageWrap"
              class="penguin-smart-gallery-modal__image-wrap"
              :class="{ 'is-visible': modalImageVisible && !isClosingModal }"
            >
              <img :src="currentModalImage" alt="Fotografía ampliada de la campaña" />
            </div>
            <button
              class="penguin-smart-gallery-modal__nav is-next"
              type="button"
              aria-label="Imagen siguiente"
              @click="showNextImage"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.penguin-smart-gallery-shell {
  position: relative;
  min-height: 300px;
  display: grid;
  place-items: center;
}

.penguin-smart-gallery-stack {
  position: relative;
  width: min(100%, 610px);
  height: 310px;
  perspective: 1800px;
  transform-style: preserve-3d;
  pointer-events: auto;
  cursor: zoom-in;
}

.penguin-smart-gallery-stack.is-ghost-only {
  cursor: default;
}

.penguin-smart-gallery-track,
.penguin-smart-gallery-ghost {
  position: absolute;
  inset: 0;
}

.penguin-smart-gallery-ghost {
  opacity: 1;
  transition: opacity 260ms ease, transform 320ms ease;
}

.penguin-smart-gallery-stack.is-ready .penguin-smart-gallery-ghost {
  opacity: 0;
  transform: translateY(8px);
}

.penguin-smart-gallery-ghost-card,
.penguin-smart-gallery-card {
  position: absolute;
  width: clamp(180px, 25vw, 270px);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 22px;
  transform-origin: center center;
}

.penguin-smart-gallery-ghost-card {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02)),
    linear-gradient(180deg, rgba(56, 182, 255, 0.08), rgba(255, 162, 209, 0.06));
  box-shadow:
    0 24px 72px rgba(15, 12, 10, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.penguin-smart-gallery-card {
  border: 1px solid rgba(255, 255, 255, 0.38);
  box-shadow: 0 28px 80px rgba(15, 12, 10, 0.28);
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
  transition: box-shadow 180ms ease, transform 180ms ease, opacity 260ms ease;
}

.penguin-smart-gallery-card img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}

.penguin-smart-gallery-card.is-source-hidden {
  border-color: rgba(255, 255, 255, 0.14);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02)),
    linear-gradient(180deg, rgba(56, 182, 255, 0.08), rgba(255, 162, 209, 0.06));
  box-shadow:
    0 24px 72px rgba(15, 12, 10, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.penguin-smart-gallery-card.is-source-hidden img {
  opacity: 0;
}

.penguin-smart-gallery-stack:hover .penguin-smart-gallery-card {
  box-shadow: 0 32px 92px rgba(15, 12, 10, 0.34);
}

.slot-1 {
  top: 8px;
  left: 0;
  transform: rotateY(26deg) rotateZ(-8deg) translate3d(0, 18px, -120px);
  z-index: 1;
}

.slot-2 {
  top: 34px;
  left: 82px;
  transform: rotateY(18deg) rotateZ(-4deg) translate3d(0, 2px, -60px);
  z-index: 2;
}

.slot-3 {
  top: 62px;
  left: 168px;
  transform: rotateY(10deg) rotateZ(0deg) translate3d(0, -4px, 0);
  z-index: 3;
}

.slot-4 {
  top: 92px;
  left: 260px;
  transform: rotateY(-6deg) rotateZ(4deg) translate3d(0, -2px, 40px);
  z-index: 4;
}

.penguin-smart-gallery-shift-enter-active,
.penguin-smart-gallery-shift-leave-active,
.penguin-smart-gallery-shift-move {
  transition:
    transform 700ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 700ms ease,
    left 700ms cubic-bezier(0.22, 1, 0.36, 1),
    top 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

.penguin-smart-gallery-shift-enter-from {
  opacity: 0;
  transform: translateX(150px) scale(0.96);
}

.penguin-smart-gallery-shift-leave-to {
  opacity: 0;
  transform: translateX(-150px) scale(0.96);
}

.penguin-smart-gallery-shift-leave-active {
  position: absolute;
}

.penguin-smart-gallery-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
}

.penguin-smart-gallery-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(5, 5, 5, 0.74);
  backdrop-filter: blur(12px);
  transition: opacity 180ms ease;
}

.penguin-smart-gallery-modal__lighthouse {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at center, rgba(56, 182, 255, 0.16), rgba(255, 248, 229, 0.04) 18%, rgba(5, 5, 5, 0) 38%),
    radial-gradient(circle at center, rgba(255, 255, 255, 0.08), rgba(5, 5, 5, 0) 52%);
  pointer-events: none;
  transition: opacity 180ms ease;
}

.penguin-smart-gallery-modal__dialog {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transition: opacity 180ms ease;
}

.penguin-smart-gallery-modal__dialog:focus {
  outline: none;
}

.penguin-smart-gallery-modal__preview {
  position: fixed;
  z-index: 3;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 36px 120px rgba(0, 0, 0, 0.42);
  object-fit: cover;
  transition:
    top 720ms cubic-bezier(0.22, 1, 0.36, 1),
    left 720ms cubic-bezier(0.22, 1, 0.36, 1),
    width 720ms cubic-bezier(0.22, 1, 0.36, 1),
    height 720ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 720ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 720ms ease;
}

.penguin-smart-gallery-modal.is-closing .penguin-smart-gallery-modal__preview {
  transition:
    top 520ms cubic-bezier(0.22, 1, 0.36, 1),
    left 520ms cubic-bezier(0.22, 1, 0.36, 1),
    width 520ms cubic-bezier(0.22, 1, 0.36, 1),
    height 520ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 520ms ease;
}

.penguin-smart-gallery-modal__frame {
  position: relative;
  width: min(78vw, 960px);
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  transition: opacity 180ms ease, transform 220ms ease;
}

.penguin-smart-gallery-modal__frame.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.penguin-smart-gallery-modal__image-wrap {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  box-shadow: 0 30px 110px rgba(0, 0, 0, 0.42);
  opacity: 0;
  transition: opacity 140ms ease;
}

.penguin-smart-gallery-modal__image-wrap.is-visible {
  opacity: 1;
}

.penguin-smart-gallery-modal__image-wrap img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  object-position: center 30%;
}

.penguin-smart-gallery-modal__close,
.penguin-smart-gallery-modal__nav {
  position: absolute;
  z-index: 4;
  border: 0;
  background: transparent;
  color: #ffffff;
  padding: 0;
  box-shadow: none;
  min-height: auto;
  line-height: 1;
  text-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18),
    0 10px 18px rgba(0, 0, 0, 0.34),
    0 18px 32px rgba(0, 0, 0, 0.18);
  transform-style: preserve-3d;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.22));
}

.penguin-smart-gallery-modal__close {
  top: -54px;
  right: 0;
  font-size: 2rem;
  transform: translateZ(0) rotateX(10deg);
}

.penguin-smart-gallery-modal__nav {
  top: 50%;
  transform: translateY(-50%);
  font-size: 4rem;
}

.penguin-smart-gallery-modal__close:hover,
.penguin-smart-gallery-modal__nav:hover {
  color: rgba(255, 255, 255, 0.72);
  filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.28));
}

.penguin-smart-gallery-modal__nav.is-prev {
  left: -92px;
  transform: translateY(-50%) rotateY(16deg);
}

.penguin-smart-gallery-modal__nav.is-next {
  right: -92px;
  transform: translateY(-50%) rotateY(-16deg);
}

.penguin-smart-gallery-modal.is-closing .penguin-smart-gallery-modal__backdrop,
.penguin-smart-gallery-modal.is-closing .penguin-smart-gallery-modal__lighthouse,
.penguin-smart-gallery-modal.is-closing .penguin-smart-gallery-modal__dialog {
  opacity: 0;
}

@media (max-width: 1100px) {
  .penguin-smart-gallery-shell {
    min-height: 260px;
  }

  .penguin-smart-gallery-stack {
    width: min(100%, 520px);
    height: 260px;
    transform: scale(0.92);
    transform-origin: center top;
  }

  .slot-2 { left: 72px; }
  .slot-3 { left: 144px; }
  .slot-4 { left: 220px; }
}

@media (max-width: 760px) {
  .penguin-smart-gallery-shell {
    min-height: 220px;
  }

  .penguin-smart-gallery-stack {
    width: min(100%, 440px);
    height: 220px;
    transform: scale(0.78);
  }

  .penguin-smart-gallery-modal__frame {
    width: min(92vw, 960px);
    padding-top: 2.75rem;
  }

  .penguin-smart-gallery-modal__close {
    top: 0;
    right: 0.25rem;
    font-size: 2.25rem;
    transform: none;
  }

  .penguin-smart-gallery-modal__nav {
    top: auto;
    bottom: -3.5rem;
    font-size: 2.75rem;
    transform: none;
  }

  .penguin-smart-gallery-modal__nav.is-prev {
    left: 0.25rem;
    transform: none;
  }

  .penguin-smart-gallery-modal__nav.is-next {
    right: 0.25rem;
    transform: none;
  }

  .penguin-smart-gallery-modal__image-wrap {
    border-radius: 16px;
  }

  .penguin-smart-gallery-modal__image-wrap img {
    aspect-ratio: 4 / 5;
    object-position: center center;
  }
}
</style>
