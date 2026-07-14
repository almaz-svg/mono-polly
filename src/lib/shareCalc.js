// marketEvents.js задаёт effect_target одним английским словом (AI, filter,
// account, menu, auth), а команды описывают фичи по-русски — простое
// includes() никогда не совпадёт, и feature_boost/feature_drop фактически
// били одинаково по всем. Список синонимов на случай, если effect_target
// не совпадает буквально.
const TARGET_SYNONYMS = {
  ai: ['ai', 'ии', 'искусственный интеллект', 'нейросет', 'ассистент', 'чат-бот', 'чатбот'],
  filter: ['filter', 'фильтр', 'сортировк', 'поиск', 'search'],
  account: ['account', 'аккаунт', 'профил', 'авторизац', 'регистрац', 'логин'],
  menu: ['menu', 'меню', 'навигац'],
  auth: ['auth', 'авторизац', 'регистрац', 'логин', 'вход'],
};

export function calculateNewShares(currentShares, aiScore, peerScore, activeEvent, teamFeatures) {
  const combinedScore = (aiScore * 0.7) + (peerScore * 0.3);
  const scoreMultiplier = ((combinedScore - 5) / 5) * 0.175 + 1.0;

  let eventMultiplier = 1.0;
  const features = teamFeatures.toLowerCase();

  if (activeEvent) {
    const pct = Math.abs(activeEvent.effect_percent) / 100;
    const targetKey = activeEvent.effect_target ? activeEvent.effect_target.toLowerCase() : null;
    const synonyms = targetKey ? (TARGET_SYNONYMS[targetKey] || [targetKey]) : [];
    const hasFeature = synonyms.some(word => features.includes(word));

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
