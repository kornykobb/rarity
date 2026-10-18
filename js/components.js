"use strict";
(() => {
  RG.el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  RG.RarityText = (id, size = "") => {
    const rarity = RG.rarities[id];
    const node = RG.el(
      "span",
      `rarity-text rarity-${rarity.appearance.treatment} ${size}`,
      rarity.name,
    );
    node.style.setProperty("--rarity-color", rarity.color);
    node.style.setProperty("--rarity-stroke", `${rarity.appearance.stroke}px`);
    node.style.setProperty("--rarity-weight", rarity.appearance.weight);
    return node;
  };
  RG.Button = (label, action, className = "") => {
    const button = RG.el("button", `gloss-button ${className}`, label);
    button.type = "button";
    button.addEventListener("click", action);
    return button;
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
    node.tabIndex = 0;
    node.hidden = true;
    node.style.setProperty("--stat-color", definition.color);
    const icon = RG.el("span", "sidebar-stat-icon", definition.icon);
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
    node.setAttribute("aria-describedby", tooltip.id);
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
    const show = () => {
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
        node.hidden = !definition.unlocked(engine);
        value.textContent = definition.value(engine.stats);
        tooltip.textContent = definition.tooltip(engine.stats);
        if (!tooltip.hidden) position();
      },
    };
  };
  RG.Upgrade = (upgrade, engine, onPurchase) => {
    const node = RG.el("article", "upgrade");
    const content = RG.el("div", "upgrade-content");
    content.append(
      RG.el("div", "upgrade-name", upgrade.name),
      RG.el("p", "upgrade-description", upgrade.description),
    );
    const button = RG.Button("", () => onPurchase(upgrade.id), "upgrade-buy");
    node.append(content, button);
    return {
      node,
      update() {
        node.hidden = !!upgrade.requires && !engine.owns(upgrade.requires);
        const owned = engine.owns(upgrade.id);
        node.classList.toggle("owned", owned);
        button.textContent = owned
          ? "Owned"
          : `${RG.format(upgrade.cost)} Points`;
        button.disabled = !engine.canBuy(upgrade.id);
      },
    };
  };
  RG.Stat = (label) => {
    const node = RG.el("div", "roll-stat");
    const value = RG.el("span");
    node.append(RG.el("span", "", label), value);
    return {
      node,
      update(text) {
        value.textContent = text;
      },
    };
  };
  RG.RepeatableUpgrade = (upgrade, engine, onPurchase) => {
    const node = RG.el("article", "upgrade repeatable-upgrade");
    const content = RG.el("div", "upgrade-content");
    const heading = RG.el("div", "upgrade-name", upgrade.name);
    const level = RG.el("span", "upgrade-level");
    heading.append(level);
    const effect = RG.el("div", "upgrade-effect");
    content.append(
      heading,
      RG.el("p", "upgrade-description", upgrade.description),
      effect,
    );
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
    node.append(content, button, flash);
    return {
      node,
      update() {
        const count = engine.state.levels[upgrade.id],
          stats = engine.stats;
        node.hidden = !!upgrade.requires && !engine.owns(upgrade.requires);
        node.classList.toggle("owned", count > 0);
        level.textContent =
          upgrade.max === null ? `Lv. ${count}` : `${count} / ${upgrade.max}`;
        effect.textContent = upgrade.effect(stats);
        button.textContent =
          upgrade.max !== null && count >= upgrade.max
            ? "Max level"
            : `${RG.format(engine.repeatableCost(upgrade.id))} Points`;
        button.disabled = !engine.canBuyRepeatable(upgrade.id);
      },
    };
  };
  RG.GradeText = (grade) =>
    RG.el("span", `grade-text grade-${grade.toLowerCase()}`, grade);
  RG.AchievementBox = (achievement, toast = false) => {
    const node = RG.el(
      "article",
      `achievement-box${toast ? " achievement-toast" : ""}`,
    );
    node.append(RG.el("span", "achievement-number", achievement.number));
    node.append(
      RG.el("div", "achievement-name", achievement.name),
      RG.el("p", "achievement-description", achievement.description),
    );
    node.append(
      RG.el("div", "achievement-requirement", achievement.requirementText),
      RG.el("div", "achievement-reward", achievement.rewardText),
    );
    const grade = RG.GradeText(achievement.grade);
    node.append(grade);
    return node;
  };
  RG.AchievementTile = (achievement) => {
    const node = RG.el("article", "achievement-tile");
    let previous;
    return {
      node,
      update(engine) {
        const earned = engine.state.achievements.includes(achievement.id);
        if (earned === previous) return;
        previous = earned;
        node.dataset.achievementId = achievement.number;
        node.className = `achievement-tile ${earned ? "achievement-box earned" : "locked"}`;
        node.setAttribute(
          "aria-label",
          earned
            ? `Achievement ${achievement.number}: ${achievement.name}`
            : `Achievement ${achievement.number}, locked`,
        );
        if (earned)
          node.replaceChildren(...RG.AchievementBox(achievement).childNodes);
        else
          node.replaceChildren(
            RG.el("span", "achievement-number", achievement.number),
            RG.el("span", "achievement-question", "?"),
          );
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
    return { node, show, mount };
  };
})();
