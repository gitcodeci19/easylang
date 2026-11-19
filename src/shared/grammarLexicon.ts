/**
 * Curated English morphosyntactic lexicon used by `grammarAnalyzer.ts` for deterministic,
 * zero-dependency clause parsing, subject-verb agreement checking, and homograph disambiguation.
 */

export const DETERMINER_WORDS = new Set([
  'a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'this', 'that', 'these', 'those', 'each', 'every', 'some', 'any', 'no',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'next', 'last', 'first', 'second', 'third', 'another', 'other', 'such',
  'many', 'much', 'few', 'several', 'all', 'both', 'most', 'more', 'various',
]);

export const SINGULAR_ONLY_DETERMINERS = new Set([
  'a', 'an', 'this', 'that', 'each', 'every', 'one', 'another',
]);

export const PLURAL_DETERMINERS = new Set([
  'these', 'those', 'many', 'few', 'several', 'both', 'various',
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
]);

export const IRREGULAR_PLURAL_NOUNS = new Set([
  'people', 'children', 'men', 'women', 'police', 'mice', 'teeth', 'feet',
  'geese', 'oxen', 'cattle', 'data', 'media', 'criteria', 'phenomena', 'staff',
]);

export const SINGULAR_S_NOUNS = new Set([
  'physics', 'economics', 'politics', 'mathematics', 'ethics', 'genetics',
  'linguistics', 'statistics', 'electronics', 'mechanics', 'athletics',
  'gymnastics', 'news', 'series', 'species', 'bus', 'glass', 'class', 'grass',
  'dress', 'stress', 'press', 'mess', 'loss', 'boss', 'cross', 'moss', 'focus',
  'status', 'virus', 'bonus', 'campus', 'genius', 'radius', 'basis', 'crisis',
  'thesis', 'analysis', 'diagnosis', 'hypothesis', 'emphasis', 'oasis', 'chaos',
  'gas', 'lens', 'canvas', 'atlas', 'christmas', 'business', 'fitness',
  'illness', 'sickness', 'darkness', 'weakness', 'kindness', 'happiness',
  'sadness', 'awareness', 'loneliness', 'progress', 'process', 'access',
  'success', 'address', 'express', 'princess', 'actress', 'waitress', 'witness',
]);

export const SUBJECT_PRONOUNS = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it', 'there']);

export const CONTRACTED_SUBJECT_AUX = new Set([
  "i'm", "you're", "we're", "they're", "he's", "she's", "it's", "there's", "that's",
  "i've", "you've", "we've", "they've",
  "i'll", "you'll", "we'll", "they'll", "he'll", "she'll", "it'll", "there'll", "that'll",
  "i'd", "you'd", "we'd", "they'd", "he'd", "she'd", "it'd", "that'd",
  "let's",
]);

export const FINITE_AUXILIARY_WORDS = new Set([
  'am', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
  'have', 'has', 'had', 'will', 'would', 'can', 'could',
  'may', 'might', 'should', 'must', 'shall',
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "haven't", "hasn't", "hadn't", "won't", "wouldn't", "can't", "couldn't",
  "shouldn't", "mustn't", "ain't",
]);

export const CLAUSE_ADVERBS = new Set([
  'never', 'always', 'often', 'usually', 'still', 'just', 'already', 'finally',
  'soon', 'really', 'probably', 'almost', 'barely', 'hardly', 'even', 'only',
  'ever', 'least', 'actually', 'suddenly', 'eventually', 'quickly', 'slowly',
  'quietly', 'carefully', 'consciously', 'genuinely', 'easily', 'naturally',
  'simply', 'merely', 'rarely', 'seldom', 'sometimes', 'frequently', 'constantly',
  'gradually', 'immediately', 'instantly', 'automatically', 'properly', 'truly',
  'definitely', 'certainly', 'clearly', 'directly', 'fully', 'completely', 'totally',
  'mostly', 'largely', 'widely', 'commonly', 'strictly', 'officially', 'originally',
]);

// High-frequency English base verb stems used for subject-verb agreement & clause parsing.
export const COMMON_BASE_VERBS = new Set([
  'accept', 'achieve', 'act', 'adapt', 'add', 'admit', 'advise', 'affect', 'afford', 'agree',
  'allow', 'analyze', 'announce', 'answer', 'apologize', 'appear', 'apply', 'appreciate',
  'approach', 'argue', 'arrange', 'arrive', 'ask', 'assume', 'attach', 'attack', 'attempt',
  'attend', 'avoid', 'bake', 'balance', 'ban', 'beat', 'become', 'begin', 'behave', 'believe',
  'belong', 'bend', 'bet', 'bite', 'blame', 'bleed', 'block', 'bloom', 'blow', 'board', 'boil',
  'book', 'borrow', 'bother', 'bounce', 'break', 'breathe', 'bring', 'build', 'burn', 'buy',
  'calculate', 'call', 'calm', 'camp', 'cancel', 'care', 'carry', 'catch', 'cause', 'celebrate',
  'change', 'charge', 'chase', 'chat', 'cheat', 'check', 'cheer', 'chew', 'chill', 'choose',
  'circulate', 'claim', 'clean', 'clear', 'click', 'climb', 'close', 'collect', 'combine',
  'come', 'comment', 'commit', 'communicate', 'compare', 'compete', 'complain', 'complete',
  'concentrate', 'conclude', 'confess', 'confirm', 'confuse', 'connect', 'consider', 'consist',
  'consume', 'contact', 'contain', 'continue', 'contradict', 'contribute', 'control', 'convince',
  'cook', 'cool', 'cope', 'copy', 'correct', 'cost', 'cough', 'count', 'cover', 'crack', 'crash',
  'create', 'criticize', 'cross', 'cry', 'cure', 'cut', 'cycle', 'damage', 'dance', 'dare',
  'date', 'deal', 'debate', 'decay', 'deceive', 'decide', 'declare', 'decline', 'decorate',
  'decrease', 'defeat', 'defend', 'define', 'delay', 'delete', 'deliver', 'demand', 'demonstrate',
  'deny', 'depart', 'depend', 'describe', 'deserve', 'design', 'desire', 'destroy', 'detect',
  'determine', 'develop', 'die', 'differ', 'dig', 'dine', 'direct', 'disagree', 'disappear',
  'disappoint', 'disclose', 'discover', 'discuss', 'dislike', 'dismiss', 'display', 'distinguish',
  'distribute', 'disturb', 'dive', 'divide', 'do', 'donate', 'double-check', 'doubt', 'download',
  'drag', 'drain', 'draw', 'dream', 'dress', 'drift', 'drink', 'drive', 'drop', 'drown', 'dry',
  'earn', 'eat', 'edit', 'educate', 'elect', 'eliminate', 'emerge', 'emphasize', 'employ',
  'empty', 'enable', 'encourage', 'end', 'enforce', 'engage', 'enjoy', 'enroll', 'ensure',
  'enter', 'entertain', 'envy', 'equal', 'equip', 'escape', 'establish', 'estimate', 'evaluate',
  'evolve', 'examine', 'exceed', 'exchange', 'excite', 'exclude', 'excuse', 'exercise', 'exist',
  'exit', 'expand', 'expect', 'experience', 'experiment', 'expire', 'explain', 'explore',
  'export', 'expose', 'express', 'extend', 'face', 'fade', 'fail', 'fall', 'favor', 'fear',
  'feature', 'feed', 'feel', 'fetch', 'fight', 'figure', 'file', 'fill', 'film', 'filter',
  'find', 'finish', 'fire', 'fish', 'fit', 'fix', 'flag', 'flash', 'flee', 'float', 'flood',
  'flow', 'fly', 'focus', 'fold', 'follow', 'forbid', 'force', 'forecast', 'forget', 'forgive',
  'form', 'found', 'frame', 'free', 'freeze', 'frighten', 'frustrate', 'fulfill', 'function',
  'fund', 'gain', 'gather', 'gaze', 'generate', 'get', 'give', 'glance', 'glow', 'go', 'govern',
  'grab', 'grade', 'graduate', 'grant', 'grasp', 'greet', 'grin', 'grip', 'grow', 'guarantee',
  'guard', 'guess', 'guide', 'handle', 'hang', 'happen', 'harm', 'harvest', 'hate', 'have',
  'head', 'heal', 'hear', 'heat', 'help', 'hesitate', 'hide', 'hijack', 'hike', 'hire', 'hit',
  'hold', 'honor', 'hope', 'host', 'hug', 'hunt', 'hurry', 'hurt', 'identify', 'ignore',
  'illustrate', 'imagine', 'impact', 'implement', 'imply', 'import', 'impose', 'impress',
  'improve', 'include', 'increase', 'indicate', 'influence', 'inform', 'inherit', 'injure',
  'insist', 'inspect', 'inspire', 'install', 'instruct', 'insult', 'insure', 'integrate',
  'intend', 'interact', 'interest', 'interfere', 'interpret', 'interrupt', 'interview',
  'introduce', 'invade', 'invent', 'invest', 'investigate', 'invite', 'involve', 'iron',
  'isolate', 'issue', 'jog', 'join', 'joke', 'judge', 'jump', 'justify', 'keep', 'kick', 'kill',
  'kiss', 'knit', 'knock', 'know', 'label', 'lack', 'land', 'last', 'laugh', 'launch', 'lay',
  'lead', 'leak', 'lean', 'leap', 'learn', 'leave', 'lecture', 'lend', 'let', 'lie', 'lift',
  'light', 'like', 'limit', 'link', 'list', 'listen', 'live', 'load', 'loan', 'locate', 'lock',
  'log', 'long', 'look', 'lose', 'love', 'lower', 'maintain', 'make', 'manage', 'manufacture',
  'map', 'march', 'mark', 'marry', 'master', 'match', 'matter', 'mean', 'measure', 'meet',
  'melt', 'memorize', 'mend', 'mention', 'merge', 'message', 'migrate', 'mind', 'miss', 'mix',
  'modify', 'monitor', 'motivate', 'mount', 'move', 'multiply', 'murder', 'name', 'nap',
  'navigate', 'need', 'neglect', 'negotiate', 'nod', 'note', 'notice', 'notify', 'obey',
  'object', 'observe', 'obtain', 'occupy', 'occur', 'offend', 'offer', 'open', 'operate',
  'oppose', 'optimize', 'order', 'organize', 'overcome', 'overflow', 'overlook', 'overthink',
  'overwhelm', 'owe', 'own', 'pack', 'paint', 'panic', 'park', 'participate', 'pass', 'paste',
  'pat', 'patch', 'pause', 'pay', 'peel', 'perform', 'permit', 'persuade', 'phone', 'pick',
  'picture', 'pin', 'pinch', 'pitch', 'place', 'plan', 'plant', 'play', 'please', 'plot',
  'plug', 'plunge', 'point', 'poison', 'poke', 'polish', 'pollute', 'pop', 'possess', 'post',
  'postpone', 'pour', 'power', 'practice', 'practise', 'praise', 'pray', 'predict', 'prefer',
  'prepare', 'present', 'preserve', 'press', 'pretend', 'prevent', 'print', 'proceed', 'process',
  'produce', 'profit', 'program', 'progress', 'prohibit', 'project', 'promise', 'promote',
  'prompt', 'pronounce', 'propose', 'protect', 'protest', 'prove', 'provide', 'provoke',
  'publish', 'pull', 'pump', 'punch', 'punish', 'purchase', 'purify', 'pursue', 'push', 'put',
  'qualify', 'question', 'quit', 'quote', 'race', 'rain', 'raise', 'rank', 'rate', 'reach',
  'react', 'read', 'realize', 'recall', 'receive', 'recognize', 'recommend', 'record', 'recover',
  'recycle', 'reduce', 'refer', 'refine', 'reflect', 'reform', 'refresh', 'refund', 'refuse',
  'refute', 'regain', 'regard', 'register', 'regret', 'regulate', 'reinforce', 'reject',
  'relate', 'relax', 'release', 'relieve', 'rely', 'remain', 'remark', 'remember', 'remind',
  'remove', 'rename', 'renew', 'rent', 'repair', 'repay', 'repeat', 'replace', 'replicate',
  'reply', 'report', 'represent', 'request', 'require', 'rescue', 'research', 'resemble',
  'reserve', 'reset', 'resign', 'resist', 'resolve', 'respect', 'respond', 'rest', 'restore',
  'restrict', 'result', 'resume', 'retain', 'retire', 'retreat', 'return', 'reveal', 'revenge',
  'reverse', 'review', 'revise', 'revive', 'revoke', 'reward', 'ride', 'ring', 'rinse', 'rip',
  'rise', 'risk', 'roar', 'rob', 'rock', 'roll', 'rot', 'rub', 'ruin', 'rule', 'run', 'rush',
  'sail', 'satisfy', 'save', 'say', 'scale', 'scan', 'scare', 'scatter', 'schedule', 'score',
  'scratch', 'scream', 'screen', 'scrub', 'seal', 'search', 'seat', 'secure', 'see', 'seek',
  'seem', 'seize', 'select', 'sell', 'send', 'sense', 'sentence', 'separate', 'serve', 'set',
  'settle', 'sew', 'shake', 'shape', 'share', 'shave', 'shed', 'shelter', 'shift', 'shine',
  'ship', 'shiver', 'shock', 'shoot', 'shop', 'shorten', 'shout', 'show', 'shower', 'shrink',
  'shrug', 'shut', 'sigh', 'sign', 'signal', 'silence', 'simplify', 'sing', 'sink', 'sip',
  'sit', 'skate', 'sketch', 'ski', 'skip', 'slap', 'sleep', 'slice', 'slide', 'slip', 'slow',
  'smell', 'smile', 'smoke', 'snap', 'sneeze', 'sniff', 'snore', 'snow', 'soak', 'solve',
  'soothe', 'sort', 'sound', 'spare', 'spark', 'speak', 'specialize', 'specify', 'speed',
  'spell', 'spend', 'spill', 'spin', 'spit', 'split', 'spoil', 'sponsor', 'spot', 'spray',
  'spread', 'spring', 'sprint', 'squeeze', 'stab', 'stack', 'stain', 'stumble', 'stamp', 'stand',
  'stare', 'start', 'startle', 'starve', 'state', 'stay', 'steal', 'steer', 'step', 'stick',
  'stimulate', 'sting', 'stir', 'stop', 'store', 'strain', 'strengthen', 'stress', 'stretch',
  'strike', 'strip', 'strive', 'stroke', 'stroll', 'struggle', 'study', 'stuff', 'stun',
  'submit', 'subscribe', 'substitute', 'succeed', 'suffer', 'suggest', 'suit', 'summarize',
  'supply', 'support', 'suppose', 'surf', 'surge', 'surprise', 'surrender', 'surround',
  'survey', 'survive', 'suspect', 'suspend', 'sustain', 'swallow', 'swap', 'sway', 'swear',
  'sweat', 'sweep', 'swell', 'swim', 'swing', 'switch', 'symbolize', 'tackle', 'tag', 'take',
  'talk', 'tap', 'target', 'taste', 'tax', 'teach', 'tear', 'tease', 'tell', 'tempt', 'tend',
  'test', 'text', 'thank', 'think', 'threaten', 'thrill', 'thrive', 'throw', 'tick', 'tickle',
  'tie', 'tighten', 'tilt', 'time', 'tip', 'tire', 'toast', 'toggle', 'tolerate', 'toss',
  'touch', 'tour', 'tow', 'trace', 'track', 'trade', 'train', 'transfer', 'transform',
  'translate', 'transmit', 'transport', 'trap', 'travel', 'tread', 'treat', 'tremble', 'trick',
  'trigger', 'trim', 'trip', 'trust', 'try', 'tuck', 'tug', 'tumble', 'tune', 'turn', 'tutor',
  'tweet', 'twist', 'type', 'uncover', 'undergo', 'underline', 'undermine', 'understand',
  'undertake', 'undo', 'unfold', 'unite', 'unlock', 'unpack', 'update', 'upgrade', 'upload',
  'upset', 'urge', 'use', 'utilize', 'validate', 'value', 'vanish', 'vary', 'verify', 'veto',
  'view', 'violate', 'visit', 'visualize', 'voice', 'volunteer', 'vote', 'vow', 'wait', 'wake',
  'walk', 'wander', 'want', 'warm', 'warn', 'wash', 'waste', 'watch', 'water', 'wave', 'weaken',
  'wear', 'weather', 'weave', 'wed', 'weep', 'weigh', 'welcome', 'weld', 'whisper', 'whistle',
  'widen', 'win', 'wind', 'wink', 'wipe', 'wire', 'wish', 'withdraw', 'witness', 'wobble',
  'wonder', 'work', 'worry', 'worship', 'wound', 'wrap', 'wreck', 'wrestle', 'write', 'yawn',
  'yell', 'yield', 'zip', 'zone', 'zoom',
]);

// Irregular past (V2) forms (excluding `bound`, which in everyday English is almost always adj `be bound to`).
export const IRREGULAR_V2_SET = new Set([
  'arose', 'ate', 'awoke', 'became', 'began', 'bent', 'bit', 'bled', 'blew', 'bought',
  'broke', 'brought', 'built', 'burnt', 'caught', 'chose', 'clung', 'came', 'crept', 'dealt',
  'did', 'dug', 'drank', 'dreamt', 'drew', 'drove', 'fell', 'fed', 'felt', 'fled', 'flew',
  'flung', 'forbade', 'forgot', 'forgave', 'fought', 'found', 'froze', 'gave', 'got', 'grew',
  'had', 'heard', 'held', 'hid', 'hung', 'kept', 'knelt', 'knew', 'laid', 'leant', 'leapt',
  'learnt', 'led', 'left', 'lent', 'lit', 'lost', 'made', 'meant', 'met', 'overcame', 'paid',
  'ran', 'rang', 'rode', 'rose', 'said', 'sang', 'sank', 'sat', 'saw', 'sent', 'shook', 'shone',
  'shot', 'shrank', 'slept', 'slid', 'smelt', 'sold', 'sought', 'spelt', 'spent', 'spilt',
  'spoke', 'sprang', 'spun', 'stood', 'stole', 'stung', 'stunk', 'struck', 'strove', 'stuck',
  'swam', 'swore', 'swept', 'swung', 'taught', 'thought', 'threw', 'told', 'took', 'tore',
  'trod', 'understood', 'undertook', 'went', 'wept', 'withdrew', 'woke', 'won', 'wore', 'wrote',
]);

// Invariant verbs whose V1 === V2 === V3 (past tense only with past context or 3sg subject lacking `-s`).
export const INVARIANT_VERBS = new Set([
  'bet', 'burst', 'cast', 'cost', 'cut', 'fit', 'hit', 'hurt', 'let', 'put',
  'quit', 'read', 'set', 'shed', 'shut', 'split', 'spread',
]);

// Participial adjectives that describe states after `be` (`is tired`, `was crowded`), NOT passive voice.
// Note: Many of these (e.g. `finished`, `closed`, `organized`) ARE active simple-past verbs after a subject!
export const PARTICIPIAL_ADJECTIVES = new Set([
  'accustomed', 'acquainted', 'addicted', 'advanced', 'afraid', 'allergic', 'amazed', 'amused',
  'annoyed', 'ashamed', 'asleep', 'astonished', 'awake', 'bored', 'closed', 'committed',
  'complicated', 'concerned', 'confused', 'convinced', 'crowded', 'dedicated', 'delighted',
  'depressed', 'deserted', 'determined', 'disappointed', 'disgusted', 'divorced', 'drunk',
  'educated', 'embarrassed', 'engaged', 'excited', 'exhausted', 'experienced', 'fascinated',
  'finished', 'frightened', 'frustrated', 'glad', 'gone', 'honored', 'interested', 'intrigued',
  'involved', 'isolated', 'limited', 'married', 'motivated', 'naked', 'open', 'organized',
  'outdated', 'overrated', 'overwhelmed', 'pleased', 'prepared', 'qualified', 'ready', 'related',
  'relaxed', 'relieved', 'satisfied', 'scared', 'shocked', 'stressed', 'stuck', 'stunned',
  'supposed', 'surprised', 'talented', 'tempted', 'terrified', 'thrilled', 'tired', 'underrated',
  'united', 'upset', 'used', 'worn', 'worried',
]);

// Words ending in `-ed` that are NEVER active finite simple-past verbs (nouns, base verbs, pure adjectives).
export const NON_VERB_ED_WORDS = new Set([
  'accustomed', 'acquainted', 'addicted', 'aged', 'ashamed', 'bed', 'beloved', 'bleed', 'breed',
  'creed', 'crooked', 'crowded', 'deed', 'exceed', 'fed', 'feed', 'gifted', 'greed', 'hundred',
  'indeed', 'jagged', 'naked', 'need', 'outdated', 'overrated', 'proceed', 'ragged', 'red',
  'reed', 'rugged', 'sacred', 'seed', 'shed', 'skilled', 'sled', 'sophisticated', 'speed',
  'steed', 'succeed', 'talented', 'underrated', 'wed', 'weed', 'wicked',
]);

export const PARTICIPIAL_ING_ADJECTIVES = new Set([
  'amazing', 'annoying', 'boring', 'challenging', 'charming', 'confusing', 'depressing',
  'disappointing', 'embarrassing', 'encouraging', 'entertaining', 'exciting', 'exhausting',
  'fascinating', 'frightening', 'frustrating', 'inspiring', 'interesting', 'missing',
  'outstanding', 'overwhelming', 'promising', 'refreshing', 'relaxing', 'rewarding',
  'satisfying', 'shocking', 'surprising', 'terrifying', 'thrilling', 'tiring', 'willing', 'worrying',
]);

export const NON_GERUND_ING_WORDS = new Set([
  'according', 'anything', 'assuming', 'barring', 'being', 'bring', 'building', 'ceiling',
  'concerning', 'considering', 'during', 'evening', 'everything', 'excluding', 'feeling',
  'following', 'including', 'king', 'meaning', 'meeting', 'morning', 'nothing',
  'notwithstanding', 'painting', 'pending', 'providing', 'regarding', 'ring', 'sing',
  'something', 'spring', 'string', 'supposing', 'thing', 'wedding', 'wing',
]);

export const NON_CONTINUOUS_ING_WORDS = new Set([
  'anything', 'ceiling', 'clothing', 'during', 'evening', 'everything', 'heating',
  'housing', 'king', 'lighting', 'morning', 'nothing', 'ring', 'something', 'spring',
  'string', 'thing', 'wedding', 'wing',
]);

export const NON_VERB_AFTER_PRONOUN = new Set([
  'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'about', 'into', 'onto',
  'over', 'under', 'through', 'between', 'without', 'tomorrow', 'today', 'tonight',
  'yesterday', 'now', 'soon', 'later', 'here', 'there', 'then', 'again', 'too', 'also',
  'either', 'forever', 'anymore', 'early', 'late', 'alone', 'together', 'away', 'back',
  'down', 'up', 'off', 'out', 'all', 'both', 'each', 'very', 'quite', 'so', 'more', 'most',
]);

export const GOING_TO_PLACE_OR_DET = new Set([
  'a', 'an', 'the', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'school', 'bed', 'home', 'church', 'college', 'university', 'hospital', 'prison', 'jail',
  'town', 'class', 'sleep', 'dinner', 'lunch', 'breakfast', 'paris', 'london', 'istanbul', 'ankara',
  'berlin', 'tokyo', 'rome', 'madrid', 'europe', 'america', 'turkey', 'england', 'france', 'germany',
  'italy', 'spain', 'japan',
]);

export const IMPERATIVE_START_VERBS = new Set([
  'make', 'keep', 'take', 'check', 'remember', 'try', 'use', 'ask', 'tell', 'give',
  'bring', 'turn', 'open', 'close', 'wait', 'look', 'listen', 'read', 'write', 'stop',
  'start', 'avoid', 'choose', 'stay', 'be', 'focus', 'plan', 'share', 'clean', 'wash',
  'drink', 'eat', 'sleep', 'save', 'pack', 'call', 'send', 'put', 'set', 'review',
  'silence', 'lock', 'wear', 'hold', 'follow', 'grab', 'enjoy', 'relax', 'hurry', 'come',
  'go', 'sit', 'stand', 'speak', 'think', 'believe', 'trust', 'forget', 'leave', 'finish',
  'help', 'show', 'pay', 'buy', 'find', 'get', 'let', 'mind', 'watch', 'run', 'walk',
  'drive', 'move', 'add', 'mix', 'cut', 'press', 'click', 'tap', 'visit', 'join', 'learn',
  'practice', 'study', 'work', 'cover', 'plug', 'double-check', 'verify', 'validate',
]);

export const IMPERATIVE_HOMOGRAPH_STARTERS = new Set([
  'clean', 'open', 'close', 'work', 'study', 'sleep', 'help', 'love', 'change', 'walk',
  'run', 'talk', 'play', 'plan', 'start', 'stop', 'look', 'call', 'mind', 'watch', 'drive',
  'move', 'visit', 'cut', 'focus', 'share', 'wash', 'drink', 'save', 'pack', 'lock',
  'wear', 'hold', 'pay', 'buy', 'show', 'set', 'mix', 'press', 'click', 'tap', 'trust',
  'check', 'review', 'silence', 'cover', 'plug', 'calm', 'slow',
]);

export const MUST_BE_DUTY_ADJS = new Set([
  'accurate', 'careful', 'courteous', 'honest', 'loyal', 'patient', 'polite', 'prepared',
  'punctual', 'quiet', 'ready', 'respectful', 'responsible', 'safe', 'silent', 'strict', 'thorough',
]);

export const ACTIVE_HAS_CONTRACTION_PARTS = new Set([
  'got', 'gotten', 'had', 'lived', 'happened', 'worked', 'stayed', 'waited', 'gone', 'come',
  'written', 'tried', 'started', 'finished', 'decided', 'forgotten', 'learned', 'been',
]);

export const POSSESSIVE_TIME_OR_NOUN_BEFORE_S = new Set([
  'tomorrow', 'today', 'yesterday', 'tonight', 'morning', 'evening', 'night',
  'week', 'month', 'year', 'summer', 'winter', 'spring', 'autumn', 'fall',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);
