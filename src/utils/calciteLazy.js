// calciteLazy.js - on-demand loading helpers for Calcite web components

export async function ensureCalciteDialog() {
  if (!customElements.get('calcite-dialog')) {
    await import('@esri/calcite-components/dist/components/calcite-dialog');
  }
}

export async function ensureCalciteModal() {
  if (!customElements.get('calcite-modal')) {
    await import('@esri/calcite-components/dist/components/calcite-modal');
  }
}

export async function ensureCalciteTooltip() {
  if (!customElements.get('calcite-tooltip')) {
    await import('@esri/calcite-components/dist/components/calcite-tooltip');
  }
}

export async function ensureCalciteDropdown() {
  if (!customElements.get('calcite-dropdown')) {
    await import('@esri/calcite-components/dist/components/calcite-dropdown');
    await import('@esri/calcite-components/dist/components/calcite-dropdown-group');
    await import('@esri/calcite-components/dist/components/calcite-dropdown-item');
  }
}


