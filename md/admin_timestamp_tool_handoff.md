# 관리자 모드 타임스탬프 마킹 기능 작업 지시서

이 문서는 **VS Code / Codex에 그대로 지시할 수 있는 핵심 작업 문서**다.
현재 프로젝트의 관리자 모드 흐름에 맞춰, `frontend/admin.html`의 **스파링 영상 탭**에서
관리자가 영상을 직접 보면서 공격이 닿는 순간을 기록하고, `timestamps[]`를 생성/수정/저장할 수 있게 만드는 것이 목표다.

현재 작업 메모 기준으로:

- 관리자 화면은 `frontend/admin.html`의 `스파링 영상` 탭에서 관리한다.
- 영상 추가는 `POST /api/admin/videos` 로 처리한다.
- 저장 시 `timestamps` 배열을 함께 넘길 수 있다.
- 수정용 `PUT /api/admin/videos/{id}`는 아직 없고, 현재는 삭제 후 다시 추가 방식이 안전하다.
- 실제 mp4 파일은 `frontend/assets/videos/` 기준으로 관리한다.
- 스파링 레벨은 `beginner / intermediate / advanced / pro` 와 `jab / straight / hook / mixed` 중심으로 연결된다. fileciteturn0file0

---

## 1. 이번 작업의 핵심 목표

Codex에게 아래 목적을 분명히 지시한다.

### 목표

`admin.html` 안에 **타임스탬프 마킹 도구**를 추가해서:

1. 관리자가 mp4 영상을 재생할 수 있게 한다.
2. 공격이 닿는 순간에 버튼 또는 키보드로 `impact_time`을 기록할 수 있게 한다.
3. 기록된 각 타임스탬프마다 아래 값을 함께 편집할 수 있게 한다.
   - `impact_time`
   - `dodge_window_ms`
   - `hitbox_radius`
   - `required_move`
   - `target_zone`
4. 난이도(`difficulty`)와 공격 타입(`attack_type`)에 따라 기본 프리셋을 자동 입력한다.
5. 최종적으로 `timestamps[]` JSON을 만들고,
6. 기존 영상 등록 폼과 함께 `POST /api/admin/videos` 로 저장할 수 있게 한다.

---

## 2. 왜 이 방식이 필요한가

복싱 영상에서 `impact_time`은 **주먹이 실제로 닿는 순간**이라서, 완전 자동 검출보다 **관리자가 직접 보면서 마킹하는 방식**이 현재 가장 현실적이다.

### 이유

- 카메라 각도에 따라 충돌 시점이 다르게 보인다.
- 잽, 스트레이트, 훅, 어퍼컷은 접촉 지점이 다르다.
- 프로 콤보나 페인트는 자동 검출 오차가 크다.
- 현재 프로젝트는 `timestamps[]`를 관리자 모드에서 직접 관리하는 구조가 더 안정적이다.

즉, 우선순위는:

1. **수동/반자동 마킹 기능 먼저 구현**
2. 필요하면 나중에 MediaPipe 후보 추출 기능 추가

---

## 3. Codex에 전달할 핵심 요약

아래 요약을 그대로 지시해도 된다.

## Codex 작업 요약

`frontend/admin.html`의 스파링 영상 관리 UI에 타임스탬프 마킹 도구를 추가해주세요.

필수 기능:

- 영상 미리보기 플레이어 추가
- 현재 재생 시점 표시
- 재생 / 정지
- 0.25x / 0.5x / 1.0x 속도 조절
- 이전 프레임 / 다음 프레임 이동 버튼
- `M` 키 또는 버튼으로 현재 시점을 `impact_time`으로 기록
- 기록된 `timestamps[]`를 테이블로 표시
- 각 row에서 `impact_time`, `dodge_window_ms`, `hitbox_radius`, `required_move`, `target_zone` 수정 가능
- 난이도 / 공격 타입에 따라 기본 프리셋 자동 채우기
- JSON 미리보기 제공
- 기존 영상 등록 저장 로직과 연결해서 `POST /api/admin/videos`에 `timestamps` 포함 전송

주의사항:

- 현재 백엔드는 수정용 PUT 엔드포인트가 없으므로, 신규 등록 기준으로 구현한다.
- 기존 `스파링 영상` 탭 구조를 최대한 유지하고, 별도 페이지를 만들지 말고 `admin.html` 내부에 붙인다.
- 기존 저장 필드(`title`, `file_path`, `difficulty`, `attack_type`, `duration`, `timestamps`)와 충돌 없게 만든다.
- 에러가 나도 기존 관리자 기능이 깨지지 않게 방어적으로 구현한다.

---

## 4. 판정 기준 통일 규칙

관리자가 어떤 순간을 `impact_time`으로 찍을지 기준을 통일해야 한다.

### 권장 기준

**주먹이 target_zone에 가장 가까워지는 프레임**을 `impact_time`으로 본다.

이 기준으로 통일한다.

- `jab`, `straight` → 보통 `head`
- `hook` → `left_head` 또는 `right_head`
- `uppercut` → `body` 또는 `head`
- `mixed` → 각 타임스탬프마다 따로 판단

---

## 5. 난이도별 기본 프리셋

아래 값을 기본 프리셋으로 자동 입력한다.

```js
const DIFFICULTY_PRESETS = {
  beginner: {
    dodge_window_ms: 650,
    hitbox_radius: 0.22
  },
  intermediate: {
    dodge_window_ms: 520,
    hitbox_radius: 0.16
  },
  advanced: {
    dodge_window_ms: 430,
    hitbox_radius: 0.12
  },
  pro: {
    dodge_window_ms: 340,
    hitbox_radius: 0.09
  }
};
```

### 기본 required_move 추천

- `jab` → `slip_side` 또는 `auto`
- `straight` → `lean_back` 또는 `slip_side`
- `hook` → `duck` 또는 `slip_side`
- `uppercut` → `lean_back` 또는 `step_out`
- `mixed` → `auto`

### 기본 target_zone 추천

- `jab` → `head`
- `straight` → `head`
- `hook` → `left_head` 또는 `right_head`
- `uppercut` → `body`
- `mixed` → `head`

---

## 6. 관리자 화면 UX 요구사항

Codex에게 아래 UX를 같이 구현하라고 지시한다.

### 필요한 UI

1. 영상 파일 경로 입력창
2. 영상 미리보기 플레이어
3. 현재 재생 시간 표시
4. 재생속도 버튼
5. 프레임 이동 버튼
6. 현재 시점 마킹 버튼
7. 마지막 마킹 삭제 버튼
8. 전체 초기화 버튼
9. `timestamps[]` 편집 테이블
10. JSON 미리보기
11. 저장 버튼

### 단축키

- `Space` → 재생/정지
- `M` → 현재 시점 마킹
- `,` → 이전 프레임
- `.` → 다음 프레임

---

## 7. admin.html에 붙여 넣을 실제 코드

아래 코드는 **현재 `admin.html`의 스파링 영상 탭 내부**에 넣는 용도다.
정확한 삽입 위치는 프로젝트 구조에 따라 약간 다를 수 있지만,
가장 안전한 방식은:

- 기존 스파링 영상 등록 폼 아래에 HTML 블록 추가
- 기존 `<script>` 또는 별도 admin JS 파일 안에 JS 추가
- 기존 저장 버튼 로직에 `timestamps` 연결

---

## 7-1. HTML 붙여 넣기 코드

```html
<section class="admin-card" id="timestampMarkerSection">
  <h3>타임스탬프 마킹 도구</h3>
  <p class="admin-help">
    영상을 재생한 뒤 공격이 닿는 순간에 <strong>M</strong> 키 또는 버튼을 눌러 impact_time을 기록하세요.
  </p>

  <div class="marker-grid">
    <div class="marker-left">
      <div class="form-row">
        <label for="videoFilePathInput">영상 경로</label>
        <input
          id="videoFilePathInput"
          type="text"
          placeholder="/assets/videos/sparring/sparring_beginner_jab_01.mp4"
        />
        <button type="button" id="loadMarkerVideoBtn">영상 불러오기</button>
      </div>

      <video id="markerVideo" controls preload="metadata" playsinline></video>

      <div class="marker-toolbar">
        <span>현재 시점: <strong id="markerCurrentTime">0.000</strong>s</span>
        <button type="button" data-rate="0.25" class="rate-btn">0.25x</button>
        <button type="button" data-rate="0.5" class="rate-btn">0.5x</button>
        <button type="button" data-rate="1" class="rate-btn">1x</button>
        <button type="button" id="prevFrameBtn">이전 프레임</button>
        <button type="button" id="nextFrameBtn">다음 프레임</button>
        <button type="button" id="markImpactBtn">현재 시점 마킹 (M)</button>
        <button type="button" id="undoImpactBtn">마지막 삭제</button>
        <button type="button" id="clearImpactBtn">전체 초기화</button>
      </div>

      <div class="marker-shortcut-help">
        단축키: Space = 재생/정지, M = 마킹, , = 이전 프레임, . = 다음 프레임
      </div>
    </div>

    <div class="marker-right">
      <table class="marker-table">
        <thead>
          <tr>
            <th>#</th>
            <th>impact_time</th>
            <th>dodge_window_ms</th>
            <th>hitbox_radius</th>
            <th>required_move</th>
            <th>target_zone</th>
            <th>삭제</th>
          </tr>
        </thead>
        <tbody id="markerTimestampsBody"></tbody>
      </table>

      <div class="marker-json-wrap">
        <label for="timestampsJsonPreview">timestamps JSON 미리보기</label>
        <textarea id="timestampsJsonPreview" rows="14" readonly></textarea>
      </div>
    </div>
  </div>
</section>
```

---

## 7-2. CSS 붙여 넣기 코드

```css
#timestampMarkerSection {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  background: rgba(255,255,255,0.03);
}

.marker-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 16px;
}

.marker-left,
.marker-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#markerVideo {
  width: 100%;
  max-height: 460px;
  background: #000;
  border-radius: 12px;
}

.marker-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.marker-shortcut-help,
.admin-help {
  color: #b7bfd1;
  font-size: 13px;
}

.marker-table {
  width: 100%;
  border-collapse: collapse;
}

.marker-table th,
.marker-table td {
  border: 1px solid rgba(255,255,255,0.08);
  padding: 6px;
  text-align: center;
  vertical-align: middle;
}

.marker-table input,
.marker-table select,
#timestampsJsonPreview,
#videoFilePathInput {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.25);
  color: #fff;
}

.marker-json-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (max-width: 1100px) {
  .marker-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 7-3. JavaScript 붙여 넣기 코드

```html
<script>
(function () {
  const markerVideo = document.getElementById('markerVideo');
  const markerCurrentTime = document.getElementById('markerCurrentTime');
  const markerTimestampsBody = document.getElementById('markerTimestampsBody');
  const timestampsJsonPreview = document.getElementById('timestampsJsonPreview');
  const videoFilePathInput = document.getElementById('videoFilePathInput');
  const loadMarkerVideoBtn = document.getElementById('loadMarkerVideoBtn');
  const markImpactBtn = document.getElementById('markImpactBtn');
  const undoImpactBtn = document.getElementById('undoImpactBtn');
  const clearImpactBtn = document.getElementById('clearImpactBtn');
  const prevFrameBtn = document.getElementById('prevFrameBtn');
  const nextFrameBtn = document.getElementById('nextFrameBtn');
  const rateButtons = document.querySelectorAll('.rate-btn');

  if (!markerVideo || !markerTimestampsBody) {
    return;
  }

  const DIFFICULTY_PRESETS = {
    beginner: { dodge_window_ms: 650, hitbox_radius: 0.22 },
    intermediate: { dodge_window_ms: 520, hitbox_radius: 0.16 },
    advanced: { dodge_window_ms: 430, hitbox_radius: 0.12 },
    pro: { dodge_window_ms: 340, hitbox_radius: 0.09 }
  };

  const MOVE_OPTIONS = ['slip_left', 'slip_right', 'slip_side', 'duck', 'lean_back', 'step_out', 'auto'];
  const ZONE_OPTIONS = ['head', 'body', 'left_head', 'right_head'];

  let markerTimestamps = [];

  function getDifficultyValue() {
    const el = document.querySelector('[name="difficulty"], #difficulty, #videoDifficulty');
    return el ? el.value : 'beginner';
  }

  function getAttackTypeValue() {
    const el = document.querySelector('[name="attack_type"], #attackType, #videoAttackType');
    return el ? el.value : 'jab';
  }

  function getDefaultMove(attackType, difficulty) {
    if (difficulty === 'pro') return 'auto';
    if (attackType === 'jab') return 'slip_side';
    if (attackType === 'straight') return 'lean_back';
    if (attackType === 'hook') return 'duck';
    if (attackType === 'uppercut') return 'step_out';
    return 'auto';
  }

  function getDefaultTargetZone(attackType) {
    if (attackType === 'hook') return 'left_head';
    if (attackType === 'uppercut') return 'body';
    return 'head';
  }

  function round3(value) {
    return Math.round(Number(value) * 1000) / 1000;
  }

  function getCurrentPayload() {
    const difficulty = getDifficultyValue();
    const attackType = getAttackTypeValue();
    const filePath = videoFilePathInput.value.trim();

    return {
      file_path: filePath,
      difficulty,
      attack_type: attackType,
      timestamps: markerTimestamps
    };
  }

  function renderJsonPreview() {
    timestampsJsonPreview.value = JSON.stringify(getCurrentPayload(), null, 2);
  }

  function renderTable() {
    markerTimestampsBody.innerHTML = '';

    markerTimestamps.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><input type="number" step="0.001" value="${item.impact_time}" data-index="${index}" data-field="impact_time"></td>
        <td><input type="number" step="1" value="${item.dodge_window_ms}" data-index="${index}" data-field="dodge_window_ms"></td>
        <td><input type="number" step="0.01" value="${item.hitbox_radius}" data-index="${index}" data-field="hitbox_radius"></td>
        <td>
          <select data-index="${index}" data-field="required_move">
            ${MOVE_OPTIONS.map(v => `<option value="${v}" ${item.required_move === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </td>
        <td>
          <select data-index="${index}" data-field="target_zone">
            ${ZONE_OPTIONS.map(v => `<option value="${v}" ${item.target_zone === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </td>
        <td><button type="button" data-remove-index="${index}">삭제</button></td>
      `;
      markerTimestampsBody.appendChild(tr);
    });

    renderJsonPreview();
  }

  function addImpactTimestamp() {
    const difficulty = getDifficultyValue();
    const attackType = getAttackTypeValue();
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.beginner;

    markerTimestamps.push({
      impact_time: round3(markerVideo.currentTime || 0),
      dodge_window_ms: preset.dodge_window_ms,
      hitbox_radius: preset.hitbox_radius,
      required_move: getDefaultMove(attackType, difficulty),
      target_zone: getDefaultTargetZone(attackType)
    });

    renderTable();
  }

  function stepFrame(direction) {
    const fps = 30;
    markerVideo.pause();
    markerVideo.currentTime = Math.max(0, (markerVideo.currentTime || 0) + direction / fps);
  }

  function loadVideoFromPath() {
    const path = videoFilePathInput.value.trim();
    if (!path) {
      alert('영상 경로를 입력하세요.');
      return;
    }
    markerVideo.src = path;
    markerVideo.load();
    renderJsonPreview();
  }

  markerVideo.addEventListener('timeupdate', () => {
    markerCurrentTime.textContent = round3(markerVideo.currentTime || 0).toFixed(3);
  });

  loadMarkerVideoBtn?.addEventListener('click', loadVideoFromPath);
  markImpactBtn?.addEventListener('click', addImpactTimestamp);

  undoImpactBtn?.addEventListener('click', () => {
    markerTimestamps.pop();
    renderTable();
  });

  clearImpactBtn?.addEventListener('click', () => {
    markerTimestamps = [];
    renderTable();
  });

  prevFrameBtn?.addEventListener('click', () => stepFrame(-1));
  nextFrameBtn?.addEventListener('click', () => stepFrame(1));

  rateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rate = Number(btn.dataset.rate || 1);
      markerVideo.playbackRate = rate;
    });
  });

  markerTimestampsBody.addEventListener('input', (event) => {
    const target = event.target;
    const index = Number(target.dataset.index);
    const field = target.dataset.field;

    if (Number.isNaN(index) || !field || !markerTimestamps[index]) return;

    if (field === 'impact_time' || field === 'hitbox_radius') {
      markerTimestamps[index][field] = Number(target.value);
    } else if (field === 'dodge_window_ms') {
      markerTimestamps[index][field] = parseInt(target.value, 10) || 0;
    } else {
      markerTimestamps[index][field] = target.value;
    }

    renderJsonPreview();
  });

  markerTimestampsBody.addEventListener('click', (event) => {
    const removeIndex = event.target.dataset.removeIndex;
    if (removeIndex === undefined) return;
    markerTimestamps.splice(Number(removeIndex), 1);
    renderTable();
  });

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    const isTyping = ['input', 'textarea', 'select'].includes(activeTag);
    if (isTyping) return;

    if (event.code === 'Space') {
      event.preventDefault();
      if (markerVideo.paused) markerVideo.play();
      else markerVideo.pause();
      return;
    }

    if (event.code === 'KeyM') {
      event.preventDefault();
      addImpactTimestamp();
      return;
    }

    if (event.key === ',') {
      event.preventDefault();
      stepFrame(-1);
      return;
    }

    if (event.key === '.') {
      event.preventDefault();
      stepFrame(1);
    }
  });

  window.getMarkerTimestamps = function () {
    return markerTimestamps;
  };

  window.setMarkerTimestamps = function (timestamps) {
    markerTimestamps = Array.isArray(timestamps) ? timestamps : [];
    renderTable();
  };

  videoFilePathInput?.addEventListener('change', renderJsonPreview);
  document.querySelector('[name="difficulty"], #difficulty, #videoDifficulty')?.addEventListener('change', renderJsonPreview);
  document.querySelector('[name="attack_type"], #attackType, #videoAttackType')?.addEventListener('change', renderJsonPreview);

  renderTable();
})();
</script>
```

---

## 8. 기존 저장 버튼과 연결하는 방법

현재 관리자 모드에 이미 영상 등록용 저장 함수가 있다면,
그 함수 안에서 `timestamps`를 아래처럼 붙이면 된다.

```js
const payload = {
  title: titleInput.value.trim(),
  file_path: filePathInput.value.trim(),
  difficulty: difficultySelect.value,
  attack_type: attackTypeSelect.value,
  duration: Number(durationInput.value),
  timestamps: window.getMarkerTimestamps ? window.getMarkerTimestamps() : []
};

await fetch('/api/admin/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

### 중요

기존 저장 함수에서 `timestamps` 필드가 빠져 있으면 반드시 추가한다.

---

## 9. Codex에게 같이 시킬 보강 작업

아래 항목도 함께 지시하면 좋다.

### 추가 요청 사항

1. 기존 영상 목록 클릭 시 해당 영상의 `timestamps`를 편집기에 불러오기
2. 영상 선택 시 자동으로 `markerVideo.src` 갱신
3. 기존 row를 수정하면 JSON 미리보기도 즉시 갱신
4. 관리자 탭 내 스타일을 기존 디자인 톤에 맞게 정리
5. 예외 처리 추가
   - 경로가 비어 있으면 로드 막기
   - 영상 로드 실패 시 안내 메시지 표시
   - timestamps가 비어 있어도 저장 가능 여부를 정책에 맞게 처리

---

## 10. 테스트 체크리스트

구현 후 아래를 확인한다.

### 기능 체크

- 영상 경로 입력 후 로드가 되는가
- 영상 재생 중 현재 시간이 갱신되는가
- `M` 키로 timestamp가 추가되는가
- 이전/다음 프레임 이동이 되는가
- 테이블 수정값이 JSON에 반영되는가
- 저장 요청에 `timestamps[]`가 포함되는가
- 초급/중급/상급/프로 프리셋이 다르게 들어가는가
- hook에서 `left_head`, `right_head` 수정이 쉬운가

### 실제 운영 체크

- 초급 jab 영상 1개 등록 테스트
- 중급 straight 영상 1개 등록 테스트
- 상급 hook 영상 1개 등록 테스트
- 프로 mixed 영상 1개 등록 테스트
- 등록 후 `sparring.html`에서 해당 레벨이 정상 반영되는가

---

## 11. 가장 중요한 실무 결론

이번 작업의 핵심은 이것이다.

- `impact_time`은 **자동 검출보다 관리자 직접 마킹이 우선**이다.
- `dodge_window_ms`, `hitbox_radius`는 **난이도 프리셋 자동 입력**이 가장 효율적이다.
- `required_move`, `target_zone`은 **관리자가 영상 흐름에 맞게 직접 조정**하는 구조가 맞다.
- 완전 자동 분석은 나중 단계로 미루고, 지금은 **admin.html 안에 반자동 마킹 도구**를 먼저 넣는 것이 최선이다.

---

## 12. Codex에 바로 붙여 넣을 짧은 지시문

아래 문장을 그대로 써도 된다.

```md
frontend/admin.html의 스파링 영상 탭에 타임스탬프 마킹 도구를 추가해주세요.

목표:
- 영상을 재생하면서 공격이 닿는 순간을 관리자가 직접 기록할 수 있게 하기
- M 키 또는 버튼으로 현재 video.currentTime을 impact_time으로 추가하기
- difficulty / attack_type 기반 프리셋으로 dodge_window_ms, hitbox_radius 자동 입력하기
- required_move, target_zone은 테이블에서 수정 가능하게 하기
- timestamps JSON 미리보기를 제공하기
- 기존 POST /api/admin/videos 저장 로직에 timestamps 배열 포함시키기

필수 UI:
- 영상 경로 입력
- video player
- 현재 시점 표시
- 재생속도 0.25x / 0.5x / 1x
- 이전 프레임 / 다음 프레임 버튼
- timestamp 추가 / 삭제 / 초기화
- timestamps 편집 테이블
- JSON preview

단축키:
- Space 재생/정지
- M 마킹
- , 이전 프레임
- . 다음 프레임

주의:
- 기존 관리자 화면 구조는 최대한 유지
- 기존 저장 필드와 충돌 없이 통합
- 수정 PUT API가 없으므로 신규 등록 기준으로 먼저 구현
- 오류가 나도 기존 기능이 깨지지 않게 방어적으로 작성
```

