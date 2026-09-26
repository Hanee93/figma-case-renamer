# Figma Community 배포 절차

## 0. 준비물
- Figma 데스크톱 앱, Figma 계정 (Community 프로필이 만들어져 있어야 함)
- 이 저장소의 `plugin/` 폴더 (manifest.json, code.js, ui.html)
- `store/` 폴더의 아이콘, 커버, 문구

## 1. 플러그인 ID 발급 (처음 한 번)
지금 `plugin/manifest.json` 의 `id` 는 개발용 임시 값입니다. 배포하려면 Figma 가 발급한 진짜 ID 가 필요합니다.

1. Figma → Plugins → Development → **New plugin…**
2. "Figma design" → "Default" 선택, 이름은 아무거나 → 아무 빈 폴더에 저장
3. 그 폴더의 `manifest.json` 을 열어 `"id": "1234567890123456789"` 값을 복사
4. 이 저장소의 `plugin/manifest.json` 에 붙여넣기 (임시로 만든 폴더는 지워도 됨)
5. Plugins → Development → **Import plugin from manifest…** → 이 저장소의 `plugin/manifest.json` 선택

## 2. 최종 빌드
```bash
npm test
npm run build
```
`plugin/code.js` 가 새로 만들어지고, 테스트가 모두 통과해야 합니다.

## 3. 마지막 확인 (실제 파일에서)
- [ ] 프레임 여러 개 선택 → 케이스 바꿔가며 미리보기 확인
- [ ] 한글 단어 입력 → 여러 레이어에 동시에 적용되는지
- [ ] 플러그인 닫았다 열기 → 사전이 남아 있는지
- [ ] "자식 레이어까지 적용" 켜고 큰 프레임에 실행 → 느리지 않은지
- [ ] 컴포넌트 세트 안 variant, 인스턴스가 "건너뜀"으로 나오는지
- [ ] 적용 후 Cmd+Z 한 번에 전부 되돌아가는지

## 4. 등록
1. Plugins → Development → 플러그인 옆 `…` → **Publish**
2. 등록 화면에 `store/description.md` 의 내용을 붙여넣기
   - 이름, 태그라인, 설명, 태그
   - 아이콘: `store/icon-128.png`
   - 커버: `store/cover-1920x960.png`
   - 지원 연락처 (필수)
3. **Publish** 클릭 → Figma 심사 (보통 며칠 이내)

## 5. 심사에서 걸리기 쉬운 것
- 네트워크: `networkAccess.allowedDomains` 가 `["none"]` 이어야 하고 실제로 fetch 를 쓰지 않아야 함 → 이미 충족
- 매니페스트: `documentAccess: "dynamic-page"` 필수 → 이미 충족
- 이름/설명에 "Figma" 를 자사 제품처럼 쓰지 않기 (예: "Figma 공식" 같은 표현 금지)
- 커버 이미지에 Figma 로고 넣지 않기

## 6. 업데이트 배포
코드를 고친 뒤:
```bash
npm test && npm run build
```
Plugins → Development → `…` → **Publish new version** → 변경 사항 적기 → Publish.
manifest 의 `id` 는 절대 바꾸지 마세요. 바꾸면 다른 플러그인으로 취급됩니다.
