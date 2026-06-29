export const SCHEDULED_EVENTS = [
  { card_text: "AI assistants flood the market. Only unique AI features hold value.", effect_type: "feature_drop", effect_target: "AI", effect_percent: -10, is_random: false },
  { card_text: "Investors love clean UI. Projects with filters and sorting gain major trust.", effect_type: "feature_boost", effect_target: "filter", effect_percent: 15, is_random: false },
  { card_text: "Security breach scandal hits the industry. Projects without user accounts lose credibility.", effect_type: "feature_drop", effect_target: "account", effect_percent: -10, is_random: false },
  { card_text: "Performance is everything. Fast and functional projects gain investor confidence.", effect_type: "global_rise", effect_target: null, effect_percent: 5, is_random: false },
  { card_text: "Market correction. Investors pull back across the board.", effect_type: "global_drop", effect_target: null, effect_percent: -8, is_random: false },
  { card_text: "Personalization is the new gold. Teams with user accounts and profiles surge.", effect_type: "feature_boost", effect_target: "account", effect_percent: 20, is_random: false },
  { card_text: "Investor panic. Mass sell-off hits all teams equally.", effect_type: "global_drop", effect_target: null, effect_percent: -15, is_random: false },
  { card_text: "AI hype cycle reaches its peak. AI-powered projects spike in value.", effect_type: "feature_boost", effect_target: "AI", effect_percent: 25, is_random: false },
  { card_text: "Market is oversaturated with similar projects. Investors want innovation.", effect_type: "global_drop", effect_target: null, effect_percent: -10, is_random: false },
  { card_text: "Final evaluation sprint. UX quality and main menu polish are judged.", effect_type: "feature_boost", effect_target: "menu", effect_percent: 20, is_random: false },
];

export const RANDOM_EVENTS = [
  { card_text: "Dark mode trend explodes on social media. Modern UI teams gain attention.", effect_type: "global_rise", effect_target: null, effect_percent: 10, is_random: true },
  { card_text: "A major tech giant enters the market. All startups feel the pressure.", effect_type: "global_drop", effect_target: null, effect_percent: -20, is_random: true },
  { card_text: "Viral moment! A project gets featured in the press. Market excitement rises.", effect_type: "global_rise", effect_target: null, effect_percent: 12, is_random: true },
  { card_text: "The AI bubble bursts. AI-based features are temporarily devalued.", effect_type: "feature_drop", effect_target: "AI", effect_percent: -25, is_random: true },
  { card_text: "New government regulation requires search and filter in all public platforms.", effect_type: "feature_boost", effect_target: "filter", effect_percent: 30, is_random: true },
  { card_text: "Investor day announced. All teams present their progress. Market rises.", effect_type: "global_rise", effect_target: null, effect_percent: 15, is_random: true },
  { card_text: "Talent shortage hits the market. Teams with auth systems attract top developers.", effect_type: "feature_boost", effect_target: "auth", effect_percent: 20, is_random: true },
  { card_text: "Market freeze. Investors are watching. No significant movements this round.", effect_type: "none", effect_target: null, effect_percent: 0, is_random: true },
  { card_text: "Acquisition rumors. Investors pour money into the most promising teams.", effect_type: "global_rise", effect_target: null, effect_percent: 20, is_random: true },
  { card_text: "Global economic downturn. All tech shares take a hit.", effect_type: "global_drop", effect_target: null, effect_percent: -30, is_random: true },
];
