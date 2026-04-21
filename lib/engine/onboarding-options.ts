// Shared onboarding option lists.
//
// Previously inlined at the top of app/(app)/onboarding/page.tsx, which meant
// neither the chat-action endpoint (when the AI proposes a new goal) nor the
// deterministic fallback-protocol module could reference the same source of
// truth. This file is the canonical list — UI + engine + future SEO pages
// (/goals/[slug]) all import from here.

/** Personal conditions the user currently has. Free text goes through `otherCondition`. */
export const CONDITIONS: readonly string[] = [
  'Type 2 Diabetes',
  'Hypertension',
  'Dyslipidemia',
  'Thyroid',
  'Autoimmune',
  'Cardiovascular',
  'Depression/Anxiety',
  'Sleep Apnea',
  'PCOS',
  'Obesity',
];

/** Family history bucket — used to gate cardiometabolic risk copy. */
export const FAMILY_CONDITIONS: readonly string[] = [
  'Diabetes',
  'Heart disease',
  'Cancer',
  "Alzheimer's",
  'Autoimmune',
  'Mental illness',
  'None known',
];

/** Primary longevity goals — drives tone + priority ordering in the protocol. */
export const GOALS: readonly string[] = [
  'Longevity / Healthspan',
  'Body Composition',
  'Cognitive Performance',
  'Skin / Hair',
  'Energy / Mood',
  'Athletic Performance',
  'Fertility',
  'Fitness Recovery',
  'Sleep',
  'Mental Health',
];

/** Sleep-issue self-report. Feeds sleep intervention prioritization. */
export const SLEEP_ISSUES: readonly string[] = [
  'Trouble falling asleep',
  'Waking in the night',
  'Wake up unrested',
  'Snoring',
  'Restless legs',
  'None',
];
