# 실시사항 앱

마루 v2에서 분리된 독립 PWA. 출입/순찰/CCTV/열쇠/초과근무 기록 + 타임라인 조회.

---

## 파일 구조

```
마루_실시사항/
├── index.html   HTML 구조만
├── style.css    CSS (GPT 디자인 토큰 기반)
└── app.js       JS 전체 로직
```

**로컬 실행**: VS Code Live Server 또는 `python -m http.server 8082`
**배포**: https://dddo12.github.io/duty-dashboard/ (DDDO12/duty-dashboard 레포 main 브랜치)

---

## 데이터 구조 (localStorage)

| 키 | 내용 |
|----|------|
| `events_YYYY-MM-DD` | `{date, events[]}` - 당일 이벤트 배열 |
| `personnel` | `{personnel[], personnel2[], personnel3[], key_presets[], entry_types[]}` |
| `boardTimers` | `{id: {category, type, persons, elapsed, paused, done, note}}` |
| `event_dates` | 데이터 있는 날짜 목록 (날짜 네비 dot 표시용) |
| `keyRecentUse` | `{이름: timestamp}` - 열쇠 추천 정렬용 |
| `nav_order` | 하단 탭 순서 (드래그 저장) |

### 이벤트 타입별 필드

```js
entry:   { time, type:'entry',    action:'입장|퇴장|외출|복귀', subject, subject2, location }
patrol:  { time, type:'patrol',   action:'start|stop',          subject }
cctv:    { time, type:'cctv',     action:'start|stop',          subject }
key:     { time, type:'key',      action:'issue|return',        subject, subject2, subject3, location }
overtime:{ time, type:'overtime', action:'start|stop',          subject, note }
// stop 이벤트에는 duration 필드 추가됨 (예: "12:34")
```

---

## 핵심 설계 규칙

### boardTimers (진행 중 타이머)
- 카테고리별 통합 관리: `entry / patrol / cctv / overtime`
- `createBoardTimer()` -> `stopBoard()` 시 stop 이벤트 자동 생성
- 페이지 새로고침 후 `restoreAllTimers()`로 복원

### 타임라인 렌더링
- `SKIP_ACTIONS = ['start', '입장']` - 시작 이벤트는 숨김 (boardTimers 진행 중 섹션에서 표시)
- `tlFilter` 상태로 타입 필터 (전체/출입/순찰/CCTV/열쇠/초과근무)
- 진행 중 + 완료 분리 표시

### 열쇠 대상자 셀렉터
- `getKeyHolders()` - issue/return 이벤트 누적으로 현재 보유자 계산
- `getRoleRank()` - 탄약관(1) > 탄약반장(2) > 관리병(3) > 기타(4) 정렬
- 섹션: 현재 보유 중 > 추천 대상(최근사용+직책순 상위 3명) > 전체 목록

### contextBar (공통 상단 고정)
- 모든 탭에서 노출. `position:sticky`, top은 `init()`에서 header 높이 기반 동적 설정
- 요약 바: 출입 건수 / 순찰 중 / CCTV 중 / 미반납 열쇠 / 초과 중
- 진행 중 블록: running boardTimers 있을 때만 노출

---

## 완료된 기능

- [x] 타임라인 타입 필터 칩 바
- [x] contextBar 모든 탭 고정
- [x] 진행 중 / 완료 그룹 분리 + DESC 정렬
- [x] 열쇠 상태 기반 셀렉터 (보유중/추천/전체)
- [x] 타임라인 진행 중 분리 (start 이벤트 숨김)
- [x] GPT 디자인 토큰 (딥블루 헤더, CSS 변수)
- [x] 날짜 이동 + 캘린더 모달
- [x] 체크박스 멀티삭제
- [x] 네비 탭 드래그 순서 변경

## 미완료 (다음 작업)

- [ ] 순찰+CCTV 묶음 탭 ("점검" 탭으로 통합)
- [ ] 출입 최근 인원 상단 추천 (keyRecentUse 방식 동일 적용)
- [ ] 설정 역할 기반 그룹 (탄약관/탄약반장/관리병 분리)

---

## GitHub 반영 방법

1. 이 폴더에서 수정
2. `duty-dashboard/index.html`에 CSS/JS 인라인으로 다시 합치거나
3. 레포에 `style.css`, `app.js` 파일 추가 후 `index.html` 참조 변경

> 현재 GitHub Pages 레포는 단일 `index.html` 방식. 분리 파일 방식으로 바꾸려면 레포에 3개 파일 올리면 됨.


---

## 2026-04-12 반영사항

- 열쇠 기록을 그룹 선택 + 세부 키 선택 구조로 변경
- 열쇠 수령은 실물 키 단위(`그룹 / 이름 / 번호`)로 저장
- 반납은 선택한 대상자의 현재 보유 키 목록 기준으로 처리
- 타임라인 완료 카드에 `시작시간 ~ 종료시간 + 경과시간` 동시 표시
- 초과근무를 타이머형에서 `시작 시각 입력형`으로 전환
- 초과근무는 타임라인에 섞지 않고 별도 저장/별도 탭에서 누적 합계 표시
