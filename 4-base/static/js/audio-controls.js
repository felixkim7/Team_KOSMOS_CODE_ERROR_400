// ================================
// GLOBAL AUDIO CONTROLS
// ================================

const sfxToggleBtn = document.getElementById("sfx-toggle");
const bgmToggleBtn = document.getElementById("bgm-toggle");

let sfxEnabled = localStorage.getItem("sfxEnabled");
let bgmEnabled = localStorage.getItem("bgmEnabled");

if (sfxEnabled === null) sfxEnabled = "true";
if (bgmEnabled === null) bgmEnabled = "true";

sfxEnabled = sfxEnabled === "true";
bgmEnabled = bgmEnabled === "true";

const pageBgm = document.getElementById("page-bgm");
const ambientSfx = document.getElementById("ambient-sfx");

const alarmLoopSfx = document.getElementById("alarm-loop-sfx");

const loopingSfxTracks = [ambientSfx, alarmLoopSfx].filter(Boolean);

const oneShotSfx = {
  oxygenWarning: new Audio("/static/audio/chatbot/Oxygen_Warning.mp3"),
  oxygenLeak: new Audio("/static/audio/chatbot/Oxygen_Leak.mp3"),
  messageOpen: new Audio("/static/audio/chatbot/Message.mp3"),
  stage3Ambient: new Audio("/static/audio/chatbot/Stage_3_Ambient.mp3"),
  velocityWarning: new Audio("/static/audio/chatbot/Velocity_Warning.mp3"),
  reentry: new Audio("/static/audio/chatbot/Reentry.mp3"),
  divert: new Audio("/static/audio/chatbot/Divert.mp3"),
};



function updateAudioButtonLabels() {
  if (sfxToggleBtn) {
    sfxToggleBtn.textContent = sfxEnabled ? "SFX: ON" : "SFX: OFF";
  }

  if (bgmToggleBtn) {
    bgmToggleBtn.textContent = bgmEnabled ? "BGM: ON" : "BGM: OFF";
  }
}

function applyBgmState() {
  if (!pageBgm) return;

  pageBgm.volume = 0.35;
  pageBgm.loop = true;

  if (bgmEnabled) {
    pageBgm.play().catch(() => {
      // Browser may block autoplay until the user clicks.
    });
  } else {
    pageBgm.pause();
  }
}

function applySfxState() {
  loopingSfxTracks.forEach((track) => {
    track.loop = true;

    if (track.id === "ambient-sfx") {
      track.volume = 0.18;
    }

    if (track.id === "alarm-loop-sfx") {
      track.volume = 0.35;
    }

    if (sfxEnabled) {
      track.play().catch(() => {
        // Browser may block autoplay until the user clicks.
      });
    } else {
      track.pause();
    }
  });
}

function restartAndPlayBgm() {
  if (!pageBgm || !bgmEnabled) return;

  pageBgm.currentTime = 0;
  pageBgm.play().catch(() => {});
}

function restartAndPlayAmbientSfx() {
  if (!ambientSfx || !sfxEnabled) return;

  ambientSfx.currentTime = 0;
  ambientSfx.play().catch(() => {});
}

function playSfx(name, volume = 0.6) {
  if (!sfxEnabled) return;

  const sound = oneShotSfx[name];
  if (!sound) return;

  sound.volume = volume;
  sound.currentTime = 0;
  sound.play().catch(() => {
    // Browser may block sound before first user interaction.
  });
}

function playLoopingSfx(name, volume = 0.6) {
  if (!sfxEnabled) return;

  const sound = oneShotSfx[name];
  if (!sound) return;

  sound.volume = volume;
  sound.loop = true;

  if (sound.paused) {
    sound.currentTime = 0;
  }

  sound.play().catch(() => {
    // Browser may block sound before first user interaction.
  });
}

function stopLoopingSfx(name) {
  const sound = oneShotSfx[name];
  if (!sound) return;

  sound.pause();
  sound.currentTime = 0;
  sound.loop = false;
}

window.playSfx = playSfx;
window.playLoopingSfx = playLoopingSfx;
window.stopLoopingSfx = stopLoopingSfx;


function unlockBgmAfterFirstClick() {
  if (bgmEnabled && pageBgm && pageBgm.paused) {
    pageBgm.play().catch(() => {});
  }

  if (sfxEnabled && ambientSfx && ambientSfx.paused) {
    ambientSfx.play().catch(() => {});
  }

  document.removeEventListener("click", unlockAudioAfterFirstClick);
}

if (sfxToggleBtn) {
  sfxToggleBtn.addEventListener("click", () => {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem("sfxEnabled", String(sfxEnabled));

    updateAudioButtonLabels();

    if (sfxEnabled) {
      restartAndPlayAmbientSfx();

      if (window.stage3SfxShouldBePlaying) {
        playLoopingSfx("stage3Ambient", 0.25);
        playLoopingSfx("velocityWarning", 0.45);
      }

    } else {
      if (ambientSfx) ambientSfx.pause();
      stopLoopingSfx("oxygenLeak");
      stopLoopingSfx("stage3Ambient");
      stopLoopingSfx("velocityWarning");
    }
  });
}

if (bgmToggleBtn) {
  bgmToggleBtn.addEventListener("click", () => {
    bgmEnabled = !bgmEnabled;
    localStorage.setItem("bgmEnabled", String(bgmEnabled));

    updateAudioButtonLabels();

    if (bgmEnabled) {
      restartAndPlayBgm();
    } else if (pageBgm) {
      pageBgm.pause();
    }
  });
}

updateAudioButtonLabels();
applyBgmState();
applySfxState();

document.addEventListener("click", unlockBgmAfterFirstClick);