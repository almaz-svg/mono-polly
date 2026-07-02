export function calculateNewShares(currentShares, aiScore, peerScore, activeEvent, teamFeatures) {
  const combinedScore = (aiScore * 0.7) + (peerScore * 0.3);
  const scoreMultiplier = ((combinedScore - 5) / 5) * 0.175 + 1.0;

  let eventMultiplier = 1.0;
  const features = teamFeatures.toLowerCase();

  if (activeEvent) {
    const pct = Math.abs(activeEvent.effect_percent) / 100;
    const hasFeature = activeEvent.effect_target && features.includes(activeEvent.effect_target.toLowerCase());

    switch (activeEvent.effect_type) {
      case 'global_drop':
        eventMultiplier = 1 - pct;
        break;
      case 'global_rise':
        eventMultiplier = 1 + pct;
        break;
      case 'feature_boost':
        // Есть фича — полный буст. Нет фичи — небольшое падение (упустили тренд)
        eventMultiplier = hasFeature ? 1 + pct : 1 - pct * 0.3;
        break;
      case 'feature_drop':
        // Есть фича — падение. Нет фичи — небольшой рост (конкуренты пострадали)
        eventMultiplier = hasFeature ? 1 - pct : 1 + pct * 0.2;
        break;
      default:
        eventMultiplier = 1.0;
    }
  }

  const newShares = Math.round(currentShares * scoreMultiplier * eventMultiplier);
  return Math.max(10, newShares);
}
