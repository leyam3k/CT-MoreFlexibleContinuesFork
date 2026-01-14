import {
  Generate,
  chat,
  eventSource,
  event_types,
  messageFormatting,
  saveChatConditional,
  saveSettingsDebounced,
  substituteParams,
} from "../../../../script.js";
import { extension_settings } from "../../../extensions.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { delay } from "../../../utils.js";

const log = (...msg) => console.log("[MFC]", ...msg);
const busy = () => {
  /**@type {HTMLElement} */
  const el = document.querySelector(".mes_stop");
  return el.offsetHeight !== 0 || el.offsetWidth !== 0;
};

let settings;
if (!extension_settings.moreFlexibleContinues) {
  extension_settings.moreFlexibleContinues = {
    showButtons: true,
  };
}
settings = extension_settings.moreFlexibleContinues;

let isListening = false;
let startMes;
const insertContinueData = (mes) => {
  if (!mes.continueHistory || !mes.continueHistory[mes.swipe_id ?? 0]) {
    if (!mes.continueHistory) {
      mes.continueHistory = (mes.swipes ?? [mes.mes]).map((it) => ({
        mes: it,
        swipes: [],
        parent: [],
        active: null,
      }));
    } else if (!mes.continueHistory[mes.swipe_id ?? 0]) {
      mes.continueHistory[mes.swipe_id ?? 0] = {
        mes: mes.swipe_id === undefined ? mes.mes : mes.swipes[mes.swipe_id],
        swipes: [],
        parent: [],
      };
    }
    mes.continueSwipeId = mes.swipe_id ?? 0;
    mes.continueSwipe = mes.continueHistory[mes.swipe_id ?? 0];
    mes.continueHistory[mes.swipe_id ?? 0].active = [
      ...mes.continueSwipe.parent,
      mes.continueSwipeId,
    ];
  }
};
const onGenerationStarted = async (type, namedArgs, dryRun) => {
  log("onGenerationStarted", { type, dryRun });
  if (dryRun || !["continue", "normal", "swipe"].includes(type)) return;
  const mes = chat.at(-1);
  insertContinueData(mes);
  if (type == "continue") {
    isListening = true;
    startMes = mes.mes;
  } else if (type == "swipe") {
    isListening = true;
    startMes = "";
  }
  log("[GENERATION_STARTED]", chat.at(-1).mes, chat.at(-1));
};

let hoverMes;
let hoverOverlay;
const onUnhover = () => {
  // log('[UNHOVER]');
  hoverOverlay?.remove();
  hoverMes?.classList?.remove("mfc--hover");
};
const onHover = () => {
  if (busy()) return;
  // log('[HOVER]');
  const mes = chat.at(-1);
  if (mes.continueSwipe?.parent?.length) {
    let swipe;
    let swipes = mes.continueHistory;
    let text = "";
    mes.continueSwipe.parent.forEach((idx) => {
      swipe = swipes[idx];
      swipes = swipe.swipes;
      text += swipe.mes;
    });
    let messageText = substituteParams(text);
    messageText = messageFormatting(
      messageText,
      mes.name,
      false,
      mes.is_user,
      null
    );
    const el = document.querySelector("#chat .last_mes .mes_text");
    hoverMes = el;
    const html = document.createElement("div");
    hoverOverlay = html;
    html.classList.add("mfc--hoverOverlay");
    html.innerHTML = messageText;
    html.style.padding = window.getComputedStyle(el).padding;
    el.classList.add("mfc--hover");
    el.append(html);
  }
};

const undo = () => {
  if (busy()) return;
  log("[UNDO]");
  const mes = chat.at(-1);
  if (mes.continueSwipe?.parent?.length) {
    let swipeIdx;
    let swipe;
    let swipes = mes.continueHistory;
    swipes[mes.continueSwipe.parent[0]].active.pop();
    let text = "";
    mes.continueSwipe.parent.forEach((idx) => {
      swipeIdx = idx;
      swipe = swipes[idx];
      swipes = swipe.swipes;
      text += swipe.mes;
    });
    mes.mes = text;
    mes.continueSwipe = swipe;
    mes.continueSwipeId = swipeIdx;
    let messageText = substituteParams(text);
    messageText = messageFormatting(
      messageText,
      mes.name,
      false,
      mes.is_user,
      null
    );
    document.querySelector("#chat .last_mes .mes_text").innerHTML = messageText;
    saveChatConditional();
    eventSource.emit(event_types.MESSAGE_EDITED, chat.length - 1);
  }
};
const regenerate = async () => {
  if (busy()) return;
  log("[REGEN]");
  const mes = chat.at(-1);
  if (mes.continueSwipe?.parent?.length) {
    let swipeIdx;
    let swipe;
    let swipes = mes.continueHistory;
    let text = "";
    mes.continueSwipe.parent.forEach((idx) => {
      swipeIdx = idx;
      swipe = swipes[idx];
      swipes = swipe.swipes;
      text += swipe.mes;
    });
    mes.mes = text;
    mes.continueSwipe = swipe;
    mes.continueSwipeId = swipeIdx;
    let messageText = substituteParams(`${text} ...`);
    messageText = messageFormatting(
      messageText,
      mes.name,
      false,
      mes.is_user,
      null
    );
    document.querySelector("#chat .last_mes .mes_text").innerHTML = messageText;
    await Generate("continue");
    log("DONE");
  }
};

/**
 * Calculate version info for a message (current/total)
 * @param {object} mes - The message object
 * @returns {{current: number, total: number}} Version info
 */
const calculateVersionInfo = (mes) => {
  if (!mes.continueHistory || !mes.continueHistory[mes.swipe_id ?? 0]) {
    return { current: 1, total: 1 };
  }

  const swipeHistory = mes.continueHistory[mes.swipe_id ?? 0];
  const active = swipeHistory.active || [mes.swipe_id ?? 0];

  // Count total versions by traversing the tree
  const countVersions = (swipe, depth = 0) => {
    let count = 1; // Count this node
    if (swipe.swipes && swipe.swipes.length > 0) {
      for (const child of swipe.swipes) {
        count += countVersions(child, depth + 1);
      }
    }
    return count;
  };

  // Find current position in the tree
  const findPosition = (
    swipe,
    targetActive,
    currentPath = [],
    positionRef = { pos: 0, found: false }
  ) => {
    positionRef.pos++;

    // Check if current path matches the active path
    const isActive =
      targetActive.length === currentPath.length &&
      currentPath.every((val, idx) => val === targetActive[idx]);

    if (isActive) {
      positionRef.found = true;
      return positionRef.pos;
    }

    if (swipe.swipes && swipe.swipes.length > 0) {
      for (let i = 0; i < swipe.swipes.length; i++) {
        const result = findPosition(
          swipe.swipes[i],
          targetActive,
          [...currentPath, i],
          positionRef
        );
        if (positionRef.found) return result;
      }
    }

    return positionRef.pos;
  };

  const total = countVersions(swipeHistory);

  // If there's only the root with no edits, return 1/1
  if (
    total === 1 &&
    (!swipeHistory.swipes || swipeHistory.swipes.length === 0)
  ) {
    return { current: 1, total: 1 };
  }

  // Find current position
  const posRef = { pos: 0, found: false };
  findPosition(swipeHistory, active.slice(1), [], posRef);
  const current = posRef.found ? posRef.pos : 1;

  return { current, total };
};

const buildSwipeDom = (mesEl) => {
  const dom = document.createElement("div");
  {
    dom.classList.add("mfc--root");
    const undoTrigger = document.createElement("div");
    {
      undoTrigger.classList.add("mfc--undo");
      undoTrigger.classList.add("mfc--action");
      undoTrigger.classList.add("mes_button");
      undoTrigger.classList.add("fa-solid");
      undoTrigger.classList.add("fa-rotate-left");
      undoTrigger.classList.add("interactable");
      undoTrigger.title = "Remove last continue";
      undoTrigger.setAttribute("tabindex", "0");
      undoTrigger.setAttribute("role", "button");
      undoTrigger.addEventListener("pointerenter", onHover);
      undoTrigger.addEventListener("pointerleave", onUnhover);
      undoTrigger.addEventListener("click", () => undo());
      dom.append(undoTrigger);
    }
    const regen = document.createElement("div");
    {
      regen.classList.add("mfc--regen");
      regen.classList.add("mfc--action");
      regen.classList.add("mes_button");
      regen.classList.add("fa-solid");
      regen.classList.add("fa-arrows-rotate");
      regen.classList.add("interactable");
      regen.title = "Regenerate last continue";
      regen.setAttribute("tabindex", "0");
      regen.setAttribute("role", "button");
      regen.addEventListener("pointerenter", onHover);
      regen.addEventListener("pointerleave", onUnhover);
      regen.addEventListener("click", async () => regenerate());
      dom.append(regen);
    }
    const swipesTrigger = document.createElement("div");
    {
      swipesTrigger.classList.add("mfc--swipes");
      swipesTrigger.classList.add("mfc--action");
      swipesTrigger.classList.add("mes_button");
      swipesTrigger.classList.add("fa-solid");
      swipesTrigger.classList.add("fa-layer-group");
      swipesTrigger.classList.add("interactable");
      swipesTrigger.title = "Show continues";
      swipesTrigger.setAttribute("tabindex", "0");
      swipesTrigger.setAttribute("role", "button");
      swipesTrigger.addEventListener("click", async (evt) => {
        if (busy()) return;
        log("[SWIPES]");

        const mes =
          chat[Number(swipesTrigger.closest("[mesid]").getAttribute("mesid"))];
        if (mes.continueHistory && mes.continueHistory[mes.swipe_id ?? 0]) {
          const renderTree = (swipe, act, isRoot = false) => {
            const el = document.createElement("div");
            {
              el.classList.add("mfc--tree");
              el.classList.add("list-group");
              el.classList.add("mfc--ctx-item");
              const txt = document.createElement("div");
              {
                txt.classList.add("mfc--treeText");
                txt.textContent = swipe.mes.trim();
                txt.addEventListener("click", () => {
                  let mesmes = "";
                  let ss = mes.continueHistory;
                  for (const idx of swipe.parent) {
                    const s = ss[idx];
                    mesmes += s.mes;
                    ss = s.swipes;
                  }
                  mesmes += swipe.mes;
                  log("NEW MES", mesmes);
                  mes.mes = mesmes;
                  mes.continueSwipe = swipe;
                  mes.continueSwipeId = ss.indexOf(swipe);
                  mes.continueHistory[mes.swipe_id ?? 0].active = [
                    ...swipe.parent,
                    ss.indexOf(swipe),
                  ];
                  let messageText = substituteParams(mesmes);
                  messageText = messageFormatting(
                    messageText,
                    mes.name,
                    false,
                    mes.is_user,
                    null
                  );
                  swipesTrigger
                    .closest("[mesid]")
                    .querySelector(".mes_text").innerHTML = messageText;
                  saveChatConditional();
                  eventSource.emit(event_types.MESSAGE_EDITED, chat.length - 1);
                  // Update version indicator
                  updateVersionIndicator(swipesTrigger.closest("[mesid]"));
                });
                el.append(txt);
              }
              if (swipe.swipes.length > 0) {
                const ul = document.createElement("ul");
                {
                  ul.classList.add("mfc--children");
                  let i = 0;
                  for (const s of swipe.swipes) {
                    const li = document.createElement("li");
                    {
                      li.classList.add("list-group-item");
                      if (i === act[0]) {
                        li.classList.add("mfc--active");
                      }
                      li.append(
                        renderTree(s, i === act[0] ? act.slice(1) : [])
                      );
                      ul.append(li);
                    }
                    i++;
                  }
                  el.append(ul);
                }
              }
            }
            return el;
          };
          const blocker = document.createElement("div");
          {
            blocker.classList.add("mfc--ctx-blocker");
            blocker.addEventListener("click", () => {
              blocker.remove();
            });
            const content = renderTree(
              mes.continueHistory[mes.swipe_id ?? 0],
              mes.continueHistory[mes.swipe_id ?? 0].active?.slice(1) || [],
              true
            );
            blocker.append(content);
            const rect = swipesTrigger.getBoundingClientRect();
            content.style.setProperty("--triggerTop", `${rect.bottom}px`);
            content.style.setProperty("--triggerRight", `${rect.right}px`);
            content.classList[
              rect.top > window.innerHeight / 2 ? "add" : "remove"
            ]("mfc--flipV");
            document.body.append(blocker);
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
        }
      });
      dom.append(swipesTrigger);
    }
    const versionIndicator = document.createElement("div");
    {
      versionIndicator.classList.add("mfc--version");
      versionIndicator.title = "Version (current/total)";
      // Version text will be set by updateVersionIndicator
      dom.append(versionIndicator);
    }
    const cont = document.createElement("div");
    {
      cont.classList.add("mfc--cont");
      cont.classList.add("mfc--action");
      cont.classList.add("mes_button");
      cont.classList.add("fa-solid");
      cont.classList.add("fa-arrow-right");
      cont.classList.add("interactable");
      cont.title = "Continue";
      cont.setAttribute("tabindex", "0");
      cont.setAttribute("role", "button");
      cont.addEventListener("click", async () => {
        if (busy()) return;
        log("[CONTINUE]");
        await Generate("continue");
        log("DONE");
      });
      dom.append(cont);
    }
  }
  return dom;
};

/**
 * Update the version indicator for a specific message element
 * @param {HTMLElement} mesEl - The message element
 */
const updateVersionIndicator = (mesEl) => {
  const mesId = Number(mesEl.getAttribute("mesid"));
  const mes = chat[mesId];
  if (!mes) return;

  const versionEl = mesEl.querySelector(".mfc--version");
  if (!versionEl) return;

  const { current, total } = calculateVersionInfo(mes);
  versionEl.textContent = `${current}/${total}`;

  // Show/hide based on whether there are multiple versions
  if (total > 1) {
    versionEl.classList.add("mfc--hasVersions");
  } else {
    versionEl.classList.remove("mfc--hasVersions");
  }
};
const makeSwipeDom = () => {
  for (const mes of chat) {
    insertContinueData(mes);
  }
  const els = Array.from(document.querySelectorAll("#chat .mes"));
  for (const el of els) {
    // Find the extraMesButtons container within mes_buttons
    const extraMesButtons = el.querySelector(".extraMesButtons");
    if (!extraMesButtons) continue;

    // Check if buttons already exist
    if (!el.querySelector(".mfc--root")) {
      const dom = buildSwipeDom(el);
      // Insert at the beginning of extraMesButtons (before mes_translate)
      const firstChild = extraMesButtons.firstChild;
      if (firstChild) {
        extraMesButtons.insertBefore(dom, firstChild);
      } else {
        extraMesButtons.append(dom);
      }
    }

    // Update version indicator for this message
    updateVersionIndicator(el);
  }
};

const onStopped = () => {
  isListening = false;
};
const onMessageDone = async (mesIdx) => {
  makeSwipeDom();
  const mes = chat[mesIdx];
  insertContinueData(mes);
  if (!isListening) return;
  if (mes.mes == startMes) return;
  if (mes.mes == "...") return;
  isListening = false;
  log(mes.mes, mes);
  // eslint-disable-next-line no-unused-vars
  if (startMes == "") {
    mes.continueHistory[mes.swipe_id ?? 0].mes = mes.mes;
  } else {
    const [_, ...rest] = mes.mes.split(startMes);
    const newMes = rest.join(startMes);
    const swipe = {
      mes: newMes,
      swipes: [],
      parent: [...mes.continueSwipe.parent, mes.continueSwipeId],
    };
    let swipes = mes.continueHistory;
    swipe.parent.forEach((it) => (swipes = swipes[it].swipes));
    swipes.push(swipe);
    mes.continueSwipe = swipe;
    mes.continueSwipeId = swipes.length - 1;
    mes.continueHistory[mes.swipe_id ?? 0].active = [
      ...mes.continueSwipe.parent,
      mes.continueSwipeId,
    ];
    log(mes);
  }
  makeSwipeDom();
};

const onMessageEdited = async (mesIdx) => {
  log("[MESSAGE_EDITED]", mesIdx);

  // Ensure continueHistory exists for this message
  if (!chat[mesIdx].continueHistory) {
    insertContinueData(chat[mesIdx]);
  }

  // Check if there's an active path to process
  const swipeId = chat[mesIdx].swipe_id ?? 0;
  if (!chat[mesIdx].continueHistory[swipeId]?.active) {
    // Initialize if no active path exists
    chat[mesIdx].continueHistory[swipeId].active = [swipeId];
  }

  // check how much of the beginning of the message is still intact
  let swipes = chat[mesIdx].continueHistory;
  let swipe;
  let text = "";
  const active = [];
  for (const idx of chat[mesIdx].continueHistory[swipeId].active) {
    swipe = swipes[idx];
    if (!swipe) break;
    const newText = `${text}${swipes[idx].mes}`;
    if (
      !chat[mesIdx].mes.startsWith(newText) &&
      !(swipe.parent.length == 0 && newText == "")
    ) {
      const newSwipe = {
        mes: chat[mesIdx].mes.substring(text.length),
        parent: [...swipe.parent],
        swipes: [],
      };
      if (swipe.parent.length == 0) {
        const newIdx = 1;
        newSwipe.parent = [swipeId];
        const unshiftParent = (childSwipes) => {
          for (const childSwipe of childSwipes) {
            childSwipe.parent.unshift(swipeId);
            unshiftParent(childSwipe.swipes);
          }
        };
        unshiftParent(swipes);
        swipes[idx] = {
          mes: "",
          parent: [],
          swipes: [swipe, newSwipe],
          active: [swipeId, newIdx],
        };
        delete swipe.active;
        chat[mesIdx].continueSwipe = newSwipe;
        chat[mesIdx].continueSwipeId = newIdx;
        text = chat[mesIdx].mes;
      } else {
        const newIdx = swipes.length;
        swipes.push(newSwipe);
        active.push(newIdx);
        chat[mesIdx].continueHistory[swipeId].active = active;
        chat[mesIdx].continueSwipe = newSwipe;
        chat[mesIdx].continueSwipeId = newIdx;
        text = chat[mesIdx].mes;
      }
      break;
    }
    active.push(idx);
    swipes = swipe.swipes;
    text = newText;
  }

  if (swipe && text.length < chat[mesIdx].mes.length) {
    const newSwipe = {
      mes: chat[mesIdx].mes.substring(text.length),
      parent: [...swipe.parent, active.slice(-1)[0]],
      swipes: [],
    };
    swipe.swipes.push(newSwipe);
    chat[mesIdx].continueSwipe = newSwipe;
    chat[mesIdx].continueSwipeId = swipe.swipes.length - 1;
    chat[mesIdx].continueHistory[swipeId].active = [
      ...newSwipe.parent,
      swipe.swipes.length - 1,
    ];
  }

  // Update the version indicator for the edited message
  const mesEl = document.querySelector(`#chat .mes[mesid="${mesIdx}"]`);
  if (mesEl) {
    updateVersionIndicator(mesEl);
  }
};

const onSwipe = async (mesId) => {
  log("swipe");
  let isGen = false;
  eventSource.once(event_types.GENERATION_STARTED, () => (isGen = true));
  await delay(100);
  const mes = chat[mesId];
  if (isGen) {
    // a vanilla swipe simply copies the previous swipe's `extra` object
    // if the previous swipe was a favorite the new one will be marked as favorite, too...
    if (!mes.swipe_info) {
      mes.swipe_info = [];
    }
    if (!mes.swipe_info[mes.swipe_id]) {
      mes.swipe_info[mes.swipe_id] = {};
    }
    if (!mes.swipe_info[mes.swipe_id].extra) {
      mes.swipe_info[mes.swipe_id].extra = {};
    }
    mes.swipe_info[mes.swipe_id].isFavorite = false;
  }
  if (mes.continueHistory) {
    let swipes = mes.continueHistory;
    let swipe;
    let swipeIdx;
    mes.continueHistory[mes.swipe_id ?? 0]?.active?.forEach((idx) => {
      swipeIdx = idx;
      swipe = swipes[idx];
      swipes = swipe.swipes;
    });
    mes.continueSwipeId = swipeIdx ?? mes.swipe_id ?? 0;
    mes.continueSwipe = swipe;
  }
};

const onChatChanged = () => {
  // migrate swipe favorite from extra to swipe info
  {
    chat.forEach((mes, mesIdx) => {
      if (mes.swipe_info?.length) {
        mes.swipe_info.forEach((swipe, swipeIdx) => {
          if (
            swipe.extra &&
            Object.prototype.hasOwnProperty.call(swipe.extra, "isFavorite")
          ) {
            log("[FAV->]", mesIdx, swipeIdx, swipe.extra.isFavorite);
            swipe.isFavorite = true;
            delete swipe.extra.isFavorite;
          }
        });
      }
    });
  }
  makeSwipeDom();
};

SlashCommandParser.addCommandObject(
  SlashCommand.fromProps({
    name: "continue-undo",
    callback: () => {
      undo();
      return "";
    },
    helpString: "Undo last continue.",
  })
);
SlashCommandParser.addCommandObject(
  SlashCommand.fromProps({
    name: "continue-regenerate",
    callback: async () => {
      await regenerate();
      return "";
    },
    helpString: "Regenerate last continue.",
  })
);

eventSource.on(event_types.APP_READY, () => {
  onChatChanged();

  eventSource.on(event_types.GENERATION_STARTED, async (...args) => {
    log("GENERATION_STARTED", args);
    onGenerationStarted(...args);
    return;
  });
  eventSource.on(event_types.GENERATION_STOPPED, async (...args) => {
    log("GENERATION_STOPPED", args);
    onStopped();
    return;
  });
  eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, async (...args) => {
    log("CHARACTER_MESSAGE_RENDERED", args);
    onMessageDone(...args);
    return;
  });
  eventSource.on(event_types.USER_MESSAGE_RENDERED, async (...args) => {
    log("USER_MESSAGE_RENDERED", args);
    onMessageDone(...args);
    return;
  });
  eventSource.on(event_types.MESSAGE_EDITED, async (...args) => {
    log("MESSAGE_EDITED", args);
    onMessageEdited(...args);
    return;
  });
  eventSource.on(event_types.CHAT_CHANGED, async (...args) => {
    log("CHAT_CHANGED", args);
    onChatChanged();
    return;
  });
  eventSource.on(event_types.MESSAGE_DELETED, async (...args) => {
    log("MESSAGE_DELETED", args);
    return makeSwipeDom(...args);
  });
  eventSource.on(event_types.MESSAGE_SWIPED, async (...args) => {
    log("MESSAGE_SWIPED", args);
    onSwipe(...args);
    return;
  });
});
