export const SCHEDULED_EVENTS = [
  { card_text: "Рынок переполнен AI-ассистентами. Ценятся только уникальные AI-функции.", effect_type: "feature_drop", effect_target: "AI", effect_percent: -10, is_random: false },
  { card_text: "Инвесторы влюблены в чистый UI. Проекты с фильтрами и сортировкой набирают доверие.", effect_type: "feature_boost", effect_target: "filter", effect_percent: 15, is_random: false },
  { card_text: "Скандал со взломом данных. Проекты без авторизации теряют доверие инвесторов.", effect_type: "feature_drop", effect_target: "account", effect_percent: -10, is_random: false },
  { card_text: "Производительность — это всё. Быстрые и функциональные проекты укрепляют доверие.", effect_type: "global_rise", effect_target: null, effect_percent: 5, is_random: false },
  { card_text: "Коррекция рынка. Инвесторы повсеместно фиксируют прибыль.", effect_type: "global_drop", effect_target: null, effect_percent: -8, is_random: false },
  { card_text: "Персонализация — новое золото. Команды с профилями пользователей резко растут.", effect_type: "feature_boost", effect_target: "account", effect_percent: 20, is_random: false },
  { card_text: "Паника на рынке. Массовая распродажа бьёт по всем командам одинаково.", effect_type: "global_drop", effect_target: null, effect_percent: -15, is_random: false },
  { card_text: "Пик хайпа вокруг AI. Проекты с искусственным интеллектом резко дорожают.", effect_type: "feature_boost", effect_target: "AI", effect_percent: 25, is_random: false },
  { card_text: "Рынок перенасыщен похожими проектами. Инвесторы требуют инноваций.", effect_type: "global_drop", effect_target: null, effect_percent: -10, is_random: false },
  { card_text: "Финальный спринт оценки. Судьи смотрят на UX и качество главного меню.", effect_type: "feature_boost", effect_target: "menu", effect_percent: 20, is_random: false },
];

export const RANDOM_EVENTS = [
  { card_text: "Тренд на тёмную тему взрывает соцсети. Команды с современным UI привлекают внимание.", effect_type: "global_rise", effect_target: null, effect_percent: 10, is_random: true },
  { card_text: "Крупный технологический гигант выходит на рынок. Все стартапы ощущают давление.", effect_type: "global_drop", effect_target: null, effect_percent: -20, is_random: true },
  { card_text: "Вирусный момент! Один из проектов попал в прессу. Рынок охвачен ажиотажем.", effect_type: "global_rise", effect_target: null, effect_percent: 12, is_random: true },
  { card_text: "AI-пузырь лопнул. Функции на основе ИИ временно обесценились.", effect_type: "feature_drop", effect_target: "AI", effect_percent: -25, is_random: true },
  { card_text: "Новый закон обязывает все платформы иметь поиск и фильтрацию.", effect_type: "feature_boost", effect_target: "filter", effect_percent: 30, is_random: true },
  { card_text: "День инвестора! Все команды представляют прогресс. Рынок растёт.", effect_type: "global_rise", effect_target: null, effect_percent: 15, is_random: true },
  { card_text: "Нехватка кадров. Команды с системой авторизации привлекают лучших разработчиков.", effect_type: "feature_boost", effect_target: "auth", effect_percent: 20, is_random: true },
  { card_text: "Заморозка рынка. Инвесторы осторожны, но самые стабильные проекты держатся.", effect_type: "global_drop", effect_target: null, effect_percent: -5, is_random: true },
  { card_text: "Слухи о поглощении. Инвесторы вкладываются в самые перспективные команды.", effect_type: "global_rise", effect_target: null, effect_percent: 20, is_random: true },
  { card_text: "Глобальный экономический спад. Все технологические акции падают.", effect_type: "global_drop", effect_target: null, effect_percent: -30, is_random: true },
];
