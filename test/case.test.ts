import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertName, convertNames, tokenize, collectHangulWords, splitTrailingNumber, isFigmaDefaultName } from '../src/case.ts';

test('tokenize splits camel, separators, digits and hangul', () => {
  assert.deepEqual(tokenize('HTMLParser'), ['HTML', 'Parser']);
  assert.deepEqual(tokenize('login_button-2'), ['login', 'button', '2']);
  assert.deepEqual(tokenize('로그인Button 확인'), ['로그인', 'Button', '확인']);
  assert.deepEqual(tokenize('Frame 12'), ['Frame', '12']);
});

test('english names', () => {
  const n = 'Login Button';
  assert.equal(convertName(n, { style: 'camel' }), 'loginButton');
  assert.equal(convertName(n, { style: 'pascal' }), 'LoginButton');
  assert.equal(convertName(n, { style: 'snake' }), 'login_button');
  assert.equal(convertName(n, { style: 'kebab' }), 'login-button');
  assert.equal(convertName(n, { style: 'constant' }), 'LOGIN_BUTTON');
  assert.equal(convertName(n, { style: 'title' }), 'Login Button');
});

test('hangul without dictionary is left untouched, only separators change', () => {
  const n = '로그인 버튼';
  assert.equal(convertName(n, { style: 'snake' }), '로그인_버튼');
  assert.equal(convertName(n, { style: 'kebab' }), '로그인-버튼');
  assert.equal(convertName(n, { style: 'camel' }), '로그인버튼');
  assert.equal(convertName(n, { style: 'title' }), '로그인 버튼');
});

test('dictionary translates hangul words then applies case', () => {
  const dictionary = { 로그인: 'login', 버튼: 'button' };
  assert.equal(convertName('로그인 버튼', { style: 'camel', dictionary }), 'loginButton');
  assert.equal(convertName('로그인 버튼', { style: 'pascal', dictionary }), 'LoginButton');
  assert.equal(convertName('로그인 버튼', { style: 'constant', dictionary }), 'LOGIN_BUTTON');
  assert.equal(convertName('메인 Header', { style: 'snake', dictionary: { 메인: 'main' } }), 'main_header');
});

test('dictionary value may contain several words', () => {
  const dictionary = { 확인: 'confirm', 버튼: 'primary button' };
  assert.equal(convertName('확인 버튼', { style: 'kebab', dictionary }), 'confirm-primary-button');
});

test('partially filled dictionary leaves unknown hangul as-is', () => {
  const dictionary = { 로그인: 'login', 버튼: '' };
  assert.equal(convertName('로그인 버튼', { style: 'snake', dictionary }), 'login_버튼');
});

test('joined hangul is split by dictionary keys, longest first', () => {
  const dictionary = { 로그인: 'login', 버튼: 'button', 로그: 'log' };
  assert.equal(convertName('로그인버튼', { style: 'camel', dictionary }), 'loginButton');
  assert.equal(convertName('로그버튼', { style: 'camel', dictionary }), 'logButton');
  // 모르는 조각은 남긴다
  assert.equal(convertName('큰로그인버튼', { style: 'snake', dictionary }), '큰_login_button');
});

test('collectHangulWords dedupes and counts across names', () => {
  const words = collectHangulWords(['로그인 버튼', '확인 버튼', 'Frame 1', '버튼/닫기']);
  assert.deepEqual(words, [
    { word: '버튼', count: 3 },
    { word: '닫기', count: 1 },
    { word: '로그인', count: 1 },
    { word: '확인', count: 1 },
  ]);
});

test('slash segments are preserved', () => {
  assert.equal(convertName('Button / Primary Large', { style: 'kebab' }), 'button/primary-large');
  assert.equal(
    convertName('아이콘/닫기 버튼', { style: 'snake', dictionary: { 아이콘: 'icon', 닫기: 'close', 버튼: 'button' } }),
    'icon/close_button',
  );
  assert.equal(
    convertName('Button / Primary Large', { style: 'kebab', preserveSlash: false }),
    'button-primary-large',
  );
});

test('name with nothing to tokenize is returned as-is', () => {
  assert.equal(convertName('---', { style: 'camel' }), '---');
});

test('splitTrailingNumber and isFigmaDefaultName', () => {
  assert.deepEqual(splitTrailingNumber('Frame 12'), { base: 'Frame', num: '12' });
  assert.deepEqual(splitTrailingNumber('Button-2'), { base: 'Button', num: '2' });
  assert.deepEqual(splitTrailingNumber('card_03'), { base: 'card', num: '03' });
  assert.equal(splitTrailingNumber('Frame'), null);
  assert.equal(splitTrailingNumber('123'), null);
  assert.equal(isFigmaDefaultName('Frame 12'), true);
  assert.equal(isFigmaDefaultName('Rectangle 3'), true);
  assert.equal(isFigmaDefaultName('Button 2'), false);
  assert.equal(isFigmaDefaultName('Frame'), false);
});

test('numbers: keep leaves trailing numbers as tokens', () => {
  assert.deepEqual(convertNames(['Frame 12', 'Button 2'], { style: 'snake' }), ['frame_12', 'button_2']);
});

test('numbers: strip removes trailing numbers from figma default names only by default', () => {
  assert.deepEqual(
    convertNames(['Frame 12', 'Rectangle 3', 'Button 2'], { style: 'snake', numbers: 'strip' }),
    ['frame', 'rectangle', 'button_2'],
  );
  assert.deepEqual(
    convertNames(['Frame 12', 'Button 2'], { style: 'snake', numbers: 'strip', defaultNamesOnly: false }),
    ['frame', 'button'],
  );
});

test('numbers: renumber restarts from 1 per base name in order', () => {
  assert.deepEqual(
    convertNames(['Frame 12', 'Frame 87', 'Rectangle 9', 'Frame 3', 'Login Button'], { style: 'camel', numbers: 'renumber' }),
    ['frame1', 'frame2', 'rectangle1', 'frame3', 'loginButton'],
  );
  assert.deepEqual(
    convertNames(['Frame 12', 'Frame 87'], { style: 'title', numbers: 'renumber' }),
    ['Frame 1', 'Frame 2'],
  );
});

test('numbers: renumber with dictionary and non-default names', () => {
  assert.deepEqual(
    convertNames(['카드 5', '카드 9'], { style: 'kebab', numbers: 'renumber', defaultNamesOnly: false, dictionary: { 카드: 'card' } }),
    ['card-1', 'card-2'],
  );
});
