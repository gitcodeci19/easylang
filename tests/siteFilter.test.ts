import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isUrlBlocked,
  normalizeBlockedEntry,
  parseBlockedListText,
  toChromeExcludeMatches,
} from '../src/shared/siteFilter.ts';

test('normalizeBlockedEntry cleans protocols, wildcards, and trailing slashes', () => {
  assert.equal(normalizeBlockedEntry('https://www.Example.com/'), 'www.example.com');
  assert.equal(normalizeBlockedEntry('*.exam.edu.tr'), 'exam.edu.tr');
  assert.equal(normalizeBlockedEntry('https://app.site.com/sinav/*'), 'app.site.com/sinav');
  assert.equal(normalizeBlockedEntry('   # comment'), null);
});

test('isUrlBlocked blocks exact hosts, subdomains, and optional path prefixes', () => {
  const blocked = parseBlockedListText('bankam.com\n*.exam.edu.tr\nportal.org/test');

  assert.equal(isUrlBlocked('https://bankam.com/giris', blocked), true);
  assert.equal(isUrlBlocked('https://sub.bankam.com/', blocked), true);
  assert.equal(isUrlBlocked('https://fakebankam.com/', blocked), false);

  assert.equal(isUrlBlocked('https://online.exam.edu.tr/quiz', blocked), true);
  assert.equal(isUrlBlocked('https://portal.org/test/123', blocked), true);
  assert.equal(isUrlBlocked('https://portal.org/home', blocked), false);
});

test('toChromeExcludeMatches generates valid MV3 excludeMatches patterns', () => {
  const matches = toChromeExcludeMatches(['bankam.com', 'localhost:3000', 'site.org/sinav']);
  assert.deepEqual(matches, [
    '*://bankam.com/*',
    '*://*.bankam.com/*',
    '*://localhost/*',
    '*://site.org/sinav*',
    '*://*.site.org/sinav*',
  ]);
});
