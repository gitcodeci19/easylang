import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeEnglishGrammarSkills,
  analyzeVoiceCoachRules,
  hasFiniteClauseAfter,
  matchesGrammarSkill,
  matchesVoiceCoachRule,
} from '../src/shared/grammarAnalyzer.ts';
import { detectHelpSkillsForQuestion, hasRichTeachMeSkills } from '../src/shared/weaknessDetector.ts';

test('distinguishes time prepositions ("before an exam") from finite time clauses ("before you go")', () => {
  assert.equal(hasFiniteClauseAfter('an exam.'), false);
  assert.equal(hasFiniteClauseAfter('an important exam.'), false);
  assert.equal(hasFiniteClauseAfter('the presentation.'), false);
  assert.equal(hasFiniteClauseAfter('midnight.'), false);
  assert.equal(hasFiniteClauseAfter('leaving home'), false);
  assert.equal(hasFiniteClauseAfter('to show up.'), false);
  assert.equal(hasFiniteClauseAfter('it tomorrow.'), false);

  assert.equal(hasFiniteClauseAfter('you go.'), true);
  assert.equal(hasFiniteClauseAfter('the backup finishes.'), true);
  assert.equal(hasFiniteClauseAfter('I arrive'), true);

  const cramSkills = detectHelpSkillsForQuestion({
    englishText: 'Short daily study sessions beat cramming all night before an exam.',
    cardType: 'sentence',
  });
  assert.ok(!cramSkills.includes('time_clauses'), `Unexpected time_clauses in: ${cramSkills.join(', ')}`);
  assert.ok(cramSkills.includes('infinitive_gerund'), 'Should detect gerund ("beat cramming")');
  assert.ok(
    cramSkills.includes('time_place_prepositions_extra'),
    'Should detect time preposition ("before an exam")'
  );
  assert.ok(cramSkills.includes('simple_present'), 'Should detect Simple Present general truth');

  assert.equal(matchesGrammarSkill('time_clauses', 'Call me as soon as you get home.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'Wait until the backup finishes.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', "After you've eaten, you should get some sleep."), true);
  assert.equal(matchesGrammarSkill('time_clauses', "After my leg heals, I'll be able to move around again."), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'Please wait till I have finished my coffee.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'I love swimming in the sea early before it gets crowded.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'Plug in your laptop before the battery hits five percent.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'Peer review filters out flawed reasoning before a paper shapes public debate.'), true);
  assert.equal(matchesGrammarSkill('time_clauses', 'Every new technology creates an ethical dilemma long before legislation catches up.'), true);

  // Prepositional uses (`until noon`, `until midnight`, `after a hot walk`, `after four PM`, `after the first summer rain`)
  assert.equal(matchesGrammarSkill('time_clauses', 'He did not arrive until noon.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', "Even though I was exhausted, I couldn't fall asleep until midnight."), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'I might not be able to buy it until next month.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'Drinking cold water after a hot walk feels awesome.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'Going to bed before midnight helps you sleep better.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'I stopped drinking coffee after four PM to sleep better.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'I love the earthy smell right after the first summer rain.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'After the stop the train accelerated quickly.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'Until when are you planning to live here?'), false);
  assert.equal(matchesGrammarSkill('time_clauses', "It doesn't matter when you come."), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'When did you arrive here?'), false);
  assert.equal(matchesGrammarSkill('time_clauses', "I'm going to look after it tomorrow."), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'Just tell me when to show up.'), false);
  assert.equal(matchesGrammarSkill('time_clauses', "Please tell me when he'll arrive here."), false);
  assert.equal(matchesGrammarSkill('time_clauses', 'I used to swim a lot when I was a kid.'), false);

  // Verify prepositional sentences map cleanly to `time_place_prepositions_extra` without `time_clauses`
  const hotWalk = detectHelpSkillsForQuestion({
    englishText: 'Drinking cold water after a hot walk feels awesome.',
    cardType: 'sentence',
  });
  assert.deepEqual(hotWalk, ['infinitive_gerund', 'time_place_prepositions_extra', 'simple_present']);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', 'He did not arrive until noon.'), true);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', "Even though I was exhausted, I couldn't fall asleep until midnight."), true);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', 'I stopped drinking coffee after four PM to sleep better.'), true);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', 'I love the earthy smell right after the first summer rain.'), true);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', 'After the stop the train accelerated quickly.'), true);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', "After you've eaten, you should get some sleep."), false);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', 'The police have been after him for a long time.'), false);
  assert.equal(matchesVoiceCoachRule('time_place_prepositions_extra', "She didn't buy the ticket after all."), false);
});

test('distinguishes true passive voice from participial adjectives and handles passive "is used to"', () => {
  assert.equal(matchesGrammarSkill('passive_voice', 'The release date was delayed twice.'), true);
  assert.equal(matchesGrammarSkill('passive_voice', 'This tool is used to cut wood.'), true);
  assert.equal(matchesGrammarSkill('passive_voice', 'Even though I was exhausted, I kept working.'), false);
  assert.equal(matchesGrammarSkill('passive_voice', 'I thought you were excited about the trip.'), false);
  assert.equal(matchesGrammarSkill('passive_voice', 'She is interested in learning Japanese.'), false);
});

test('distinguishes past habit "used to" from "be/get used to" and future "going to" from movement', () => {
  assert.equal(matchesGrammarSkill('used_to_habit', 'I used to play guitar every night.'), true);
  assert.equal(matchesGrammarSkill('used_to_habit', 'I am slowly getting used to waking up early in the winter.'), false);
  assert.equal(matchesGrammarSkill('used_to_habit', 'This tool is used to cut wood.'), false);

  assert.equal(matchesGrammarSkill('going_to_vs_will', 'Look at those dark clouds, it is going to rain.'), true);
  assert.equal(matchesGrammarSkill('going_to_vs_will', "I'm going to school."), false);
  assert.equal(matchesGrammarSkill('going_to_vs_will', 'She has a very strong will.'), false);
});

test('avoids modal-perfect false positives on present_perfect and subjunctive noise on conditionals', () => {
  assert.equal(matchesGrammarSkill('present_perfect', 'Have you ever tried cooking traditional dishes at home?'), true);
  assert.equal(matchesGrammarSkill('present_perfect', "I've learned a lot already."), true);
  assert.equal(matchesGrammarSkill('present_perfect', "You shouldn't have stayed up so late before an important exam."), false);
  assert.equal(matchesGrammarSkill('present_perfect', 'By next year, they will have completed the bridge.'), false);

  const condSkills = analyzeEnglishGrammarSkills('If I were you, I would take that offer.');
  assert.ok(condSkills.includes('conditionals_would'));
  assert.ok(!condSkills.includes('was_vs_were'), 'Subjunctive "If I were" must not trigger basic was_vs_were rule');

  assert.equal(matchesGrammarSkill('conditionals_would', 'I would like a cup of coffee.'), false);
  assert.equal(matchesGrammarSkill('past_continuous', 'What were you doing when the fire alarm went off?'), true);
});

test('accurately routes all 17 extra voice-coach grammar rules without cross-rule false positives', () => {
  const expectContains = (sentence: string, expected: string[], forbidden: string[] = []): void => {
    const got = detectHelpSkillsForQuestion({ englishText: sentence, cardType: 'sentence' });
    for (const e of expected) {
      assert.ok(got.includes(e as never), `Expected "${e}" for "${sentence}", got [${got.join(', ')}]`);
    }
    for (const f of forbidden) {
      assert.ok(!got.includes(f as never), `Forbidden "${f}" for "${sentence}", got [${got.join(', ')}]`);
    }
  };

  expectContains('She works from home on Fridays.', ['simple_present', 'prepositions_core']);
  expectContains('I would like a cup of coffee.', ['articles_a_an_the'], ['conditionals_would', 'simple_present']);
  expectContains('She saw the movie yesterday.', ['simple_past']);
  expectContains('Could you help me with this task?', ['can_could_able']);
  expectContains('You will be able to finish it tomorrow.', ['can_could_able', 'going_to_vs_will']);
  expectContains('There is too much noise in the street.', ['there_is_it_is', 'quantifiers_count']);
  expectContains('We are meeting at seven tonight.', ['present_continuous', 'prepositions_core']);
  expectContains("I'm going to school.", ['present_continuous'], ['going_to_vs_will']);
  expectContains('The movie is interesting.', ['simple_present'], ['present_continuous']);
  expectContains('When did you arrive here?', ['wh_questions', 'simple_past'], ['time_clauses']);
  expectContains('Check your notes carefully before the exam.', ['imperatives_lets', 'time_place_prepositions_extra']);
  expectContains('Sleep is essential for good health.', ['simple_present'], ['imperatives_lets']);
  expectContains("Let's take a short break.", ['imperatives_lets']);
  expectContains('This shortcut is much faster than the main road.', ['comparatives_superlatives'], ['quantifiers_count']);
  expectContains('The teacher who helped me lives nearby.', ['relative_clauses']);
  expectContains('I taught myself how to code.', ['reflexives_reciprocals', 'simple_past']);
  expectContains('We help each other every day.', ['reflexives_reciprocals', 'simple_present']);
  expectContains('It is important to practice every day.', ['there_is_it_is']);
  expectContains('She told me that the flight was delayed.', ['reported_speech', 'passive_voice']);
  expectContains('I wonder where he lives now.', ['reported_speech']);
  expectContains('I am slowly getting used to waking up early in the winter.', ['be_get_used_to', 'phrasal_verbs', 'prepositions_core'], ['used_to_habit']);
  expectContains('The flight was delayed because of the fog.', ['passive_voice', 'cause_effect_linkers']);
  expectContains('When we arrived at the station, the train had already left.', ['past_perfect']);
  expectContains('Please silence your phone during the meeting.', ['imperatives_lets', 'time_place_prepositions_extra']);
  expectContains('I cannot function without coffee in the morning.', ['can_could_able', 'time_place_prepositions_extra', 'prepositions_core']);
});

test('prevents cross-rule false positives across passive, simple_past, modals, relatives, there_is, and imperatives', () => {
  // Passive voice must enforce word boundaries and disambiguate contracted `'s` (= has)
  assert.equal(matchesGrammarSkill('passive_voice', 'I was wondering if you could help me.'), false);
  assert.equal(matchesGrammarSkill('passive_voice', 'He was reading a newspaper.'), false);
  assert.equal(matchesGrammarSkill('passive_voice', "It's been three days."), false);
  assert.equal(matchesGrammarSkill('passive_voice', 'There is little food in the refrigerator.'), false);
  assert.equal(matchesGrammarSkill('passive_voice', "I'm used to these things."), false);
  assert.equal(matchesGrammarSkill('passive_voice', "He's written ten books, but hasn't published any of them."), false);

  // Simple past must not trigger on present perfect negatives/passives, contractions, compounds, or homographs
  assert.equal(matchesVoiceCoachRule('simple_past', "They haven't responded to our proposal yet, so we are still waiting."), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'All flights have been cancelled due to thick fog at the airport.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'Have you ever tried cooking traditional dishes at home?'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'To succeed, you must believe.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', "That won't be necessary today."), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'My laptop has a built-in card reader.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'My room feels so cozy when the LED lights are on.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', "I have to admit that I'm a bit stingy."), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'We just need one shot.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'Turn left at the first intersection.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'Rose was blowing bubbles.'), false);
  assert.equal(matchesVoiceCoachRule('simple_past', 'I read this book last night.'), true);

  // Epistemic deduction (`must be exciting`) vs passive obligation (`must be fired`)
  assert.equal(matchesGrammarSkill('modal_possibility', 'That must be exciting.'), true);
  assert.equal(matchesGrammarSkill('should_vs_have_to', 'That must be exciting.'), false);
  assert.equal(matchesGrammarSkill('should_vs_have_to', 'All the workers who are lazy must be fired.'), true);
  assert.equal(matchesGrammarSkill('modal_possibility', 'All the workers who are lazy must be fired.'), false);

  // Conditionals vs polite offers & reported speech backshift
  assert.equal(matchesGrammarSkill('conditionals_would', 'Would you like another beer?'), false);
  assert.equal(matchesGrammarSkill('conditionals_would', 'Would you mind standing aside?'), false);
  assert.equal(matchesGrammarSkill('conditionals_would', 'I thought you would understand.'), false);

  // Existential `there is` vs locative `over there` / `was there`
  assert.equal(matchesVoiceCoachRule('there_is_it_is', 'Over there is the person I have been waiting for.'), false);
  assert.equal(matchesVoiceCoachRule('there_is_it_is', 'She was there in the morning.'), false);
  assert.equal(matchesVoiceCoachRule('there_is_it_is', 'People there are weird.'), false);
  assert.equal(matchesVoiceCoachRule('there_is_it_is', 'Is there a museum in this town?'), true);

  // Relative clauses vs embedded WH-clauses & interrogatives
  assert.equal(matchesVoiceCoachRule('relative_clauses', 'They were arguing about who should sit in front.'), false);
  assert.equal(matchesVoiceCoachRule('relative_clauses', 'No matter who may call, you must not open the door.'), false);
  assert.equal(matchesVoiceCoachRule('relative_clauses', 'This car, whose is it?'), false);

  // Imperatives vs declarative noun/hyphenated subjects, gerund prepositions, `gotten used to`, possessive `'s`
  assert.equal(matchesVoiceCoachRule('imperatives_lets', 'Open-source software quietly powers almost the entire modern internet.'), false);
  assert.equal(matchesVoiceCoachRule('imperatives_lets', 'Clean code is written for humans to read, not just machines to run.'), false);
  assert.equal(matchesGrammarSkill('infinitive_gerund', 'According to the report, he is alive.'), false);
  assert.equal(matchesGrammarSkill('infinitive_gerund', 'Lock the window before going to bed.'), true);
  assert.equal(matchesVoiceCoachRule('be_get_used_to', "I've gotten used to this."), true);
  assert.equal(matchesGrammarSkill('used_to_habit', "I've gotten used to this."), false);
  assert.equal(matchesVoiceCoachRule('present_continuous', "I won't be able to come to tomorrow's meeting."), false);
  assert.equal(matchesVoiceCoachRule('present_continuous', "We know it's not going to work."), false);
  assert.equal(matchesGrammarSkill('going_to_vs_will', "We know it's not going to work."), true);
  assert.equal(matchesVoiceCoachRule('reported_speech', 'As far as I know, he said that himself.'), false);
  assert.equal(matchesVoiceCoachRule('comparatives_superlatives', 'As far as I know, she has not departed yet.'), false);
  assert.equal(matchesGrammarSkill('contrast_linkers', 'He speaks as though he knew everything.'), false);
  assert.equal(matchesGrammarSkill('phrasal_verbs', 'I felt something moving on my back.'), false);
  assert.equal(matchesGrammarSkill('prepositions_core', 'The road continues for many miles.'), false);

  // Verify `has` in declarative 3sg sentences is detected as Simple Present
  assert.ok(analyzeVoiceCoachRules('My laptop has a built-in card reader.').includes('simple_present'));
});

test('hasRichTeachMeSkills only highlights Teach Me when 2+ substantive grammar voiceovers exist', () => {
  // Generic fallbacks or a single rule + fallback must NOT glow
  assert.equal(hasRichTeachMeSkills([]), false);
  assert.equal(hasRichTeachMeSkills(['word_order_syntax']), false);
  assert.equal(hasRichTeachMeSkills(['trouble_vocab']), false);
  assert.equal(hasRichTeachMeSkills(['imperatives_lets']), false);
  assert.equal(hasRichTeachMeSkills(['imperatives_lets', 'word_order_syntax']), false);
  assert.equal(hasRichTeachMeSkills(['should_vs_have_to', 'listening_gap']), false);

  // Two or three real grammar voiceovers MUST glow
  assert.equal(hasRichTeachMeSkills(['should_vs_have_to', 'time_clauses']), true);
  assert.equal(hasRichTeachMeSkills(['infinitive_gerund', 'simple_present', 'prepositions_core']), true);

  // End-to-end check on real sentences
  const singleRule = detectHelpSkillsForQuestion({
    englishText: "Let's go to that fancy restaurant for dinner instead of lunch.",
    cardType: 'sentence',
  });
  assert.equal(hasRichTeachMeSkills(singleRule), false);

  const multiRule = detectHelpSkillsForQuestion({
    englishText: 'Drinking cold water after a hot walk feels awesome.',
    cardType: 'sentence',
  });
  assert.equal(hasRichTeachMeSkills(multiRule), true);
});
