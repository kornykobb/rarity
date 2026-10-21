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
  let prestiging = false,
    autoTimer = 0;
  let shopCategory = "main",
    collectionCategory = "rarities";
  let tab = "roll",
    audioContext = null,
    tickBuffer = null,
    frame = 0,
    nextTick = 0,
    started = 0,
    activeRoll = null,
    starClicks = 0,
    visibleRarity = null,
    visibleGrade = null,
    visibleFinalOdds = null;
  const beep = new Audio("assets/lichess-beep.mp3");
  beep.volume = 0.6;
  const meow = new Audio("assets/baby-beefer-meow.mp3");
  meow.volume = 0.7;
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
  const youGroup = E("div", "you-category");
  youGroup.hidden = true;
  const bodyTab = RG.Button("Body", () => setTab("body"), "nav-button");
  const statsTab = RG.Button("Stats", () => {}, "nav-button");
  statsTab.disabled = true;
  youGroup.append(E("h3", "", "You"), bodyTab, statsTab);
  nav.append(rollTab, collectionTab, upgradesTab, historyTab, youGroup);
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
    "sound-button settings-button",
  );
  const beeferButton = RG.Button(
    "",
    () => {
      engine.recordAction("beefer");
      if (engine.state.sound) {
        meow.currentTime = 0;
        meow.play().catch(() => {});
      }
      update();
    },
    "beefer-button",
  );
  beeferButton.setAttribute("aria-label", "Baby Beefer");
  beeferButton.append(RG.BeeferOrb());
  sidebarFooter.append(settingsButton, beeferButton, saveStatus);
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
  const cooldownStat = RG.Stat(
      "Roll Speed",
      "Time each roll takes. Lower is faster. A roll in progress keeps its starting speed.",
    ),
    multiplierStat = RG.Stat(
      "Point multiplier",
      "Multiplies Points earned from rolling. Includes upgrades, achievements and passive treasures. Rarity Grades add their own bonus afterward. Discovery bonuses and passive Points are separate. Purchases affect the next roll.",
    ),
    totalStat = RG.Stat(
      "Total rolls",
      "Number of completed rolls. Interrupted rolls do not count.",
    );
  const discoveryStat = RG.Stat(
      "Discovery points",
      () =>
        `Extra Points for finding a rarity for the first time. Flat bonus: ${RG.format(engine.stats.discovery_points)}. ${engine.owns("seal-of-approval") ? "Seal Of Approval also adds that rarity's base Point value. " : ""}Adventurer also rewards the first copy of each new rarity/Grade combination; known combinations get no discovery bonus. This bonus is not multiplied by your Point multiplier.`,
    ),
    passiveStat = RG.Stat(
      "Passive Points",
      () =>
        `Points earned automatically each second, including time away. Achievement Boost currently adds ${RG.format(engine.stats.achievement_pps)} PPS from your ${engine.state.achievements.length} achievements. Finally Passive adds 5 base PPS once earned. Factory Maintenance adds ${RG.format(engine.stats.maintenance_pps)} and Factory Annex adds ${engine.owns("factory-annex") ? 5 : 0} base PPS. ${engine.ownsTreasure("shadow-totem") ? "Shadow Totem doubles the whole base rate." : ""}`,
    );
  rollInfo.append(
    cooldownStat.node,
    multiplierStat.node,
    totalStat.node,
    discoveryStat.node,
    passiveStat.node,
  );
  const autoRollButton = RG.Button(
    "Auto Roll: Off",
    () => {
      if (engine.setAutoRoll(!engine.state.autoRoll)) {
        update();
        scheduleAutoRoll();
      }
    },
    "auto-roll-button",
  );
  const autoRollSettings = RG.Button(
    "⚙",
    () => {
      autoRollMenu.hidden = !autoRollMenu.hidden;
      autoRollSettings.setAttribute("aria-expanded", String(!autoRollMenu.hidden));
    },
    "auto-roll-settings",
  );
  autoRollSettings.setAttribute("aria-label", "Auto Roll settings");
  autoRollSettings.setAttribute("aria-expanded", "false");
  const autoRollMenu = E("div", "auto-roll-menu");
  autoRollMenu.hidden = true;
  const pauseOptions = [
    ["newRarity", "Pause on new rarity"],
    ["newGrade", "Pause on new Grade"],
    ["luckyDie", "Pause when a Lucky Die drops"],
  ].map(([key, text]) => {
    const label = E("label"),
      box = E("input");
    box.type = "checkbox";
    box.addEventListener("change", () =>
      engine.setAutoRollPause(key, box.checked),
    );
    label.append(box, document.createTextNode(text));
    autoRollMenu.append(label);
    return { key, box };
  });
  const autoRollRow = E("div", "auto-roll-row");
  autoRollRow.append(autoRollButton, autoRollSettings, autoRollMenu);
  autoRollRow.hidden = true;
  document.addEventListener("pointerdown", (event) => {
    if (!autoRollMenu.hidden && !autoRollRow.contains(event.target)) {
      autoRollMenu.hidden = true;
      autoRollSettings.setAttribute("aria-expanded", "false");
    }
  });
  const prestigeButton = RG.Button(
    "PRESTIGE",
    () => prestigeDialog.open(),
    "prestige-button",
  );
  prestigeButton.hidden = true;
  controls.append(
    progress,
    rollButton,
    autoRollRow,
    rollInfo,
    prestigeButton,
  );
  const levelBlock = E("div", "level-block");
  levelBlock.hidden = true;
  const levelLabel = E("span", "level-label"),
    realmLabel = E("span", "realm-label"),
    levelBar = E("div", "level-bar"),
    levelFill = E("div", "level-fill"),
    levelXp = E("span", "level-xp");
  levelBar.setAttribute("role", "progressbar");
  levelBar.setAttribute("aria-label", "Experience");
  levelBar.setAttribute("aria-valuemin", "0");
  levelBar.append(levelFill, levelXp);
  const levelHeading = E("div", "level-heading");
  levelHeading.append(levelLabel, realmLabel);
  levelBlock.append(levelHeading, levelBar);
  header.append(levelBlock);
  let shownLevel = null,
    shownRealm = null;
  rollView.append(stage, controls);
  const collection = E("section", "collection-view");
  collection.hidden = true;
  collection.setAttribute("aria-label", "Collection");
  const collectionNav = E("nav", "category-nav collection-categories");
  collectionNav.setAttribute("aria-label", "Collection categories");
  const rarityCategory = RG.Button(
    "Rarities",
    () => setCollectionCategory("rarities"),
    "category-button active",
  );
  const treasureCategory = RG.Button(
    "Treasures",
    () => setCollectionCategory("treasures"),
    "category-button",
  );
  collectionNav.append(rarityCategory, treasureCategory);
  const rarityCollection = E("div");
  const treasureField = RG.TreasureField(engine);
  treasureField.node.hidden = true;
  const sortControls = E("div", "collection-sort");
  sortControls.hidden = true;
  const sortLabel = E("label", "", "Sort");
  const sortSelect = E("select");
  sortSelect.id = "collection-sort";
  sortLabel.htmlFor = sortSelect.id;
  for (const [value, label] of [
    ["unsorted", "Unsorted"],
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
  const foundCounter = E("span", "collection-found");
  const collectionBar = E("div", "collection-bar");
  collectionBar.append(foundCounter, sortControls);
  const grid = E("div", "rarity-list");
  rarityCollection.append(collectionBar, grid);
  collection.append(collectionNav, rarityCollection, treasureField.node);
  function setCollectionCategory(category) {
    collectionCategory = category;
    rarityCollection.hidden = category !== "rarities";
    treasureField.node.hidden = category !== "treasures";
    rarityCategory.classList.toggle("active", category === "rarities");
    treasureCategory.classList.toggle("active", category === "treasures");
    rarityCategory.setAttribute(
      "aria-current",
      category === "rarities" ? "page" : "false",
    );
    treasureCategory.setAttribute(
      "aria-current",
      category === "treasures" ? "page" : "false",
    );
    treasureField.activate(tab === "collection" && category === "treasures");
    RG.hideTooltips();
  }
  const collectionRows = RG.rarities.map((rarity) => {
    const row = E("article", "rarity-card");
    const label = E("div", "collection-rarity");
    const count = E("span", "rarity-count");
    const odds = E("span", "rarity-odds");
    const payout = E("span", "rarity-payout");
    const badges = RG.CollectionBadges();
    const gradeDetails = E("details", "rarity-grade-details");
    gradeDetails.hidden = true;
    gradeDetails.append(E("summary", "", "Grades"));
    const variants = E("div", "rarity-grade-variants");
    gradeDetails.append(variants);
    let gradeViews = [];
    gradeDetails.addEventListener("toggle", () => {
      if (gradeDetails.open) update();
    });
    row.append(label, odds, payout, count, ...badges.nodes, gradeDetails);
    grid.append(row);
    return {
      id: rarity.id,
      row,
      label,
      count,
      odds,
      payout,
      badges,
      gradeDetails,
      variants,
      gradeViews,
    };
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
  const marketCategory = RG.Button(
    "",
    () => setShopCategory("market"),
    "night-market-tab",
  );
  marketCategory.setAttribute("aria-label", "Night Market");
  marketCategory.hidden = true;
  const marketIcon = E("img");
  marketIcon.src = "assets/night-market.png";
  marketIcon.alt = "";
  marketCategory.append(marketIcon);
  for (const name of ["mouseenter", "focus"])
    marketCategory.addEventListener(name, () =>
      root.classList.add("market-hover"),
    );
  for (const name of ["mouseleave", "blur"])
    marketCategory.addEventListener(name, () =>
      root.classList.remove("market-hover"),
    );
  categoryNav.append(mainCategory, repeatableCategory, marketCategory);
  const upgradeList = E("div", "upgrade-list");
  const upgradeRows = RG.upgrades.map((upgrade) => ({
    ...RG.Upgrade(upgrade, engine, (id) => {
      if (engine.buy(id)) {
        tick(true);
        update();
      }
    }),
    category: upgrade.category || "main",
  }));
  const upgradeGroups = ["main", "badges", "collection"].map((category) => {
    const node = E("section", "upgrade-group");
    const title =
      category === "main"
        ? "Main"
        : category === "badges"
          ? "Badges"
          : "Collection";
    node.setAttribute("aria-label", `${title} upgrades`);
    node.append(E("h3", "upgrade-divider", title));
    const rows = upgradeRows.filter((view) => view.category === category);
    rows.forEach((view) => node.append(view.node));
    upgradeList.append(node);
    return { node, rows };
  });
  const repeatableList = E("div", "upgrade-list repeatable-grid");
  repeatableList.hidden = true;
  const repeatableRows = RG.repeatables.map((upgrade) =>
    RG.RepeatableUpgrade(upgrade, engine, (id) => {
      if (!engine.buyRepeatable(id)) return false;
      tick(true);
      update();
      return true;
    }, (id) => {
      if (!engine.buyRepeatableMax(id)) return false;
      tick(true);
      update();
      return true;
    }),
  );
  repeatableRows.forEach((view) => repeatableList.append(view.node));
  const marketFlash = E("div", "market-flash");
  marketFlash.setAttribute("aria-hidden", "true");
  const marketVignette = E("div", "market-vignette");
  marketVignette.setAttribute("aria-hidden", "true");
  const nightMarket = RG.NightMarket(engine, (purchase = true) => {
    if (!purchase) {
      update();
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced)
      shell.animate(
        [
          { transform: "translate(0)" },
          { transform: "translate(-5px,2px)" },
          { transform: "translate(4px,-2px)" },
          { transform: "translate(0)" },
        ],
        { duration: 330, easing: "ease-out" },
      );
    marketFlash.animate(
      [
        { opacity: 0 },
        { opacity: reduced ? 0.08 : 0.22, offset: 0.2 },
        { opacity: 0 },
      ],
      { duration: reduced ? 200 : 380 },
    );
    update();
  });
  upgradeView.append(
    categoryNav,
    upgradeList,
    repeatableList,
    nightMarket.node,
  );
  function setShopCategory(category) {
    if (category === "repeatables" && !engine.repeatablesUnlocked) return;
    if (category === "market" && !engine.nightMarketUnlocked) return;
    if (shopCategory === "market" && category !== "market") nightMarket.leave();
    if (shopCategory !== "market" && category === "market") nightMarket.enter();
    shopCategory = category;
    nightMarket.node.hidden = category !== "market";
    root.classList.toggle("market-mode", category === "market");
    document.body.classList.toggle("market-mode", category === "market");
    root.classList.remove("market-hover");
    marketCategory.setAttribute("aria-pressed", String(category === "market"));
    RG.hideTooltips();
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
    engine.fastRolls = !engine.fastRolls;
    update();
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
  function adminSection(title) {
    const section = E("fieldset", "admin-section");
    section.append(E("legend", "", title));
    admin.append(section);
    return section;
  }
  function adminSelect(items, label) {
    const select = E("select");
    select.setAttribute("aria-label", label);
    items.forEach(([id, name]) => {
      const option = E("option", "", name);
      option.value = id;
      select.append(option);
    });
    return select;
  }
  function adminChange(change) {
    engine.accrue();
    change();
    engine.state = engine.validate(engine.state);
    engine.checkAchievements();
    engine.save();
    update();
  }
  const progressionTools = adminSection("Progress");
  const amount = E("input");
  amount.type = "number";
  amount.min = "1";
  amount.max = "1000000000";
  amount.value = "10000";
  amount.setAttribute("aria-label", "Points to grant");
  progressionTools.append(
    amount,
    RG.Button("Grant Points", () => {
      const value = Number(amount.value);
      if (Number.isFinite(value) && value > 0 && value <= 1e9) {
        engine.grantPoints(value);
        update();
      }
    }),
    RG.Button("Unlock Main upgrades", () =>
      adminChange(() => {
        engine.state.purchased = RG.upgrades.map((item) => item.id);
        engine.state.upgradesUnlocked = true;
      }),
    ),
  );
  const upgradeTools = adminSection("Repeatable upgrades");
  const upgradeSelect = adminSelect(
    RG.repeatables.map((item) => [item.id, item.name]),
    "Repeatable upgrade",
  );
  function setLevel(max) {
    const item = RG.repeatables.find((item) => item.id === upgradeSelect.value);
    if (!engine.repeatableAvailable(item)) return;
    adminChange(() => {
      engine.state.levels[item.id] = max
        ? item.max
        : Math.min(item.max, engine.state.levels[item.id] + 1);
    });
  }
  upgradeTools.append(
    upgradeSelect,
    RG.Button("Add level", () => setLevel(false)),
    RG.Button("Max level", () => setLevel(true)),
  );
  progressionTools.append(
    RG.Button("Grant Legendary", () =>
      adminChange(() => {
        engine.state.counts[RG.prestigeRarity]++;
        engine.state.best = RG.prestigeRarity;
      }),
    ),
  );
  const marketTools = adminSection("Night Market");
  marketTools.append(
    RG.Button("Unlock Night Market", () =>
      adminChange(() => {
        engine.state.maxRolledOdds = Math.max(60, engine.state.maxRolledOdds);
        engine.state.upgradesUnlocked = true;
      }),
    ),
  );
  const treasureSelect = adminSelect(
    RG.treasures.map((item) => [item.id, item.name]),
    "Treasure",
  );
  marketTools.append(
    treasureSelect,
    RG.Button("Grant treasure", () =>
      adminChange(() => {
        if (!engine.ownsTreasure(treasureSelect.value))
          engine.state.treasures.push(treasureSelect.value);
      }),
    ),
    RG.Button("Restock treasure", () => {
      adminChange(() => {
        engine.state.treasures = engine.state.treasures.filter(
          (id) => id !== treasureSelect.value,
        );
      });
      nightMarket.leave();
    }),
  );
  const quotes = adminSelect(
    [
      [-1, RG.shadowPoorQuote],
      ...RG.shadowQuotes.map((quote, index) => [index, quote]),
    ],
    "Shadow Guy quote",
  );
  marketTools.append(
    quotes,
    RG.Button("Preview quote", () => {
      if (!engine.nightMarketUnlocked) return;
      admin.close();
      setTab("upgrades");
      setShopCategory("market");
      nightMarket.talk(Number(quotes.value));
    }),
  );
  marketTools.append(
    RG.Button("Spawn Lucky Die", () => {
      if (!engine.nightMarketUnlocked || engine.stats.temporary_luck) return;
      engine.luckyDieOffer = {
        amount: 1,
        expiresAt: Date.now() + RG.luckyDie.fallDuration,
      };
      admin.close();
      update();
    }),
  );
  const achievementTools = adminSection("Achievements");
  const achievementSelect = adminSelect(
    RG.achievements.map((item) => [item.id, `${item.number}: ${item.name}`]),
    "Achievement",
  );
  const tierSelect = adminSelect(
    RG.achievementTiers.map((tier) => [tier.id, tier.name]),
    "Achievement tier preview",
  );
  achievementTools.append(
    achievementSelect,
    tierSelect,
    RG.Button("Preview toast", () => {
      toasts.show(
        engine.achievementView(
          RG.achievements.find((item) => item.id === achievementSelect.value),
          Number(tierSelect.value),
        ),
      );
    }),
    RG.Button("Grant achievement", () => {
      const item = RG.achievements.find(
        (item) => item.id === achievementSelect.value,
      );
      adminChange(() => {
        if (engine.state.achievements.includes(item.id)) return;
        engine.state.achievements.push(item.id);
        if (item.reward.points) engine.credit(item.reward.points);
        engine.pendingAchievements.push(item);
      });
    }),
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
  const confirmDialog = RG.ConfirmDialog();
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
      if (file.size > 1024 * 1024) throw new Error("Save file is too large.");
      const parsed = JSON.parse(await file.text());
      engine.validate(parsed);
      if (
        !(await confirmDialog.ask(
          "Replace your progress with this save? Your current save will be downloaded first.",
        ))
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
    cancelAnimationFrame(frame);
    activeRoll = null;
    engine.cancelRoll();
    buttonText.textContent = "Roll Rarity";
    stopSound();
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
  const resetButton = RG.Button("Reset progress", async () => {
    if (
      !(await confirmDialog.ask(
        "Reset progress in this browser? A recovery backup will be kept.",
      ))
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
  const restoreButton = RG.Button("Restore before reset", async () => {
    if (
      !(await confirmDialog.ask(
        "Restore the progress saved before your last reset?",
      ))
    )
      return;
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
  const bodyTree = RG.BodyTree(engine, {
    onPrestige: () => performPrestige(),
    onChange: () => update(),
  });
  const prestigeDialog = RG.PrestigeDialog(engine, performPrestige);
  prestigeDialog.node.addEventListener("close", scheduleAutoRoll);
  const prestigeFlash = E("div", "prestige-flash");
  prestigeFlash.hidden = true;
  prestigeFlash.setAttribute("aria-hidden", "true");
  main.append(
    header,
    bodyTree.node,
    rollView,
    collection,
    upgradeView,
    achievementsView,
    historyView,
  );
  shell.append(sidebar, main);
  const changelog = RG.Changelog();
  const version = E("button", "game-version", `v${RG.version}`);
  version.type = "button";
  version.setAttribute("aria-controls", changelog.id);
  version.setAttribute("aria-expanded", "false");
  version.addEventListener("click", () => changelog.togglePopover());
  changelog.addEventListener("toggle", (event) =>
    version.setAttribute("aria-expanded", String(event.newState === "open")),
  );
  changelog.addEventListener("toggle", (event) => {
    if (event.newState === "open") {
      engine.recordAction("changelog");
      update();
    }
  });
  root.append(
    shell,
    toasts.node,
    admin,
    saveDialog,
    version,
    changelog,
    marketFlash,
    marketVignette,
    prestigeDialog.node,
    prestigeFlash,
    confirmDialog.node,
  );
  function setTab(value) {
    if (value === "upgrades" && !engine.state.upgradesUnlocked) return;
    if (value === "achievements" && !engine.achievementsUnlocked) return;
    if (value === "history" && !engine.owns("logbook")) return;
    if (value === "body" && !engine.state.meta.prestiges) return;
    if (value !== "upgrades" && shopCategory === "market")
      setShopCategory("main");
    tab = value;
    rollView.hidden = value !== "roll";
    collection.hidden = value !== "collection";
    upgradeView.hidden = value !== "upgrades";
    achievementsView.hidden = value !== "achievements";
    historyView.hidden = value !== "history";
    bodyTree.node.hidden = value !== "body";
    treasureField.activate(
      value === "collection" && collectionCategory === "treasures",
    );
    RG.hideTooltips();
    remoteRoll.hidden = !engine.owns("remote-cont-roll") || value === "roll";
    levelBlock.hidden = !engine.levelsUnlocked || value !== "roll";
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
      ["body", bodyTab],
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
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 150);
      ready.then(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  const noiseSources = new Set();
  function stopSound() {
    beep.pause();
    meow.pause();
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
  function showRarity(id, grade = null, odds = null) {
    visibleRarity = id;
    visibleGrade = grade;
    visibleFinalOdds = odds;
    display.replaceChildren(RG.RarityText(id, "hero-rarity", grade));
    display.tabIndex = 0;
    rarityOdds.textContent = RG.oddsText(
      odds === null
        ? engine.resultChance(
            id,
            grade,
            engine.pendingRoll?.chances,
            engine.pendingRoll?.gradeChances,
          )
        : 1 / odds,
    );
    stage.style.setProperty("--ray-color", RG.rarities[id].color);
    if (activeRoll?.remote)
      miniPreview.replaceChildren(
        E("span", "mini-roll-caption", "Rolling"),
        RG.RarityText(id, "mini-rarity", grade),
      );
  }
  async function startRoll(remote = false, automated = false) {
    if (prestiging) return;
    clearTimeout(autoTimer);
    if (!automated && engine.rolling) unlockAudio();
    const roll = engine.begin();
    if (!roll) {
      update();
      return;
    }
    if (remote) engine.recordAction("remote-roll");
    activeRoll = roll;
    activeRoll.phase = "rarity";
    stage.dataset.rollPhase = "rarity";
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
    if (!automated || navigator.userActivation?.hasBeenActive)
      await unlockAudio();
    if (stopped || prestiging || activeRoll !== roll) return;
    started = performance.now();
    nextTick = 0;
    activeRoll.tickTimes = RG.rollTickTimes(activeRoll.rarityDuration);
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
    const elapsed = now - started;
    let fraction;
    if (activeRoll.phase === "grade") {
      const gradeElapsed = now - activeRoll.gradeStartedAt;
      fraction = Math.min(
        1,
        (activeRoll.rarityDuration + gradeElapsed) / activeRoll.duration,
      );
      if (gradeElapsed >= activeRoll.gradeDuration) {
        finish();
        return;
      }
      if (gradeElapsed >= activeRoll.nextGradeTick) {
        activeRoll.nextGradeTick = gradeElapsed + 80;
        let preview = engine.sampleGrade(
          Math.random,
          engine.pendingRoll.gradeChances,
        );
        for (
          let attempt = 0;
          preview === visibleGrade && attempt < 5;
          attempt++
        )
          preview = engine.sampleGrade(
            Math.random,
            engine.pendingRoll.gradeChances,
          );
        if (preview !== visibleGrade) {
          showRarity(activeRoll.id, preview);
          tick();
        }
      }
    } else {
      fraction = Math.min(1, elapsed / activeRoll.duration);
      if (elapsed >= activeRoll.rarityDuration) {
        if (!activeRoll.gradeDuration) {
          finish();
          return;
        }
        if (engine.beginGrade() !== null) {
          activeRoll.phase = "grade";
          activeRoll.gradeStartedAt = now;
          activeRoll.nextGradeTick = 0;
          stage.dataset.rollPhase = "grade";
          showRarity(activeRoll.id);
        }
      } else if (
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
    }
    progressFill.style.width = `${fraction * 100}%`;
    progress.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    frame = requestAnimationFrame(animate);
  }
  function finish() {
    const remote = activeRoll.remote;
    const last = engine.complete(activeRoll.id);
    if (!last) {
      frame = requestAnimationFrame(animate);
      return;
    }
    activeRoll = null;
    stage.dataset.rollPhase = "complete";
    progressFill.style.width = "100%";
    progress.setAttribute("aria-valuenow", "100");
    showRarity(last.id, last.grade, last.odds);
    stage.classList.remove("rolling");
    stage.classList.add("revealed");
    if (remote) {
      miniPreview.replaceChildren(
        RG.RarityText(last.id, "mini-rarity", last.grade),
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
    announcement.textContent = `${RG.rarities[last.id].name}${last.grade === null ? "" : `, Grade ${RG.rarityGrades[last.grade].name}`}. ${last.amount} Points earned.${last.isNew ? " New rarity!" : ""}${last.isBest ? " New highest rarity." : ""}`;
    if (engine.state.sound) {
      beep.muted = false;
      beep.currentTime = 0;
      beep.play().catch(() => {});
    }
    buttonText.textContent = "Roll Rarity";
    if (remote && rollView.hidden && !inView(miniPreview))
      toasts.message(
        RG.RarityText(last.id, "", last.grade),
        E("span", "message-toast-points", `+${RG.format(last.amount)} Points`),
      );
    const pause = engine.state.autoRollPause;
    const reason = !engine.state.autoRoll
      ? null
      : pause.newRarity && last.isNew
        ? "new rarity"
        : pause.newGrade && last.newGrade
          ? "new Grade"
          : pause.luckyDie && engine.luckyDieOffer
            ? "Lucky Die"
            : null;
    if (reason && engine.setAutoRoll(false))
      toasts.message(E("span", "", `Auto Roll paused: ${reason}`));
    update();
    scheduleAutoRoll();
  }
  function inView(node) {
    if (node.hidden) return false;
    const rect = node.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }
  document.addEventListener("keydown", (event) => {
    if (
      event.code !== "Space" ||
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !engine.owns("remote-control") ||
      prestiging ||
      document.querySelector("dialog[open]") ||
      event.target.closest?.("input, textarea, select, [contenteditable]")
    )
      return;
    event.preventDefault();
    if (engine.rolling) return;
    startRoll(tab !== "roll");
  });
  function scheduleAutoRoll() {
    clearTimeout(autoTimer);
    if (
      stopped ||
      prestiging ||
      document.hidden ||
      prestigeDialog.node.open ||
      !engine.state.autoRoll ||
      !engine.owns("auto-roll") ||
      engine.rolling
    )
      return;
    autoTimer = setTimeout(() => {
      if (!document.hidden && !prestiging && !prestigeDialog.node.open)
        startRoll(false, true);
    }, 120);
  }
  async function performPrestige() {
    if (prestiging) return;
    if (!engine.prestige()) {
      saveStatus.textContent = engine.saveMessage;
      return;
    }
    prestiging = true;
    clearTimeout(autoTimer);
    cancelAnimationFrame(frame);
    activeRoll = null;
    stopSound();
    prestigeDialog.node.close();
    toasts.node.replaceChildren();
    if (toasts.node.matches(":popover-open")) toasts.node.hidePopover();
    nightMarket.reset();
    luckyDie.stop();
    RG.hideTooltips();
    if (admin.open) admin.close();
    if (saveDialog.open) saveDialog.close();
    root.inert = true;
    shell.inert = true;
    prestigeFlash.hidden = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced)
      shell.animate(
        [
          { transform: "translate(0)" },
          { transform: "translate(-9px,5px)" },
          { transform: "translate(8px,-6px)" },
          { transform: "translate(-5px,3px)" },
          { transform: "translate(0)" },
        ],
        { duration: 650 },
      );
    await prestigeFlash
      .animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: reduced ? 160 : 2200,
        fill: "forwards",
        easing: "ease-in",
      })
      .finished.catch(() => {});
    if (stopped) return;
    visibleRarity = visibleGrade = visibleFinalOdds = null;
    display.replaceChildren();
    display.tabIndex = -1;
    rarityOdds.textContent = "";
    stage.classList.remove("rolling", "revealed");
    stage.removeAttribute("data-roll-phase");
    miniPreview.hidden = true;
    buttonText.textContent = "Roll Rarity";
    bodyTree.reset();
    setTab("body");
    update();
    await prestigeFlash
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reduced ? 160 : 900,
        fill: "forwards",
      })
      .finished.catch(() => {});
    prestigeFlash.hidden = true;
    root.inert = false;
    shell.inert = false;
    prestiging = false;
    bodyTab.focus();
  }
  function update() {
    const state = engine.state,
      values = engine.stats;
    luckyDie.update();
    bodyTree.update();
    youGroup.hidden = !state.meta.prestiges;
    const levels = engine.levelsUnlocked,
      info = engine.levelInfo(),
      realm = levels ? engine.realm : RG.realms[0];
    levelBlock.hidden = !levels || tab !== "roll";
    levelXp.textContent = `${RG.format(info.xp)} / ${RG.format(info.next)} XP`;
    levelLabel.textContent = `Level ${info.level}`;
    realmLabel.textContent = realm.name;
    levelFill.style.width = `${(info.xp / info.next) * 100}%`;
    levelBar.setAttribute("aria-valuemax", String(info.next));
    levelBar.setAttribute("aria-valuenow", String(info.xp));
    document.documentElement.dataset.realm = realm.id;
    if (levels && shownLevel !== null && info.level > shownLevel)
      toasts.message(E("span", "", `Level ${info.level}`));
    if (levels && shownRealm !== null && realm.id !== shownRealm)
      toasts.message(E("span", "", `Entered ${realm.name}`));
    shownLevel = info.level;
    shownRealm = realm.id;
    autoRollRow.hidden = !engine.owns("auto-roll");
    pauseOptions.forEach(({ key, box }) => {
      box.checked = state.autoRollPause[key];
    });
    autoRollButton.textContent = state.autoRoll
      ? "Auto Roll: On"
      : "Auto Roll: Off";
    autoRollButton.setAttribute("aria-pressed", String(state.autoRoll));
    prestigeButton.hidden = !engine.canPrestige;
    if (engine.canPrestige && !state.flags.legendaryDialogueSeen && !prestiging)
      prestigeDialog.open();
    document.title = `Rarity - ${state.best === null ? "???" : RG.rarities[state.best].name}`;
    const showOdds = engine.owns("lucky-eye"),
      showQuantity = engine.owns("inventory");
    currency.update(state.points);
    sidebarStatRows.forEach((view) => view.update(engine));
    if (state.best === null) best.replaceChildren(E("span", "no-best", "???"));
    else {
      best.replaceChildren(
        RG.RarityText(state.best, "", engine.bestGrade(state.best)),
      );
      if (showOdds)
        best.append(
          E(
            "span",
            "best-odds",
            RG.oddsText(
              engine.resultChance(state.best, engine.bestGrade(state.best)),
            ),
          ),
        );
    }
    if (visibleRarity !== null)
      rarityOdds.textContent = RG.oddsText(
        visibleFinalOdds === null
          ? engine.resultChance(
              visibleRarity,
              visibleGrade,
              engine.pendingRoll?.chances,
              engine.pendingRoll?.gradeChances,
            )
          : 1 / visibleFinalOdds,
      );
    rarityOdds.hidden = !showOdds;
    remoteRoll.hidden = !engine.owns("remote-cont-roll") || tab === "roll";
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
        const rarity = E("div", "history-rarity");
        rarity.append(RG.RarityText(entry.id, "", entry.grade));
        row.append(
          time,
          rarity,
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
    achievementsButton.hidden = !state.achievements.length;
    achievementsButton.setAttribute(
      "aria-label",
      engine.achievementsUnlocked ? "Achievements" : "?",
    );
    achievementRows.forEach((view) => view.update(engine));
    for (const item of engine.pendingAchievements.splice(0)) toasts.show(item);
    fastRolls.textContent = engine.fastRolls
      ? "Fast rolls on"
      : "Fast rolls off";
    fastRolls.setAttribute("aria-pressed", String(engine.fastRolls));
    upgradeRows.forEach((view) => view.update());
    upgradeGroups.forEach((group) => {
      group.node.hidden = group.rows.every((view) => view.node.hidden);
    });
    repeatableCategory.disabled = !engine.repeatablesUnlocked;
    repeatableCategory.textContent = engine.repeatablesUnlocked
      ? "Upgrades"
      : "???";
    repeatableRows.forEach((view) => view.update());
    marketCategory.hidden = !engine.nightMarketUnlocked;
    nightMarket.update();
    treasureField.update();
    rollInfo.hidden = !engine.owns("handbook");
    cooldownStat.update(`${values.roll_time.toFixed(1)}s`);
    multiplierStat.update(`${RG.format(values.point_multiplier)}×`);
    totalStat.update(RG.format(state.rolls));
    discoveryStat.node.hidden =
      values.discovery_points === 0 && values.discovery_multiplier === 0;
    discoveryStat.update(
      `+${RG.format(values.discovery_points)}${values.discovery_multiplier ? " + rarity value" : ""}`,
    );
    passiveStat.node.hidden = values.passive_pps === 0;
    passiveStat.update(`${RG.format(values.passive_pps)} / second`);
    sortControls.hidden = !engine.owns("collection-book-2");
    foundCounter.textContent = `${state.counts.filter((count) => count > 0).length} / ${RG.rarities.length} found`;
    sortSelect.value = state.collectionSort;
    sortSelect.querySelector('option[value="count"]').hidden = !showQuantity;
    sortSelect.querySelector('option[value="count"]').disabled = !showQuantity;
    sound.textContent = state.sound ? "Sound on" : "Sound off";
    sound.setAttribute("aria-pressed", String(state.sound));
    restoreButton.hidden = !engine.hasResetBackup();
    saveStatus.textContent = engine.saveOK
      ? ""
      : engine.saveMessage || "Saving unavailable";
    collectionRows.forEach((view, id) => {
      const unlocked = state.counts[id] > 0;
      view.row.classList.toggle("found", unlocked);
      view.label.replaceChildren(
        unlocked
          ? RG.RarityText(id, "", engine.bestGrade(id))
          : E("span", "locked-rarity", "???"),
      );
      view.gradeDetails.hidden = !unlocked || !engine.owns("grading-kit");
      if (view.gradeDetails.open && !view.gradeDetails.hidden) {
        if (!view.gradeViews.length) {
          view.gradeViews = RG.gradeOrder.map((grade) => {
            const tile = E("div", "grade-variant");
            tile.tabIndex = 0;
            const letter = E("span"),
              quantity = E("span", "grade-quantity");
            tile.append(letter, quantity);
            RG.Tooltip(tile, () =>
              grade.rank < engine.stats.grade_limit
                ? RG.GradeInfo(grade, engine, id)
                : "???",
            );
            view.variants.append(tile);
            return { tile, letter, quantity, grade: grade.id };
          });
        }
        view.gradeViews.forEach(({ tile, letter, quantity, grade }) => {
          const known = RG.rarityGrades[grade].rank < values.grade_limit;
          tile.hidden = state.gradeCounts[id][grade] === 0;
          tile.classList.toggle("collected", state.gradeCounts[id][grade] > 0);
          tile.classList.toggle("locked", !known);
          letter.replaceChildren(
            known ? RG.RarityGrade(grade) : E("span", "", "???"),
          );
          quantity.hidden = !showQuantity || !known;
          quantity.textContent = `×${RG.format(state.gradeCounts[id][grade])}`;
          tile.setAttribute(
            "aria-label",
            known ? `Grade ${RG.rarityGrades[grade].name}` : "Locked Grade",
          );
        });
      }
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
          ? RG.oddsText(engine.resultChance(id, engine.bestGrade(id)))
          : "???"
        : "";
      view.odds.title =
        showOdds && unlocked
          ? `${(engine.resultChance(id, engine.bestGrade(id)) * 100).toPrecision(4)}% chance per roll`
          : "";
      view.badges.update(state, id);
      view.row.classList.toggle("stamped", state.stamped[id]);
      view.row.classList.toggle("has-odds", showOdds);
      view.row.classList.toggle("has-quantity", showQuantity);
      view.payout.textContent = unlocked
        ? `${RG.format(engine.reward(id, engine.bestGrade(id)) + (RG.rarityGrades[engine.bestGrade(id)]?.passiveSeconds || 0) * values.passive_pps)} Points`
        : "???";
    });
    const sorted = [...collectionRows];
    if (engine.owns("collection-book-2") && state.collectionSort !== "unsorted")
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
  const luckyDie = RG.LuckyDie(engine, update);
  root.append(luckyDie.node);
  update();
  setTab(tab);
  scheduleAutoRoll();
  let lastPassiveSave = Date.now();
  let displayedLuck = engine.stats.luck;
  const passiveTimer = setInterval(() => {
    if (prestiging) {
      engine.accrue();
      return;
    }
    luckyDie.update();
    if (displayedLuck !== engine.stats.luck) {
      displayedLuck = engine.stats.luck;
      update();
    }
    const achievementsBefore = engine.state.achievements.length;
    const lifetimeBefore = engine.state.lifetime;
    if (engine.accrue() > 0) {
      currency.update(engine.state.points);
      upgradeRows.forEach((view) => view.update());
      repeatableRows.forEach((view) => view.update());
      if (
        engine.state.achievements.length !== achievementsBefore ||
        [10, 25, 50, 100, 75000, 100000, 150000].some(
          (milestone) =>
            lifetimeBefore < milestone && engine.state.lifetime >= milestone,
        )
      )
        update();
    }
    bodyTree.update();
    sidebarStatRows.forEach((view) => view.update(engine));
    if (
      (engine.stats.passive_pps > 0 || engine.state.meta.prestiges > 0) &&
      Date.now() - lastPassiveSave >= 5000
    ) {
      engine.save();
      lastPassiveSave = Date.now();
      saveStatus.textContent = engine.saveOK ? "" : engine.saveMessage;
    }
  }, 250);
  function visibilityChanged() {
    if (document.hidden) {
      clearTimeout(autoTimer);
      engine.accrue();
      engine.save();
    } else if (
      activeRoll?.tickTimes &&
      performance.now() - started >= activeRoll.duration
    ) {
      cancelAnimationFrame(frame);
      finish();
    } else if (!document.hidden) {
      scheduleAutoRoll();
    }
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(autoTimer);
    clearInterval(passiveTimer);
    cancelAnimationFrame(frame);
    activeRoll = null;
    engine.cancelRoll();
    stopSound();
    luckyDie.stop();
    RG.stopOrbs();
    RG.stopAchievementShaders();
    treasureField.stop();
    nightMarket.stop();
    RG.clearTooltips();
    document.body.classList.remove("market-mode");
    document.removeEventListener("visibilitychange", visibilityChanged);
    engine.accrue();
    engine.save();
  }
  window.addEventListener("pagehide", stop, { once: true });
  return { stop };
};
