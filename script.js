const GRID_SIZE = 8;
const GAME_DURATION = 60;
const BEST_SCORE_KEY = "hanip-suhwak-best-score";

const boardElement = document.querySelector("#board");
const timeElement = document.querySelector("#time-left");
const timerPanel = document.querySelector(".timer-panel");
const timerTrack = document.querySelector("#timer-track");
const timerProgress = document.querySelector("#timer-progress");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const confettiLayer = document.querySelector("#confetti");
const sumElement = document.querySelector("#selection-sum");
const sumPanel = document.querySelector("#sum-panel");
const messageElement = document.querySelector("#game-message");
const startButton = document.querySelector("#start-button");

let numbers = createBoard();
let selectedCells = [];
let selectedSum = 0;
let score = 0;
let bestScore = readBestScore();
let timeRemaining = GAME_DURATION;
let timerId = null;
let isRunning = false;
let activePointerId = null;
let focusIndex = 0;
let celebratedRecord = false;

function createBoard() {
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, () => Math.floor(Math.random() * 9) + 1);
}

function readBestScore() {
  try {
    const savedScore = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isSafeInteger(savedScore) && savedScore > 0 ? savedScore : 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function renderBoard(animate = false, fallDistances = []) {
  const hadBoardFocus = boardElement.contains(document.activeElement);
  const fragment = document.createDocumentFragment();

  for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "grid-row";
    row.setAttribute("role", "row");

    for (let columnIndex = 0; columnIndex < GRID_SIZE; columnIndex += 1) {
      const index = rowIndex * GRID_SIZE + columnIndex;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "grid-cell";
      cell.setAttribute("role", "gridcell");
      cell.dataset.index = String(index);
      cell.style.setProperty("--cell-index", String(index));
      cell.tabIndex = index === focusIndex ? 0 : -1;

      const apple = document.createElement("img");
      apple.className = "apple-icon";
      apple.src = "./apple.svg";
      apple.alt = "";
      apple.draggable = false;
      apple.setAttribute("aria-hidden", "true");

      const number = document.createElement("span");
      number.className = "apple-number";
      number.textContent = numbers[index] ?? "";
      cell.append(apple, number);
      row.append(cell);
    }

    fragment.append(row);
  }

  boardElement.replaceChildren(fragment);
  syncBoardState();

  if (hadBoardFocus) {
    boardElement.querySelector(`[data-index="${focusIndex}"]`)?.focus({ preventScroll: true });
  }

  if (animate) {
    boardElement.classList.add("board--fresh");
    window.setTimeout(() => boardElement.classList.remove("board--fresh"), 500);
  }

  if (fallDistances.length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const rowGap = Number.parseFloat(window.getComputedStyle(boardElement).rowGap) || 0;
    fallDistances.forEach((distance, index) => {
      if (distance === 0) return;

      const cell = boardElement.querySelector(`[data-index="${index}"]`);
      const travelDistance = distance * (cell.getBoundingClientRect().height + rowGap);
      cell.style.zIndex = "1";
      const animation = cell.animate(
        [
          { transform: `translateY(-${travelDistance}px)` },
          { transform: "translateY(0)" },
        ],
        {
          duration: Math.min(720, 250 + distance * 55),
          easing: "cubic-bezier(0.2, 0.75, 0.25, 1)",
        },
      );
      animation.addEventListener("finish", () => { cell.style.zIndex = ""; }, { once: true });
    });
  }
}

function syncBoardState() {
  const selected = new Set(selectedCells);

  boardElement.querySelectorAll(".grid-cell").forEach((cell, index) => {
    const isEmpty = numbers[index] === null;
    const isSelected = selected.has(index);
    cell.classList.toggle("is-empty", isEmpty);
    cell.classList.toggle("is-selected", isSelected);
    cell.querySelector(".apple-number").textContent = numbers[index] ?? "";
    cell.setAttribute("aria-label", isEmpty ? `${index + 1}번 칸, 비어 있음` : `${index + 1}번 칸, ${numbers[index]}`);
    cell.setAttribute("aria-disabled", String(!isRunning || isEmpty));
    cell.setAttribute("aria-selected", String(isSelected));
    cell.tabIndex = index === focusIndex ? 0 : -1;
  });
}

function updateScore() {
  scoreElement.value = String(score);
  scoreElement.textContent = String(score);

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.value = String(bestScore);
    bestScoreElement.textContent = String(bestScore);
    saveBestScore();

    if (!celebratedRecord) {
      celebratedRecord = true;
      showRecordConfetti();
    }
  }
}

function showRecordConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#e75243", "#277849", "#f5c84b", "#5b91ce", "#ed8a55"];
  for (let index = 0; index < 84; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    piece.style.setProperty("--confetti-drift", `${Math.random() * 240 - 120}px`);
    piece.style.setProperty("--confetti-turn", `${Math.random() * 720 - 360}deg`);
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
    confettiLayer.append(piece);
  }
}

function updateTimer() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  timeElement.value = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timeElement.textContent = timeElement.value;
  timerTrack.setAttribute("aria-valuenow", String(timeRemaining));
  timerProgress.style.width = `${(timeRemaining / GAME_DURATION) * 100}%`;
  timerPanel.classList.toggle("is-urgent", timeRemaining <= 10);
}

function setMessage(message, kind = "") {
  messageElement.textContent = message;
  messageElement.classList.toggle("is-success", kind === "success");
  messageElement.classList.toggle("is-error", kind === "error");
}

function updateSelectionDisplay() {
  sumElement.value = String(selectedSum);
  sumElement.textContent = String(selectedSum);
  sumPanel.classList.toggle("is-valid", selectedSum > 0 && selectedSum % 10 === 0);
  syncBoardState();
}

function clearSelection() {
  selectedCells = [];
  selectedSum = 0;
  activePointerId = null;
  updateSelectionDisplay();
}

function startSelection(index, pointerId = null) {
  if (!isRunning || numbers[index] === null) return;

  selectedCells = [index];
  selectedSum = numbers[index];
  activePointerId = pointerId;
  focusIndex = index;
  updateSelectionDisplay();
}

function isAdjacent(firstIndex, secondIndex) {
  const rowDistance = Math.abs(Math.floor(firstIndex / GRID_SIZE) - Math.floor(secondIndex / GRID_SIZE));
  const columnDistance = Math.abs((firstIndex % GRID_SIZE) - (secondIndex % GRID_SIZE));
  return rowDistance + columnDistance === 1;
}

function dropApples() {
  const fallDistances = Array(GRID_SIZE * GRID_SIZE).fill(0);

  for (let column = 0; column < GRID_SIZE; column += 1) {
    let destinationRow = GRID_SIZE - 1;

    for (let row = GRID_SIZE - 1; row >= 0; row -= 1) {
      const sourceIndex = row * GRID_SIZE + column;
      if (numbers[sourceIndex] === null) continue;

      const destinationIndex = destinationRow * GRID_SIZE + column;
      if (sourceIndex !== destinationIndex) {
        numbers[destinationIndex] = numbers[sourceIndex];
        numbers[sourceIndex] = null;
        fallDistances[destinationIndex] = destinationRow - row;
      }
      destinationRow -= 1;
    }

    for (let row = 0; row <= destinationRow; row += 1) {
      numbers[row * GRID_SIZE + column] = Math.floor(Math.random() * 9) + 1;
      fallDistances[row * GRID_SIZE + column] = row + 1;
    }
  }

  return fallDistances;
}

function extendSelection(index) {
  if (!isRunning || numbers[index] === null || selectedCells.length === 0) return;

  const lastIndex = selectedCells.at(-1);
  if (selectedCells.length > 1 && index === selectedCells.at(-2)) {
    selectedCells.pop();
    selectedSum = selectedCells.reduce((sum, cellIndex) => sum + numbers[cellIndex], 0);
  } else if (!selectedCells.includes(index) && isAdjacent(lastIndex, index)) {
    selectedCells.push(index);
    selectedSum += numbers[index];
  } else {
    return;
  }

  focusIndex = index;
  updateSelectionDisplay();
}

function finishSelection() {
  if (selectedCells.length === 0) return;

  if (selectedSum > 0 && selectedSum % 10 === 0) {
    const harvestedCount = selectedCells.length;
    const harvestedSum = selectedSum;
    for (const index of selectedCells) numbers[index] = null;
    const fallDistances = dropApples();
    score += harvestedCount;
    updateScore();
    clearSelection();
    renderBoard(false, fallDistances);
    setMessage(`합계 ${harvestedSum} 수확! +${harvestedCount}점`, "success");
    return;
  }

  const failedSum = selectedSum;
  clearSelection();
  setMessage(`합계 ${failedSum}은 10의 배수가 아니에요.`, "error");
}

function startGame() {
  window.clearInterval(timerId);
  numbers = createBoard();
  selectedCells = [];
  selectedSum = 0;
  score = 0;
  celebratedRecord = false;
  timeRemaining = GAME_DURATION;
  isRunning = true;
  activePointerId = null;
  updateScore();
  updateTimer();
  updateSelectionDisplay();
  renderBoard(true);
  startButton.querySelector("span").textContent = "다시 시작";
  setMessage("좋아요, 숫자를 이어 수확해보세요.");

  timerId = window.setInterval(() => {
    timeRemaining -= 1;
    updateTimer();

    if (timeRemaining <= 0) endGame();
  }, 1000);
}

function endGame() {
  window.clearInterval(timerId);
  timerId = null;
  isRunning = false;
  clearSelection();
  updateTimer();
  syncBoardState();
  startButton.querySelector("span").textContent = "다시 시작";
  setMessage(`시간 종료! 최종 점수는 ${score}점이에요.`);
}

function cellFromPoint(x, y) {
  const target = document.elementFromPoint(x, y)?.closest(".grid-cell");
  return target && boardElement.contains(target) ? target : null;
}

boardElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  const cell = event.target.closest(".grid-cell");
  if (!cell) return;

  const index = Number(cell.dataset.index);
  if (!isRunning || numbers[index] === null) return;

  event.preventDefault();
  startSelection(index, event.pointerId);
  boardElement.setPointerCapture(event.pointerId);
});

boardElement.addEventListener("pointermove", (event) => {
  if (activePointerId !== event.pointerId) return;
  const cell = cellFromPoint(event.clientX, event.clientY);
  if (cell) extendSelection(Number(cell.dataset.index));
});

boardElement.addEventListener("pointerup", (event) => {
  if (activePointerId !== event.pointerId) return;
  finishSelection();
});

boardElement.addEventListener("pointercancel", (event) => {
  if (activePointerId === event.pointerId) clearSelection();
});

boardElement.addEventListener("keydown", (event) => {
  const cell = event.target.closest(".grid-cell");
  if (!cell) return;

  const index = Number(cell.dataset.index);
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  const offsets = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };

  if (offsets[event.key]) {
    event.preventDefault();
    const [rowOffset, columnOffset] = offsets[event.key];
    const nextRow = row + rowOffset;
    const nextColumn = column + columnOffset;
    if (nextRow < 0 || nextRow >= GRID_SIZE || nextColumn < 0 || nextColumn >= GRID_SIZE) return;

    const nextIndex = nextRow * GRID_SIZE + nextColumn;
    focusIndex = nextIndex;
    boardElement.querySelector(`[data-index="${nextIndex}"]`)?.focus();
    if (selectedCells.length > 0) extendSelection(nextIndex);
    syncBoardState();
    return;
  }

  if ((event.key === " " || event.key === "Enter") && isRunning) {
    event.preventDefault();
    if (selectedCells.length > 0) finishSelection();
    else startSelection(index);
  } else if (event.key === "Escape" && selectedCells.length > 0) {
    event.preventDefault();
    clearSelection();
  }
});

startButton.addEventListener("click", startGame);

bestScoreElement.value = String(bestScore);
bestScoreElement.textContent = String(bestScore);
updateTimer();
renderBoard(true);