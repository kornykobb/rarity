"use strict";
(() => {
  const SVG = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs) => {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs))
      node.setAttribute(key, value);
    return node;
  };
  RG.SoulPanel = (engine, onChange) => {
    const node = RG.el("div", "soul");
    const orbWrap = RG.el("div", "soul-orb-wrap");
    const ring = svg("svg", {
      viewBox: "0 0 120 120",
      class: "soul-ring",
      "aria-hidden": "true",
    });
    const radius = 54,
      circumference = 2 * Math.PI * radius;
    const track = svg("circle", {
      cx: 60,
      cy: 60,
      r: radius,
      class: "soul-ring-track",
    });
    const fill = svg("circle", {
      cx: 60,
      cy: 60,
      r: radius,
      class: "soul-ring-fill",
      "stroke-dasharray": circumference,
    });
    ring.append(track, fill);
    const soulOrb = RG.SoulOrb(),
      orb = soulOrb.node;
    orbWrap.append(ring, orb);
    const rank = RG.el("div", "soul-rank"),
      progress = RG.el("p", "soul-progress"),
      balance = RG.el("p", "soul-balance"),
      passive = RG.el("p", "soul-passive");
    const modes = RG.el("div", "soul-modes");
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "Soul imbuements");
    const modeViews = RG.soul.modes.map((mode) => {
      const button = RG.Button(
        "",
        () => {
          if (engine.setSoulMode(mode.id)) onChange();
        },
        "soul-mode",
      );
      const effect = RG.el("span", "soul-mode-effect");
      button.append(
        RG.el("strong", "", mode.name),
        RG.el("span", "soul-mode-description", mode.description),
        effect,
      );
      modes.append(button);
      return { mode, button, effect };
    });
    node.append(orbWrap, rank, progress, balance, passive, modes);
    return {
      node,
      update() {
        const stats = engine.stats,
          meta = engine.state.meta,
          lit = stats.soul_rank > 0;
        fill.setAttribute(
          "stroke-dashoffset",
          String(circumference * (1 - stats.soul_progress)),
        );
        orb.hidden = !lit;
        const tint = RG.soul.colors[Math.max(0, stats.soul_rank - 1)];
        node.style.setProperty("--soul-color", tint);
        soulOrb.set(
          "tint",
          ...[1, 3, 5].map((index) => parseInt(tint.slice(index, index + 2), 16) / 255),
        );
        node.classList.toggle("lit", lit);
        rank.hidden = balance.hidden = passive.hidden = modes.hidden = !lit;
        rank.textContent = `Soul Rank ${stats.soul_rank}`;
        progress.textContent = stats.soul_next
          ? `${RG.format(Math.floor(meta.essenceEarned))} / ${RG.format(stats.soul_next)} Essence`
          : "Max Rank";
        balance.textContent = `${RG.format(meta.currencies.soul)} Soul (+${RG.format(stats.soul_rate)} / second)`;
        passive.textContent = `×${RG.format(1 + stats.soul_rank * RG.soul.pointsPerRank)} Points, ×${RG.format(1 + stats.soul_rank * RG.soul.essencePerRank)} Essence, +${RG.format(stats.soul_rank * RG.soul.luckPerRank)} Luck`;
        for (const view of modeViews) {
          const active = meta.soulMode === view.mode.id;
          view.button.classList.toggle("active", active);
          view.button.setAttribute("aria-pressed", String(active));
          view.effect.textContent = view.mode.effect(
            stats.soul_rank,
            meta.currencies.essence,
          );
        }
      },
    };
  };
  RG.BodyTree = (engine, { onPrestige = () => {}, onChange = () => {} } = {}) => {
    const node = RG.el("section", "body-view");
    node.hidden = true;
    node.setAttribute("aria-label", "Body");
    const viewport = RG.el("div", "body-tree-viewport");
    viewport.tabIndex = 0;
    viewport.setAttribute("aria-label", "Body tree canvas");
    const world = RG.el("div", "body-tree-world"),
      edges = RG.el("canvas", "body-tree-edges");
    edges.width = 1600;
    edges.height = 1200;
    edges.setAttribute("aria-hidden", "true");
    world.append(edges);
    const panel = RG.el("section", "body-layer-panel");
    panel.hidden = true;
    panel.setAttribute("aria-label", "Layer information");
    const panelHeader = RG.el("div", "body-layer-header");
    const tabs = RG.el("nav", "body-layer-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Body layers");
    const activeTab = RG.Button("", () => {}, "body-layer-tab");
    activeTab.setAttribute("role", "tab");
    activeTab.setAttribute("aria-selected", "true");
    activeTab.id = "body-layer-tab";
    activeTab.setAttribute("aria-controls", "body-layer-content");
    tabs.append(activeTab);
    const closeLayer = RG.Button(
      "×",
      () => {
        selected = null;
        update();
        viewport.focus();
      },
      "body-layer-close",
    );
    closeLayer.setAttribute("aria-label", "Close layer");
    const content = RG.el("div", "body-layer-content");
    content.id = "body-layer-content";
    content.setAttribute("role", "tabpanel");
    content.setAttribute("aria-labelledby", activeTab.id);
    const balance = RG.el("div", "body-layer-balance"),
      rate = RG.el("p");
    const prestigeReset = RG.TreeResetButton({
      label: "Prestige",
      onReset: () => onPrestige(),
    });
    const prestigeNote = RG.el(
      "p",
      "",
      "Resets your run. Keeps achievements, Treasures, Prestige, Essence and Soul.",
    );
    const soul = RG.SoulPanel(engine, () => {
      update();
      onChange();
    });
    content.append(balance, rate, prestigeReset.node, prestigeNote, soul.node);
    panelHeader.append(tabs, closeLayer);
    panel.append(panelHeader, content);
    let selected = null,
      panX = 0,
      panY = 0,
      zoom = 1,
      drag = null;
    const views = RG.bodyLayers.map((layer) => {
      const button = RG.Button(
        "",
        () => {
          selected = layer.id;
          update();
        },
        `body-node body-layer-node body-layer-${layer.id}`,
      );
      button.setAttribute("aria-label", `${layer.name} layer`);
      button.style.setProperty("--layer-color", layer.color);
      button.style.left = layer.position.x + "px";
      button.style.top = layer.position.y + "px";
      const shader = RG.NodeShader(layer.id);
      if (shader) {
        button.classList.add("shaded");
        button.append(shader.node);
      }
      button.append(RG.el("span", "body-node-symbol", layer.symbol));
      world.append(button);
      return { layer, button };
    });
    const ctx = edges.getContext("2d");
    ctx.scale(2, 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    for (const layer of RG.bodyLayers) {
      const parent = RG.bodyLayers.find((l) => l.id === layer.parent);
      if (!parent) continue;
      ctx.beginPath();
      ctx.moveTo(parent.position.x, parent.position.y);
      ctx.lineTo(layer.position.x, layer.position.y);
      ctx.stroke();
    }
    function transform() {
      world.style.transform = `translate(calc(-50% + ${panX}px),calc(-50% + ${panY}px)) scale(${zoom})`;
    }
    const toolbar = RG.el("div", "body-tree-toolbar");
    toolbar.append(
      RG.Button("−", () => {
        zoom = Math.max(0.5, zoom - 0.15);
        transform();
      }),
      RG.Button("Center", () => {
        panX = panY = 0;
        zoom = 1;
        transform();
      }),
      RG.Button("+", () => {
        zoom = Math.min(2, zoom + 0.15);
        transform();
      }),
    );
    toolbar.children[0].setAttribute("aria-label", "Zoom out");
    toolbar.children[2].setAttribute("aria-label", "Zoom in");
    viewport.append(world, toolbar);
    node.append(viewport, panel);
    viewport.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      drag = { x: event.clientX, y: event.clientY, panX, panY };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag) return;
      panX = drag.panX + event.clientX - drag.x;
      panY = drag.panY + event.clientY - drag.y;
      transform();
    });
    const release = () => {
      drag = null;
    };
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    viewport.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        zoom = Math.max(0.5, Math.min(2, zoom - event.deltaY * 0.001));
        transform();
      },
      { passive: false },
    );
    viewport.addEventListener("keydown", (event) => {
      if (event.target !== viewport) return;
      const offsets = {
        ArrowLeft: [30, 0],
        ArrowRight: [-30, 0],
        ArrowUp: [0, 30],
        ArrowDown: [0, -30],
      };
      if (offsets[event.key]) {
        event.preventDefault();
        panX += offsets[event.key][0];
        panY += offsets[event.key][1];
        transform();
      }
    });
    function update() {
      for (const view of views) {
        view.button.classList.toggle("active", selected === view.layer.id);
        view.button.classList.toggle(
          "can-reset",
          view.layer.id === "prestige" && engine.canPrestige,
        );
        view.button.setAttribute(
          "aria-pressed",
          String(selected === view.layer.id),
        );
      }
      node.classList.toggle("has-layer", !!selected);
      panel.hidden = !selected;
      if (!selected) return;
      const layer = RG.bodyLayers.find((l) => l.id === selected),
        isPrestige = layer.id === "prestige";
      activeTab.textContent = layer.name;
      balance.textContent =
        RG.format(engine.state.meta.currencies[layer.currency]) +
        " " +
        layer.name;
      rate.hidden = isPrestige;
      rate.textContent =
        RG.format(engine.stats.essence_rate) + " Essence / second";
      prestigeReset.node.hidden = prestigeNote.hidden = !isPrestige;
      prestigeReset.update({
        label: "Prestige",
        gain: engine.canPrestige ? "+1 Prestige" : "Requires Legendary",
        enabled: engine.canPrestige,
      });
      soul.node.hidden = layer.id !== "essence";
      if (!soul.node.hidden) soul.update();
    }
    transform();
    return {
      node,
      update,
      reset() {
        selected = null;
        panX = panY = 0;
        zoom = 1;
        panel.hidden = true;
        node.classList.remove("has-layer");
        transform();
      },
    };
  };
  RG.PrestigeDialog = (engine, onPrestige) => {
    const node = RG.el("dialog", "prestige-dialog");
    node.setAttribute("aria-label", "Legendary");
    const close = RG.Button("×", () => node.close(), "prestige-close");
    close.setAttribute("aria-label", "Keep rolling");
    node.append(
      close,
      ...RG.prestigeDialogue.map((text) => RG.el("p", "", text)),
      RG.Button("PRESTIGE", onPrestige, "prestige-button"),
    );
    return {
      node,
      open() {
        if (!engine.canPrestige || node.open) return;
        node.showModal();
        engine.recordAction("legendary-dialogue");
      },
    };
  };
})();
