"use strict";
(() => {
  RG.LuckyDie = (engine, onClaim) => {
    const node = RG.el("div", "lucky-die-layer");
    let current = null,
      button = null,
      flight = null,
      tooltip = null;
    function clear() {
      flight?.cancel();
      tooltip?.destroy();
      node.replaceChildren();
      current = button = flight = tooltip = null;
    }
    return {
      node,
      update() {
        const offer = engine.luckyDieOffer;
        if (!offer || offer.expiresAt <= Date.now()) {
          if (offer) engine.luckyDieOffer = null;
          if (current) clear();
          return;
        }
        if (offer === current) return;
        clear();
        current = offer;
        button = RG.Button(
          "",
          () => {
            if (engine.claimLuckyDie()) {
              clear();
              onClaim();
            }
          },
          "lucky-die",
        );
        button.setAttribute("aria-label", "Lucky Die");
        const cube = RG.el("span", "lucky-die-cube");
        cube.setAttribute("aria-hidden", "true");
        const pips = [
          [5],
          [1, 9],
          [1, 5, 9],
          [1, 3, 7, 9],
          [1, 3, 5, 7, 9],
          [1, 3, 4, 6, 7, 9],
        ];
        pips.forEach((positions, index) => {
          const face = RG.el("span", `lucky-die-face face-${index + 1}`);
          positions.forEach((position) => {
            const pip = RG.el("i", "die-pip");
            pip.style.gridArea = `${Math.ceil(position / 3)} / ${((position - 1) % 3) + 1}`;
            face.append(pip);
          });
          cube.append(face);
        });
        button.append(cube);
        button.style.left = `${Math.max(36, Math.min(innerWidth - 72, innerWidth * 0.3 + Math.random() * innerWidth * 0.5))}px`;
        node.append(button);
        tooltip = RG.Tooltip(
          button,
          () => `+${RG.format(offer.amount)} Luck for 45 seconds.`,
        );
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        flight = button.animate(
          reduced
            ? [{ opacity: 1 }, { opacity: 1 }]
            : [
                { transform: "translateY(-80px)" },
                { transform: `translateY(${innerHeight + 80}px)` },
              ],
          {
            duration: Math.max(1, offer.expiresAt - Date.now()),
            fill: "forwards",
            easing: "linear",
          },
        );
        flight.onfinish = () => {
          if (engine.luckyDieOffer === offer) engine.luckyDieOffer = null;
          clear();
        };
      },
      stop: clear,
    };
  };
})();
