console.log("챗봇 JS 로드 완료");

// ================================
// DOM ELEMENTS
// ================================

// Supports both old skeleton `.chat-area` and new game UI `.game-shell`
const gameShell = document.querySelector(".game-shell");
const chatArea = document.querySelector(".chat-area");

const rootElement = gameShell || chatArea;

const username = rootElement ? rootElement.dataset.username || "사용자" : "사용자";
const usergender = rootElement ? rootElement.dataset.usergender || "미정" : "미정";

const chatLog = document.getElementById("chat-log");
const userMessageInput = document.getElementById("user-message");
const sendBtn = document.getElementById("send-btn");

// Existing optional media buttons
const videoBtn = document.getElementById("videoBtn");
const imageBtn = document.getElementById("imageBtn");

// New game UI elements
const airLevelText = document.getElementById("air-level");
const timerCard = document.getElementById("timer-card");
const timerValue = document.getElementById("timer-value");

const cargoBtn = document.getElementById("cargo-btn");
const cockpitBtn = document.getElementById("cockpit-btn");

const hintRow = document.getElementById("hint-row");
const areaViewer = document.getElementById("area-viewer");
const areaTitle = document.getElementById("area-title");
const areaImage = document.getElementById("area-image");
const areaPlaceholder = document.getElementById("area-placeholder");

// ================================
// GAME STATE
// ================================

let currentStage = 1;
let airLevel = 20;
let timerStarted = false;
let timerSeconds = 10 * 60;
let openedArea = null;
let messageIdCounter = 0;

const areaData = {
  living: {
    title: "LIVING AREA",
    image: "/static/images/chatbot/living_area.png",
  },
  cargo: {
    title: "CARGO BAY",
    image: "/static/images/chatbot/cargo_bay.png",
  },
  cockpit: {
    title: "COCKPIT",
    image: "/static/images/chatbot/cockpit.png",
  },
};

const hintsByStage = {
  1: [
    "내가 얼마나 잤지?",
    "지금 어디쯤이야?",
    "산소는 왜 떨어진 거지?",
  ],
  2: [
    "화물칸에 뭐가 실려 있어?",
    "산소 탱크가 손상된 것 같은데?",
    "왜 비상 식량이 거의 없지?",
  ],
  3: [
    "속도가 너무 빠른데?",
    "너 지구로 가려는 목적이 뭐야?",
    "궤도 좌표를 다시 보여줘.",
  ],
};

// ================================
// MESSAGE FUNCTIONS
// ================================

function appendMessage(sender, text, imageSrc = null) {
  const messageId = `msg-${messageIdCounter++}`;
  const messageElem = document.createElement("div");

  messageElem.classList.add("message", sender);
  messageElem.id = messageId;

  if (sender === "user") {
    messageElem.textContent = text;
  } else {
    if (imageSrc) {
      const botImg = document.createElement("img");
      botImg.classList.add("bot-big-img");
      botImg.src = imageSrc;
      botImg.alt = "챗봇 이미지";
      messageElem.appendChild(botImg);
    }

    const textContainer = document.createElement("div");
    textContainer.classList.add("bot-text-container");
    textContainer.textContent = text;
    messageElem.appendChild(textContainer);
  }

  if (chatLog) {
    chatLog.appendChild(messageElem);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  return messageId;
}

function removeMessage(messageId) {
  const elem = document.getElementById(messageId);

  if (elem) {
    elem.remove();
  }
}

// ================================
// GAME UI FUNCTIONS
// ================================

function updateHints() {
  if (!hintRow) return;

  hintRow.innerHTML = "";

  const hints = hintsByStage[currentStage] || hintsByStage[1];

  hints.forEach((question) => {
    const btn = document.createElement("button");
    btn.className = "hint-btn";
    btn.dataset.question = question;
    btn.textContent = question;
    hintRow.appendChild(btn);
  });
}

function unlockStage(stage) {
  currentStage = Math.max(currentStage, stage);

  if (currentStage >= 2 && cargoBtn) {
    cargoBtn.classList.remove("locked");
  }

  if (currentStage >= 3) {
    if (cockpitBtn) {
      cockpitBtn.classList.remove("locked");
    }

    startTimer();
  }

  updateHints();
}

function reduceAirLevel(amount = 1) {
  if (!airLevelText) return;

  airLevel = Math.max(0, airLevel - amount);
  airLevelText.textContent = airLevel;

  if (airLevel <= 10) {
    airLevelText.style.color = "#ff9caf";
  }

  if (airLevel <= 5) {
    appendMessage("system", "SYSTEM: CRITICAL OXYGEN WARNING");
  }
}

function startTimer() {
  if (timerStarted) return;
  if (!timerCard || !timerValue) return;

  timerStarted = true;
  timerCard.classList.remove("hidden");

  setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);

    const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const seconds = String(timerSeconds % 60).padStart(2, "0");

    timerValue.textContent = `${minutes}:${seconds}`;

    if (timerSeconds === 0) {
      appendMessage("system", "SYSTEM: EARTH ORBIT COLLISION IMMINENT");
    }
  }, 1000);
}

function toggleArea(areaKey) {
  if (!areaViewer || !areaTitle || !areaImage || !areaPlaceholder) return;

  if (openedArea === areaKey) {
    areaViewer.classList.remove("active");
    openedArea = null;
    return;
  }

  const area = areaData[areaKey];

  if (!area) return;

  openedArea = areaKey;

  areaTitle.textContent = area.title;
  areaImage.src = area.image;
  areaImage.style.display = "block";
  areaPlaceholder.style.display = "none";

  areaImage.onerror = () => {
    areaImage.style.display = "none";
    areaPlaceholder.style.display = "block";
  };

  areaViewer.classList.add("active");
}

function checkStageTriggers(message) {
  if (
    message.includes("화물칸") ||
    message.includes("비상 식량") ||
    message.includes("산소 탱크") ||
    message.includes("산소탱크") ||
    message.includes("화물")
  ) {
    unlockStage(2);
  }

  if (
    message.includes("조종실") ||
    message.includes("궤도") ||
    message.includes("속도") ||
    message.includes("지구") ||
    message.includes("회항")
  ) {
    unlockStage(3);
  }
}

// ================================
// MESSAGE SEND FUNCTION
// ================================

async function sendMessage(isInitial = false) {
  let message;

  if (isInitial) {
    message = "init";
  } else {
    if (!userMessageInput) return;

    message = userMessageInput.value.trim();

    if (!message) return;

    appendMessage("user", message);
    userMessageInput.value = "";

    if (areaViewer) {
      areaViewer.classList.remove("active");
      openedArea = null;
    }

    reduceAirLevel(1);
    checkStageTriggers(message);
  }

  const loadingId = appendMessage("bot", "생각 중...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        username: username,
        usergender: usergender,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    removeMessage(loadingId);

    let replyText;
    let imagePath;

    if (typeof data.reply === "object" && data.reply !== null) {
      replyText = data.reply.reply || "";
      imagePath = data.reply.image || null;
    } else {
      replyText = data.reply;
      imagePath = null;
    }

    appendMessage("bot", replyText || "응답을 생성할 수 없습니다.", imagePath);
  } catch (err) {
    console.error("메시지 전송 에러:", err);

    removeMessage(loadingId);

    appendMessage(
      "system",
      "SYSTEM ERROR: HS-400 응답 모듈과 연결할 수 없습니다."
    );
  }
}

// ================================
// INPUT EVENTS
// ================================

if (userMessageInput) {
  userMessageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", () => sendMessage());
}

// ================================
// LOCATION BUTTON EVENTS
// ================================

document.querySelectorAll(".location-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("locked")) return;
    toggleArea(btn.dataset.area);
  });
});

// ================================
// HINT BUTTON EVENTS
// ================================

if (hintRow) {
  hintRow.addEventListener("click", (event) => {
    if (event.target.classList.contains("hint-btn")) {
      userMessageInput.value = event.target.dataset.question;
      userMessageInput.focus();
    }
  });
}

// ================================
// MODAL FUNCTIONS FROM ORIGINAL JS
// ================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "block";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "none";
  }
}

if (videoBtn) {
  videoBtn.addEventListener("click", () => openModal("videoModal"));
}

if (imageBtn) {
  imageBtn.addEventListener("click", () => openModal("imageModal"));
}

document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modalId = btn.dataset.closeModal;
    closeModal(modalId);
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});

// ================================
// INITIAL LOAD
// ================================

window.addEventListener("load", () => {
  console.log("페이지 로드 완료");

  if (airLevelText) {
    airLevelText.textContent = airLevel;
  }

  updateHints();

  setTimeout(() => {
    if (chatLog && chatLog.childElementCount === 0) {
      console.log("초기 메시지 요청");
      sendMessage(true);
    }
  }, 500);
});