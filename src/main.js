import { scoreShare } from "./share-score.js";
import { createShareCard, canShareImage } from "./share-card.js";
import { t, applyLanguage, toggleLanguage } from "./i18n.js";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { createDinoGame } from "./dino-game.js";
import { createRunnerScene } from "./runner-scene.js";
import { LearnedJumpDetector } from "./learned-jump-detector.js";
import { validateModel } from "./jump-features.js";
import { renderReadyBunny } from "./ready-bunny.js";
import { personReady } from "./person-ready.js";
import { motionHint, prepareMotion } from "./motion-startup.js";
import { menuJump } from "./menu-jump.js";
import { createGameAudio } from "./game-audio.js";
import "./style.css";
const $ = (id) => document.getElementById(id);
const video = $("video"), game = createDinoGame(), detector = new LearnedJumpDetector();
let stream = null, model = null, modelPromise = null, generation = 0, view = null;
let previousVideoTime = -1, lastInference = 0, lastFrame = 0, lastTracked = -Infinity;
let cameraPhase = "off";
let mode = "camera", tracking = { tracked: false, ready: false }, best = 0;
let resumeAt = 0, wasActive = false;
const audio = createGameAudio();
let readyBunnyView = null, sharing = false, shareStatusTimer;
let gameOverAt = -Infinity;
let heardJumps = 0, heardClears = 0, heardDeath = false, heardScore = 0, scoreFlashUntil = 0;
window.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#sound-button")) audio.unlock();
});
window.addEventListener("keydown", (event) => {
  if (!event.target.closest("#sound-button")) audio.unlock();
});
window.addEventListener("click", (event) => {
  if (!event.target.closest("#sound-button")) audio.unlock();
});
try {
  best = Number(localStorage.getItem("bunny-run-accuracy-stars-best")) || 0;
} catch {
}
let cameraStatus = () => t("\u6444\u50CF\u5934\u672A\u5F00\u542F");
const status = (message) => {
  cameraStatus = typeof message === "function" ? message : () => t(message);
  $("camera-status").textContent = cameraStatus();
};
applyLanguage();
$("language-button").onclick = () => {
  toggleLanguage();
  $("camera-status").textContent = cameraStatus();
  updateSensitivity();
};
async function loadModel() {
  if (!modelPromise) modelPromise = (async () => {
    const root = import.meta.env.BASE_URL;
    const vision = await FilesetResolver.forVisionTasks(`${root}vendor/mediapipe/wasm`);
    const response = await fetch(`${root}models/jump-visible-mlp.json`);
    if (!response.ok) throw new Error("Could not load jump model");
    const jump = validateModel(await response.json());
    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${root}models/pose_landmarker_lite.task`, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    return { pose, jump };
  })().catch((error) => {
    modelPromise = null;
    throw error;
  });
  const loaded = await modelPromise;
  detector.setModel(loaded.jump);
  model = loaded.pose;
}
async function listCameras(selected = "") {
  const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  $("device-select").replaceChildren(...cameras.map((d, i) => {
    const option = document.createElement("option");
    option.value = d.deviceId;
    option.textContent = d.label || `${t("\u6444\u50CF\u5934")} ${i + 1}`;
    return option;
  }));
  if (cameras.some((d) => d.deviceId === selected)) $("device-select").value = selected;
  $("device-select").disabled = cameras.length < 2;
}
function resetTracking() {
  detector.reset();
  tracking = { tracked: false, ready: false };
  lastTracked = -Infinity;
  wasActive = false;
  resumeAt = 0;
}
function stopCamera() {
  generation++;
  cameraPhase = "off";
  stream?.getTracks().forEach((t2) => t2.stop());
  stream = null;
  video.srcObject = null;
  video.hidden = true;
  $("pose-overlay").hidden = true;
  previousVideoTime = -1;
  resetTracking();
  $("start-button").disabled = false;
  $("stop-button").disabled = true;
  $("live-dot").classList.remove("active");
  status("\u6444\u50CF\u5934\u672A\u5F00\u542F");
}
function errorMessage(error) {
  if (error.name === "NotAllowedError") return t("\u8BF7\u5728\u6D4F\u89C8\u5668\u5730\u5740\u680F\u5141\u8BB8\u6444\u50CF\u5934\u6743\u9650\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002");
  if (error.name === "NotFoundError") return t("\u6CA1\u6709\u627E\u5230\u6444\u50CF\u5934\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u3002");
  if (error.name === "NotReadableError") return t("\u6444\u50CF\u5934\u6B63\u88AB\u5176\u4ED6\u5E94\u7528\u5360\u7528\uFF0C\u8BF7\u5173\u95ED\u5360\u7528\u540E\u91CD\u8BD5\u3002");
  return `${t("\u6444\u50CF\u5934\u6216\u6A21\u578B\u542F\u52A8\u5931\u8D25")}: ${error.message}`;
}
async function startCamera(deviceId = "") {
  stopCamera();
  mode = "camera";
  const token = generation;
  cameraPhase = "connecting";
  $("start-button").disabled = true;
  $("stop-button").disabled = false;
  status("\u6B63\u5728\u8FDE\u63A5\u6444\u50CF\u5934\u2026");
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error(t("\u8BF7\u7528 localhost \u6216 HTTPS \u6253\u5F00\u3002"));
    const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      ...deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 }
    } });
    if (token !== generation) {
      next.getTracks().forEach((t2) => t2.stop());
      return;
    }
    stream = next;
    video.srcObject = next;
    next.getVideoTracks()[0].addEventListener("ended", () => {
      if (stream === next) {
        stopCamera();
        status("\u6444\u50CF\u5934\u5DF2\u65AD\u5F00\uFF0C\u53EF\u7528\u7A7A\u683C\u7EE7\u7EED\u3002");
      }
    });
    video.hidden = false;
    cameraPhase = "loading";
    status("\u6B63\u5728\u51C6\u5907\u52A8\u4F5C\u8BC6\u522B\u2026");
    await prepareMotion({
      play: () => video.play(),
      load: loadModel,
      isCurrent: () => token === generation,
      ready: () => {
        resetTracking();
        previousVideoTime = -1;
        cameraPhase = "tracking";
        audio.unlock();
        $("live-dot").classList.add("active");
        status("\u8BF7\u8BA9\u5934\u90E8\u6216\u80A9\u8180\u8FDB\u5165\u955C\u5934");
      },
      list: () => listCameras(next.getVideoTracks()[0].getSettings().deviceId)
    });
  } catch (error) {
    if (token !== generation) return;
    stopCamera();
    status(() => errorMessage(error));
  }
}
function infer(now) {
  if (cameraPhase !== "tracking" || !stream || !model || video.readyState < 2 || now - lastInference < 16 || video.currentTime === previousVideoTime || document.hidden) return;
  lastInference = now;
  previousVideoTime = video.currentTime;
  try {
    const points = model.detectForVideo(video, now).landmarks[0];
    tracking = detector.update(points, now, Number($("sensitivity").value));
    if (tracking.tracked) lastTracked = performance.now();
    status(!tracking.tracked ? "\u8BF7\u8BA9\u5934\u90E8\u6216\u80A9\u8180\u8FDB\u5165\u955C\u5934" : !tracking.ready ? "\u8BF7\u7AD9\u7A33\u7247\u523B\uFF0C\u6B63\u5728\u6821\u51C6\u2026" : "\u52A8\u4F5C\u8BC6\u522B\u5DF2\u5C31\u7EEA");
    const started = !sharing && menuJump(game.state.phase, tracking, now, gameOverAt);
    if (started) {
      audio.clear();
      $("game-card").classList.remove("ready-unlocked");
      void $("game-card").offsetWidth;
      $("game-card").classList.add("ready-unlocked");
      startGame("camera", true);
    }
    const canvas = $("pose-overlay"), ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.hidden = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a5e4a0";
    for (const index of [0, 2, 5, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = points?.[index];
      if (!p || p.visibility < 0.55) continue;
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    $("tracking-status").textContent = !tracking.tracked ? t("\u672A\u8BC6\u522B") : !tracking.ready ? t("\u6821\u51C6\u4E2D\u2026") : `${t("\u5DF2\u8BC6\u522B")} ${t(tracking.source)}`;
    if (!sharing && !started && game.state.phase === "playing" && tracking.jump && wasActive && now >= resumeAt) game.jump();
  } catch (error) {
    stopCamera();
    status(() => `${t("\u52A8\u4F5C\u8BC6\u522B\u4E2D\u65AD")}: ${error.message}`);
  }
}
function startGame(nextMode, keepTracking = false) {
  mode = nextMode;
  game.start();
  audio.resetStars();
  heardJumps = heardClears = heardScore = 0;
  heardDeath = false;
  scoreFlashUntil = 0;
  $("game-card").classList.remove("crashed");
  wasActive = false;
  resumeAt = 0;
  $("game-canvas").focus({ preventScroll: true });
  if (mode === "camera" && !keepTracking) resetTracking();
  if (keepTracking) {
    wasActive = true;
    resumeAt = 0;
  }
}
$("start-button").onclick = () => {
  audio.unlock();
  startCamera();
};
$("camera-enable").onclick = () => {
  if (!$("start-button").disabled) {
    audio.unlock();
    startCamera();
  }
};
$("stop-button").onclick = stopCamera;
$("device-select").onchange = (event) => startCamera(event.target.value);
$("play-button").onclick = () => {
  startGame("camera");
  if (!stream) startCamera();
};
$("recalibrate").onclick = resetTracking;
let shareImageUrl = null, shareFile = null, sharePayload = null;
$("share-button").onclick = async () => {
  if (sharing) return;
  sharing = true;
  $("share-button").disabled = true;
  clearTimeout(shareStatusTimer);
  $("share-status").textContent = t("\u6B63\u5728\u751F\u6210\u6210\u7EE9\u5361\u2026");
  try {
    const score = Math.max(best, game.state.score);
    const scenePicture = view.captureShareBackground();
    const blob = await createShareCard(score, t, scenePicture);
    shareFile = new File([blob], "bunny-run-best.png", { type: "image/png" });
    sharePayload = scoreShare(score, t, location.href);
    shareImageUrl = URL.createObjectURL(blob);
    $("share-preview").src = shareImageUrl;
    $("share-download").href = shareImageUrl;
    $("share-image-button").hidden = !canShareImage(navigator, shareFile);
    $("share-image-status").textContent = "";
    $("share-status").textContent = "";
    $("share-dialog").showModal();
  } catch {
    $("share-status").textContent = t("\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21");
    sharing = false;
    $("share-button").disabled = false;
  }
};
$("share-image-button").onclick = async () => {
  if (!shareFile) return;
  $("share-image-button").disabled = true;
  try {
    await navigator.share({ ...sharePayload, files: [shareFile] });
  } catch (error) {
    if (error.name !== "AbortError") $("share-image-status").textContent = t("\u8BF7\u4FDD\u5B58\u56FE\u7247\u540E\u5206\u4EAB");
  } finally {
    $("share-image-button").disabled = false;
  }
};
$("share-dialog").addEventListener("close", () => {
  sharing = false;
  $("share-button").disabled = false;
  shareFile = null;
  sharePayload = null;
  if (shareImageUrl) {
    URL.revokeObjectURL(shareImageUrl);
    shareImageUrl = null;
  }
  $("share-preview").removeAttribute("src");
  $("share-download").removeAttribute("href");
});
$("sound-button").onclick = async () => {
  if (audio.ready || audio.muted) audio.setMuted(!audio.muted);
  await audio.unlock();
};
function updateSensitivity() {
  const value = Number($("sensitivity").value);
  $("sensitivity-value").textContent = value < 0.9 ? t("\u8F83\u4F4E") : value > 1.15 ? t("\u8F83\u9AD8") : t("\u6807\u51C6");
}
$("sensitivity").oninput = () => {
  updateSensitivity();
  resetTracking();
};
window.addEventListener("keydown", (event) => {
  if (!view || !["Space", "ArrowUp"].includes(event.code) || event.target.isContentEditable || /INPUT|SELECT|BUTTON|TEXTAREA|SUMMARY/.test(event.target.tagName)) return;
  event.preventDefault();
  if (event.repeat || document.hidden || sharing) return;
  if (game.state.phase !== "playing") {
    startGame("keyboard");
    return;
  }
  if (stream && (!wasActive || performance.now() < resumeAt)) return;
  game.jump();
});
$("game-canvas").addEventListener("pointerdown", () => {
  if (!sharing && mode === "keyboard" && (!stream || wasActive && performance.now() >= resumeAt)) game.jump();
});
window.addEventListener("pagehide", () => {
  stopCamera();
});
document.addEventListener("visibilitychange", () => {
  lastFrame = 0;
  resetTracking();
});
navigator.mediaDevices?.addEventListener?.("devicechange", () => listCameras($("device-select").value).catch(() => {
}));
function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastFrame ? (now - lastFrame) / 1e3 : 0;
  lastFrame = now;
  const soundButton = $("sound-button");
  soundButton.textContent = audio.muted ? "\u{1F507}" : audio.ready ? "\u{1F50A}" : "\u{1F508}";
  soundButton.title = audio.muted ? t("\u5F00\u542F\u97F3\u6548") : audio.ready ? t("\u9759\u97F3") : t("\u70B9\u51FB\u5F00\u542F\u97F3\u6548");
  soundButton.setAttribute("aria-label", soundButton.title);
  soundButton.setAttribute("aria-pressed", String(audio.muted));
  infer(now);
  const gestureMenu = Boolean(game.state.phase === "idle" || game.state.phase === "over" && now - gameOverAt >= 800);
  const restarting = game.state.phase === "over";
  $("gesture-guide").hidden = !gestureMenu;
  const guideText = motionHint(cameraPhase, tracking, performance.now() - lastTracked < 200, restarting);
  const caption = $("gesture-guide").querySelector("small");
  caption.dataset.i18n = guideText;
  caption.textContent = t(guideText);
  for (const element of [$("gesture-guide"), $("ready-bunny")]) {
    element.dataset.i18nLabel = guideText;
    element.setAttribute("aria-label", t(guideText));
  }
  readyBunnyView?.render(now, gestureMenu && !document.hidden, cameraPhase === "off" || cameraPhase === "tracking" && tracking.ready && tracking.tracked);
  $("gesture-fill").style.height = "0%";
  $("gesture-guide").classList.remove("filling");
  const ready = !document.hidden && personReady(mode, Boolean(stream), tracking, now, lastTracked);
  if (!ready) wasActive = false;
  if (ready && !wasActive) {
    resumeAt = now + (stream && game.state.phase === "playing" ? 600 : 0);
    wasActive = true;
  }
  const active = ready && now >= resumeAt && !sharing;
  game.step(dt, active);
  if (game.state.jumps > heardJumps) {
    audio.jump();
    heardJumps = game.state.jumps;
  }
  if (game.state.score > heardScore) {
    audio.stars(game.state.score - heardScore);
    heardScore = game.state.score;
    heardClears = game.state.cleared;
    scoreFlashUntil = now + 700;
  }
  if (game.state.phase === "over" && !heardDeath) {
    audio.death();
    heardDeath = true;
    gameOverAt = now;
    $("game-card").classList.add("crashed");
  }
  $("score").classList.toggle("score-flash", now < scoreFlashUntil);
  if (game.state.phase === "over" && game.state.score > best) {
    best = game.state.score;
    try {
      localStorage.setItem("bunny-run-accuracy-stars-best", String(best));
    } catch {
    }
  }
  view?.render(game.state, now, game.state.phase === "playing" && !active);
  $("speed").textContent = `${(game.state.speed / 280).toFixed(2)}\xD7`;
  $("score").textContent = String(game.state.score).padStart(5, "0");
  $("best").textContent = String(best).padStart(5, "0");
  $("play-button").textContent = game.state.phase === "idle" ? t("\u5F00\u59CB") : t("\u91CD\u6765");
  const message = !view ? t("\u52A0\u8F7D\u4E2D\u2026") : game.state.phase === "idle" ? "" : game.state.phase === "over" ? "" : !ready ? t(cameraPhase === "loading" ? "\u6B63\u5728\u51C6\u5907\u52A8\u4F5C\u8BC6\u522B\u2026" : tracking.tracked && !tracking.ready ? "\u8BF7\u7AD9\u7A33\u7247\u523B\uFF0C\u6B63\u5728\u6821\u51C6\u2026" : "\u68C0\u6D4B\u4E0D\u5230\u4EBA\u7269") : sharing ? "" : !active ? `${Math.ceil((resumeAt - now) / 1e3)}` : "";
  const cameraAction = Boolean(view && !stream && game.state.phase !== "playing");
  $("camera-enable").hidden = !cameraAction;
  $("camera-enable").disabled = $("start-button").disabled;
  $("camera-enable").textContent = $("start-button").disabled ? t("\u6B63\u5728\u8FDE\u63A5\u2026") : t("\u5F00\u542F\u6444\u50CF\u5934");
  $("game-message").textContent = cameraAction ? "" : message;
  $("game-message").hidden = !$("game-message").textContent;
  $("game-overlay").hidden = !message && !cameraAction && !gestureMenu;
}
renderReadyBunny($("ready-bunny"), $("brand-bunny")).then((result) => {
  readyBunnyView = result;
}).catch(() => {
  $("ready-bunny").hidden = true;
});
createRunnerScene($("game-canvas")).then((scene) => {
  view = scene;
  $("play-button").disabled = false;
  requestAnimationFrame(frame);
  audio.unlock();
}).catch((error) => {
  $("game-message").textContent = `${t("3D \u5154\u5B50\u52A0\u8F7D\u5931\u8D25")}: ${error.message}. ${t("\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002")}`;
});
startCamera();
