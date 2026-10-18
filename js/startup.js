"use strict";
(() => {
  const root = document.getElementById("app");
  function showOtherSession() {
    root.replaceChildren();
    const notice = RG.el("main", "session-notice");
    notice.append(
      RG.el("p", "", "Rarity is open in another tab."),
      RG.Button("Retry", () => location.reload()),
    );
    root.append(notice);
  }
  function startFallback() {
    const game = RG.startApp();
    addEventListener("storage", (event) => {
      if (event.key === "rarity.save.v1") {
        game.stop();
        showOtherSession();
      }
    });
  }
  if (navigator.locks?.request && location.protocol !== "file:") {
    navigator.locks
      .request("rarity-save-owner", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          showOtherSession();
          return;
        }
        RG.startApp();
        await new Promise((resolve) =>
          addEventListener("pagehide", resolve, { once: true }),
        );
      })
      .catch((error) => {
        if (
          error.name === "SecurityError" ||
          error.name === "NotSupportedError"
        )
          startFallback();
        else
          root.replaceChildren(
            RG.el(
              "p",
              "session-notice",
              "The game could not start. Reload to try again.",
            ),
          );
      });
  } else startFallback();
  addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
})();
