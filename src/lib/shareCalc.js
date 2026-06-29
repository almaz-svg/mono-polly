export function calculateNewShares(currentShares, aiScore, peerScore, activeEvent, teamFeatures) {
  const combinedScore = (aiScore * 0.7) + (peerScore * 0.3);
  const scoreMultiplier = ((combinedScore - 5) / 5) * 0.175 + 1.0;

  let eventMultiplier = 1.0;
  const features = teamFeatures.toLowerCase();

  if (activeEvent) {
    switch (activeEvent.effect_type) {
      case 'global_drop':
        eventMultiplier = 1 - (Math.abs(activeEvent.effect_percent) / 100);
        break;
      case 'global_rise':
        eventMultiplier = 1 + (activeEvent.effect_percent / 100);
        break;
      case 'feature_boost':
        if (activeEvent.effect_target && features.includes(activeEvent.effect_target.toLowerCase())) {
          eventMultiplier = 1 + (activeEvent.effect_percent / 100);
        }
        break;
      case 'feature_drop':
        if (activeEvent.effect_target && features.includes(activeEvent.effect_target.toLowerCase())) {
          eventMultiplier = 1 - (Math.abs(activeEvent.effect_percent) / 100);
        }
        break;
      case 'none':
      default:
        eventMultiplier = 1.0;
    }
  }

  const newShares = Math.round(currentShares * scoreMultiplier * eventMultiplier);
  return Math.max(10, newShares);
}
