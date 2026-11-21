import type { VoiceCoachRuleId, WeakSkillId } from './types.ts';

export type UiIconName =
  | 'map'
  | 'layers'
  | 'flame'
  | 'book'
  | 'message'
  | 'headphones'
  | 'sparkles'
  | 'volume'
  | 'volumeOff'
  | 'bolt'
  | 'target'
  | 'clock'
  | 'award'
  | 'search'
  | 'pin'
  | 'check'
  | 'key'
  | 'download'
  | 'folder'
  | 'link'
  | 'scale'
  | 'shuffle'
  | 'repeat'
  | 'compass'
  | 'sliders'
  | 'edit'
  | 'rotateCcw'
  | 'chevronDown';

const ICON_PATHS: Record<UiIconName, string> = {
  map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 3v3"/><path d="M17.5 4.5h3"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeOff: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  scale: '<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7h14"/><path d="M3 14l2-7 2 7a2 2 0 0 1-4 0z"/><path d="M17 14l2-7 2 7a2 2 0 0 1-4 0z"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  rotateCcw: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
};

/** Render a crisp monochrome SVG icon inheriting `currentColor` for theme-native UI elements. */
export function uiIconSvg(name: UiIconName, size: number = 14): string {
  const body = ICON_PATHS[name] ?? ICON_PATHS.sparkles;
  return `<svg class="ui-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Populate an element with a monochrome SVG icon followed by safe plain text. */
export function setIconLabel(
  el: HTMLElement,
  icon: UiIconName,
  label: string,
  size: number = 13
): void {
  el.innerHTML = uiIconSvg(icon, size);
  const span = document.createElement('span');
  span.textContent = label;
  el.appendChild(span);
}

/** Populate an icon-only button with a monochrome SVG icon. */
export function setIconOnly(el: HTMLElement, icon: UiIconName, size: number = 14): void {
  el.innerHTML = uiIconSvg(icon, size);
}

/** Map each Remedial Studio workshop skill to a cohesive monochrome icon instead of colorful OS emojis. */
export function getRemedialSkillIconName(skillId: WeakSkillId): UiIconName {
  switch (skillId) {
    case 'was_vs_were':
      return 'scale';
    case 'should_vs_have_to':
      return 'sliders';
    case 'used_to_habit':
      return 'repeat';
    case 'past_continuous':
      return 'clock';
    case 'present_perfect':
      return 'link';
    case 'passive_voice':
      return 'layers';
    case 'going_to_vs_will':
      return 'compass';
    case 'conditionals_would':
      return 'shuffle';
    case 'contrast_linkers':
      return 'scale';
    case 'time_clauses':
      return 'clock';
    case 'phrasal_verbs':
      return 'bolt';
    case 'prepositions_core':
      return 'pin';
    case 'modal_possibility':
      return 'sliders';
    case 'infinitive_gerund':
      return 'edit';
    case 'negation_questions':
      return 'message';
    case 'word_order_syntax':
      return 'shuffle';
    case 'listening_gap':
      return 'headphones';
    case 'trouble_vocab':
      return 'target';
    default:
      return 'book';
  }
}

/** Map any of the 35 Teach Me voice-coach rules to a monochrome SVG icon. */
export function getVoiceCoachIconName(ruleId: VoiceCoachRuleId): UiIconName {
  switch (ruleId) {
    case 'simple_present':
    case 'simple_past':
    case 'present_continuous':
    case 'past_perfect':
      return 'clock';
    case 'articles_a_an_the':
      return 'edit';
    case 'can_could_able':
    case 'imperatives_lets':
      return 'bolt';
    case 'quantifiers_count':
    case 'comparatives_superlatives':
      return 'scale';
    case 'wh_questions':
    case 'reported_speech':
      return 'message';
    case 'relative_clauses':
    case 'cause_effect_linkers':
      return 'link';
    case 'reflexives_reciprocals':
    case 'be_get_used_to':
      return 'repeat';
    case 'there_is_it_is':
    case 'time_place_prepositions_extra':
      return 'pin';
    default:
      return getRemedialSkillIconName(ruleId as WeakSkillId);
  }
}
