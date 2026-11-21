/**
 * app.js - Main Application Controller
 * Manages configuration, data rendering, dynamic KPI calculation,
 * filtering, modals, theme toggling, and event handlers.
 */

const App = {
  config: null,
  investments: [],
  filteredInvestments: [],
  activeFilters: {
    sector: "all",
    year: "all",
    outcome: "all"
  },
  activeModalPosition: null,

  async init() {
    // 1. Initialize Theme (Light by default)
    this.initTheme();

    // 2. Initialize i18n Engine
    await I18n.init();

    // 3. Load Config & Investments Data
    await Promise.all([
      this.loadConfig(),
      this.loadInvestments()
    ]);

    // 4. Bind Global UI Events
    this.bindEvents();

    // 5. Initial Render
    this.renderAll();

    // 6. Subscribe to Language changes
    I18n.subscribe(() => {
      this.updateConfigLinks();
      this.populateFilterDropdowns();
      this.renderAll();
      if (this.activeModalPosition) {
        this.openModal(this.activeModalPosition.id);
      }
    });
  },

  /* ------------------------------------------------------------------------
     THEME MANAGEMENT (LIGHT / DARK)
     ------------------------------------------------------------------------ */
  initTheme() {
    const stored = localStorage.getItem("portfolio_theme");
    const theme = stored === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);

    const toggleBtn = document.getElementById("theme-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("portfolio_theme", next);
        // Re-render chart to adapt colors if needed
        this.renderCharts();
      });
    }
  },

  /* ------------------------------------------------------------------------
     DATA LOADING
     ------------------------------------------------------------------------ */
  async loadConfig() {
    try {
      const res = await fetch("data/config.json");
      this.config = await res.json();
      this.updateConfigLinks();
    } catch (e) {
      console.error("Could not load config.json:", e);
    }
  },

  async loadInvestments() {
    try {
      const res = await fetch("data/investments.json");
      this.investments = await res.json();
      this.filteredInvestments = [...this.investments];
      this.populateFilterDropdowns();
    } catch (e) {
      console.error("Could not load investments.json:", e);
    }
  },

  updateConfigLinks() {
    if (!this.config) return;
    const lang = I18n.getLanguage();

    // LinkedIn Links (Header, Hero CTA, Contact card, Footer)
    document.querySelectorAll(".js-linkedin-link").forEach(link => {
      link.href = this.config.linkedin_url || "https://www.linkedin.com";
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });

    // Email links & text
    document.querySelectorAll(".js-email-link").forEach(el => {
      if (el.tagName === "A") {
        el.href = `mailto:${this.config.email}`;
      }
      el.textContent = this.config.email;
    });

    // CV Download Link
    const cvLink = document.getElementById("hero-cv-btn");
    if (cvLink) {
      const cvFile = lang === "es" ? this.config.cv_file_es : this.config.cv_file_en;
      cvLink.href = cvFile || "assets/cv-samuel-marin-es.pdf";
    }

    // Phone link & text
    document.querySelectorAll(".js-phone-link").forEach(el => {
      if (this.config.phone) {
        if (el.tagName === "A") {
          el.href = `tel:${this.config.phone.replace(/[^+\d]/g, '')}`;
        }
        el.textContent = this.config.phone;
      }
    });
  },

  /* ------------------------------------------------------------------------
     FILTERING & KPI CALCULATIONS
     ------------------------------------------------------------------------ */
  populateFilterDropdowns() {
    const sectorSelect = document.getElementById("filter-sector");
    const yearSelect = document.getElementById("filter-year");
    if (!sectorSelect || !yearSelect) return;

    // Collect unique sectors and years
    const sectors = Array.from(new Set(this.investments.map(i => i.sector))).sort();
    const years = Array.from(new Set(this.investments.map(i => {
      return i.entry_date ? i.entry_date.split("-")[0] : "";
    }))).filter(Boolean).sort().reverse();

    // Clear existing dynamic options (keep first "all" option)
    while (sectorSelect.options.length > 1) sectorSelect.remove(1);
    while (yearSelect.options.length > 1) yearSelect.remove(1);

    sectors.forEach(sec => {
      const opt = document.createElement("option");
      opt.value = sec;
      opt.textContent = sec;
      sectorSelect.appendChild(opt);
    });

    years.forEach(yr => {
      const opt = document.createElement("option");
      opt.value = yr;
      opt.textContent = yr;
      yearSelect.appendChild(opt);
    });
  },

  applyFilters() {
    this.filteredInvestments = this.investments.filter(inv => {
      // Sector filter
      if (this.activeFilters.sector !== "all" && inv.sector !== this.activeFilters.sector) {
        return false;
      }
      // Year filter
      if (this.activeFilters.year !== "all") {
        const invYear = inv.entry_date ? inv.entry_date.split("-")[0] : "";
        if (invYear !== this.activeFilters.year) return false;
      }
      // Outcome filter
      if (this.activeFilters.outcome !== "all") {
        const isWinner = (inv.outcome === "ganadora" || inv.outcome === "winner" || inv.return_pct >= 0);
        if (this.activeFilters.outcome === "winner" && !isWinner) return false;
        if (this.activeFilters.outcome === "loser" && isWinner) return false;
      }
      return true;
    });

    this.renderKPIs();
    this.renderCards();
    this.renderCharts();
  },

  renderKPIs() {
    const count = this.filteredInvestments.length;
    const countEl = document.getElementById("kpi-count");
    const winRateEl = document.getElementById("kpi-winrate");
    const avgReturnEl = document.getElementById("kpi-avg-return");
    const avgAlphaEl = document.getElementById("kpi-avg-alpha");

    if (!countEl || !winRateEl || !avgReturnEl || !avgAlphaEl) return;

    if (count === 0) {
      countEl.textContent = "0";
      winRateEl.textContent = "—";
      avgReturnEl.textContent = "—";
      avgAlphaEl.textContent = "—";
      return;
    }

    let winners = 0;
    let sumReturn = 0;
    let sumAlpha = 0;

    this.filteredInvestments.forEach(inv => {
      const ret = inv.return_pct || 0;
      const bmk = inv.benchmark_return_pct || 0;
      const alpha = ret - bmk;

      if (ret >= 0 || inv.outcome === "ganadora" || inv.outcome === "winner") {
        winners++;
      }
      sumReturn += ret;
      sumAlpha += alpha;
    });

    const winRate = (winners / count) * 100;
    const avgReturn = sumReturn / count;
    const avgAlpha = sumAlpha / count;

    countEl.textContent = count.toString();
    winRateEl.textContent = `${winRate.toFixed(1)}%`;
    
    avgReturnEl.textContent = `${avgReturn >= 0 ? '+' : ''}${avgReturn.toFixed(1)}%`;
    avgReturnEl.className = `kpi-value tnum ${avgReturn >= 0 ? 'positive' : 'negative'}`;

    avgAlphaEl.textContent = `${avgAlpha >= 0 ? '+' : ''}${avgAlpha.toFixed(1)}%`;
    avgAlphaEl.className = `kpi-value tnum ${avgAlpha >= 0 ? 'positive' : 'negative'}`;
  },

  /* ------------------------------------------------------------------------
     RENDER INVESTMENT CARDS
     ------------------------------------------------------------------------ */
  renderCards() {
    const container = document.getElementById("investments-container");
    if (!container) return;

    if (this.filteredInvestments.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
        ${I18n.getLanguage() === 'es' ? 'No se encontraron posiciones con los filtros seleccionados.' : 'No positions matched the selected filters.'}
      </div>`;
      return;
    }

    const labels = {
      sample_badge: I18n.t("track_record.labels.sample_badge"),
      lesson_badge: I18n.t("track_record.labels.lesson_badge"),
      return_label: I18n.t("track_record.labels.return"),
      view_details: I18n.t("track_record.labels.view_details"),
      open_position: I18n.t("track_record.labels.open_position"),
      benchmark: I18n.t("track_record.labels.benchmark"),
      alpha: I18n.t("track_record.labels.alpha")
    };

    container.innerHTML = this.filteredInvestments.map(inv => {
      const isWinner = (inv.outcome === "ganadora" || inv.outcome === "winner" || inv.return_pct >= 0);
      const ret = inv.return_pct || 0;
      const bmk = inv.benchmark_return_pct || 0;
      const alpha = ret - bmk;

      const thesisText = I18n.getInvestmentText(inv.id, "thesis", inv);
      const lessonText = I18n.getInvestmentText(inv.id, "lessons_learned", inv);

      const exitLabel = (inv.exit_date === "abierta" || inv.exit_date === "open")
        ? labels.open_position
        : inv.exit_date;

      return `
        <article class="inv-card ${isWinner ? 'is-winner' : 'is-loser'}" id="card-${inv.id}">
          <div class="inv-card-top">
            <div class="card-badges">
              ${inv.is_sample ? `<span class="badge badge-sample">${labels.sample_badge}</span>` : ''}
              ${!isWinner ? `<span class="badge badge-lesson">${labels.lesson_badge}</span>` : ''}
              <span class="badge badge-sector">${inv.sector}</span>
            </div>

            <div class="card-title-row">
              <span class="card-ticker">${inv.ticker}</span>
              <span class="card-company">${inv.country}</span>
            </div>
            <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
              ${inv.company}
            </div>

            <div class="card-returns-box">
              <div class="return-main">
                <span class="return-label">${labels.return_label}</span>
                <span class="return-val tnum ${ret >= 0 ? 'positive' : 'negative'}">
                  ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%
                </span>
              </div>
              <div class="return-benchmark">
                <span class="benchmark-val tnum">${inv.benchmark}: ${bmk >= 0 ? '+' : ''}${bmk.toFixed(1)}%</span>
                <span class="alpha-val tnum ${alpha >= 0 ? 'positive' : 'negative'}">
                  ${labels.alpha}: ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%
                </span>
              </div>
            </div>

            <p class="card-thesis">${thesisText}</p>

            ${!isWinner && lessonText ? `
              <div class="card-lesson-preview">
                <strong>${labels.lesson_badge}</strong>
                <span>${lessonText}</span>
              </div>
            ` : ''}
          </div>

          <div class="card-footer">
            <span class="card-dates tnum">${inv.entry_date} &rarr; ${exitLabel}</span>
            <button class="btn-detail js-view-detail" data-id="${inv.id}" aria-haspopup="dialog">
              ${labels.view_details} &rarr;
            </button>
          </div>
        </article>
      `;
    }).join("");
  },

  renderCharts() {
    const labels = {
      chart_title: I18n.t("track_record.chart_title")
    };
    Charts.renderOverviewBarChart("overview-chart", this.filteredInvestments, labels);
  },

  /* ------------------------------------------------------------------------
     RENDER INVESTMENT PROCESS & TIMELINE
     ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------
     RENDER INVESTMENT METHODOLOGY (VALUE INVESTING & CANSLIM)
     ------------------------------------------------------------------------ */
  renderMethodology() {
    const container = document.getElementById("methodology-container");
    if (!container) return;

    const valueTitle = I18n.t("methodology.value_title");
    const valueSubtitle = I18n.t("methodology.value_subtitle");
    const valuePillars = I18n.t("methodology.value_pillars", []);

    const canslimTitle = I18n.t("methodology.canslim_title");
    const canslimSubtitle = I18n.t("methodology.canslim_subtitle");
    const canslimItems = I18n.t("methodology.canslim_items", []);

    container.innerHTML = `
      <!-- Pillar 1: Value Investing -->
      <div class="methodology-block">
        <div class="methodology-header">
          <h3 class="methodology-title">${valueTitle}</h3>
          <p class="methodology-subtitle">${valueSubtitle}</p>
        </div>
        <div class="value-pillars-grid">
          ${valuePillars.map(p => `
            <div class="pillar-item">
              <h4 class="pillar-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-gold)" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                ${p.title}
              </h4>
              <p class="pillar-desc">${p.desc}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Pillar 2: CANSLIM -->
      <div class="methodology-block">
        <div class="methodology-header">
          <h3 class="methodology-title">${canslimTitle}</h3>
          <p class="methodology-subtitle">${canslimSubtitle}</p>
        </div>
        <div class="canslim-grid">
          ${canslimItems.map(item => `
            <div class="canslim-card">
              <span class="canslim-letter">${item.letter}</span>
              <div class="canslim-body">
                <div class="canslim-name">${item.name}</div>
                <p class="canslim-desc">${item.desc}</p>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  /* ------------------------------------------------------------------------
     RENDER UNDERGRADUATE THESIS & RESEARCH (TFG)
     ------------------------------------------------------------------------ */
  renderResearch() {
    const container = document.getElementById("research-container");
    if (!container) return;

    const badge = I18n.t("research.tfg_badge");
    const title = I18n.t("research.tfg_title");
    const meta = I18n.t("research.tfg_meta");
    const abstractTitle = I18n.t("research.abstract_title");
    const abstractText = I18n.t("research.abstract_text");
    const methodTitle = I18n.t("research.methodology_title");
    const methodItems = I18n.t("research.methodology_items", []);
    const conclTitle = I18n.t("research.conclusions_title");
    const conclItems = I18n.t("research.conclusions_items", []);

    container.innerHTML = `
      <div class="tfg-card">
        <div class="tfg-badge-wrap">
          <span class="tfg-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${badge}
          </span>
        </div>
        <h3 class="tfg-title">${title}</h3>
        <p class="tfg-meta">${meta}</p>

        <div class="tfg-block">
          <h4 class="tfg-block-title">${abstractTitle}</h4>
          <p class="tfg-text">${abstractText}</p>
        </div>

        <div class="tfg-block">
          <h4 class="tfg-block-title">${methodTitle}</h4>
          <ul class="tfg-list">
            ${methodItems.map(m => `<li>${m}</li>`).join("")}
          </ul>
        </div>

        <div class="tfg-block">
          <h4 class="tfg-block-title">${conclTitle}</h4>
          <ul class="tfg-list">
            ${conclItems.map(c => `<li>${c}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  },

  renderSkills() {
    const container = document.getElementById("skills-container");
    if (!container) return;

    const hardTitle = I18n.t("skills.hard_title", "Análisis Financiero");
    const hardItems = I18n.t("skills.hard_items", []);
    const softTitle = I18n.t("skills.soft_title", "Criterio de Inversión");
    const softItems = I18n.t("skills.soft_items", []);

    const checkIcon = `<svg class="skill-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    container.innerHTML = `
      <div class="skill-col">
        <h3 class="skill-col-title">${hardTitle}</h3>
        <ul class="skill-items-list">
          ${hardItems.map(item => `<li class="skill-item">${checkIcon}<span>${item}</span></li>`).join("")}
        </ul>
      </div>
      <div class="skill-col">
        <h3 class="skill-col-title">${softTitle}</h3>
        <ul class="skill-items-list">
          ${softItems.map(item => `<li class="skill-item">${checkIcon}<span>${item}</span></li>`).join("")}
        </ul>
      </div>
    `;
  },

  renderTimeline() {
    const container = document.getElementById("timeline-container");
    if (!container) return;

    const items = I18n.t("experience.items", []);
    container.innerHTML = items.map(item => `
      <div class="timeline-item">
        <div class="timeline-dot" aria-hidden="true"></div>
        <div class="timeline-period">
          ${item.period}
          ${item.status_badge ? `<span class="timeline-badge">${item.status_badge}</span>` : ''}
        </div>
        <h3 class="timeline-role">${item.role}</h3>
        <div class="timeline-institution">${item.institution}</div>
        <p class="timeline-desc">${item.description}</p>
      </div>
    `).join("");
  },

  renderAll() {
    this.renderKPIs();
    this.renderCards();
    this.renderCharts();
    this.renderMethodology();
    this.renderSkills();
    this.renderResearch();
    this.renderTimeline();
  },

  /* ------------------------------------------------------------------------
     MODAL MANAGEMENT
     ------------------------------------------------------------------------ */
  openModal(positionId) {
    const pos = this.investments.find(i => i.id === positionId);
    if (!pos) return;
    this.activeModalPosition = pos;

    const modalOverlay = document.getElementById("detail-modal");
    if (!modalOverlay) return;

    const labels = {
      sample_badge: I18n.t("track_record.labels.sample_badge"),
      lesson_badge: I18n.t("track_record.labels.lesson_badge"),
      entry_date: I18n.t("track_record.labels.entry_date"),
      exit_date: I18n.t("track_record.labels.exit_date"),
      entry_price: I18n.t("track_record.labels.entry_price"),
      exit_price: I18n.t("track_record.labels.exit_price"),
      return_label: I18n.t("track_record.labels.return"),
      benchmark: I18n.t("track_record.labels.benchmark"),
      alpha: I18n.t("track_record.labels.alpha"),
      open_position: I18n.t("track_record.labels.open_position"),
      thesis_title: I18n.t("track_record.modal.tab_thesis"),
      catalysts_title: I18n.t("track_record.modal.catalysts_title"),
      risks_title: I18n.t("track_record.modal.risks_title"),
      lessons_title: I18n.t("track_record.modal.lessons_title"),
      chart_title: I18n.t("track_record.modal.tab_chart")
    };

    const isWinner = (pos.outcome === "ganadora" || pos.outcome === "winner" || pos.return_pct >= 0);
    const ret = pos.return_pct || 0;
    const bmk = pos.benchmark_return_pct || 0;
    const alpha = ret - bmk;

    const thesisText = I18n.getInvestmentText(pos.id, "thesis", pos);
    const catalysts = I18n.getInvestmentText(pos.id, "catalysts", pos) || [];
    const risks = I18n.getInvestmentText(pos.id, "risks", pos) || [];
    const lessonsLearned = I18n.getInvestmentText(pos.id, "lessons_learned", pos);

    const exitDisplay = (pos.exit_date === "abierta" || pos.exit_date === "open")
      ? labels.open_position
      : pos.exit_date;

    // Header & Meta Info
    document.getElementById("modal-ticker").textContent = `${pos.ticker} — ${pos.company}`;
    document.getElementById("modal-meta-badges").innerHTML = `
      ${pos.is_sample ? `<span class="badge badge-sample">${labels.sample_badge}</span>` : ''}
      ${!isWinner ? `<span class="badge badge-lesson">${labels.lesson_badge}</span>` : ''}
      <span class="badge badge-sector">${pos.sector}</span>
      <span class="badge badge-sector">${pos.country}</span>
    `;

    document.getElementById("modal-meta-grid").innerHTML = `
      <div class="modal-meta-item">
        <span class="modal-meta-label">${labels.entry_date}</span>
        <span class="modal-meta-value tnum">${pos.entry_date}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${labels.exit_date}</span>
        <span class="modal-meta-value tnum">${exitDisplay}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${labels.return_label}</span>
        <span class="modal-meta-value tnum ${ret >= 0 ? 'positive' : 'negative'}">
          ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%
        </span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">${labels.alpha} (${pos.benchmark})</span>
        <span class="modal-meta-value tnum ${alpha >= 0 ? 'positive' : 'negative'}">
          ${alpha >= 0 ? '+' : ''}${alpha.toFixed(2)}%
        </span>
      </div>
    `;

    // Sections
    document.getElementById("modal-thesis-text").textContent = thesisText;

    const catEl = document.getElementById("modal-catalysts-list");
    catEl.innerHTML = Array.isArray(catalysts) ? catalysts.map(c => `<li>${c}</li>`).join("") : `<li>${catalysts}</li>`;

    const risksEl = document.getElementById("modal-risks-list");
    risksEl.innerHTML = Array.isArray(risks) ? risks.map(r => `<li>${r}</li>`).join("") : `<li>${risks}</li>`;

    const lessonBox = document.getElementById("modal-lessons-box");
    if (lessonsLearned) {
      lessonBox.style.display = "block";
      document.getElementById("modal-lessons-text").textContent = lessonsLearned;
    } else {
      lessonBox.style.display = "none";
    }

    // Render Price Evolution SVG chart
    Charts.renderPriceDetailChart("modal-price-chart-container", pos, labels);

    // Open Modal
    modalOverlay.classList.add("active");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Focus close button
    const closeBtn = document.getElementById("modal-close-btn");
    if (closeBtn) closeBtn.focus();
  },

  closeModal() {
    const modalOverlay = document.getElementById("detail-modal");
    if (!modalOverlay) return;
    modalOverlay.classList.remove("active");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    this.activeModalPosition = null;
  },

  /* ------------------------------------------------------------------------
     EVENT BINDINGS
     ------------------------------------------------------------------------ */
  bindEvents() {
    // Language switcher buttons
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const lang = btn.getAttribute("data-lang");
        I18n.setLanguage(lang);
      });
    });

    // Mobile nav toggle
    const menuBtn = document.getElementById("mobile-menu-btn");
    const header = document.querySelector(".site-header");
    if (menuBtn && header) {
      menuBtn.addEventListener("click", () => {
        header.classList.toggle("menu-open");
      });
      // Close menu on link click
      document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => header.classList.remove("menu-open"));
      });
    }

    // Filter changes
    const filterSector = document.getElementById("filter-sector");
    const filterYear = document.getElementById("filter-year");
    const filterOutcome = document.getElementById("filter-outcome");

    if (filterSector) {
      filterSector.addEventListener("change", (e) => {
        this.activeFilters.sector = e.target.value;
        this.applyFilters();
      });
    }

    if (filterYear) {
      filterYear.addEventListener("change", (e) => {
        this.activeFilters.year = e.target.value;
        this.applyFilters();
      });
    }

    if (filterOutcome) {
      filterOutcome.addEventListener("change", (e) => {
        this.activeFilters.outcome = e.target.value;
        this.applyFilters();
      });
    }

    // Detail modal openers (event delegation)
    const invContainer = document.getElementById("investments-container");
    if (invContainer) {
      invContainer.addEventListener("click", (e) => {
        const btn = e.target.closest(".js-view-detail");
        if (btn) {
          const id = btn.getAttribute("data-id");
          this.openModal(id);
        }
      });
    }

    // Modal Close
    const closeBtn = document.getElementById("modal-close-btn");
    const modalOverlay = document.getElementById("detail-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeModal());
    }
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });
    }

    // Keyboard ESC to close modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOverlay && modalOverlay.classList.contains("active")) {
        this.closeModal();
      }
    });

    // Contact Form submission handling (mailto generator)
    const contactForm = document.getElementById("contact-form");
    if (contactForm) {
      contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("form-name").value.trim();
        const email = document.getElementById("form-email").value.trim();
        const subject = document.getElementById("form-subject").value.trim() || "Contacto Profesional";
        const message = document.getElementById("form-message").value.trim();

        const targetEmail = this.config ? this.config.email : "samuel.marin.munoz@outlook.com";
        const bodyContent = encodeURIComponent(
          `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`
        );
        const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${bodyContent}`;
        window.location.href = mailtoUrl;
      });
    }
  }
};

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
