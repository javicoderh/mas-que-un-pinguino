<script setup lang="ts">
import { ref, computed } from "vue";

type Currency = "CLP" | "USD";
type Lang = "es" | "en";

const AMOUNTS_CLP = [
  { value: 1000, impact: "Un café por el pingüino" },
  { value: 2500, impact: "Apoyo básico" },
  { value: 5000, impact: "Apoyo completo" },
  { value: 10000, impact: "Guardián Humboldt" },
];

const AMOUNTS_USD = [
  { value: 1, impactEs: "Un café por el pingüino", impactEn: "A coffee for the penguin" },
  { value: 3, impactEs: "Apoyo básico", impactEn: "Basic support" },
  { value: 5, impactEs: "Apoyo completo", impactEn: "Full support" },
  { value: 10, impactEs: "Guardián Humboldt", impactEn: "Humboldt Guardian" },
];

const currency = ref<Currency>("CLP");
const lang = ref<Lang>("es");
const selectedAmount = ref(5000);
const customAmount = ref("");
const name = ref("");
const email = ref("");
const loading = ref(false);
const error = ref("");

// Stats — conectado a DB, sin render
const donorCount = ref(0);
const totalAmount = ref(0);

const isUSD = computed(() => currency.value === "USD");
const amounts = computed(() => isUSD.value ? AMOUNTS_USD : AMOUNTS_CLP);

const switchCurrency = (c: Currency) => {
  currency.value = c;
  customAmount.value = "";
  selectedAmount.value = c === "CLP" ? 5000 : 5;
  // Al cambiar a USD, el idioma por defecto es inglés
  if (c === "USD") lang.value = "en";
  else lang.value = "es";
};

const effectiveAmount = computed(() => {
  if (customAmount.value) {
    const n = parseFloat(customAmount.value.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return selectedAmount.value;
});

const impactLabel = computed(() => {
  if (isUSD.value) {
    const match = AMOUNTS_USD.find((a) => a.value === effectiveAmount.value);
    if (!match) return lang.value === "en" ? "Custom donation" : "Donación personalizada";
    return lang.value === "en" ? match.impactEn : match.impactEs;
  }
  return AMOUNTS_CLP.find((a) => a.value === effectiveAmount.value)?.impact ?? "Donación personalizada";
});

const fmtAmount = (n: number) =>
  isUSD.value
    ? `US$${n}`
    : `$${new Intl.NumberFormat("es-CL").format(n)}`;

// Textos según idioma
const t = computed(() =>
  lang.value === "en"
    ? {
        chooseAmount: "Choose an amount",
        otherAmount: "Other amount in USD",
        yourName: "Your name",
        yourEmail: "Your email",
        submit: "Donate now",
        submitting: "Redirecting to payment…",
        security: "Secure payment via Flow · Chilean payment platform",
        errorFields: "Please fill in all fields.",
        errorMin: "Minimum amount is US$1.",
        errorConn: "Connection error. Please try again.",
        errorGeneric: "Payment error. Please try again.",
      }
    : {
        chooseAmount: "Elige un monto",
        otherAmount: isUSD.value ? "Otro monto en USD" : "Otro monto en CLP",
        yourName: "Tu nombre",
        yourEmail: "Tu email",
        submit: "Donar ahora",
        submitting: "Redirigiendo a pago…",
        security: "Pago seguro via Flow · Plataforma chilena de pagos",
        errorFields: "Completa todos los campos.",
        errorMin: isUSD.value ? "El monto mínimo es US$1." : "El monto mínimo es $500 CLP.",
        errorConn: "Error de conexión. Intenta nuevamente.",
        errorGeneric: "Error al procesar el pago.",
      }
);

const selectAmount = (value: number) => {
  selectedAmount.value = value;
  customAmount.value = "";
};

const onCustomFocus = () => {
  selectedAmount.value = 0;
};

const onSubmit = async () => {
  error.value = "";

  if (!name.value.trim() || !email.value.trim()) {
    error.value = t.value.errorFields;
    return;
  }
  const min = isUSD.value ? 1 : 500;
  if (!effectiveAmount.value || effectiveAmount.value < min) {
    error.value = t.value.errorMin;
    return;
  }

  loading.value = true;

  try {
    const res = await fetch("/api/donations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        amount: effectiveAmount.value,
        currency: currency.value,
        language: lang.value,
      }),
    });

    const data = await res.json();
    if (data.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      error.value = data.message ?? t.value.errorGeneric;
      loading.value = false;
    }
  } catch {
    error.value = t.value.errorConn;
    loading.value = false;
  }
};

// Carga silenciosa de estadísticas
const loadStats = async () => {
  try {
    const res = await fetch("/api/donations/stats");
    const data = await res.json();
    if (data.ok) {
      donorCount.value = data.donorCount;
      totalAmount.value = data.totalAmount;
    }
  } catch { /* silent */ }
};

loadStats();
</script>

<template>
  <div class="rounded-[2rem] border border-white/12 bg-black/40 p-6 backdrop-blur-sm md:p-8">
    <!-- Stats: conectado a DB, sin render -->
    <div hidden aria-hidden="true" :data-donor-count="donorCount" :data-total-amount="totalAmount"></div>

    <!-- Tabs Chile / Internacional -->
    <div class="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-1">
      <button
        type="button"
        @click="switchCurrency('CLP')"
        :class="[
          'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          !isUSD
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-white/55 hover:text-white/80',
        ]"
      >
        🇨🇱 Chile · CLP
      </button>
      <button
        type="button"
        @click="switchCurrency('USD')"
        :class="[
          'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          isUSD
            ? 'bg-white/10 text-white shadow-sm'
            : 'text-white/55 hover:text-white/80',
        ]"
      >
        🌍 Internacional · USD
      </button>
    </div>

    <!-- Toggle de idioma (solo en modo USD) -->
    <div v-if="isUSD" class="mb-5 flex items-center gap-2">
      <span class="text-xs font-medium text-white/45">Idioma / Language:</span>
      <div class="flex gap-1 rounded-full border border-white/10 bg-white/4 p-0.5">
        <button
          type="button"
          @click="lang = 'es'"
          :class="[
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            lang === 'es' ? 'bg-white/12 text-white' : 'text-white/45 hover:text-white/70',
          ]"
        >
          Español
        </button>
        <button
          type="button"
          @click="lang = 'en'"
          :class="[
            'rounded-full px-3 py-1 text-xs font-semibold transition',
            lang === 'en' ? 'bg-white/12 text-white' : 'text-white/45 hover:text-white/70',
          ]"
        >
          English
        </button>
      </div>
    </div>

    <!-- Selección de monto -->
    <p class="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-campaign-sky">
      {{ t.chooseAmount }}
    </p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        v-for="opt in amounts"
        :key="opt.value"
        type="button"
        @click="selectAmount(opt.value)"
        :class="[
          'rounded-2xl border px-3 py-3 text-center transition',
          selectedAmount === opt.value && !customAmount
            ? 'border-campaign-warm bg-campaign-warm/15 text-white'
            : 'border-white/14 bg-white/5 text-white/80 hover:border-white/28 hover:text-white',
        ]"
      >
        <span class="block text-base font-black">{{ fmtAmount(opt.value) }}</span>
        <span class="mt-0.5 block text-[10px] leading-tight text-white/55">
          {{ isUSD && lang === 'en' && 'impactEn' in opt ? opt.impactEn : ('impactEs' in opt ? opt.impactEs : (opt as any).impact) }}
        </span>
      </button>
    </div>

    <input
      v-model="customAmount"
      @focus="onCustomFocus"
      type="text"
      inputmode="decimal"
      :placeholder="t.otherAmount"
      class="mt-2 w-full rounded-2xl border border-white/14 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-campaign-warm/50 focus:bg-white/8"
    />

    <!-- Etiqueta de impacto -->
    <p class="mt-4 rounded-xl border border-campaign-sky/20 bg-campaign-sky/10 px-4 py-2.5 text-sm text-campaign-sky">
      <span class="font-semibold">{{ fmtAmount(effectiveAmount) }}</span> — {{ impactLabel }}
    </p>

    <!-- Campos del formulario -->
    <div class="mt-5 grid gap-3">
      <input
        v-model="name"
        type="text"
        :placeholder="t.yourName"
        autocomplete="name"
        class="w-full rounded-2xl border border-white/14 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-campaign-warm/50 focus:bg-white/8"
      />
      <input
        v-model="email"
        type="email"
        :placeholder="t.yourEmail"
        autocomplete="email"
        class="w-full rounded-2xl border border-white/14 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/35 outline-none transition focus:border-campaign-warm/50 focus:bg-white/8"
      />
    </div>

    <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>

    <!-- Botón de envío -->
    <button
      type="button"
      @click="onSubmit"
      :disabled="loading"
      class="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-black/40 bg-campaign-warm px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-black shadow-[0_12px_40px_rgba(255,162,0,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg v-if="!loading" aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 fill-current">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      </svg>
      <svg v-if="loading" aria-hidden="true" viewBox="0 0 24 24" class="h-4 w-4 animate-spin fill-current">
        <path d="M12 2a10 10 0 0 1 7.071 2.929 1 1 0 0 1-1.414 1.414A8 8 0 0 0 12 4a8 8 0 0 0-8 8 1 1 0 0 1-2 0C2 6.477 6.477 2 12 2z" />
      </svg>
      {{ loading ? t.submitting : t.submit }}
    </button>

    <p class="mt-3 text-center text-xs text-white/38">{{ t.security }}</p>
  </div>
</template>
