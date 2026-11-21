/**
 * charts.js - Lightweight native SVG chart generators for investment visualization
 * Zero external dependencies, accessible, high-DPI crisp vector graphics.
 */

const Charts = {
  /**
   * Renders a comparative bar chart (Position Return vs. Benchmark Return)
   * @param {string} containerId - Element ID where the SVG will be placed
   * @param {Array} investments - Array of investment objects
   * @param {Object} labels - Current language labels
   */
  renderOverviewBarChart(containerId, investments, labels = {}) {
    const container = document.getElementById(containerId);
    if (!container || !investments || investments.length === 0) return;

    const width = 800;
    const barHeight = 28;
    const barGap = 20;
    const groupHeight = barHeight * 2 + 10;
    const topPadding = 30;
    const bottomPadding = 30;
    const leftPadding = 90;
    const rightPadding = 80;
    const chartHeight = topPadding + bottomPadding + investments.length * (groupHeight + barGap);

    // Calculate max absolute return to establish symmetric/clean scale
    let maxVal = 10;
    investments.forEach(inv => {
      const p = Math.abs(inv.return_pct || 0);
      const b = Math.abs(inv.benchmark_return_pct || 0);
      if (p > maxVal) maxVal = p;
      if (b > maxVal) maxVal = b;
    });
    maxVal = Math.ceil((maxVal + 5) / 10) * 10; // Round up to nearest 10%

    const plotWidth = width - leftPadding - rightPadding;
    const zeroX = leftPadding + (plotWidth / 2); // Center 0% line
    const scale = (plotWidth / 2) / maxVal;

    let svg = `<svg viewBox="0 0 ${width} ${chartHeight}" width="100%" height="auto" class="overview-chart-svg" role="img" aria-label="${labels.chart_title || 'Gráfico de rentabilidad'}">
      <defs>
        <pattern id="benchmarkHatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#718096" stroke-width="1.2" />
        </pattern>
      </defs>
      <!-- Gridlines & Axis -->
      <line x1="${zeroX}" y1="${topPadding - 10}" x2="${zeroX}" y2="${chartHeight - bottomPadding + 10}" stroke="var(--border-color, #E2DFD8)" stroke-width="2" />
      <text x="${zeroX}" y="${topPadding - 14}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">0%</text>
      
      <!-- Negative Marker -->
      <text x="${zeroX - (maxVal * scale)}" y="${topPadding - 14}" text-anchor="middle" font-size="11" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">-${maxVal}%</text>
      <!-- Positive Marker -->
      <text x="${zeroX + (maxVal * scale)}" y="${topPadding - 14}" text-anchor="middle" font-size="11" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">+${maxVal}%</text>
    `;

    investments.forEach((inv, index) => {
      const groupY = topPadding + index * (groupHeight + barGap);
      const ret = inv.return_pct || 0;
      const bmk = inv.benchmark_return_pct || 0;

      // Position bar dimensions
      const retWidth = Math.abs(ret) * scale;
      const retX = ret >= 0 ? zeroX : zeroX - retWidth;
      const retColor = ret >= 0 ? "var(--color-winner, #2D6A4F)" : "var(--color-loser, #9E2A2B)";

      // Benchmark bar dimensions
      const bmkWidth = Math.abs(bmk) * scale;
      const bmkX = bmk >= 0 ? zeroX : zeroX - bmkWidth;
      const bmkColor = "var(--text-muted, #8E9CAE)";

      // Ticker Label
      svg += `
        <g class="chart-group" tabindex="0" role="group" aria-label="${inv.ticker}: ${ret >= 0 ? '+' : ''}${ret}%">
          <text x="${leftPadding - 14}" y="${groupY + barHeight - 2}" text-anchor="end" font-size="12" font-weight="700" fill="var(--text-primary, #0B1F3A)" font-family="Inter, sans-serif">${inv.ticker}</text>
          
          <!-- Position Bar -->
          <rect x="${retX}" y="${groupY}" width="${Math.max(retWidth, 2)}" height="${barHeight - 4}" rx="2" fill="${retColor}">
            <title>${inv.ticker} Return: ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%</title>
          </rect>
          <!-- Position Label -->
          <text x="${ret >= 0 ? retX + retWidth + 8 : retX - 8}" y="${groupY + (barHeight / 2) + 1}" text-anchor="${ret >= 0 ? 'start' : 'end'}" font-size="11" font-weight="700" fill="${retColor}" font-family="Inter, sans-serif">
            ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%
          </text>

          <!-- Benchmark Bar -->
          <rect x="${bmkX}" y="${groupY + barHeight}" width="${Math.max(bmkWidth, 2)}" height="${barHeight - 10}" rx="2" fill="${bmkColor}" opacity="0.6">
            <title>${inv.benchmark}: ${bmk >= 0 ? '+' : ''}${bmk.toFixed(1)}%</title>
          </rect>
          <!-- Benchmark Label -->
          <text x="${bmk >= 0 ? bmkX + bmkWidth + 8 : bmkX - 8}" y="${groupY + barHeight + 11}" text-anchor="${bmk >= 0 ? 'start' : 'end'}" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">
            ${inv.benchmark} (${bmk >= 0 ? '+' : ''}${bmk.toFixed(1)}%)
          </text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  },

  /**
   * Renders a clean price trajectory with entry and exit pin markers for the modal view
   * @param {string} containerId - Element ID where the SVG will be placed
   * @param {Object} position - Investment position data
   * @param {Object} labels - Current language labels
   */
  renderPriceDetailChart(containerId, position, labels = {}) {
    const container = document.getElementById(containerId);
    if (!container || !position) return;

    const history = position.price_history && position.price_history.length > 1
      ? position.price_history
      : [
          { date: position.entry_date, price: position.entry_price },
          { date: position.exit_date === 'abierta' ? 'Actual' : position.exit_date, price: position.exit_price }
        ];

    const width = 640;
    const height = 260;
    const padTop = 35;
    const padBottom = 45;
    const padLeft = 60;
    const padRight = 60;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const prices = history.map(h => h.price);
    const minPrice = Math.min(...prices) * 0.95;
    const maxPrice = Math.max(...prices) * 1.05;

    const getX = (idx) => padLeft + (idx / (history.length - 1)) * plotWidth;
    const getY = (price) => padTop + plotHeight - ((price - minPrice) / (maxPrice - minPrice)) * plotHeight;

    // Build polyline points
    const points = history.map((pt, idx) => `${getX(idx).toFixed(1)},${getY(pt.price).toFixed(1)}`).join(" ");

    // Build fill polygon
    const firstX = getX(0).toFixed(1);
    const lastX = getX(history.length - 1).toFixed(1);
    const bottomY = (padTop + plotHeight).toFixed(1);
    const areaPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;

    const isPositive = (position.return_pct || 0) >= 0;
    const strokeColor = isPositive ? "var(--color-winner, #2D6A4F)" : "var(--color-loser, #9E2A2B)";
    const fillColor = isPositive ? "rgba(45, 106, 79, 0.12)" : "rgba(158, 42, 43, 0.12)";

    let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" class="price-detail-svg" role="img" aria-label="Evolución de precio para ${position.ticker}">
      <!-- Background Horizontal Gridlines -->
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft + plotWidth}" y2="${padTop}" stroke="var(--border-color, #E2DFD8)" stroke-dasharray="3 3" />
      <text x="${padLeft - 10}" y="${padTop + 4}" text-anchor="end" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">${maxPrice.toFixed(1)}</text>
      
      <line x1="${padLeft}" y1="${padTop + plotHeight / 2}" x2="${padLeft + plotWidth}" y2="${padTop + plotHeight / 2}" stroke="var(--border-color, #E2DFD8)" stroke-dasharray="3 3" />
      <text x="${padLeft - 10}" y="${padTop + plotHeight / 2 + 4}" text-anchor="end" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">${((maxPrice + minPrice) / 2).toFixed(1)}</text>

      <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${padLeft + plotWidth}" y2="${padTop + plotHeight}" stroke="var(--border-color, #E2DFD8)" />
      <text x="${padLeft - 10}" y="${padTop + plotHeight + 4}" text-anchor="end" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">${minPrice.toFixed(1)}</text>

      <!-- Area and Line -->
      <polygon points="${areaPoints}" fill="${fillColor}" />
      <polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    `;

    // Add entry and exit / current points with clear tags
    const entryX = getX(0);
    const entryY = getY(history[0].price);
    const exitIdx = history.length - 1;
    const exitX = getX(exitIdx);
    const exitY = getY(history[exitIdx].price);

    // Entry Marker
    svg += `
      <g class="chart-marker entry-marker">
        <circle cx="${entryX}" cy="${entryY}" r="5" fill="#0B1F3A" stroke="#FFFFFF" stroke-width="2" />
        <rect x="${entryX - 35}" y="${entryY - 26}" width="70" height="20" rx="3" fill="#0B1F3A" />
        <text x="${entryX}" y="${entryY - 13}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif">
          ${labels.entry_price || 'Entrada'}: ${position.entry_price}
        </text>
        <text x="${entryX}" y="${padTop + plotHeight + 18}" text-anchor="middle" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">
          ${history[0].date}
        </text>
      </g>
    `;

    // Exit Marker
    const isExitOpen = position.exit_date === 'abierta' || position.exit_date === 'open';
    const exitTagLabel = isExitOpen ? (labels.open_position || 'Actual') : (labels.exit_price || 'Salida');
    
    svg += `
      <g class="chart-marker exit-marker">
        <circle cx="${exitX}" cy="${exitY}" r="5" fill="${strokeColor}" stroke="#FFFFFF" stroke-width="2" />
        <rect x="${exitX - 45}" y="${exitY - 26}" width="90" height="20" rx="3" fill="${strokeColor}" />
        <text x="${exitX}" y="${exitY - 13}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#FFFFFF" font-family="Inter, sans-serif">
          ${exitTagLabel}: ${position.exit_price}
        </text>
        <text x="${exitX}" y="${padTop + plotHeight + 18}" text-anchor="middle" font-size="10" fill="var(--text-muted, #718096)" font-family="Inter, sans-serif">
          ${history[exitIdx].date}
        </text>
      </g>
    `;

    svg += `</svg>`;
    container.innerHTML = svg;
  }
};
