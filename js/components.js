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
    const show = () => {
      if (!definition.tooltip) return;
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
        tooltip.textContent = definition.tooltip?.(engine.stats) || "";
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
        node.hidden = !engine.repeatableAvailable(upgrade);
        node.classList.toggle(
          "owned",
          upgrade.max !== null && count >= upgrade.max,
        );
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
