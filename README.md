# 레이어이름 정리 (Figma plugin)

선택한 레이어/프레임 이름을 camelCase · PascalCase · snake_case · kebab-case · CONSTANT_CASE · Title Case 로 일괄 변환한다.

## 한글 처리
- 선택한 레이어 전체에서 한글 단어를 모아 **중복 없이 한 번씩** 보여준다 (등장 횟수 포함).
- 각 단어에 영어를 직접 입력하면, 그 단어가 들어간 모든 레이어에 한 번에 적용된다.
  `로그인 버튼`, `로그인 화면` 에서 `로그인 → login` 한 번만 적으면 둘 다 바뀐다.
- 값은 `primary button` 처럼 여러 단어여도 되고, 비워두면 그 한글은 그대로 남는다.
- `취소버튼` 처럼 붙어 있는 이름은 `취소`, `버튼` 을 따로 적어도 긴 단어부터 잘라서 적용된다.
- 입력한 사전은 `figma.clientStorage` 에 저장되어 다음 실행 때 자동으로 채워진다.

## 끝 숫자 정리
Figma 가 자동으로 붙이는 `Frame 12`, `Rectangle 3` 같은 번호를 정리한다.
- **그대로**: 숫자를 토큰으로 유지 (`Frame 12` → `frame12`)
- **지우기**: `Frame 12` → `frame`
- **순서대로 다시 매기기**: 같은 이름끼리 선택 순서대로 1부터 (`Frame 12`, `Frame 87` → `frame1`, `frame2`)
- 기본으로는 Figma 기본 이름(Frame, Group, Rectangle, Ellipse, Vector, Text …)에만 적용. 체크를 풀면 `Button 2` 같은 이름도 대상이 된다.

## 기타 동작
- `Button / Primary` 처럼 `/` 로 나뉜 그룹 구분은 유지하고 세그먼트별로 변환 (옵션으로 끌 수 있음)
- 컴포넌트 세트 안의 variant(`Size=Large`)와 인스턴스는 건너뜀
- 적용 전 미리보기, 적용 후 Cmd+Z 한 번으로 되돌리기

## 개발
```bash
npm install
npm run build        # plugin/code.js 생성
npm test             # 케이스 변환 로직 테스트
```
Figma 데스크톱 앱 → Plugins → Development → Import plugin from manifest… → `plugin/manifest.json` 선택.

`plugin/` 폴더에는 매니페스트, 빌드된 `code.js`, `ui.html` 만 둔다. Figma 가 매니페스트 폴더를 통째로 감시하기 때문에 `node_modules` 가 같은 폴더에 있으면 앱이 멈춘다.

## 구조
- `src/case.ts` — 토크나이저 + 한글 사전 적용 + 케이스 변환 (순수 함수, 테스트 대상)
- `src/code.ts` — Figma 메인 스레드: 선택 수집, 미리보기, 적용
- `plugin/ui.html` — 플러그인 UI
- `plugin/manifest.json` — Figma 에 불러올 매니페스트
- `test/` — `node --test` 기반 테스트
- `store/` — 커뮤니티 등록용 아이콘, 커버, 문구
- `PUBLISHING.md` — 배포 절차

## 웹 데모
Figma 없이 변환 로직만 브라우저에서 확인할 수 있다.
```bash
npx esbuild demo/entry.ts --bundle --format=iife --target=es2020 --outfile=demo/lib.js && python3 -m http.server 4173 --directory demo
```
http://localhost:4173 접속. `src/case.ts` 를 고치면 위 명령을 다시 실행한다.
