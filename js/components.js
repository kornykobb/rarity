"use strict";
(() => {
  RG.el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  RG.RarityText = (id, size = "", gradeId = null) => {
    const rarity = RG.rarities[id];
    const node = RG.el(
      "span",
      `rarity-text rarity-${rarity.appearance.treatment} ${size}`,
      rarity.name,
    );
    node.style.setProperty("--rarity-color", rarity.color);
    node.style.setProperty("--rarity-stroke", `${rarity.appearance.stroke}px`);
    node.style.setProperty("--rarity-weight", rarity.appearance.weight);
    const grade = RG.rarityGrades[gradeId];
    if (!grade) return node;
    const wrapper = RG.el("span", `graded-rarity ${size}`);
    const badge = RG.RarityGrade(gradeId);
    wrapper.append(node, badge);
    return wrapper;
  };
  RG.RarityGrade = (id) => {
    const grade = RG.rarityGrades[id];
    const badge = RG.el(
      "span",
      `rarity-grade-badge${grade.treatment === "gradient" ? " advanced" : ""}${grade.name === "Ω" ? " omega" : ""}`,
      grade.name,
    );
    badge.style.setProperty("--grade-color", grade.color);
    badge.setAttribute("aria-label", `Grade ${grade.name}`);
    return badge;
  };
  RG.GradeInfo = (grade, engine, rarityId) => {
    const info = RG.el("div", "rarity-grade-info");
    info.append(
      RG.el("strong", "", `Grade ${grade.name}`),
      RG.el(
        "p",
        "",
        `+${RG.format((grade.pointMultiplier - 1) * 100)}% rolling Points`,
      ),
    );
    if (grade.discoveryPoints)
      info.append(
        RG.el(
          "p",
          "",
          `+${grade.discoveryPoints} Points on first rarity discovery`,
        ),
      );
    if (grade.passiveSeconds)
      info.append(
        RG.el(
          "p",
          "",
          `Bonus: ${grade.passiveSeconds} seconds of passive Points on this roll`,
        ),
      );
    if (engine.owns("lucky-eye"))
      info.append(
        RG.el(
          "p",
          "",
          `Grade odds: ${RG.oddsText(engine.gradeChances[grade.id])}`,
        ),
        RG.el(
          "p",
          "",
          `Rarity + Grade odds: ${RG.oddsText(engine.resultChance(rarityId, grade.id))}`,
        ),
      );
    if (engine.owns("inventory"))
      info.append(
        RG.el(
          "p",
          "",
          `Collected: ${RG.format(engine.state.gradeCounts[rarityId][grade.id])}`,
        ),
      );
    return info;
  };
  RG.CollectionBadges = () => {
    const views = RG.collectionBadges.map((badge) => {
      const node = RG.el("img", badge.className);
      node.src = badge.image;
      node.alt = badge.name;
      node.hidden = true;
      return { badge, node };
    });
    return {
      nodes: views.map((view) => view.node),
      update(state, id) {
        views.forEach(({ badge, node }) => {
          node.hidden = !state.badges[badge.id][id];
        });
      },
    };
  };
  RG.Button = (label, action, className = "") => {
    const button = RG.el("button", `gloss-button ${className}`, label);
    button.type = "button";
    button.addEventListener("click", action);
    return button;
  };
  RG.TreeResetButton = ({ label, gain = "", enabled = false, onReset }) => {
    const node = RG.Button(
      "",
      () => {
        if (!node.disabled) onReset();
      },
      "tree-reset-button",
    );
    const title = RG.el("span"),
      reward = RG.el("span");
    node.append(title, reward);
    function update(options) {
      title.textContent = options.label;
      reward.textContent = options.gain || "";
      reward.hidden = !options.gain;
      node.disabled = !options.enabled;
    }
    update({ label, gain, enabled });
    return { node, update };
  };
  RG.DiceIcon = () => {
    const make = (tag, attrs) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [key, value] of Object.entries(attrs))
        node.setAttribute(key, value);
      return node;
    };
    const icon = make("svg", {
      viewBox: "0 0 24 24",
      width: 20,
      height: 20,
      "aria-hidden": "true",
      focusable: "false",
    });
    icon.append(
      make("rect", {
        x: 3,
        y: 3,
        width: 18,
        height: 18,
        rx: 3,
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.5,
      }),
    );
    for (const [cx, cy] of [
      [8, 8],
      [16, 8],
      [12, 12],
      [8, 16],
      [16, 16],
    ])
      icon.append(make("circle", { cx, cy, r: 1.35, fill: "currentColor" }));
    return icon;
  };
  RG.CurrencyStrip = () => {
    const node = RG.el("div", "currency-strip");
    const icon = RG.el("button", "currency-icon", "✦");
    icon.type = "button";
    icon.setAttribute("aria-label", "Points star");
    const label = RG.el("span", "", "Points");
    const value = RG.el("strong", "currency-value", "0");
    node.append(icon, label, value);
    return {
      node,
      icon,
      update: (points) => {
        value.textContent = RG.format(points);
      },
    };
  };
  RG.SidebarStat = (definition) => {
    const node = RG.el("div", `sidebar-stat sidebar-stat-${definition.id}`);
    node.tabIndex = definition.tooltip ? 0 : -1;
    node.hidden = true;
    node.style.setProperty("--stat-color", definition.color);
    const icon = RG.el("span", "sidebar-stat-icon");
    if (typeof definition.icon === "function") icon.append(definition.icon());
    else icon.textContent = definition.icon;
    icon.setAttribute("aria-hidden", "true");
    const value = RG.el("span", "sidebar-stat-value");
    node.append(
      icon,
      RG.el("span", "sidebar-stat-name", definition.name),
      value,
    );
    const tooltip = RG.el("div", "stat-tooltip");
    tooltip.id = `stat-tooltip-${definition.id}`;
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    if (definition.tooltip) node.setAttribute("aria-describedby", tooltip.id);
    node.append(tooltip);
    const position = () => {
      const rect = node.getBoundingClientRect(),
        box = tooltip.getBoundingClientRect();
      let left = rect.right + 12,
        top = rect.top + (rect.height - box.height) / 2;
      if (left + box.width > innerWidth - 12) {
        left = Math.max(12, Math.min(rect.left, innerWidth - box.width - 12));
        top = rect.bottom + 8;
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(12, Math.min(top, innerHeight - box.height - 12))}px`;
    };
    let currentStats;
    const show = () => {
      if (!definition.tooltip) return;
      tooltip.textContent = definition.tooltip?.(currentStats) || "";
      tooltip.hidden = false;
      position();
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    node.addEventListener("mouseenter", show);
    node.addEventListener("mouseleave", () => {
      if (!node.matches(":focus-within")) hide();
    });
    node.addEventListener("focus", show);
    node.addEventListener("blur", hide);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return {
      node,
      update(engine) {
        currentStats = engine.stats;
        node.hidden = !definition.unlocked(engine);
        value.textContent = definition.value(engine.stats);
        tooltip.textContent = definition.tooltip?.(engine.stats) || "";
        if (!tooltip.hidden) position();
      },
    };
  };
  RG.upgradeTeased = (upgrade, engine) =>
    !upgrade.requires || engine.owns(upgrade.requires);
  RG.hiddenName = (name) => name.replace(/\S/g, "?");
  RG.Upgrade = (upgrade, engine, onPurchase) => {
    const node = RG.el("article", "upgrade");
    const content = RG.el("div", "upgrade-content");
    const name = RG.el("div", "upgrade-name", upgrade.name),
      description = RG.el("p", "upgrade-description", upgrade.description);
    content.append(name, description);
    const button = RG.Button("", () => onPurchase(upgrade.id), "upgrade-buy");
    const badge = RG.collectionBadges.find((item) => item.id === upgrade.id);
    if (badge) {
      const image = RG.el("img", "upgrade-badge-icon");
      image.src = badge.image;
      image.alt = "";
      node.append(image);
      if (upgrade.id === "participation-prize")
        RG.Tooltip(
          node,
          () =>
            "+2% rolling value per doubling of rarity + Grade odds, up to +50%. Discovery bonuses and passive Points are separate. Applies to rolls started after purchase.",
        );
    }
    node.append(content, button);
    return {
      node,
      update() {
        const available = engine.upgradeAvailable(upgrade),
          locked = !available && !engine.owns(upgrade.id);
        node.hidden = locked && !RG.upgradeTeased(upgrade, engine);
        node.classList.toggle("locked", locked);
        name.textContent = locked ? RG.hiddenName(upgrade.name) : upgrade.name;
        description.textContent = locked
          ? engine.requirementText(upgrade)
          : upgrade.description;
        const owned = engine.owns(upgrade.id);
        node.classList.toggle("owned", owned);
        button.textContent = owned
          ? "Owned"
          : locked
            ? "Locked"
            : `${RG.format(upgrade.cost)} Points`;
        button.disabled = !engine.canBuy(upgrade.id);
      },
    };
  };
  let tooltipId = 0;
  const tooltips = new Set();
  RG.Tooltip = (target, content, { placement = "above" } = {}) => {
    const node = RG.el("div", "game-tooltip");
    node.id = `game-tooltip-${++tooltipId}`;
    node.setAttribute("role", "tooltip");
    node.setAttribute("popover", "manual");
    target.setAttribute("aria-describedby", node.id);
    document.body.append(node);
    const hide = () => {
      if (node.matches(":popover-open")) node.hidePopover();
    };
    const show = () => {
      node.replaceChildren();
      const value = typeof content === "function" ? content() : content;
      if (typeof value === "string") node.textContent = value;
      else node.append(value);
      node.showPopover();
      const rect = target.getBoundingClientRect(),
        size = node.getBoundingClientRect();
      let left = rect.left + (rect.width - size.width) / 2;
      const gap = placement === "side" ? 42 : 10;
      let top =
        rect.top > size.height + gap + 8
          ? rect.top - size.height - gap
          : rect.bottom + 10;
      if (placement === "side" && rect.right + size.width + 24 < innerWidth) {
        left = rect.right + 14;
        top = rect.top + (rect.height - size.height) / 2;
      } else if (placement === "side" && rect.left > size.width + 24) {
        left = rect.left - size.width - 14;
        top = rect.top + (rect.height - size.height) / 2;
      }
      node.style.left = `${Math.max(10, Math.min(innerWidth - size.width - 10, left))}px`;
      node.style.top = `${Math.max(10, Math.min(innerHeight - size.height - 10, top))}px`;
    };
    target.addEventListener("mouseenter", show);
    target.addEventListener("focus", show);
    target.addEventListener("mouseleave", hide);
    target.addEventListener("blur", hide);
    target.addEventListener("pointerdown", hide);
    target.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    tooltips.add(node);
    return {
      hide,
      destroy() {
        hide();
        node.remove();
        tooltips.delete(node);
      },
    };
  };
  RG.clearTooltips = () => {
    tooltips.forEach((node) => node.remove());
    tooltips.clear();
  };
  RG.hideTooltips = () =>
    tooltips.forEach((node) => {
      if (node.matches(":popover-open")) node.hidePopover();
    });
  RG.Stat = (label, tooltip) => {
    const node = RG.el("div", "roll-stat");
    const value = RG.el("span");
    node.append(RG.el("span", "", label), value);
    if (tooltip) {
      node.tabIndex = 0;
      RG.Tooltip(node, tooltip);
    }
    return {
      node,
      update(text) {
        value.textContent = text;
      },
    };
  };
  RG.RepeatableUpgrade = (upgrade, engine, onPurchase, onBuyMax) => {
    const node = RG.el("article", "upgrade repeatable-upgrade");
    const content = RG.el("div", "upgrade-content");
    const heading = RG.el("div", "upgrade-name");
    const title = RG.el("span", "", upgrade.name);
    const level = RG.el("span", "upgrade-level");
    heading.append(title, level);
    const effect = RG.el("div", "upgrade-effect");
    const description = RG.el(
      "p",
      "upgrade-description",
      upgrade.description,
    );
    content.append(heading, description, effect);
    const flash = RG.el("div", "purchase-flash");
    flash.setAttribute("aria-hidden", "true");
    const button = RG.Button(
      "",
      () => {
        if (onPurchase(upgrade.id)) {
          flash.getAnimations().forEach((animation) => animation.cancel());
          flash.animate(
            [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }],
            {
              duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 180
                : 850,
              easing: "ease-out",
            },
          );
        }
      },
      "upgrade-buy",
    );
    const maxButton = RG.Button(
      "Max",
      () => {
        if (!onBuyMax(upgrade.id)) return;
        flash.getAnimations().forEach((animation) => animation.cancel());
        flash.animate(
          [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }],
          { duration: 850, easing: "ease-out" },
        );
      },
      "upgrade-buy-max",
    );
    maxButton.setAttribute("aria-label", `Buy max ${upgrade.name}`);
    const buttons = RG.el("div", "upgrade-buttons");
    buttons.append(button, maxButton);
    node.append(content, buttons, flash);
    return {
      node,
      update() {
        const count = engine.state.levels[upgrade.id],
          stats = engine.stats,
          locked = !engine.repeatableAvailable(upgrade);
        node.hidden = locked && !RG.upgradeTeased(upgrade, engine);
        node.classList.toggle("locked", locked);
        title.textContent = locked ? RG.hiddenName(upgrade.name) : upgrade.name;
        description.textContent = locked
          ? engine.requirementText(upgrade)
          : upgrade.description;
        effect.hidden = level.hidden = locked;
        maxButton.hidden = locked || !engine.owns("shopping-cart");
        maxButton.disabled = !engine.canBuyRepeatable(upgrade.id);
        node.classList.toggle(
          "owned",
          upgrade.max !== null && count >= upgrade.max,
        );
        level.textContent =
          upgrade.max === null ? `Lv. ${count}` : `${count} / ${upgrade.max}`;
        effect.textContent = upgrade.effect(stats);
        button.textContent = locked
          ? "Locked"
          : upgrade.max !== null && count >= upgrade.max
            ? "Max level"
            : `${RG.format(engine.repeatableCost(upgrade.id))} Points`;
        button.disabled = !engine.canBuyRepeatable(upgrade.id);
      },
    };
  };
  RG.GradeText = (grade) => {
    const node = RG.el(
      "span",
      `grade-text grade-${grade.toLowerCase()}`,
      grade,
    );
    const style = RG.rarityGrades.find((item) => item.name === grade);
    if (style && !["S", "SS"].includes(grade)) node.style.color = style.color;
    return node;
  };
  RG.AchievementTierStyle = (node, tierId = 0) => {
    const tier = RG.achievementTiers[tierId];
    node.dataset.tier = tier.name.toLowerCase();
    node.style.setProperty("--tier-fill", tier.fill);
    node.style.setProperty("--tier-stroke", tier.stroke);
    return tier;
  };
  RG.AchievementBox = (achievement, toast = false) => {
    const node = RG.el(
      "article",
      `achievement-box${toast ? " achievement-toast" : ""}`,
    );
    node.dataset.achievementId = achievement.number;
    const tier = RG.AchievementTierStyle(node, achievement.tier || 0);
    node.append(RG.el("span", "achievement-number", achievement.number));
    node.append(
      RG.el(
        "div",
        "achievement-tier",
        `${achievement.tierUp ? "Tier up: " : ""}${tier.name}`,
      ),
    );
    const name = RG.el("div", "achievement-name");
    if (achievement.faceHeart) {
      name.setAttribute("aria-label", achievement.name);
      const heart = RG.el("span", "beefer-heart");
      heart.setAttribute("aria-hidden", "true");
      name.append(
        document.createTextNode("We "),
        heart,
        document.createTextNode(" Baby Beefer"),
      );
    } else name.textContent = achievement.name;
    node.append(
      name,
      RG.el("p", "achievement-description", achievement.description),
    );
    node.append(
      RG.el("div", "achievement-requirement", achievement.requirementText),
      RG.el(
        "div",
        "achievement-reward",
        achievement.tierUp ? "" : achievement.rewardText,
      ),
    );
    const grade = RG.GradeText(achievement.grade);
    node.append(grade);
    if (!toast && !achievement.faceHeart) RG.AchievementShader(name, tier);

    if (toast) RG.AchievementSurface(node, tier);
    return node;
  };
  RG.AchievementTile = (achievement) => {
    const node = RG.el("article", "achievement-tile");
    let previous;
    return {
      node,
      update(engine) {
        const earned = engine.state.achievements.includes(achievement.id);
        const tier = earned ? engine.achievementTier(achievement.id) : -1;
        if (tier !== previous) {
          previous = tier;
          node.dataset.achievementId = achievement.number;
          node.className = `achievement-tile ${earned ? "achievement-box earned" : "locked"}`;
          node.setAttribute(
            "aria-label",
            earned
              ? `Achievement ${achievement.number}: ${achievement.name}, ${RG.achievementTiers[tier].name}`
              : `Achievement ${achievement.number}, locked`,
          );
          if (earned) {
            RG.AchievementTierStyle(node, tier);
            node.replaceChildren(
              ...RG.AchievementBox(engine.achievementView(achievement))
                .childNodes,
            );
            RG.AchievementSurface(node, RG.achievementTiers[tier]);
          } else
            node.replaceChildren(
              RG.el("span", "achievement-number", achievement.number),
              RG.el("span", "achievement-question", "?"),
            );
        }
      },
    };
  };
  RG.Changelog = () => {
    const node = RG.el("section", "changelog");
    node.id = "changelog";
    node.setAttribute("popover", "auto");
    node.setAttribute("aria-label", "Changelog");
    const content = (entry) => {
      const fragment = document.createDocumentFragment();
      if (entry.thanks) fragment.append(RG.el("p", "", entry.thanks));
      const date = RG.el("time", "changelog-date", entry.date);
      date.dateTime = entry.date;
      fragment.append(
        date,
        RG.el(
          "h2",
          "",
          `v${entry.version}${entry.name ? ` - ${entry.name}` : ""}`,
        ),
      );
      const list = RG.el("ul");
      entry.changes.forEach((change) => list.append(RG.el("li", "", change)));
      fragment.append(list);
      return fragment;
    };
    RG.changelog.forEach((entry) => node.append(content(entry)));
    return node;
  };
  RG.ConfirmDialog = () => {
    const node = RG.el("dialog", "confirm-dialog");
    const text = RG.el("p");
    const actions = RG.el("div", "confirm-actions");
    let resolve = null;
    const finish = (value) => {
      resolve?.(value);
      resolve = null;
      if (node.open) node.close();
    };
    const cancel = RG.Button("Cancel", () => finish(false));
    const ok = RG.Button("OK", () => finish(true), "confirm-ok");
    actions.append(cancel, ok);
    node.append(text, actions);
    node.addEventListener("close", () => finish(false));
    return {
      node,
      ask(message) {
        finish(false);
        text.textContent = message;
        node.showModal();
        cancel.focus();
        return new Promise((done) => {
          resolve = done;
        });
      },
    };
  };
  RG.ToastSystem = () => {
    const node = RG.el("div", "toast-stack");
    node.setAttribute("role", "region");
    node.setAttribute("aria-label", "Notifications");
    node.setAttribute("aria-live", "polite");
    if (typeof node.showPopover === "function")
      node.setAttribute("popover", "manual");
    const show = (achievement) => {
      if (
        typeof node.showPopover === "function" &&
        !node.matches(":popover-open")
      )
        node.showPopover();
      const toast = RG.AchievementBox(achievement, true);
      const dismiss = RG.Button(
        "×",
        () => {
          clearTimeout(timer);
          toast.remove();
        },
        "toast-dismiss",
      );
      dismiss.setAttribute("aria-label", "Dismiss notification");
      toast.append(dismiss);
      node.append(toast);
      const timer = setTimeout(() => toast.remove(), 6500);
      if (node.children.length > 3) node.firstElementChild.remove();
    };
    const message = (...content) => {
      if (
        typeof node.showPopover === "function" &&
        !node.matches(":popover-open")
      )
        node.showPopover();
      const toast = RG.el("div", "message-toast");
      toast.append(...content);
      node.append(toast);
      setTimeout(() => toast.remove(), 3200);
      if (node.children.length > 3) node.firstElementChild.remove();
    };
    const mount = (parent) => {
      if (
        typeof node.hidePopover === "function" &&
        node.matches(":popover-open")
      )
        node.hidePopover();
      parent.append(node);
      if (node.children.length && typeof node.showPopover === "function")
        node.showPopover();
    };
    return { node, show, message, mount };
  };
})();
