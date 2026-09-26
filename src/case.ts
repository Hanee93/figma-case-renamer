export type CaseStyle =
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'title';

/** 한글 단어 → 영어. 값은 "login button" 처럼 여러 단어여도 된다 (다시 토큰화됨). */
export type Dictionary = Record<string, string>;

/**
 * 이름 끝 숫자 처리
 * - keep:     그대로 둔다 ("Frame 12" → camel "frame12")
 * - strip:    지운다 ("Frame 12" → "frame")
 * - renumber: 같은 이름끼리 선택 순서대로 1부터 다시 매긴다 ("Frame 12", "Frame 87" → "frame1", "frame2")
 */
export type NumberMode = 'keep' | 'strip' | 'renumber';

export interface ConvertOptions {
  style: CaseStyle;
  /** 끝 숫자 처리. 기본 keep */
  numbers?: NumberMode;
  /** true 면 Figma 가 자동으로 붙인 이름("Frame 12", "Rectangle 3" …)에만 숫자 처리를 적용한다. 기본 true */
  defaultNamesOnly?: boolean;
  /** 한글 토큰을 영어로 바꿀 사전. 사전에 없는 한글은 그대로 남긴다. */
  dictionary?: Dictionary;
  /** "/" 로 구분된 세그먼트를 유지하고 각각 따로 변환한다. 기본 true (예: "Button/Primary Large") */
  preserveSlash?: boolean;
}

export const CASE_STYLES: { value: CaseStyle; label: string; example: string }[] = [
  { value: 'camel', label: 'camelCase', example: 'loginButton' },
  { value: 'pascal', label: 'PascalCase', example: 'LoginButton' },
  { value: 'snake', label: 'snake_case', example: 'login_button' },
  { value: 'kebab', label: 'kebab-case', example: 'login-button' },
  { value: 'constant', label: 'CONSTANT_CASE', example: 'LOGIN_BUTTON' },
  { value: 'title', label: 'Title Case', example: 'Login Button' },
];

export const NUMBER_MODES: { value: NumberMode; label: string; example: string }[] = [
  { value: 'keep', label: '그대로', example: 'Frame 12 → frame12' },
  { value: 'strip', label: '지우기', example: 'Frame 12 → frame' },
  { value: 'renumber', label: '순서대로 다시 매기기', example: 'Frame 12, Frame 87 → frame1, frame2' },
];

/** Figma 가 새 레이어에 자동으로 붙이는 이름들 */
const FIGMA_DEFAULT_NAMES = [
  'Frame', 'Group', 'Section', 'Rectangle', 'Ellipse', 'Line', 'Arrow', 'Polygon', 'Star',
  'Vector', 'Text', 'Image', 'Slice', 'Component', 'Instance',
  'Boolean', 'Union', 'Subtract', 'Intersect', 'Exclude',
];
const FIGMA_DEFAULT_RE = new RegExp(`^(${FIGMA_DEFAULT_NAMES.join('|')})\\s+\\d+$`);

/** "Frame 12", "Rectangle 3" 처럼 Figma 기본 이름 + 숫자인지 */
export function isFigmaDefaultName(name: string): boolean {
  return FIGMA_DEFAULT_RE.test(name.trim());
}

/** 이름 끝의 숫자를 떼어낸다. "Frame 12" → { base: "Frame", num: "12" }. 숫자가 없거나 숫자뿐이면 null */
export function splitTrailingNumber(name: string): { base: string; num: string } | null {
  const m = name.trim().match(/^(.*?\D)[\s_\-]*(\d+)$/);
  return m ? { base: m[1].trim(), num: m[2] } : null;
}

const HANGUL_RE = /^[가-힣]+$/;

export function isHangul(str: string): boolean {
  return HANGUL_RE.test(str);
}

/**
 * 토큰 규칙 (정규식 순서가 우선순위):
 *  - 연속 대문자 (뒤에 소문자가 안 올 때): "HTML" in "HTMLParser"
 *  - 대문자 하나 + 소문자들: "Parser", "Button"
 *  - 소문자들
 *  - 숫자
 *  - 한글 덩어리
 * 구분자(공백, _, -, .)와 그 외 기호는 버린다.
 */
const TOKEN_RE = /[A-Z]+(?![a-z])|[A-Z][a-z]+|[a-z]+|\d+|[가-힣]+/g;

export function tokenize(input: string): string[] {
  return input.match(TOKEN_RE) ?? [];
}

/**
 * 이름 목록에서 한글 토큰을 모아 등장 횟수와 함께 돌려준다 (횟수 내림차순, 같으면 가나다순).
 * UI 의 "한글 단어" 표를 채우는 데 쓴다.
 */
export function collectHangulWords(names: string[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    for (const t of tokenize(name)) {
      if (isHangul(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'ko'));
}

/**
 * 한글 토큰 하나에 사전을 적용한다.
 *  - 정확히 일치하는 항목이 있으면 그 값 사용
 *  - 없으면 "로그인버튼" 처럼 붙어 있는 경우를 위해, 사전 키를 긴 것부터 부분 치환
 *  - 결과를 다시 토큰화해서 돌려준다 (값이 "login button" 이면 두 토큰)
 */
function translateHangul(token: string, dict: Dictionary): string[] {
  const exact = dict[token]?.trim();
  if (exact) return tokenize(exact);

  const keys = Object.keys(dict)
    .filter((k) => k && dict[k]?.trim())
    .sort((a, b) => b.length - a.length);
  if (keys.length === 0) return [token];

  let rest = token;
  const out: string[] = [];
  outer: while (rest.length > 0) {
    for (const k of keys) {
      if (rest.startsWith(k)) {
        out.push(...tokenize(dict[k].trim()));
        rest = rest.slice(k.length);
        continue outer;
      }
    }
    // 어떤 키로도 시작하지 않으면, 다음 키가 나올 때까지의 한글 덩어리를 그대로 둔다
    let end = 1;
    while (end < rest.length && !keys.some((k) => rest.startsWith(k, end))) end++;
    out.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  return out;
}

function capitalize(word: string): string {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/** 한글 토큰에는 대소문자 개념이 없으므로, 영문 토큰에만 케이스 변환을 적용한다. */
const lower = (t: string) => (isHangul(t) ? t : t.toLowerCase());
const upper = (t: string) => (isHangul(t) ? t : t.toUpperCase());
const cap = (t: string) => (isHangul(t) ? t : capitalize(t));

export function convertSegment(segment: string, opts: ConvertOptions): string {
  let tokens = tokenize(segment);
  if (tokens.length === 0) return segment;

  const dict = opts.dictionary ?? {};
  tokens = tokens.flatMap((t) => (isHangul(t) ? translateHangul(t, dict) : [t]));

  switch (opts.style) {
    case 'camel':
      return tokens.map((t, i) => (i === 0 ? lower(t) : cap(t))).join('');
    case 'pascal':
      return tokens.map(cap).join('');
    case 'snake':
      return tokens.map(lower).join('_');
    case 'kebab':
      return tokens.map(lower).join('-');
    case 'constant':
      return tokens.map(upper).join('_');
    case 'title':
      return tokens.map(cap).join(' ');
  }
}

export function convertName(name: string, opts: ConvertOptions): string {
  const preserveSlash = opts.preserveSlash ?? true;
  if (!preserveSlash || !name.includes('/')) return convertSegment(name, opts);
  return name
    .split('/')
    .map((seg) => convertSegment(seg.trim(), opts))
    .join('/');
}

/**
 * 여러 이름을 한 번에 변환한다. renumber 는 목록 전체를 봐야 하므로 이 함수를 써야 한다.
 * 순서는 입력 순서(= 레이어 순서)를 따른다.
 */
export function convertNames(names: string[], opts: ConvertOptions): string[] {
  const mode = opts.numbers ?? 'keep';
  const defaultOnly = opts.defaultNamesOnly ?? true;
  const counters = new Map<string, number>();

  return names.map((name) => {
    if (mode === 'keep') return convertName(name, opts);
    const split = splitTrailingNumber(name);
    if (!split || (defaultOnly && !isFigmaDefaultName(name))) return convertName(name, opts);

    if (mode === 'strip') return convertName(split.base, opts);

    const key = split.base.toLowerCase();
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    return convertName(`${split.base} ${n}`, opts);
  });
}
