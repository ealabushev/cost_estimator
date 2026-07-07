const PROVIDER_LABELS = {
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  openai: 'OpenAI',
  sap_ai_hub: 'SAP AI Hub',
  self_hosted: 'Self-hosted'
};

export function getProviderLabel(provider = '') {
  const normalized = String(provider || '').toLowerCase();
  return PROVIDER_LABELS[normalized] || normalized
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown Provider';
}

export function sortByProviderAndModel(models = []) {
  return [...models].sort((a, b) => {
    const providerCompare = getProviderLabel(a.provider).localeCompare(getProviderLabel(b.provider));
    if (providerCompare !== 0) return providerCompare;
    return String(a.modelName || '').localeCompare(String(b.modelName || ''));
  });
}

export function groupByProvider(models = [], options = {}) {
  const groups = new Map();
  const orderedModels = options.preserveOrder ? [...models] : sortByProviderAndModel(models);

  for (const model of orderedModels) {
    const provider = model.provider || 'unknown';
    if (!groups.has(provider)) {
      groups.set(provider, {
        provider,
        label: getProviderLabel(provider),
        models: []
      });
    }
    groups.get(provider).models.push(model);
  }

  return [...groups.values()];
}
