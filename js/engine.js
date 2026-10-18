"use strict";
(() => {
  const KEY = "rarity.save.v1";
  const fresh = () => ({
    version: 1,
    points: 0,
    lifetime: 0,
    rolls: 0,
    best: null,
    counts: Array(RG.rarities.length).fill(0),
    stamped: Array(RG.rarities.length).fill(false),
    history: [],
    lastAccrual: Date.now(),
    sound: true,
    upgradesUnlocked: false,
    purchased: [],
    achievements: [],
    flags: { clickedRarity: false, mutedOnce: false },
    collectionSort: "rarity",
    levels: Object.fromEntries(RG.repeatables.map((item) => [item.id, 0])),
  });
  RG.Engine = class {
    constructor(
      storage,
      {
        random = Math.random,
        rollClock = () => globalThis.performance?.now() ?? Date.now(),
      } = {},
    ) {
      this.storage = storage;
      this.random = random;
      this.rollClock = rollClock;
      this.state = fresh();
      this.saveOK = true;
      this.saveMessage = "";
      this.readOnly = false;
      this.rolling = false;
      this.pendingRoll = null;
      this.pendingAchievements = [];
      this.fastRolls = false;
      this.load();
      const accrued = this.accrue();
      if (this.checkAchievements() || accrued > 0) this.save();
    }
    load() {
      try {
        const raw = this.storage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.version > 1) {
          this.readOnly = true;
          this.saveOK = false;
          this.saveMessage = "Save is from a newer version.";
          return;
        }
        this.state = this.validate(parsed);
      } catch {
        try {
          const backup = this.storage.getItem(`${KEY}.backup`);
          if (!backup) throw new Error("No backup");
          this.state = this.validate(JSON.parse(backup));
          this.saveMessage = "Recovered saved backup.";
          this.save();
        } catch {
          this.readOnly = true;
          this.saveOK = false;
          this.saveMessage =
            "Save could not be read. Import a backup to recover.";
        }
      }
    }
    validate(input) {
      if (!input || typeof input !== "object" || input.version !== 1)
        throw new Error("Unsupported save");
      const next = fresh();
      for (const key of ["points", "lifetime"])
        if (
          Number.isFinite(input[key]) &&
          input[key] >= 0 &&
          input[key] <= Number.MAX_SAFE_INTEGER
        )
          next[key] = input[key];
      if (Number.isSafeInteger(input.rolls) && input.rolls >= 0)
        next.rolls = input.rolls;
      next.counts = next.counts.map((_, id) =>
        Number.isSafeInteger(input.counts?.[id]) && input.counts[id] >= 0
          ? input.counts[id]
          : 0,
      );
      next.stamped = next.stamped.map(
        (_, id) => input.stamped?.[id] === true && next.counts[id] > 0,
      );
      next.best = next.counts.reduce(
        (best, count, id) => (count > 0 ? id : best),
        null,
      );
      next.sound = input.sound !== false;
      for (const upgrade of RG.upgrades) {
        if (
          Array.isArray(input.purchased) &&
          input.purchased.includes(upgrade.id) &&
          (!upgrade.requires || next.purchased.includes(upgrade.requires))
        )
          next.purchased.push(upgrade.id);
      }
      next.lifetime = Math.max(next.lifetime, next.points);
      for (const upgrade of RG.repeatables) {
        const level = input.levels?.[upgrade.id];
        if (
          Number.isSafeInteger(level) &&
          level >= 0 &&
          next.lifetime >= 75 &&
          (!upgrade.requires || next.purchased.includes(upgrade.requires))
        )
          next.levels[upgrade.id] = Math.min(
            level,
            upgrade.max ?? Number.MAX_SAFE_INTEGER,
          );
      }
      next.upgradesUnlocked =
        input.upgradesUnlocked === true ||
        next.lifetime >= 50 ||
        next.purchased.length > 0;
      next.achievements = RG.achievements
        .filter(
          (item) =>
            Array.isArray(input.achievements) &&
            input.achievements.includes(item.id),
        )
        .map((item) => item.id);
      next.flags.clickedRarity = input.flags?.clickedRarity === true;
      next.flags.mutedOnce =
        input.flags?.mutedOnce === true || input.sound === false;
      if (
        ["rarity", "rarity-desc", "name", "count"].includes(
          input.collectionSort,
        ) &&
        next.purchased.includes("collection-book-2")
      )
        next.collectionSort = input.collectionSort;
      if (
        next.collectionSort === "count" &&
        !next.purchased.includes("inventory")
      )
        next.collectionSort = "rarity";
      if (next.purchased.includes("logbook") && Array.isArray(input.history))
        next.history = input.history
          .filter(
            (item) =>
              Number.isInteger(item?.id) &&
              item.id >= 0 &&
              item.id < RG.rarities.length &&
              Number.isFinite(item.amount) &&
              item.amount >= 0 &&
              Number.isFinite(item.at) &&
              item.at >= 0 &&
              item.at <= 8640000000000000 &&
              Number.isSafeInteger(item.roll) &&
              item.roll > 0,
          )
          .slice(-20)
          .map((item) => ({
            id: item.id,
            amount: item.amount,
            at: item.at,
            roll: item.roll,
            isNew: item.isNew === true,
          }));
      if (Number.isFinite(input.lastAccrual) && input.lastAccrual > 0)
        next.lastAccrual = Math.min(Date.now(), input.lastAccrual);
      return next;
    }
    get stats() {
      const bonus = (key) =>
        RG.achievements.reduce(
          (sum, item) =>
            sum +
            (this.state.achievements.includes(item.id)
              ? item.reward[key] || 0
              : 0),
          0,
        );
      return {
        roll_time: this.fastRolls
          ? 0.75
          : this.round(
              7.5 -
                this.state.levels.efficiency * RG.balance.efficiencySeconds -
                (this.owns("rolling-dumbell") ? 0.2 : 0),
            ),
        luck: this.round(
          this.state.levels["luck-training"] * 0.5 +
            (this.owns("two-leaf-clover") ? 0.2 : 0) +
            bonus("luck"),
        ),
        point_multiplier: this.round(
          RG.pointMultiplier(
            (this.owns("rolling-kit") ? 0.2 : 0) +
              (this.owns("simple-point-booster") ? 0.7 : 0) +
              bonus("point_multiplier") +
              this.state.levels["point-farm"] * 0.2,
          ),
        ),
        discovery_points:
          bonus("discovery_points") + this.state.levels.adventurer * 5,
        discovery_multiplier: this.owns("seal-of-approval") ? 1 : 0,
        passive_pps: this.state.levels["point-factory"],
      };
    }
    get chances() {
      const weights = RG.rarities.map(
        (rarity) =>
          rarity.weight **
          (1 / (1 + this.stats.luck * RG.balance.luckStrength)),
      );
      const total = weights.reduce((a, b) => a + b, 0);
      return weights.map((weight) => weight / total);
    }
    sample(random = this.random) {
      let cursor = random();
      const chances = this.chances;
      for (let id = 0; id < chances.length; id++) {
        cursor -= chances[id];
        if (cursor < 0) return id;
      }
      return chances.length - 1;
    }
    samplePreview(previous, random = this.random) {
      if (previous === null) return this.sample(random);
      const chances = this.chances;
      let cursor = random() * (1 - chances[previous]);
      for (let id = 0; id < chances.length; id++) {
        if (id === previous) continue;
        cursor -= chances[id];
        if (cursor < 0) return id;
      }
      return previous === chances.length - 1 ? 0 : chances.length - 1;
    }
    accrue(now = Date.now()) {
      const elapsed = Math.max(0, now - this.state.lastAccrual);
      this.state.lastAccrual = Math.max(this.state.lastAccrual, now);
      const amount = this.round(
        Math.min(
          (elapsed / 1000) * this.stats.passive_pps,
          Number.MAX_SAFE_INTEGER - this.state.lifetime,
        ),
      );
      if (amount > 0) {
        this.credit(amount);
        this.checkAchievements();
      }
      return amount;
    }
    reward(id) {
      return this.round(RG.rarities[id].points * this.stats.point_multiplier);
    }
    discoveryReward(id) {
      return this.round(
        this.stats.discovery_points +
          RG.rarities[id].points * this.stats.discovery_multiplier,
      );
    }
    credit(amount) {
      if (!Number.isFinite(amount) || amount < 0)
        throw new Error("Invalid Point award");
      this.state.points = this.round(
        Math.min(Number.MAX_SAFE_INTEGER, this.state.points + amount),
      );
      this.state.lifetime = this.round(
        Math.min(Number.MAX_SAFE_INTEGER, this.state.lifetime + amount),
      );
      if (this.state.lifetime >= 50) this.state.upgradesUnlocked = true;
    }
    recordAction(action) {
      if (action === "clicked-rarity") this.state.flags.clickedRarity = true;
      if (action === "mute") {
        this.state.sound = false;
        this.state.flags.mutedOnce = true;
      }
      this.checkAchievements();
      this.save();
    }
    setSound(enabled) {
      this.state.sound = enabled;
      if (!enabled) this.state.flags.mutedOnce = true;
      this.checkAchievements();
      this.save();
    }
    setCollectionSort(value) {
      if (
        !this.owns("collection-book-2") ||
        !["rarity", "rarity-desc", "name", "count"].includes(value) ||
        (value === "count" && !this.owns("inventory"))
      )
        return false;
      this.state.collectionSort = value;
      this.save();
      return true;
    }
    round(value) {
      return Number(value.toFixed(6));
    }
    owns(id) {
      return this.state.purchased.includes(id);
    }
    get repeatablesUnlocked() {
      return this.state.lifetime >= 75;
    }
    repeatableCost(id) {
      const upgrade = RG.repeatables.find((item) => item.id === id);
      return upgrade
        ? Math.ceil(upgrade.cost * upgrade.growth ** this.state.levels[id])
        : Infinity;
    }
    canBuyRepeatable(id) {
      const upgrade = RG.repeatables.find((item) => item.id === id);
      return (
        !!upgrade &&
        this.repeatablesUnlocked &&
        (!upgrade.requires || this.owns(upgrade.requires)) &&
        !this.rolling &&
        (upgrade.max === null || this.state.levels[id] < upgrade.max) &&
        this.state.points >= this.repeatableCost(id)
      );
    }
    buyRepeatable(id) {
      this.accrue();
      if (!this.canBuyRepeatable(id)) return false;
      this.state.points = this.round(
        this.state.points - this.repeatableCost(id),
      );
      this.state.levels[id]++;
      this.checkAchievements();
      this.save();
      return true;
    }
    get achievementsUnlocked() {
      return this.state.lifetime >= 100;
    }
    checkAchievements() {
      let changed = false;
      let granted;
      do {
        granted = false;
        for (const item of RG.achievements) {
          if (!this.state.achievements.includes(item.id) && item.check(this)) {
            this.state.achievements.push(item.id);
            if (item.reward.points) this.credit(item.reward.points);
            this.pendingAchievements.push(item);
            granted = changed = true;
          }
        }
      } while (granted);
      return changed;
    }
    grantPoints(amount) {
      if (
        this.rolling ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        this.state.lifetime + amount > Number.MAX_SAFE_INTEGER
      )
        return false;
      this.credit(amount);
      this.checkAchievements();
      this.save();
      return true;
    }
    canBuy(id) {
      const upgrade = RG.upgrades.find((item) => item.id === id);
      return (
        !!upgrade &&
        this.state.upgradesUnlocked &&
        !this.rolling &&
        !this.owns(id) &&
        (!upgrade.requires || this.owns(upgrade.requires)) &&
        this.state.points >= upgrade.cost
      );
    }
    buy(id) {
      this.accrue();
      if (!this.canBuy(id)) return false;
      const upgrade = RG.upgrades.find((item) => item.id === id);
      this.state.points = this.round(this.state.points - upgrade.cost);
      this.state.purchased.push(id);
      this.checkAchievements();
      this.save();
      return true;
    }
    begin() {
      if (this.rolling) return null;
      this.rolling = true;
      const stats = this.stats;
      this.pendingRoll = {
        id: this.sample(),
        duration: stats.roll_time * 1000,
        startedAt: this.rollClock(),
        pointMultiplier: stats.point_multiplier,
        discoveryPoints: stats.discovery_points,
        discoveryScale: stats.discovery_multiplier,
      };
      return { duration: this.pendingRoll.duration, id: this.pendingRoll.id };
    }
    cancelRoll() {
      this.rolling = false;
      this.pendingRoll = null;
    }
    complete(id = this.pendingRoll?.id) {
      const roll = this.pendingRoll;
      if (
        !this.rolling ||
        !roll ||
        id !== roll.id ||
        this.rollClock() - roll.startedAt < roll.duration
      )
        return null;
      const isNew = this.state.counts[id] === 0;
      const baseAmount = this.round(
        RG.rarities[id].points * roll.pointMultiplier,
      );
      const discoveryAmount = isNew
        ? this.round(
            roll.discoveryPoints + RG.rarities[id].points * roll.discoveryScale,
          )
        : 0;
      const amount = this.round(baseAmount + discoveryAmount);
      const isBest = this.state.best === null || id > this.state.best;
      this.credit(amount);
      this.state.rolls++;
      this.state.counts[id]++;
      if (this.owns("seal-of-approval")) this.state.stamped[id] = true;
      if (isBest) this.state.best = id;
      this.checkAchievements();
      this.cancelRoll();
      if (this.owns("logbook")) {
        this.state.history.push({
          id,
          at: Date.now(),
          roll: this.state.rolls,
          amount,
          isNew,
        });
        this.state.history = this.state.history.slice(-20);
      }
      this.save();
      return { id, amount, baseAmount, discoveryAmount, isNew, isBest };
    }
    save() {
      if (this.readOnly) return false;
      const json = JSON.stringify(this.state);
      try {
        this.storage.setItem(KEY, json);
        this.saveOK = true;
        if (this.saveMessage !== "Recovered saved backup.")
          this.saveMessage = "";
      } catch {
        this.saveOK = false;
        this.saveMessage = "Saving unavailable. Export a backup.";
        return false;
      }
      try {
        this.storage.setItem(`${KEY}.backup`, json);
      } catch {}
      return true;
    }
    resetProgress() {
      if (this.rolling) throw new Error("Finish the current roll first.");
      const previous = this.state;
      const previousReadOnly = this.readOnly;
      const previousAchievements = this.pendingAchievements;
      try {
        this.storage.setItem(
          `${KEY}.reset-backup`,
          this.storage.getItem(KEY) || JSON.stringify(previous),
        );
      } catch {
        throw new Error("Progress could not be backed up. Reset cancelled.");
      }
      this.state = fresh();
      this.readOnly = false;
      this.pendingAchievements = [];
      this.saveMessage = "";
      if (!this.save()) {
        this.state = previous;
        this.readOnly = previousReadOnly;
        this.pendingAchievements = previousAchievements;
        throw new Error("Reset could not be saved. Your progress was kept.");
      }
      this.fastRolls = false;
    }
    hasResetBackup() {
      try {
        return !!this.storage.getItem(`${KEY}.reset-backup`);
      } catch {
        return false;
      }
    }
    restoreResetBackup() {
      if (this.rolling) throw new Error("Finish the current roll first.");
      const raw = this.storage.getItem(`${KEY}.reset-backup`);
      if (!raw) throw new Error("No reset backup is available.");
      this.importSave(JSON.parse(raw));
    }
    importSave(input) {
      const next = this.validate(input);
      const previous = this.state;
      const previousReadOnly = this.readOnly;
      const previousAchievements = this.pendingAchievements;
      try {
        this.storage.setItem(
          `${KEY}.import-backup`,
          this.storage.getItem(KEY) || JSON.stringify(previous),
        );
      } catch {
        throw new Error(
          "Storage is unavailable. Export your current save before importing.",
        );
      }
      this.cancelRoll();
      this.state = next;
      this.pendingAchievements = [];
      this.readOnly = false;
      this.saveMessage = "";
      this.accrue();
      this.checkAchievements();
      if (!this.save()) {
        this.state = previous;
        this.readOnly = previousReadOnly;
        this.pendingAchievements = previousAchievements;
        throw new Error(
          "The imported save could not be stored. Your previous progress was kept.",
        );
      }
    }
  };
})();
