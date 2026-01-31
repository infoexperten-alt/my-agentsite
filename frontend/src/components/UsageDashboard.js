/**
 * Token and cost tracking dashboard.
 */
export class UsageDashboard {
  constructor(container) {
    this.container = container;
    this.usage = {};
    this.render();
  }

  render() {
    const tokens = this.usage.total_tokens || 0;
    const cost = this.usage.total_cost || 0;
    const calls = this.usage.call_count || 0;

    this.container.innerHTML = `
      <div class="usage-dashboard">
        <h3 class="control-section-title">Usage</h3>
        <div class="usage-grid">
          <div class="usage-stat">
            <span class="usage-value">${tokens.toLocaleString()}</span>
            <span class="usage-label">Tokens</span>
          </div>
          <div class="usage-stat">
            <span class="usage-value">$${cost.toFixed(4)}</span>
            <span class="usage-label">Cost</span>
          </div>
          <div class="usage-stat">
            <span class="usage-value">${calls}</span>
            <span class="usage-label">API Calls</span>
          </div>
        </div>
      </div>
    `;
  }

  setUsage(usage) {
    this.usage = usage || {};
    this.render();
  }

  clear() {
    this.usage = {};
    this.render();
  }
}
