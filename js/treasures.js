"use strict";
(() => {
  RG.TreasureInfo = (item, engine) => {
    const info = RG.el("div", "treasure-info");
    info.append(
      RG.el("strong", "", item.name),
      RG.el(
        "div",
        `treasure-rarity treasure-${item.rarity}`,
        `${item.rarity[0].toUpperCase()}${item.rarity.slice(1)} Treasure`,
      ),
    );
    info.append(RG.el("p", "", item.description));
    if (item.passiveMultiplier)
      info.append(
        RG.el(
          "p",
          "",
          `Passive: ×${item.passiveMultiplier} passive Point income.`,
        ),
      );
    if (item.achievementBonus) {
      const power = engine.state.achievements.includes("tier-up") ? 1.03 : 1;
      info.append(
        RG.el(
          "p",
          "",
          `Passive: +${RG.format(item.achievementBonus * power * 100)}% rolling Points per earned achievement.`,
        ),
      );
      info.append(
        RG.el(
          "div",
          "",
          `${engine.state.achievements.length} achievements: +${RG.format(engine.state.achievements.length * item.achievementBonus * power * 100)}% rolling Points.`,
        ),
      );
    }
    info.append(
      RG.el(
        "div",
        "",
        engine.ownsTreasure(item.id)
          ? "Owned"
          : `${RG.format(item.price)} Points`,
      ),
    );
    return info;
  };
  let cityLookup;
  RG.lookupCity = () => {
    if (!cityLookup)
      cityLookup = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(
            "https://free.freeipapi.com/api/v1/json/",
            {
              credentials: "omit",
              referrerPolicy: "no-referrer",
              signal: controller.signal,
            },
          );
          if (!response.ok) return null;
          const result = await response.json();
          if (typeof result.cityName !== "string") return null;
          const city = result.cityName.trim();
          return city.length > 0 &&
            city.length <= 80 &&
            !/[\u0000-\u001f\u007f<>]/.test(city) &&
            !/^(unknown|null|n\/a)$/i.test(city)
            ? city
            : null;
        } catch {
          return null;
        } finally {
          clearTimeout(timeout);
        }
      })();
    return cityLookup;
  };
  RG.NightMarket = (engine, onPurchase) => {
    const node = RG.el("section", "night-market-room");
    node.setAttribute("aria-label", "Night Market");
    node.hidden = true;
    const scene = RG.el("div", "market-scene");
    const art = RG.el("img", "market-room-art");
    art.src = "assets/market-room.png";
    art.alt = "";
    scene.append(art);
    node.append(scene);
    const dialogue = RG.el("div", "market-dialogue");
    const dialogueText = RG.el("span", "market-dialogue-text");
    const controls = RG.el("div", "market-dialogue-controls");
    dialogue.append(dialogueText, controls);
    const announcement = RG.el("span", "sr-only");
    announcement.setAttribute("aria-live", "polite");
    const merchant = RG.Button("", () => talk(), "shadow-guy");
    merchant.setAttribute("aria-label", "Talk to Shadow Guy");
    const door = RG.el("img", "market-door");
    door.src = "assets/market-door.png";
    door.alt = "Night Market closed";
    door.hidden = true;
    node.append(door);
    scene.append(merchant, dialogue, announcement);
    let dialogueTimer = 0,
      previousQuote = -1,
      dialogueGeneration = 0,
      city = null,
      closed = false,
      closing = false;
    function stopDialogue() {
      dialogueGeneration++;
      clearTimeout(dialogueTimer);
      dialogueTimer = 0;
      dialogueText.textContent = "";
      controls.replaceChildren();
      announcement.textContent = "";
    }
    function closeShop() {
      if (closed) return;
      closed = true;
      engine.recordAction("market-closed");
      onPurchase();
      closing = false;
      stopDialogue();
      scene.inert = true;
      door.hidden = false;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => door.classList.add("closed")),
      );
      update();
    }
    function say(quote, after, erase = false) {
      stopDialogue();
      const generation = dialogueGeneration;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      let cursor = 0;
      function type() {
        if (generation !== dialogueGeneration) return;
        dialogueText.textContent = quote.slice(
          0,
          reduced ? quote.length : ++cursor,
        );
        if (cursor < quote.length && !reduced)
          dialogueTimer = setTimeout(type, 30);
        else if (erase)
          dialogueTimer = setTimeout(stopDialogue, reduced ? 1500 : 30);
        else {
          announcement.textContent = quote;
          if (after) after();
        }
      }
      type();
    }
    function inputForm(kind) {
      const form = RG.el("form", "market-input-form");
      const input = RG.el("input");
      input.type = "text";
      input.autocomplete = "off";
      input.maxLength = kind === "name" ? 32 : 4;
      input.setAttribute(
        "aria-label",
        kind === "name" ? "Name" : "Fake card number (four digits only)",
      );
      if (kind === "card") {
        input.inputMode = "numeric";
        input.placeholder = "Fake number only: 0000";
        input.addEventListener("input", () => {
          input.value = input.value.replace(/[^0-9]/g, "").slice(0, 4);
        });
      }
      const submit = RG.el("button", "gloss-button", "→");
      submit.type = "submit";
      submit.setAttribute("aria-label", "Submit");
      form.append(input, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (kind === "name") {
          if (!engine.setMarketName(input.value)) return;
          say(
            `${engine.state.marketName}, Hmmmm? I'll remember that. Why would you willingly give me this information?`,
          );
        } else if (input.value.length) {
          input.value = "";
          closing = true;
          say("Sucker..", () => {
            dialogueTimer = setTimeout(closeShop, 800);
          });
          update();
        }
      });
      controls.append(form);
      input.focus({ preventScroll: true });
    }
    function talk(index) {
      if (closed || closing) return;
      const stock = RG.treasures.filter(
        (item) => !engine.ownsTreasure(item.id),
      );
      const poor =
        stock.length > 0 &&
        stock.every((item) => !engine.canBuyTreasure(item.id));
      const name = engine.state.marketName;
      if (!Number.isInteger(index)) {
        const available = RG.shadowQuotes
          .map((_, id) => id)
          .filter(
            (id) =>
              id !== previousQuote &&
              (![11, 19].includes(id) || city) &&
              (![18, 19].includes(id) || name) &&
              (id !== 17 || !name),
          );
        index = poor
          ? -1
          : available[Math.floor(Math.random() * available.length)];
      }
      previousQuote = index;
      if ([11, 19].includes(index) && !city) {
        stopDialogue();
        const generation = dialogueGeneration;
        RG.lookupCity().then((value) => {
          if (generation !== dialogueGeneration) return;
          city = value;
          talk(city ? index : 0);
        });
        return;
      }
      if ([18, 19].includes(index) && !name) {
        talk(17);
        return;
      }
      const quote =
        index === -1
          ? RG.shadowPoorQuote
          : index === 11
            ? `How is ${city}?`
            : index === 18
              ? `Hello, ${name}.`
              : index === 19
                ? `Living it up in ${city}, huh, ${name}?`
                : RG.shadowQuotes[index];
      if (!quote) return;
      say(
        quote,
        () => {
          if (index === 17) inputForm("name");
          if (index === 20) inputForm("card");
        },
        index === 6,
      );
    }
    const soldThisVisit = new Set();
    const items = RG.treasures.map((item) => {
      const button = RG.Button(
        "",
        () => {
          if (closed || closing || !engine.canBuyTreasure(item.id)) return;
          if (Math.random() < RG.marketRefusalChance) {
            closing = true;
            tooltip.hide();
            say(
              "Euuuuuuuuuughhhh..................i don't feeeeeel like it.....",
              () => {
                dialogueTimer = setTimeout(closeShop, 900);
              },
            );
            update();
            return;
          }
          if (!engine.buyTreasure(item.id)) return;
          soldThisVisit.add(item.id);
          tooltip.hide();
          update();
          onPurchase();
        },
        "market-item",
      );
      button.setAttribute("aria-label", item.name);
      button.style.left = `${item.shelf.x * 100}%`;
      button.style.bottom = `${item.shelf.bottom * 100}%`;
      button.style.width = `${item.shelf.width * 100}%`;
      const image = RG.el("img", "market-treasure-image");
      image.src = item.image;
      image.alt = "";
      image.draggable = false;
      const outline = RG.el("span", "market-treasure-outline");
      outline.style.setProperty("--treasure-image", `url("${item.image}")`);
      outline.append(RG.el("span", "market-silhouette"));
      const price = RG.el("span", "market-item-price");
      price.append(
        RG.el("span", "", RG.format(item.price)),
        RG.el("span", "price-currency-icon", "✦"),
      );
      button.append(image, outline, price);
      scene.append(button);
      const tooltip = RG.Tooltip(button, () => RG.TreasureInfo(item, engine), {
        placement: "side",
      });
      return { item, button, tooltip };
    });
    function update() {
      items.forEach(({ item, button }) => {
        const owned = engine.ownsTreasure(item.id);
        button.hidden = owned && !soldThisVisit.has(item.id);
        button.disabled = closed || closing;
        button.classList.toggle("purchased", owned);
        button.classList.toggle("affordable", engine.canBuyTreasure(item.id));
        button.setAttribute(
          "aria-disabled",
          String(!engine.canBuyTreasure(item.id)),
        );
      });
    }
    return {
      node,
      update,
      talk,
      stop() {
        stopDialogue();
        if (closing) closeShop();
      },
      reset() {
        closed = false;
        closing = false;
        stopDialogue();
        scene.inert = false;
        door.hidden = true;
        door.classList.remove("closed");
        soldThisVisit.clear();
        update();
      },
      enter() {
        soldThisVisit.clear();
        update();
        RG.lookupCity().then((value) => {
          city = value;
        });
        if (!closed) talk();
      },
      leave() {
        if (closing) closeShop();
        stopDialogue();
        soldThisVisit.clear();
        items.forEach((view) => view.tooltip.hide());
        update();
      },
    };
  };
  RG.TreasureField = (engine) => {
    const node = RG.el("div", "treasure-field");
    node.setAttribute("aria-label", "Treasures");
    const bodies = new Map();
    let frame = 0,
      last = 0,
      active = false;
    const bounds = (body) => ({
      width: node.clientWidth,
      height: node.clientHeight,
      size: body.node.offsetWidth,
    });
    const clamp = (body) => {
      const box = bounds(body);
      body.x = Math.max(0, Math.min(box.width - box.size, body.x));
      body.y = Math.max(0, Math.min(box.height - box.size, body.y));
    };
    const paint = (body) => {
      body.node.style.transform = `translate(${body.x}px,${body.y}px) rotate(${body.angle}rad)`;
      body.node.dataset.motion = !node.getClientRects().length
        ? "hidden"
        : body.dragging
          ? "dragging"
          : body.y >= bounds(body).height - bounds(body).size &&
              body.vx === 0 &&
              body.vy === 0 &&
              body.spin === 0 &&
              body.angle === 0
            ? "resting"
            : "moving";
    };
    const tick = (now) => {
      frame = 0;
      if (!active || !node.getClientRects().length || document.hidden) {
        last = 0;
        return;
      }
      const dt = Math.min(0.033, last ? (now - last) / 1000 : 0.016);
      last = now;
      let moving = false;
      for (const body of bodies.values()) {
        if (body.dragging) {
          moving = true;
          continue;
        }
        const box = bounds(body),
          floor = Math.max(0, box.height - box.size);
        body.vy += 1100 * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.spin * dt;
        if (body.x <= 0 || body.x + box.size >= box.width) {
          body.vx *= -0.45;
          clamp(body);
        }
        if (body.y >= floor) {
          body.y = floor;
          body.vy = Math.abs(body.vy) < 55 ? 0 : -body.vy * 0.36;
          body.vx *= Math.exp(-9 * dt);
          body.spin *= Math.exp(-8 * dt);
          body.angle *= Math.exp(-8 * dt);
          if (Math.abs(body.angle) < 0.01) body.angle = 0;
          if (Math.abs(body.vx) < 2) body.vx = 0;
          if (Math.abs(body.spin) < 0.02) body.spin = 0;
        }
        if (body.y < 0) {
          body.y = 0;
          body.vy = Math.abs(body.vy) * 0.4;
        }
        moving ||=
          body.y < floor ||
          body.vx !== 0 ||
          body.vy !== 0 ||
          body.spin !== 0 ||
          body.angle !== 0;
        paint(body);
      }
      const all = [...bodies.values()];
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i],
            b = all[j],
            size = bounds(a).size;
          if (a.dragging || b.dragging) continue;
          const dx = b.x - a.x,
            dy = b.y - a.y,
            distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < size * 0.85) {
            const push = (size * 0.85 - distance) / 2,
              nx = dx / distance,
              ny = dy / distance;
            a.x -= nx * push;
            b.x += nx * push;
            a.y -= ny * push;
            b.y += ny * push;
            [a.vx, b.vx] = [b.vx * 0.5, a.vx * 0.5];
            clamp(a);
            clamp(b);
            moving = true;
          }
        }
      if (moving) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (active && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const update = () => {
      for (const [id, body] of bodies)
        if (!engine.ownsTreasure(id)) {
          body.tooltip.destroy();
          body.node.remove();
          bodies.delete(id);
        }
      engine.state.treasures.forEach((id, index) => {
        if (bodies.has(id)) return;
        const item = RG.treasures.find((item) => item.id === id);
        const button = RG.Button("", () => {}, "treasure-body");
        button.setAttribute("aria-label", item.name);
        const image = RG.el("img");
        image.src = item.image;
        image.alt = "";
        image.draggable = false;
        button.append(image);
        node.append(button);
        const body = {
          node: button,
          x: 40 + index * 110,
          y: 20,
          vx: 0,
          vy: 0,
          angle: 0,
          spin: 0,
          dragging: false,
        };
        body.tooltip = RG.Tooltip(button, () => RG.TreasureInfo(item, engine));
        bodies.set(id, body);
        let previousX = 0,
          previousY = 0,
          previousTime = 0,
          offsetX = 0,
          offsetY = 0;
        button.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          body.tooltip.hide();
          body.dragging = true;
          body.vx = body.vy = 0;
          button.setPointerCapture(event.pointerId);
          const rect = node.getBoundingClientRect();
          offsetX = event.clientX - rect.left - body.x;
          offsetY = event.clientY - rect.top - body.y;
          previousX = event.clientX;
          previousY = event.clientY;
          previousTime = event.timeStamp;
          wake();
        });
        button.addEventListener("pointermove", (event) => {
          if (!body.dragging) return;
          const rect = node.getBoundingClientRect(),
            elapsed = Math.max(8, event.timeStamp - previousTime) / 1000;
          body.x = event.clientX - rect.left - offsetX;
          body.y = event.clientY - rect.top - offsetY;
          body.vx = Math.max(
            -900,
            Math.min(900, (event.clientX - previousX) / elapsed),
          );
          body.vy = Math.max(
            -900,
            Math.min(900, (event.clientY - previousY) / elapsed),
          );
          body.spin = body.vx / 140;
          previousX = event.clientX;
          previousY = event.clientY;
          previousTime = event.timeStamp;
          clamp(body);
          paint(body);
        });
        const release = (event) => {
          if (!body.dragging) return;
          body.dragging = false;
          if (event.timeStamp - previousTime > 100) {
            body.vx = body.vy = body.spin = 0;
          }
          wake();
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
        paint(body);
      });
      wake();
    };
    const observer = new ResizeObserver(() => {
      bodies.forEach((body) => {
        if (node.clientWidth) {
          clamp(body);
          paint(body);
        }
      });
      wake();
    });
    observer.observe(node);
    const visibilityChanged = () => {
      if (!document.hidden && active) wake();
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    return {
      node,
      update,
      activate(value) {
        active = value;
        if (active) {
          update();
          wake();
        } else {
          cancelAnimationFrame(frame);
          frame = 0;
          bodies.forEach((body) => body.tooltip.hide());
        }
      },
      stop() {
        active = false;
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", visibilityChanged);
        bodies.forEach((body) => body.tooltip.destroy());
      },
    };
  };
})();
