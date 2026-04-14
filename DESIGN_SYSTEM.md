# 마루 실시사항 - 디자인 시스템 (Vanguard Elite)
> 스티치 AI 생성 기반, 2026-04-14 확정

## 색상 팔레트

### 기본 (배경/표면)
- `--bg-primary`: #0d1117 (최상위 배경)
- `--bg-surface`: #161b22 (카드/패널 배경)
- `--bg-surface-elevated`: #1c2128 (떠있는 카드)
- `--bg-input`: #21262d (입력 필드 배경)
- `--border-subtle`: #30363d (경계선)

### 액센트
- `--accent-green`: #34a853 (순찰, 주요 액션)
- `--accent-green-dim`: #238636 (순찰 hover)
- `--accent-purple`: #9334e6 (CCTV)
- `--accent-purple-dim`: #7928a1 (CCTV hover)
- `--accent-teal`: #0097a7 (인수인계)
- `--accent-teal-dim`: #00838f (인수인계 hover)
- `--accent-amber`: #f0b429 (경고/주의)

### 텍스트
- `--text-primary`: #e6edf3 (본문)
- `--text-secondary`: #8b949e (보조)
- `--text-muted`: #484f58 (비활성)
- `--text-on-accent`: #ffffff (액센트 버튼 위)

### 상태
- `--status-online`: #34a853 (정상/온라인)
- `--status-warning`: #f0b429 (경고)
- `--status-error`: #e60012 (오류/위험)

## 타이포그래피
- 제목: 700(bold), 24px
- 부제목: 600(semi), 18px
- 본문: 400(regular), 14px
- 캡션: 400, 12px
- 타이머 숫자: 700(bold), 32px, monospace

## 간격 (spacing)
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px

## 모서리 (border-radius)
- 칩/태그: 8px
- 버튼: 16px
- 카드: 16px
- 큰 액션 버튼: 20px
- 모달: 24px

## 그림자
- 카드: 0 2px 8px rgba(0,0,0,0.3)
- 떠있는 카드: 0 4px 16px rgba(0,0,0,0.4)
- 액션 버튼: 0 4px 12px rgba(색상, 0.3)

## 컴포넌트 규격

### 큰 액션 버튼 (순찰/CCTV/인수인계)
- 높이: 64px
- 너비: 100% (좌우 패딩 16px)
- border-radius: 20px
- 아이콘: 왼쪽 16px, 28px 크기
- 라벨: 중앙, 18px bold
- 그림자: 0 4px 12px rgba(색상, 0.3)
- hover: 밝기 +10%, scale(1.02)
- active: scale(0.98)

### 카드
- padding: 16px
- border-radius: 16px
- 배경: --bg-surface
- 테두리: 1px solid --border-subtle
- 내부 간격: 12px

### 칩 (인원/카테고리)
- padding: 6px 14px
- border-radius: 8px
- 배경: --bg-input
- 선택시: accent 색상 배경
- 글씨: 13px

### 타이머 카드 (진행중)
- 배경: --bg-surface-elevated
- 왼쪽 보더: 3px solid accent
- 시간: 32px monospace bold
- 라벨: 12px --text-secondary

### 네비게이션 바
- 높이: 64px
- 배경: --bg-surface
- 상단 테두리: 1px solid --border-subtle
- 아이콘: 24px
- 라벨: 10px
- 활성 탭: --accent-green 색상

### 모달 오버레이
- 배경: rgba(0,0,0,0.6)
- backdrop-filter: blur(12px)

### 모달
- 배경: --bg-surface
- border-radius: 24px
- padding: 24px
- 애니메이션: slideUp 0.3s ease

## 애니메이션

### 전환 기본
- duration: 0.2s
- easing: cubic-bezier(0.4, 0, 0.2, 1)

### 페이지 전환
- fadeIn: opacity 0->1, 0.3s
- slideUp: translateY(20px)->0, 0.3s

### 버튼 입장
- scale(0.9)->scale(1), opacity 0->1
- stagger: 각 버튼 0.08s 딜레이

### 카드 입장
- translateY(12px)->0, opacity 0->1
- stagger: 0.05s

### 스플래시
- 로고: scale(0.6)->scale(1), 0.8s
- 텍스트: translateY(10px)->0, opacity, 0.5s (0.3s delay)
- 퇴장: opacity->0, 0.6s (1.6s delay)
