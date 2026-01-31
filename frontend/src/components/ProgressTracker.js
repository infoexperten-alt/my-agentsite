/**
 * Agent pipeline progress tracker.
 */
export class ProgressTracker {
  constructor(container) {
    this.container = container;
    this.phases = [
      { key: 'pm', label: 'PM', status: 'pending' },
      { key: 'designer', label: 'Designer', status: 'pending' },
      { key: 'developer', label: 'Developer', status: 'pending' },
      { key: 'reviewer', label: 'Reviewer', status: 'pending' },
    ];
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="progress-tracker">
        <div class="progress-steps">
          ${this.phases
            .map(
              (p, i) => `
            <div class="progress-step progress-step--${p.status}" data-key="${p.key}">
              <div class="progress-step-dot"></div>
              <span class="progress-step-label">${p.label}</span>
            </div>
            ${i < this.phases.length - 1 ? '<div class="progress-step-line"></div>' : ''}
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  setAgentStatus(agentName, status) {
    const phase = this.phases.find((p) => p.key === agentName);
    if (phase) {
      phase.status = status;
      this.render();
    }
  }

  reset() {
    this.phases.forEach((p) => (p.status = 'pending'));
    this.render();
  }

  setGenerating() {
    this.phases.forEach((p) => (p.status = 'pending'));
    this.render();
  }
}
