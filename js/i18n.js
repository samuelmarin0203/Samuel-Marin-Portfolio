/**
 * i18n.js - Bilingual Internationalization Engine (Spanish / English)
 * Reads data/es.json and data/en.json.
 * Auto-detects browser language, stores preference, and updates DOM reactively.
 */

const I18n = {
  currentLang: "es",
  translations: {},
  subscribers: [],

  /**
   * Initializes i18n, loads JSON language dictionaries, and sets active language
   */
  async init() {
    try {
      const [esRes, enRes] = await Promise.all([
        fetch("data/es.json"),
        fetch("data/en.json")
      ]);

      this.translations.es = await esRes.json();
      this.translations.en = await enRes.json();

      // Determine initial language: localStorage > browser language > default 'es'
      const stored = localStorage.getItem("portfolio_lang");
      if (stored === "es" || stored === "en") {
        this.currentLang = stored;
      } else {
        const browserLang = (navigator.language || navigator.userLanguage || "es").toLowerCase();
        this.currentLang = browserLang.startsWith("es") ? "es" : "en";
      }

      this.applyLanguage(this.currentLang);
      return this.currentLang;
    } catch (err) {
      console.error("Failed to load i18n files:", err);
      // Fallback minimal safe execution
      return "es";
    }
  },

  /**
   * Sets active language and re-translates the UI
   * @param {string} lang - 'es' | 'en'
   */
  setLanguage(lang) {
    if (lang !== "es" && lang !== "en") return;
    this.currentLang = lang;
    localStorage.setItem("portfolio_lang", lang);
    this.applyLanguage(lang);
    this.notifySubscribers();
  },

  getLanguage() {
    return this.currentLang;
  },

  /**
   * Retrieves nested key translation e.g., 'hero.headline'
   */
  t(keyPath, fallback = "") {
    const dict = this.translations[this.currentLang] || {};
    const parts = keyPath.split(".");
    let curr = dict;
    for (const p of parts) {
      if (curr && curr[p] !== undefined) {
        curr = curr[p];
      } else {
        return fallback || keyPath;
      }
    }
    return curr;
  },

  /**
   * Translates an investment's thesis, catalysts, risks, or lessons learned.
   * Priority:
   * 1. Check active language dictionary (es.json / en.json) under investments[positionId]
   * 2. Fallback to direct field in investments.json if provided
   */
  getInvestmentText(positionId, field, fallbackObj = null) {
    const dict = this.translations[this.currentLang];
    if (dict && dict.investments && dict.investments[positionId]) {
      const val = dict.investments[positionId][field];
      if (val !== undefined && val !== null && val !== "") return val;
    }

    // Fallback: direct properties on investment object (e.g., thesis_es / thesis_en or thesis)
    if (fallbackObj) {
      const langSpecific = fallbackObj[`${field}_${this.currentLang}`];
      if (langSpecific) return langSpecific;
      if (fallbackObj[field]) return fallbackObj[field];
    }
    return "";
  },

  /**
   * Updates standard data-i18n nodes in DOM
   */
  applyLanguage(lang) {
    document.documentElement.lang = lang;

    // Update document title and meta description
    const metaTitle = this.t("meta.title");
    const metaDesc = this.t("meta.description");
    if (metaTitle) document.title = metaTitle;
    const descEl = document.querySelector('meta[name="description"]');
    if (descEl && metaDesc) descEl.setAttribute("content", metaDesc);

    // Update text elements
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const val = this.t(key);
      if (val) {
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          el.placeholder = val;
        } else {
          el.textContent = val;
        }
      }
    });

    // Update attributes e.g., aria-label, title
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const mapping = el.getAttribute("data-i18n-attr").split(",");
      mapping.forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s.trim());
        if (attr && key) {
          const val = this.t(key);
          if (val) el.setAttribute(attr, val);
        }
      });
    });

    // Update language toggle buttons visual active state
    document.querySelectorAll(".lang-btn").forEach(btn => {
      if (btn.getAttribute("data-lang") === lang) {
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      }
    });
  },

  /**
   * Register subscriber callback for when language changes
   */
  subscribe(callback) {
    if (typeof callback === "function") {
      this.subscribers.push(callback);
    }
  },

  notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.currentLang));
  }
};
