import { convertNames, collectHangulWords, ConvertOptions, Dictionary, CASE_STYLES, NUMBER_MODES } from './case.ts';

/** UI ↔ main thread 메시지 정의 */
type UIMessage =
  | { type: 'preview'; opts: ConvertOptions; recursive: boolean }
  | { type: 'apply'; opts: ConvertOptions; recursive: boolean }
  | { type: 'close' };

interface PreviewRow {
  id: string;
  before: string;
  after: string;
  skipped?: string; // 건너뛴 이유
}

const DICT_KEY = 'hangulDictionary';

figma.showUI(__html__, { width: 400, height: 720, themeColors: true });

/** 선택된 노드(옵션에 따라 자식 포함)를 평탄화해서 모은다. */
function collectNodes(recursive: boolean): SceneNode[] {
  const out: SceneNode[] = [];
  const visit = (node: SceneNode) => {
    out.push(node);
    if (recursive && 'children' in node) {
      for (const child of node.children) visit(child);
    }
  };
  for (const node of figma.currentPage.selection) visit(node);
  return out;
}

/**
 * 이름을 바꾸면 안 되는 노드 판단.
 * - 컴포넌트 세트 안의 variant 는 "Property=Value, ..." 형식이 깨지면 안 된다.
 * - 인스턴스 이름은 보통 마스터 컴포넌트를 따라가므로 기본 건너뜀.
 */
function skipReason(node: SceneNode): string | undefined {
  if (node.parent?.type === 'COMPONENT_SET' && node.name.includes('=')) {
    return 'variant 이름';
  }
  if (node.type === 'INSTANCE') return '인스턴스';
  return undefined;
}

function buildPreview(opts: ConvertOptions, recursive: boolean) {
  const nodes = collectNodes(recursive);
  // renumber 는 목록 전체를 봐야 하므로, 건너뛰지 않는 노드 이름을 순서대로 모아 한 번에 변환한다
  const active = nodes.filter((n) => !skipReason(n));
  const converted = convertNames(active.map((n) => n.name), opts);
  const afterById = new Map(active.map((n, i) => [n.id, converted[i]]));
  const rows: PreviewRow[] = nodes.map((node) => {
    const skipped = skipReason(node);
    return {
      id: node.id,
      before: node.name,
      after: skipped ? node.name : afterById.get(node.id) ?? node.name,
      skipped,
    };
  });
  // 건너뛰지 않는 노드 이름에서만 한글 단어를 모은다
  const hangulWords = collectHangulWords(rows.filter((r) => !r.skipped).map((r) => r.before));
  return { rows, hangulWords };
}

function sendPreview(opts: ConvertOptions, recursive: boolean) {
  try {
    figma.ui.postMessage({ type: 'preview', ...buildPreview(opts, recursive) });
  } catch (e) {
    figma.notify('미리보기를 만드는 중 문제가 생겼어요: ' + (e instanceof Error ? e.message : String(e)), { error: true });
  }
}

let lastOpts: ConvertOptions = { style: 'camel', dictionary: {}, preserveSlash: true, numbers: 'keep', defaultNamesOnly: true };
let lastRecursive = false;

/** 값이 비어 있지 않은 항목만 남겨서 저장 */
async function saveDictionary(dict: Dictionary) {
  const cleaned: Dictionary = {};
  for (const [k, v] of Object.entries(dict)) if (k && v?.trim()) cleaned[k] = v.trim();
  await figma.clientStorage.setAsync(DICT_KEY, cleaned);
}

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'preview':
      lastOpts = msg.opts;
      lastRecursive = msg.recursive;
      sendPreview(msg.opts, msg.recursive);
      break;

    case 'apply': {
      try {
        const { rows } = buildPreview(msg.opts, msg.recursive);
        let changed = 0;
        for (const row of rows) {
          if (row.skipped || row.before === row.after) continue;
          // dynamic-page 모드에서는 동기 getNodeById 를 쓸 수 없다
          const node = (await figma.getNodeByIdAsync(row.id)) as SceneNode | null;
          if (!node) continue;
          node.name = row.after;
          changed++;
        }
        // 한 번의 실행을 Cmd+Z 한 번으로 되돌릴 수 있게 undo 지점을 만든다.
        figma.commitUndo();
        await saveDictionary(msg.opts.dictionary ?? {});
        figma.notify(`${changed}개 레이어 이름을 바꿨어요`);
      } catch (e) {
        figma.notify('이름을 바꾸는 중 문제가 생겼어요: ' + (e instanceof Error ? e.message : String(e)), { error: true });
      }
      sendPreview(msg.opts, msg.recursive);
      break;
    }

    case 'close':
      figma.closePlugin();
      break;
  }
};

figma.on('selectionchange', () => sendPreview(lastOpts, lastRecursive));

// UI 초기화: 케이스 목록 + 지난번에 저장해 둔 한글 사전
(async () => {
  const dictionary = ((await figma.clientStorage.getAsync(DICT_KEY)) as Dictionary | undefined) ?? {};
  lastOpts = { ...lastOpts, dictionary };
  figma.ui.postMessage({ type: 'init', styles: CASE_STYLES, numberModes: NUMBER_MODES, dictionary });
})();
