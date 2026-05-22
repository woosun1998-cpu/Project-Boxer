// =============================================
// sounds.js — Web Audio API 기반 효과음 시스템
// 별도 오디오 파일 없이 프로그래밍으로 사운드 생성
// =============================================

const SoundSystem = (() => {
  let ctx = null;      // AudioContext (첫 상호작용 시 생성)
  let enabled = true;  // 소리 켜기/끄기

  // AudioContext 지연 초기화 (브라우저 정책: 사용자 제스처 필요)
  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // suspended 상태이면 재개
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ─── 공통 사운드 빌더 ───
  // 오실레이터 + 볼륨 엔벨로프로 단순 파형 생성
  function playTone({
    type      = 'sine',    // 파형: sine / square / sawtooth / triangle
    freq      = 440,       // 시작 주파수 (Hz)
    freqEnd   = null,      // 종료 주파수 (glide 효과)
    gain      = 0.3,       // 최대 볼륨 (0~1)
    attack    = 0.01,      // 공격 시간 (초)
    decay     = 0.1,       // 감쇠 시간 (초)
    sustain   = 0.0,       // 서스테인 볼륨
    release   = 0.2,       // 릴리즈 시간 (초)
    duration  = 0.3,       // 전체 길이 (초)
    delay     = 0,         // 시작 지연 (초)
    filterFreq = null,     // 로우패스 필터 주파수
  } = {}) {
    if (!enabled) return;
    try {
      const c = getCtx();
      const now = c.currentTime + delay;

      // 오실레이터
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(freqEnd, 1), now + duration
        );
      }

      // 볼륨 엔벨로프
      const gainNode = c.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain, now + attack);
      gainNode.gain.linearRampToValueAtTime(
        sustain * gain, now + attack + decay
      );
      gainNode.gain.setValueAtTime(sustain * gain, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);

      // 선택적 필터
      let destination = gainNode;
      if (filterFreq) {
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        gainNode.connect(filter);
        filter.connect(c.destination);
      } else {
        gainNode.connect(c.destination);
      }

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      // 소리 실패는 게임 흐름에 영향 없음
    }
  }

  // 노이즈 버스트 (충격음용)
  function playNoise({ gain = 0.2, duration = 0.1, filterFreq = 400, delay = 0 } = {}) {
    if (!enabled) return;
    try {
      const c = getCtx();
      const now = c.currentTime + delay;
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = c.createBufferSource();
      source.buffer = buffer;

      const gainNode = c.createGain();
      gainNode.gain.setValueAtTime(gain, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(c.destination);
      source.start(now);
    } catch (e) {}
  }

  // ─── 공개 사운드 API ───
  return {

    // 소리 켜기/끄기 토글
    toggle() {
      enabled = !enabled;
      return enabled;
    },

    isEnabled() { return enabled; },

    // ─── DODGE 성공: 빠른 휘파람 상승음 ───
    dodge() {
      playTone({ type: 'sine',  freq: 300, freqEnd: 900, gain: 0.25, attack: 0.005, decay: 0.05, release: 0.15, duration: 0.25 });
      playTone({ type: 'sine',  freq: 400, freqEnd: 1100, gain: 0.15, attack: 0.005, decay: 0.05, release: 0.1, duration: 0.2, delay: 0.03 });
    },

    // ─── HIT 피격: 둔탁한 충격음 ───
    hit() {
      playNoise({ gain: 0.5, duration: 0.15, filterFreq: 300 });
      playTone({ type: 'square', freq: 80, freqEnd: 40, gain: 0.3, attack: 0.002, decay: 0.08, release: 0.1, duration: 0.2, filterFreq: 200 });
    },

    // ─── COMBO: 콤보 수에 따라 음이 상승 ───
    combo(count) {
      const baseFreq = 440 + (count * 50);
      playTone({ type: 'triangle', freq: baseFreq, gain: 0.2, attack: 0.005, decay: 0.05, release: 0.1, duration: 0.18 });
      if (count >= 3) {
        // 3콤보 이상: 화음 추가
        playTone({ type: 'triangle', freq: baseFreq * 1.25, gain: 0.12, attack: 0.01, decay: 0.05, release: 0.1, duration: 0.18, delay: 0.04 });
      }
      if (count >= 5) {
        // 5콤보 이상: 반짝이는 고음 추가
        playTone({ type: 'sine', freq: 1200, gain: 0.1, attack: 0.002, decay: 0.05, release: 0.08, duration: 0.12, delay: 0.06 });
      }
    },

    // ─── KO: 극적인 저음 + 리버브 효과 ───
    ko() {
      // 저음 드럼
      playNoise({ gain: 0.6, duration: 0.4, filterFreq: 150 });
      playTone({ type: 'sine', freq: 120, freqEnd: 30, gain: 0.5, attack: 0.002, decay: 0.3, release: 0.5, duration: 0.8 });
      // 고음 크래시
      playNoise({ gain: 0.3, duration: 0.6, filterFreq: 3000, delay: 0.05 });
      // 감소 멜로디
      [440, 330, 220, 165].forEach((f, i) => {
        playTone({ type: 'sawtooth', freq: f, gain: 0.15, attack: 0.01, decay: 0.1, release: 0.2, duration: 0.3, delay: i * 0.12 + 0.1 });
      });
    },

    // ─── 튜토리얼 완료: 환호 팡파르 ───
    tutorialComplete() {
      // 3음 상승 팡파르
      [523, 659, 784, 1047].forEach((f, i) => {
        playTone({ type: 'sine', freq: f, gain: 0.25, attack: 0.01, decay: 0.05, sustain: 0.3, release: 0.2, duration: 0.35, delay: i * 0.12 });
      });
      // 마지막 화음
      [523, 659, 784].forEach((f, i) => {
        playTone({ type: 'sine', freq: f, gain: 0.15, attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.4, duration: 0.8, delay: 0.5 + i * 0.02 });
      });
    },

    // ─── 게임 시작: 카운트다운 beep ───
    countdownBeep(isFinal = false) {
      if (isFinal) {
        // FIGHT! 고음 2단 beep
        playTone({ type: 'sine', freq: 880, gain: 0.3, attack: 0.005, decay: 0.05, release: 0.1, duration: 0.2 });
        playTone({ type: 'sine', freq: 1320, gain: 0.3, attack: 0.005, decay: 0.05, release: 0.1, duration: 0.2, delay: 0.15 });
      } else {
        // 보통 틱
        playTone({ type: 'sine', freq: 440, gain: 0.2, attack: 0.005, decay: 0.03, release: 0.05, duration: 0.12 });
      }
    },

    // ─── DODGE NOW 경고: 날카로운 경보음 ───
    dodgeAlert() {
      playTone({ type: 'square', freq: 600, freqEnd: 800, gain: 0.15, attack: 0.002, decay: 0.03, release: 0.05, duration: 0.12 });
    },

    // ─── 버튼 클릭 UI 음 ───
    click() {
      playTone({ type: 'sine', freq: 660, gain: 0.08, attack: 0.002, decay: 0.03, release: 0.03, duration: 0.08 });
    },

    // ─── 업적/알림 팡파르 ───
    achievement() {
      [659, 784, 880, 1047].forEach((f, i) => {
        playTone({ type: 'triangle', freq: f, gain: 0.2, attack: 0.01, decay: 0.04, sustain: 0.2, release: 0.15, duration: 0.25, delay: i * 0.1 });
      });
    },

    // ─── 에러/실패 음 ───
    error() {
      playTone({ type: 'square', freq: 200, freqEnd: 150, gain: 0.2, attack: 0.005, decay: 0.1, release: 0.15, duration: 0.3 });
    }
  };
})();
