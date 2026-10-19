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
    treasures: [],
    maxRolledOdds: 0,
    marketName: "",
    flags: {
      clickedRarity: false,
      mutedOnce: false,
      beeferClicked: false,
      readChangelog: false,
      usedRemote: false,
      spammedRoll: false,
    },
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
      this.ignoredRollClicks = [];
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
        this.migrateLegacyOdds(parsed);
      } catch {
        try {
          const backup = this.storage.getItem(`${KEY}.backup`);
          if (!backup) throw new Error("No backup");
          const recovered = JSON.parse(backup);
          this.state = this.validate(recovered);
          this.migrateLegacyOdds(recovered);
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
      next.achievements = RG.achievements
        .filter(
          (item) =>
            Array.isArray(input.achievements) &&
            input.achievements.includes(item.id),
        )
        .map((item) => item.id);
      for (const upgrade of RG.repeatables) {
        const level = input.levels?.[upgrade.id];
        if (
          Number.isSafeInteger(level) &&
          level >= 0 &&
          next.lifetime >= 50 &&
          (!upgrade.requiresAchievement ||
            next.achievements.includes(upgrade.requiresAchievement)) &&
          (!upgrade.requires || next.purchased.includes(upgrade.requires))
        )
          next.levels[upgrade.id] = Math.min(
            level,
            upgrade.max ?? Number.MAX_SAFE_INTEGER,
          );
      }
      next.upgradesUnlocked =
        input.upgradesUnlocked === true ||
        next.lifetime >= 25 ||
        next.purchased.length > 0;
      next.treasures = RG.treasures
        .filter(
          (item) =>
            Array.isArray(input.treasures) && input.treasures.includes(item.id),
        )
        .map((item) => item.id);
      if (Number.isFinite(input.maxRolledOdds) && input.maxRolledOdds >= 0)
        next.maxRolledOdds = Math.min(
          Number.MAX_SAFE_INTEGER,
          input.maxRolledOdds,
        );
      if (next.treasures.length)
        next.maxRolledOdds = Math.max(60, next.maxRolledOdds);
      if (next.maxRolledOdds >= 60) next.upgradesUnlocked = true;
      next.marketName = this.cleanMarketName(input.marketName);
      next.flags.clickedRarity = input.flags?.clickedRarity === true;
      next.flags.beeferClicked = input.flags?.beeferClicked === true;
      next.flags.readChangelog = input.flags?.readChangelog === true;
      next.flags.usedRemote = input.flags?.usedRemote === true;
      next.flags.spammedRoll = input.flags?.spammedRoll === true;
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
    migrateLegacyOdds(input) {
      if (Object.hasOwn(input, "maxRolledOdds")) return;
      const chances = this.chances;
      this.state.counts.forEach((count, id) => {
        if (count > 0)
          this.state.maxRolledOdds = Math.max(
            this.state.maxRolledOdds,
            1 / chances[id],
          );
      });
      if (this.nightMarketUnlocked) this.state.upgradesUnlocked = true;
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
            (this.owns("rolling-kit") ? RG.balance.rollingKitBonus : 0) +
              (this.owns("simple-point-booster")
                ? RG.balance.pointBoosterBonus
                : 0) +
              bonus("point_multiplier") +
              this.state.levels["point-farm"] * RG.balance.pointFarmBonus,
          ) *
            (1 +
              RG.treasures.reduce(
                (sum, item) =>
                  sum +
                  (this.state.treasures.includes(item.id)
                    ? item.achievementBonus * this.state.achievements.length
                    : 0),
                0,
              )),
        ),
        discovery_points:
          bonus("discovery_points") + this.state.levels.adventurer * 5,
        discovery_multiplier: this.owns("seal-of-approval") ? 1 : 0,
        achievement_pps: this.round(
          this.state.levels["achievement-boost"] *
            this.state.achievements.length *
            0.1,
        ),
        passive_pps: this.round(
          this.state.levels["point-factory"] +
            bonus("passive_pps") +
            this.state.levels["achievement-boost"] *
              this.state.achievements.length *
              0.1,
        ),
        beef: bonus("beef"),
      };
    }
    get chances() {
      const exponent = 1 / (1 + this.stats.luck * RG.balance.luckStrength);
      const weights = RG.rarities.map((rarity) => rarity.weight ** exponent);
      const total = weights.reduce((a, b) => a + b, 0);
      return weights.map((weight) => weight / total);
    }
    sample(random = this.random, chances = this.chances) {
      let cursor = random();
      for (let id = 0; id < chances.length; id++) {
        cursor -= chances[id];
        if (cursor < 0) return id;
      }
      return chances.length - 1;
    }
    samplePreview(previous, random = this.random) {
      const chances = this.pendingRoll?.chances || this.chances;
      if (previous === null) return this.sample(random, chances);
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
      if (this.state.lifetime >= 25) this.state.upgradesUnlocked = true;
    }
    cleanMarketName(value) {
      return typeof value === "string"
        ? value
            .replace(/[\u0000-\u001f\u007f<>]/g, "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 32)
        : "";
    }
    setMarketName(value) {
      const name = this.cleanMarketName(value);
      if (!name || this.readOnly) return false;
      this.state.marketName = name;
      this.save();
      return true;
    }
    recordAction(action) {
      this.accrue();
      if (action === "changelog") this.state.flags.readChangelog = true;
      if (action === "remote-roll") this.state.flags.usedRemote = true;
      if (action === "beefer") this.state.flags.beeferClicked = true;
      if (action === "clicked-rarity") this.state.flags.clickedRarity = true;
      if (action === "mute") {
        this.state.sound = false;
        this.state.flags.mutedOnce = true;
      }
      this.checkAchievements();
      this.save();
    }
    setSound(enabled) {
      this.accrue();
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
      return this.state.lifetime >= 50;
    }
    repeatableAvailable(upgrade) {
      return (
        (!upgrade.requires || this.owns(upgrade.requires)) &&
        (!upgrade.requiresAchievement ||
          this.state.achievements.includes(upgrade.requiresAchievement))
      );
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
        this.repeatableAvailable(upgrade) &&
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
        !Number.isFinite(amount) ||
        amount <= 0 ||
        this.state.lifetime + amount > Number.MAX_SAFE_INTEGER
      )
        return false;
      this.accrue();
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
    get nightMarketUnlocked() {
      return this.state.maxRolledOdds >= 60;
    }
    ownsTreasure(id) {
      return this.state.treasures.includes(id);
    }
    canBuyTreasure(id) {
      const treasure = RG.treasures.find((item) => item.id === id);
      return (
        !!treasure &&
        this.nightMarketUnlocked &&
        !this.ownsTreasure(id) &&
        this.state.points >= treasure.price
      );
    }
    buyTreasure(id) {
      this.accrue();
      if (!this.canBuyTreasure(id)) return false;
      const item = RG.treasures.find((item) => item.id === id);
      this.state.points = this.round(this.state.points - item.price);
      this.state.treasures.push(id);
      this.save();
      return true;
    }
    begin() {
      if (this.rolling) {
        const now = this.rollClock();
        this.ignoredRollClicks = this.ignoredRollClicks.filter(
          (time) => now - time <= 2000,
        );
        this.ignoredRollClicks.push(now);
        if (
          this.ignoredRollClicks.length >= 5 &&
          !this.state.flags.spammedRoll
        ) {
          this.accrue();
          this.state.flags.spammedRoll = true;
          this.checkAchievements();
          this.save();
        }
        return null;
      }
      this.ignoredRollClicks = [];
      this.rolling = true;
      const stats = this.stats;
      this.pendingRoll = {
        id: this.sample(),
        duration: stats.roll_time * 1000,
        startedAt: this.rollClock(),
        pointMultiplier: stats.point_multiplier,
        discoveryPoints: stats.discovery_points,
        discoveryScale: stats.discovery_multiplier,
        sealOwned: this.owns("seal-of-approval"),
        logbookOwned: this.owns("logbook"),
        chances: this.chances,
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
      this.accrue();
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
      if (roll.sealOwned) this.state.stamped[id] = true;
      if (isBest) this.state.best = id;
      const odds = 1 / roll.chances[id];
      this.state.maxRolledOdds = Math.max(this.state.maxRolledOdds, odds);
      if (this.nightMarketUnlocked) this.state.upgradesUnlocked = true;
      this.checkAchievements();
      this.cancelRoll();
      if (roll.logbookOwned) {
        this.state.history.push({
          id,
          at: Date.now(),
          roll: this.state.rolls,
          amount,
          isNew,
          odds,
        });
        this.state.history = this.state.history.slice(-20);
      }
      this.save();
      return { id, amount, baseAmount, discoveryAmount, isNew, isBest, odds };
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
      this.cancelRoll();
    }
    hasResetBackup() {
      try {
        return !!this.storage.getItem(`${KEY}.reset-backup`);
      } catch {
        return false;
      }
    }
    restoreResetBackup() {
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
      this.state = next;
      this.migrateLegacyOdds(input);
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
      this.cancelRoll();
    }
  };
})();
