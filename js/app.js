"use strict";
RG.startApp = () => {
  const E = RG.el;
  const engine = new RG.Engine({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const root = document.getElementById("app");
  const adminEnabled =
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  let stopped = false;
  let tab = "roll",
    audioContext = null,
    tickBuffer = null,
    frame = 0,
    nextTick = 0,
    started = 0,
    activeRoll = null,
    starClicks = 0,
    visibleRarity = null;
  const beep = new Audio("assets/lichess-beep.mp3");
  beep.volume = 0.6;
  const shell = E("div", "shell");
  const sidebar = E("aside", "sidebar");
  const currency = RG.CurrencyStrip();
  const sidebarStats = E("div", "sidebar-stats");
  const sidebarStatRows = RG.sidebarStats.map((definition) =>
    RG.SidebarStat(definition),
  );
  sidebarStatRows.forEach((view) => sidebarStats.append(view.node));
  const nav = E("nav", "nav");
  nav.setAttribute("aria-label", "Game views");
  const rollTab = RG.Button("Roll", () => setTab("roll"), "nav-button active");
  const collectionTab = RG.Button(
    "Collection",
    () => setTab("collection"),
    "nav-button",
  );
  const upgradesTab = RG.Button("???", () => setTab("upgrades"), "nav-button");
  const historyTab = RG.Button("???", () => setTab("history"), "nav-button");
  historyTab.disabled = true;
  nav.append(rollTab, collectionTab, upgradesTab, historyTab);
  const sidebarFooter = E("div", "sidebar-footer");
  const sound = RG.Button(
    "",
    () => {
      engine.setSound(!engine.state.sound);
      if (!engine.state.sound) stopSound();
      update();
    },
    "settings-sound",
  );
  const saveStatus = E("span", "save-status");
  const settingsButton = RG.Button(
    "Settings",
    () => {
      saveFeedback.textContent = engine.saveMessage;
      saveDialog.showModal();
    },
    "sound-button",
  );
  sidebarFooter.append(settingsButton, saveStatus);
  sidebar.append(currency.node, sidebarStats, nav, sidebarFooter);
  const main = E("main", "main");
  const header = E("header", "header");
  const bestBlock = E("div", "best-block");
  bestBlock.append(E("span", "eyebrow", "Your Rarity"));
  const best = E("div", "best");
  const bestAnchor = E("div", "best-anchor");
  const miniPreview = E("div", "mini-roll-preview");
  miniPreview.hidden = true;
  miniPreview.setAttribute("aria-hidden", "true");
  bestAnchor.append(best, miniPreview);
  bestBlock.append(bestAnchor);
  const remoteRoll = RG.Button("", () => startRoll(true), "remote-roll");
  remoteRoll.append(RG.DiceIcon());
  remoteRoll.hidden = true;
  remoteRoll.setAttribute("aria-label", "Remote roll");
  bestBlock.append(remoteRoll);
  header.append(bestBlock);
  const achievementsButton = RG.Button(
    "?",
    () => setTab(tab === "achievements" ? "roll" : "achievements"),
    "achievements-button",
  );
  header.append(achievementsButton);
  const rollView = E("section", "roll-view");
  rollView.setAttribute("aria-label", "Roll a rarity");
  const stage = E("div", "stage");
  const rays = E("div", "rays");
  rays.setAttribute("aria-hidden", "true");
  const display = E("div", "rarity-display");
  display.setAttribute("role", "button");
  display.setAttribute("aria-label", "Rarity");
  display.tabIndex = -1;
  display.addEventListener("click", () => {
    if (visibleRarity !== null) {
      engine.recordAction("clicked-rarity");
      update();
    }
  });
  display.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      display.click();
    }
  });
  const rewardLabel = E("div", "reward-label");
  const rarityOdds = E("div", "roll-rarity-odds");
  rarityOdds.setAttribute("aria-hidden", "true");
  const announcement = E("div", "sr-only");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  const revealCenter = E("div", "reveal-center");
  revealCenter.append(rays, display);
  const newRarityLabel = E("div", "new-rarity-label", "NEW RARITY!");
  newRarityLabel.hidden = true;
  newRarityLabel.setAttribute("aria-hidden", "true");
  revealCenter.append(newRarityLabel);
  stage.append(revealCenter, rarityOdds, rewardLabel, announcement);
  const controls = E("div", "roll-controls");
  const progress = E("div", "progress sr-only");
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Roll progress");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  const progressFill = E("div", "progress-fill");
  progress.append(progressFill);
  const rollButton = RG.Button("", () => startRoll(false), "roll-button");
  const buttonText = E("span", "", "Roll Rarity");
  rollButton.append(buttonText);
  const rollInfo = E("div", "roll-info");
  rollInfo.hidden = true;
  const cooldownStat = RG.Stat("Roll cooldown"),
    multiplierStat = RG.Stat("Point multiplier"),
    totalStat = RG.Stat("Total rolls");
  const discoveryStat = RG.Stat("Discovery points"),
    passiveStat = RG.Stat("Passive Points");
  rollInfo.append(
    cooldownStat.node,
    multiplierStat.node,
    totalStat.node,
    discoveryStat.node,
    passiveStat.node,
  );
  controls.append(progress, rollButton, rollInfo);
  rollView.append(stage, controls);
  const collection = E("section", "collection-view");
  collection.hidden = true;
  collection.setAttribute("aria-label", "Collection");
  const sortControls = E("div", "collection-sort");
  sortControls.hidden = true;
  const sortLabel = E("label", "", "Sort");
  const sortSelect = E("select");
  sortSelect.id = "collection-sort";
  sortLabel.htmlFor = sortSelect.id;
  for (const [value, label] of [
    ["rarity", "Rarity: low to high"],
    ["rarity-desc", "Rarity: high to low"],
    ["name", "Name"],
    ["count", "Most collected"],
  ]) {
    const option = E("option", "", label);
    option.value = value;
    sortSelect.append(option);
  }
  sortSelect.addEventListener("change", () => {
    if (engine.setCollectionSort(sortSelect.value)) update();
  });
  sortControls.append(sortLabel, sortSelect);
  const grid = E("div", "rarity-list");
  collection.append(sortControls, grid);
  const collectionRows = RG.rarities.map((rarity) => {
    const row = E("article", "rarity-card");
    const label = E("div", "collection-rarity");
    const count = E("span", "rarity-count");
    const odds = E("span", "rarity-odds");
    const payout = E("span", "rarity-payout");
    const stamp = E("img", "wax-stamp");
    stamp.src = "assets/wax-seal.png";
    stamp.alt = "Seal of Approval";
    stamp.hidden = true;
    row.append(label, odds, payout, count, stamp);
    grid.append(row);
    return { id: rarity.id, row, label, count, odds, payout, stamp };
  });
  const upgradeView = E("section", "upgrade-view");
  upgradeView.hidden = true;
  upgradeView.setAttribute("aria-label", "Upgrades");
  const categoryNav = E("nav", "category-nav");
  categoryNav.setAttribute("aria-label", "Upgrade categories");
  const mainCategory = RG.Button(
    "Main",
    () => setShopCategory("main"),
    "category-button active",
  );
  mainCategory.setAttribute("aria-current", "page");
  const repeatableCategory = RG.Button(
    "???",
    () => setShopCategory("repeatables"),
    "category-button",
  );
  repeatableCategory.disabled = true;
  categoryNav.append(mainCategory, repeatableCategory);
  const upgradeList = E("div", "upgrade-list");
  const upgradeRows = RG.upgrades.map((upgrade) =>
    RG.Upgrade(upgrade, engine, (id) => {
      if (engine.buy(id)) {
        tick(true);
        update();
      }
    }),
  );
  upgradeRows.forEach((view) => upgradeList.append(view.node));
  const repeatableList = E("div", "upgrade-list repeatable-grid");
  repeatableList.hidden = true;
  const repeatableRows = RG.repeatables.map((upgrade) =>
    RG.RepeatableUpgrade(upgrade, engine, (id) => {
      if (!engine.buyRepeatable(id)) return false;
      tick(true);
      update();
      return true;
    }),
  );
  repeatableRows.forEach((view) => repeatableList.append(view.node));
  upgradeView.append(categoryNav, upgradeList, repeatableList);
  function setShopCategory(category) {
    if (category === "repeatables" && !engine.repeatablesUnlocked) return;
    upgradeList.hidden = category !== "main";
    repeatableList.hidden = category !== "repeatables";
    mainCategory.classList.toggle("active", category === "main");
    repeatableCategory.classList.toggle("active", category === "repeatables");
    mainCategory.setAttribute(
      "aria-current",
      category === "main" ? "page" : "false",
    );
    repeatableCategory.setAttribute(
      "aria-current",
      category === "repeatables" ? "page" : "false",
    );
  }
  const achievementsView = E("section", "achievements-view");
  achievementsView.hidden = true;
  achievementsView.setAttribute("aria-label", "Achievements");
  const historyView = E("section", "history-view");
  historyView.hidden = true;
  historyView.setAttribute("aria-label", "Roll history");
  let historyKey = "";
  const achievementRows = RG.achievements.map((item) =>
    RG.AchievementTile(item),
  );
  achievementRows.forEach((view) => achievementsView.append(view.node));
  const toasts = RG.ToastSystem();
  const admin = E("dialog", "admin-panel");
  admin.setAttribute("aria-label", "Admin panel");
  const adminHeading = E("div", "admin-heading");
  adminHeading.append(
    E("span", "", "Admin panel"),
    RG.Button("Close", () => admin.close()),
  );
  const adminActions = E("div", "admin-actions");
  const grant100 = RG.Button("+100 Points", () => {
    if (engine.grantPoints(100)) update();
  });
  const grant1000 = RG.Button("+1,000 Points", () => {
    if (engine.grantPoints(1000)) update();
  });
  const fastRolls = RG.Button("Fast rolls off", () => {
    if (!engine.rolling) {
      engine.fastRolls = !engine.fastRolls;
      update();
    }
  });
  function exportProgress() {
    engine.accrue();
    engine.save();
    let json = JSON.stringify(engine.state, null, 2);
    if (engine.readOnly) {
      try {
        json = engine.storage.getItem("rarity.save.v1") || json;
      } catch {}
    }
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = E("a");
    link.href = url;
    link.download = "rarity-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const exportSave = RG.Button("Export save", exportProgress);
  adminActions.append(grant100, grant1000, fastRolls, exportSave);
  const testButtons = E("div", "toast-tests");
  for (const grade of RG.grades)
    testButtons.append(
      RG.Button(`Test ${grade}`, () =>
        toasts.show({ ...RG.achievements[0], name: "Toast test", grade }),
      ),
    );
  admin.append(
    adminHeading,
    adminActions,
    E("p", "", "Toast tests"),
    testButtons,
  );
  if (adminEnabled)
    currency.icon.addEventListener("click", () => {
      if (++starClicks === 10) {
        starClicks = 0;
        admin.showModal();
        toasts.mount(admin);
      }
    });
  admin.addEventListener("close", () => toasts.mount(root));
  const saveDialog = E("dialog", "settings-dialog");
  saveDialog.setAttribute("aria-label", "Settings");
  const saveHeading = E("div", "admin-heading");
  saveHeading.append(
    E("span", "", "Settings"),
    RG.Button("Close", () => saveDialog.close()),
  );
  const importFile = E("input");
  importFile.type = "file";
  importFile.accept = ".json,application/json";
  importFile.hidden = true;
  const importButton = RG.Button("Import save", () => importFile.click());
  const saveFeedback = E("p", "save-feedback");
  saveFeedback.setAttribute("role", "status");
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    if (!file) return;
    try {
      if (engine.rolling) throw new Error("Finish the current roll first.");
      if (file.size > 1024 * 1024) throw new Error("Save file is too large.");
      const parsed = JSON.parse(await file.text());
      engine.validate(parsed);
      if (
        !confirm(
          "Replace your progress with this save? Your current save will be downloaded first.",
        )
      )
        return;
      exportProgress();
      engine.importSave(parsed);
      clearReveal();
      update();
      saveDialog.close();
    } catch (error) {
      saveFeedback.textContent =
        error instanceof SyntaxError
          ? "This file is not valid JSON."
          : error.message;
    } finally {
      importFile.value = "";
    }
  });
  const saveActions = E("div", "settings-actions");
  saveActions.append(RG.Button("Export save", exportProgress), importButton);
  function clearReveal() {
    visibleRarity = null;
    display.replaceChildren();
    display.tabIndex = -1;
    rewardLabel.textContent =
      rarityOdds.textContent =
      announcement.textContent =
        "";
    stage.classList.remove("revealed", "rolling");
    newRarityLabel.hidden = miniPreview.hidden = true;
    progressFill.style.width = "0%";
    progress.setAttribute("aria-valuenow", "0");
    toasts.node.replaceChildren();
    setShopCategory("main");
    setTab("roll");
  }
  const resetButton = RG.Button("Reset progress", () => {
    if (
      !confirm(
        "Reset progress in this browser? A recovery backup will be kept.",
      )
    )
      return;
    try {
      engine.resetProgress();
      stopSound();
      clearReveal();
      saveFeedback.textContent = "Progress reset.";
      update();
    } catch (error) {
      saveFeedback.textContent = error.message;
    }
  });
  const restoreButton = RG.Button("Restore before reset", () => {
    if (!confirm("Restore the progress saved before your last reset?")) return;
    try {
      engine.restoreResetBackup();
      clearReveal();
      saveFeedback.textContent = "Previous progress restored.";
      update();
    } catch (error) {
      saveFeedback.textContent = error.message;
    }
  });
  saveActions.append(resetButton, restoreButton);
  saveDialog.append(
    saveHeading,
    sound,
    E("p", "save-feedback", "Your progress saves automatically."),
    saveActions,
    importFile,
    saveFeedback,
  );
  main.append(
    header,
    rollView,
    collection,
    upgradeView,
    achievementsView,
    historyView,
  );
  shell.append(sidebar, main);
  const version = E("span", "game-version", `v${RG.version}`);
  root.append(shell, toasts.node, admin, saveDialog, version);
  function setTab(value) {
    if (value === "upgrades" && !engine.state.upgradesUnlocked) return;
    if (value === "achievements" && !engine.achievementsUnlocked) return;
    if (value === "history" && !engine.owns("logbook")) return;
    tab = value;
    rollView.hidden = value !== "roll";
    collection.hidden = value !== "collection";
    upgradeView.hidden = value !== "upgrades";
    achievementsView.hidden = value !== "achievements";
    historyView.hidden = value !== "history";
    achievementsButton.classList.toggle("active", value === "achievements");
    achievementsButton.setAttribute(
      "aria-pressed",
      String(value === "achievements"),
    );
    for (const [name, button] of [
      ["roll", rollTab],
      ["collection", collectionTab],
      ["upgrades", upgradesTab],
      ["history", historyTab],
    ]) {
      button.classList.toggle("active", name === value);
      button.setAttribute("aria-current", name === value ? "page" : "false");
    }
  }
  function unlockAudio() {
    if (!engine.state.sound) return;
    let ready = Promise.resolve();
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      ready = audioContext.resume().catch(() => {});
    } catch {}
    beep.muted = true;
    const play = beep.play();
    if (play)
      play
        .then(() => {
          beep.pause();
          beep.currentTime = 0;
          beep.muted = false;
        })
        .catch(() => {
          beep.muted = false;
        });
    return ready;
  }
  const noiseSources = new Set();
  function stopSound() {
    beep.pause();
    for (const source of noiseSources) {
      try {
        source.stop();
      } catch {}
    }
  }
  function tick(purchase = false) {
    if (
      !engine.state.sound ||
      !audioContext ||
      audioContext.state !== "running" ||
      document.hidden
    )
      return;
    const now = audioContext.currentTime;
    if (!tickBuffer) {
      tickBuffer = audioContext.createBuffer(
        1,
        Math.ceil(audioContext.sampleRate * 0.025),
        audioContext.sampleRate,
      );
      const samples = tickBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] =
          (Math.random() * 2 - 1) *
          Math.exp(-i / (audioContext.sampleRate * 0.004));
    }
    const noise = audioContext.createBufferSource(),
      filter = audioContext.createBiquadFilter(),
      volume = audioContext.createGain();
    noise.buffer = tickBuffer;
    noise.playbackRate.value = purchase ? 0.9 : 1;
    filter.type = "highpass";
    filter.frequency.value = 1300;
    filter.Q.value = 0.8;
    volume.gain.setValueAtTime(0.55, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    noise.connect(filter);
    filter.connect(volume);
    volume.connect(audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.025);
    noiseSources.add(noise);
    noise.onended = () => {
      noiseSources.delete(noise);
      noise.disconnect();
      filter.disconnect();
      volume.disconnect();
    };
  }
  function showRarity(id) {
    visibleRarity = id;
    display.replaceChildren(RG.RarityText(id, "hero-rarity"));
    display.tabIndex = 0;
    rarityOdds.textContent = RG.oddsText(engine.chances[id]);
    stage.style.setProperty("--ray-color", RG.rarities[id].color);
    if (activeRoll?.remote)
      miniPreview.replaceChildren(
        E("span", "mini-roll-caption", "Rolling"),
        RG.RarityText(id, "mini-rarity"),
      );
  }
  async function startRoll(remote = false) {
    const roll = engine.begin();
    if (!roll) return;
    activeRoll = roll;
    activeRoll.remote = remote;
    miniPreview.getAnimations().forEach((animation) => animation.cancel());
    miniPreview.hidden = !remote;
    if (remote) {
      miniPreview.replaceChildren(E("span", "mini-roll-caption", "Rolling…"));
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      miniPreview.animate(
        [
          { opacity: 0, transform: `translateY(${reduced ? "6px" : "-8px"})` },
          { opacity: 1, transform: "translateY(6px)" },
        ],
        { duration: 240, easing: "ease-out" },
      );
    }
    buttonText.textContent = "Rolling";
    update();
    await unlockAudio();
    if (stopped || activeRoll !== roll) return;
    started = performance.now();
    nextTick = 0;
    activeRoll.tickTimes = RG.rollTickTimes(activeRoll.duration);
    newRarityLabel.getAnimations().forEach((animation) => animation.cancel());
    newRarityLabel.hidden = true;
    stage.classList.remove("revealed");
    stage.classList.add("rolling");
    rewardLabel.textContent = "";
    buttonText.textContent = "Rolling";
    update();
    frame = requestAnimationFrame(animate);
  }
  function animate(now) {
    if (!activeRoll) return;
    const elapsed = now - started,
      fraction = Math.min(1, elapsed / activeRoll.duration);
    progressFill.style.width = `${fraction * 100}%`;
    progress.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    if (fraction >= 1) {
      finish();
      return;
    }
    if (
      nextTick < activeRoll.tickTimes.length &&
      elapsed >= activeRoll.tickTimes[nextTick]
    ) {
      while (
        nextTick < activeRoll.tickTimes.length &&
        elapsed >= activeRoll.tickTimes[nextTick]
      )
        nextTick++;
      showRarity(engine.samplePreview(visibleRarity));
      tick();
    }
    frame = requestAnimationFrame(animate);
  }
  function finish() {
    const remote = activeRoll.remote;
    const last = engine.complete(activeRoll.id);
    activeRoll = null;
    if (!last) return;
    showRarity(last.id);
    stage.classList.remove("rolling");
    stage.classList.add("revealed");
    if (remote) {
      miniPreview.replaceChildren(
        RG.RarityText(last.id, "mini-rarity"),
        E("span", "mini-roll-caption", `+${RG.format(last.amount)} Points`),
      );
      const fade = miniPreview.animate([{ opacity: 1 }, { opacity: 0 }], {
        delay: 1200,
        duration: 350,
        easing: "ease-out",
      });
      fade.onfinish = () => {
        miniPreview.hidden = true;
      };
    }
    rewardLabel.replaceChildren(
      E("span", "points-reward", `+${RG.format(last.amount)} Points`),
    );
    if (last.isNew) {
      newRarityLabel.hidden = false;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animation = newRarityLabel.animate(
        [
          {
            opacity: 0,
            transform: `translate(-50%, ${reduced ? "-90px" : "-50%"})`,
          },
          { opacity: 1, transform: "translate(-50%, -90px)", offset: 0.25 },
          {
            opacity: 1,
            transform: `translate(-50%, ${reduced ? "-90px" : "-108px"})`,
            offset: 0.75,
          },
          {
            opacity: 0,
            transform: `translate(-50%, ${reduced ? "-90px" : "-120px"})`,
          },
        ],
        { duration: reduced ? 1200 : 2000, easing: "ease-out" },
      );
      animation.onfinish = () => {
        newRarityLabel.hidden = true;
      };
    }
    announcement.textContent = `${RG.rarities[last.id].name}. ${last.amount} Points earned.${last.isNew ? " New rarity!" : ""}${last.isBest ? " New highest rarity." : ""}`;
    if (engine.state.sound) {
      beep.muted = false;
      beep.currentTime = 0;
      beep.play().catch(() => {});
    }
    buttonText.textContent = "Roll Rarity";
    update();
  }
  function update() {
    const state = engine.state,
      values = engine.stats;
    document.title = `Rarity - ${state.best === null ? "???" : RG.rarities[state.best].name}`;
    const showOdds = engine.owns("lucky-eye"),
      showQuantity = engine.owns("inventory");
    currency.update(state.points);
    sidebarStatRows.forEach((view) => view.update(engine));
    if (state.best === null) best.replaceChildren(E("span", "no-best", "???"));
    else {
      best.replaceChildren(RG.RarityText(state.best));
      if (showOdds)
        best.append(
          E("span", "best-odds", RG.oddsText(engine.chances[state.best])),
        );
    }
    if (visibleRarity !== null)
      rarityOdds.textContent = RG.oddsText(engine.chances[visibleRarity]);
    rarityOdds.hidden = !showOdds;
    rollButton.disabled = remoteRoll.disabled = engine.rolling;
    remoteRoll.hidden = !engine.owns("remote-cont-roll");
    historyTab.disabled = !engine.owns("logbook");
    historyTab.textContent = engine.owns("logbook") ? "History" : "???";
    const nextHistoryKey = JSON.stringify(state.history);
    if (historyKey !== nextHistoryKey) {
      historyKey = nextHistoryKey;
      historyView.replaceChildren();
      for (const entry of [...state.history].reverse()) {
        const row = E("article", "history-row");
        const time = E(
          "time",
          "history-time",
          new Date(entry.at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
        time.dateTime = new Date(entry.at).toISOString();
        row.append(
          time,
          RG.RarityText(entry.id),
          E("span", "history-points", `+${RG.format(entry.amount)} Points`),
        );
        historyView.append(row);
      }
    }
    if (!engine.rolling) {
      progressFill.style.width = "0%";
      progress.setAttribute("aria-valuenow", "0");
    }
    upgradesTab.textContent = state.upgradesUnlocked ? "Upgrades" : "???";
    upgradesTab.disabled = !state.upgradesUnlocked;
    achievementsButton.textContent = engine.achievementsUnlocked ? "★" : "?";
    achievementsButton.disabled = !engine.achievementsUnlocked;
    achievementsButton.setAttribute(
      "aria-label",
      engine.achievementsUnlocked ? "Achievements" : "?",
    );
    achievementRows.forEach((view) => view.update(engine));
    for (const item of engine.pendingAchievements.splice(0)) toasts.show(item);
    grant100.disabled =
      grant1000.disabled =
      fastRolls.disabled =
        engine.rolling;
    fastRolls.textContent = engine.fastRolls
      ? "Fast rolls on"
      : "Fast rolls off";
    fastRolls.setAttribute("aria-pressed", String(engine.fastRolls));
    upgradeRows.forEach((view) => view.update());
    repeatableCategory.disabled = !engine.repeatablesUnlocked;
    repeatableCategory.textContent = engine.repeatablesUnlocked
      ? "Upgrades"
      : "???";
    repeatableRows.forEach((view) => view.update());
    rollInfo.hidden = !engine.owns("handbook");
    cooldownStat.update(`${values.roll_time.toFixed(1)}s`);
    multiplierStat.update(`${RG.format(values.point_multiplier)}×`);
    totalStat.update(RG.format(state.rolls));
    discoveryStat.node.hidden = values.discovery_points === 0;
    discoveryStat.update(`+${RG.format(values.discovery_points)}`);
    passiveStat.node.hidden = values.passive_pps === 0;
    passiveStat.update(`${RG.format(values.passive_pps)} / second`);
    sortControls.hidden = !engine.owns("collection-book-2");
    sortSelect.value = state.collectionSort;
    sortSelect.querySelector('option[value="count"]').hidden = !showQuantity;
    sortSelect.querySelector('option[value="count"]').disabled = !showQuantity;
    sound.textContent = state.sound ? "Sound on" : "Sound off";
    sound.setAttribute("aria-pressed", String(state.sound));
    importButton.disabled = engine.rolling;
    resetButton.disabled = restoreButton.disabled = engine.rolling;
    restoreButton.hidden = !engine.hasResetBackup();
    saveStatus.textContent = engine.saveOK
      ? ""
      : engine.saveMessage || "Saving unavailable";
    const chances = engine.chances;
    collectionRows.forEach((view, id) => {
      const unlocked = state.counts[id] > 0;
      view.row.classList.toggle("found", unlocked);
      view.label.replaceChildren(
        unlocked ? RG.RarityText(id) : E("span", "locked-rarity", "???"),
      );
      view.row.style.setProperty(
        "--strip-color",
        unlocked ? RG.rarities[id].color : "#777777",
      );
      view.count.hidden = !showQuantity;
      view.count.textContent = showQuantity
        ? unlocked
          ? `×${RG.format(state.counts[id])}`
          : "???"
        : "";
      view.odds.hidden = !showOdds;
      view.odds.textContent = showOdds
        ? unlocked
          ? RG.oddsText(chances[id])
          : "???"
        : "";
      view.odds.title =
        showOdds && unlocked
          ? `${(chances[id] * 100).toPrecision(4)}% chance per roll`
          : "";
      view.stamp.hidden = !state.stamped[id];
      view.row.classList.toggle("stamped", state.stamped[id]);
      view.row.classList.toggle("has-odds", showOdds);
      view.row.classList.toggle("has-quantity", showQuantity);
      view.payout.textContent = unlocked
        ? `${RG.format(engine.reward(id))} Points`
        : "???";
    });
    const sorted = [...collectionRows];
    if (engine.owns("collection-book-2"))
      sorted.sort((a, b) => {
        const aKnown = state.counts[a.id] > 0,
          bKnown = state.counts[b.id] > 0;
        if (aKnown !== bKnown) return aKnown ? -1 : 1;
        if (!aKnown) return a.id - b.id;
        if (state.collectionSort === "rarity-desc") return b.id - a.id;
        if (state.collectionSort === "name")
          return RG.rarities[a.id].name.localeCompare(RG.rarities[b.id].name);
        if (state.collectionSort === "count")
          return state.counts[b.id] - state.counts[a.id] || a.id - b.id;
        return a.id - b.id;
      });
    if (sorted.some((view, index) => grid.children[index] !== view.row))
      sorted.forEach((view) => grid.append(view.row));
  }
  update();
  setTab(tab);
  let lastPassiveSave = Date.now();
  const passiveTimer = setInterval(() => {
    const achievementsBefore = engine.state.achievements.length;
    const lifetimeBefore = engine.state.lifetime;
    if (engine.accrue() > 0) {
      currency.update(engine.state.points);
      upgradeRows.forEach((view) => view.update());
      repeatableRows.forEach((view) => view.update());
      if (
        engine.state.achievements.length !== achievementsBefore ||
        [50, 75, 100].some(
          (milestone) =>
            lifetimeBefore < milestone && engine.state.lifetime >= milestone,
        )
      )
        update();
    }
    if (engine.stats.passive_pps > 0 && Date.now() - lastPassiveSave >= 5000) {
      engine.save();
      lastPassiveSave = Date.now();
      saveStatus.textContent = engine.saveOK ? "" : engine.saveMessage;
    }
  }, 250);
  function visibilityChanged() {
    if (document.hidden) {
      engine.accrue();
      engine.save();
    } else if (
      activeRoll?.tickTimes &&
      performance.now() - started >= activeRoll.duration
    ) {
      cancelAnimationFrame(frame);
      finish();
    }
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(passiveTimer);
    cancelAnimationFrame(frame);
    activeRoll = null;
    engine.cancelRoll();
    stopSound();
    document.removeEventListener("visibilitychange", visibilityChanged);
    engine.accrue();
    engine.save();
  }
  window.addEventListener("pagehide", stop, { once: true });
  return { stop };
};
