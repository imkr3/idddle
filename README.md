# 별가루 수집가 (idddle) — 방치형 클리커 프로토타입

빌드 도구 없이 HTML/CSS/JS만으로 돌아가는 방치형 클리커 게임 프로토타입입니다.
`index.html`을 브라우저로 열면 바로 플레이할 수 있습니다.

## 기능
- 별 클릭으로 별가루 획득
- 생산기 7종 (가격은 1개 살 때마다 1.15배), x1 / x10 / x100 / MAX 구매
- 업그레이드: 생산기 보유 수, 클릭 수 조건에 따라 등장
- 오프라인 보상: 자리를 비운 시간만큼 생산 (최대 8시간, 효율 50%)
- 자동 저장 (10초마다 + 탭 닫을 때, localStorage)
- 환생(초신성): 진행을 초기화하고 성핵 획득 → 성핵 1개당 전체 생산 +10%
- 한국식 숫자 단위 표기 (만, 억, 조, 경 …)

## 구조
| 파일 | 역할 |
|---|---|
| `src/data.js` | 밸런스 데이터 (생산기, 업그레이드, 각종 수치) — 조정은 여기서 |
| `src/engine.js` | 게임 상태/규칙/저장. DOM 없음 |
| `src/ui.js` | 화면 렌더링, 입력 처리, 게임 루프 |
| `src/style.css` | 스타일 (모두 `.idd` 아래로 한정) |

## 웹사이트에 넣기
```html
<link rel="stylesheet" href="src/style.css">
<div id="idle-game"></div>
<script src="src/data.js"></script>
<script src="src/engine.js"></script>
<script src="src/ui.js"></script>
<script>Idddle.mount(document.getElementById('idle-game'), { saveKey: 'idddle-save-v1' });</script>
```
CSS가 `.idd` 클래스 안으로 한정되어 있어 기존 사이트 스타일과 충돌하지 않습니다.

## 디버깅
`index.html`에서는 콘솔에서 `game.state.light = 1e9` 같은 식으로 상태를 직접 바꿀 수 있습니다.
