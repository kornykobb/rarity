"use strict";
(() => {
  const KEY = "rarity.save.v1";
  const fresh = () => ({
    version: 1,
    progressionRevision: 2,
    meta: {
      prestiges: 0,
      currencies: Object.fromEntries(RG.metaCurrencies.map((c) => [c.id, 0])),
      essenceEarned: 0,
      soulMode: null,
      xp: 0,
    },
    autoRoll: false,
    autoRollPause: { newRarity: false, newGrade: false, luckyDie: false },
    points: 0,
    lifetime: 0,
    rolls: 0,
    best: null,
    counts: Array(RG.rarities.length).fill(0),
    gradeCounts: RG.rarities.map(() => Array(RG.rarityGrades.length).fill(0)),
    badges: Object.fromEntries(
      RG.collectionBadges.map((badge) => [
        badge.id,
        Array(RG.rarities.length).fill(false),
      ]),
    ),
    stamped: Array(RG.rarities.length).fill(false),
    history: [],
    lastAccrual: Date.now(),
    sound: true,
    upgradesUnlocked: false,
    purchased: [],
    achievements: [],
    achievementTiers: {},
    counters: { remoteRolls: 0, rareRolls: 0 },
    treasures: [],
    maxRolledOdds: 0,
    marketName: "",
    luckyBoost: null,
    flags: {
      clickedRarity: false,
      mutedOnce: false,
      beeferClicked: false,
      readChangelog: false,
      usedRemote: false,
      spammedRoll: false,
      marketClosed: false,
      legendaryDialogueSeen: false,
    },
    collectionSort: "unsorted",
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
      this.luckyDieOffer = null;
      this.ignoredRollClicks = [];
      this.initializing = true;
      this.load();
      const accrued = this.accrue();
      if (
        this.checkAchievements() ||
        accrued > 0 ||
        this.state.meta.prestiges > 0
      )
        this.save();
      this.initializing = false;
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
      const legacyMaintenance =
        Array.isArray(input.purchased) &&
        input.purchased.includes("factory-maintenance");
      if (legacyMaintenance)
        input = {
          ...input,
          levels: {
            ...input.levels,
            "factory-maintenance": Math.max(
              1,
              Number.isSafeInteger(input.levels?.["factory-maintenance"])
                ? input.levels["factory-maintenance"]
                : 0,
            ),
          },
        };
      const legacyMilestones = (input.progressionRevision || 0) < 2;
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
      next.gradeCounts = next.gradeCounts.map((row, id) => {
        let remaining = next.counts[id];
        return row.map((_, grade) => {
          const value = input.gradeCounts?.[id]?.[grade];
          const count =
            Number.isSafeInteger(value) && value >= 0
              ? Math.min(value, remaining)
              : 0;
          remaining -= count;
          return count;
        });
      });
      next.stamped = next.stamped.map(
        (_, id) => input.stamped?.[id] === true && next.counts[id] > 0,
      );
      next.best = next.counts.reduce(
        (best, count, id) => (count > 0 ? id : best),
        null,
      );
      next.sound = input.sound !== false;
      next.lifetime = Math.max(next.lifetime, next.points);
      for (const upgrade of RG.upgrades) {
        if (
          Array.isArray(input.purchased) &&
          input.purchased.includes(upgrade.id) &&
          this.upgradeAvailable(
            upgrade,
            {
              ...next,
              achievements: Array.isArray(input.achievements)
                ? input.achievements
                : [],
              levels: input.levels || {},
            },
            legacyMilestones,
          )
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
      for (const item of RG.achievements) {
        if (next.achievements.includes(item.id)) {
          const tier = input.achievementTiers?.[item.id];
          next.achievementTiers[item.id] =
            item.track && Number.isInteger(tier)
              ? Math.max(0, Math.min(item.track.thresholds.length - 1, tier))
              : 0;
        }
      }
      for (const key of ["remoteRolls", "rareRolls"]) {
        const value = input.counters?.[key];
        if (Number.isSafeInteger(value) && value >= 0)
          next.counters[key] = Math.min(value, next.rolls);
      }
      for (const upgrade of RG.repeatables) {
        const level = input.levels?.[upgrade.id];
        if (
          Number.isSafeInteger(level) &&
          level >= 0 &&
          next.lifetime >= 50 &&
          this.upgradeAvailable(upgrade, next)
        )
          next.levels[upgrade.id] = Math.min(
            level,
            upgrade.max ?? Number.MAX_SAFE_INTEGER,
          );
      }
      next.purchased = next.purchased.filter((id) =>
        this.upgradeAvailable(
          RG.upgrades.find((item) => item.id === id),
          next,
          legacyMilestones,
        ),
      );
      for (const badge of RG.collectionBadges)
        next.badges[badge.id] = next.counts.map(
          (count, id) =>
            count > 0 &&
            next.purchased.includes(badge.id) &&
            (input.badges?.[badge.id]?.[id] === true ||
              (badge.id === "seal-of-approval" && next.stamped[id])),
        );
      if (!next.purchased.includes("grading-kit"))
        next.gradeCounts.forEach((row) => row.fill(0));
      next.upgradesUnlocked =
        input.upgradesUnlocked === true ||
        next.lifetime >= 10 ||
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
      const boost = input.luckyBoost;
      if (
        boost &&
        Number.isFinite(boost.amount) &&
        boost.amount >= RG.luckyDie.min &&
        boost.amount <= RG.luckyDie.max &&
        Number.isFinite(boost.expiresAt) &&
        boost.expiresAt > Date.now() &&
        boost.expiresAt <= Date.now() + RG.luckyDie.duration
      )
        next.luckyBoost = { amount: boost.amount, expiresAt: boost.expiresAt };
      if (
        Number.isSafeInteger(input.meta?.prestiges) &&
        input.meta.prestiges > 0
      ) {
        next.meta.prestiges = input.meta.prestiges;
        for (const currency of RG.metaCurrencies) {
          const value = input.meta.currencies?.[currency.id];
          if (
            Number.isFinite(value) &&
            value >= 0 &&
            value <= Number.MAX_SAFE_INTEGER
          )
            next.meta.currencies[currency.id] = value;
        }
        const earned = input.meta.essenceEarned;
        next.meta.essenceEarned =
          Number.isFinite(earned) &&
          earned >= 0 &&
          earned <= Number.MAX_SAFE_INTEGER
            ? Math.max(earned, next.meta.currencies.essence)
            : next.meta.currencies.essence;
        if (RG.soul.modes.some((mode) => mode.id === input.meta.soulMode))
          next.meta.soulMode = input.meta.soulMode;
        const xp = input.meta.xp;
        if (Number.isFinite(xp) && xp >= 0 && xp <= Number.MAX_SAFE_INTEGER)
          next.meta.xp = Math.floor(xp);
      }
      next.autoRoll =
        input.autoRoll === true && next.purchased.includes("auto-roll");
      for (const key of Object.keys(next.autoRollPause))
        next.autoRollPause[key] = input.autoRollPause?.[key] === true;
      next.flags.legendaryDialogueSeen =
        input.flags?.legendaryDialogueSeen === true;
      next.flags.marketClosed = input.flags?.marketClosed === true;
      next.flags.clickedRarity = input.flags?.clickedRarity === true;
      next.flags.beeferClicked = input.flags?.beeferClicked === true;
      next.flags.readChangelog = input.flags?.readChangelog === true;
      next.flags.usedRemote = input.flags?.usedRemote === true;
      next.flags.spammedRoll = input.flags?.spammedRoll === true;
      next.flags.mutedOnce =
        input.flags?.mutedOnce === true || input.sound === false;
      if (
        ["unsorted", "rarity", "rarity-desc", "name", "count"].includes(
          input.collectionSort,
        ) &&
        next.purchased.includes("collection-book-2")
      )
        next.collectionSort = input.collectionSort;
      if (
        next.collectionSort === "count" &&
        !next.purchased.includes("inventory")
      )
        next.collectionSort = "unsorted";
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
            remote: item.remote === true,
            grade:
              Number.isInteger(item.grade) && RG.rarityGrades[item.grade]
                ? item.grade
                : null,
            rarityOdds:
              Number.isFinite(item.rarityOdds) && item.rarityOdds >= 1
                ? item.rarityOdds
                : null,
            gradeOdds:
              Number.isFinite(item.gradeOdds) && item.gradeOdds >= 1
                ? item.gradeOdds
                : null,
            odds:
              Number.isFinite(item.odds) && item.odds >= 1 ? item.odds : null,
          }));
      if (!input.counters) {
        next.counters.remoteRolls = next.history.filter(
          (item) => item.remote,
        ).length;
        next.counters.rareRolls = Math.min(
          next.rolls,
          Math.max(
            next.history.filter((item) => item.odds >= 100).length,
            next.maxRolledOdds >= 100 ? 1 : 0,
          ),
        );
      }
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
      const upgradeBonus = (key) =>
        RG.upgrades.reduce(
          (sum, item) => sum + (this.owns(item.id) ? item[key] || 0 : 0),
          0,
        );
      const soul = this.soulStats();
      const permanentLuck = this.round(
        soul.luck +
          this.state.levels["luck-training"] * RG.balance.luckTrainingBonus +
          (this.owns("two-leaf-clover") ? 0.2 : 0) +
          bonus("luck") +
          upgradeBonus("luckBonus"),
      );
      const luckyBoost =
        this.state.luckyBoost?.expiresAt > Date.now()
          ? this.state.luckyBoost.amount
          : 0;
      const passiveMultiplier = RG.treasures.reduce(
        (value, item) =>
          value *
          (this.ownsTreasure(item.id) ? item.passiveMultiplier || 1 : 1),
        1,
      );
      return {
        metaCurrencies: this.state.meta.currencies,
        soul_rank: soul.rank,
        soul_progress: soul.progress,
        soul_next: soul.next,
        soul_rate: soul.soulRate,
        soul_points: soul.points,
        essence_rate: soul.essenceRate,
        factory_pps: this.state.levels["point-factory"],
        adventurer_points: this.state.levels.adventurer * 5,
        permanent_luck: permanentLuck,
        temporary_luck: luckyBoost,
        luck_expires_at: luckyBoost ? this.state.luckyBoost.expiresAt : 0,
        roll_time: this.fastRolls
          ? 0.75
          : this.round(
              Math.max(
                3,
                6.5 -
                  this.state.levels.efficiency * RG.balance.efficiencySeconds -
                  (this.owns("rolling-dumbell") ? 0.2 : 0),
              ),
            ),
        luck: this.round(permanentLuck + luckyBoost),
        point_multiplier: this.round(
          RG.pointMultiplier(
            (this.owns("rolling-kit") ? RG.balance.rollingKitBonus : 0) +
              (this.owns("simple-point-booster")
                ? RG.balance.pointBoosterBonus
                : 0) +
              bonus("point_multiplier") +
              this.state.levels["point-farm"] * RG.balance.pointFarmBonus,
          ) *
            (1 + bonus("rolling_percent")) *
            (1 +
              RG.treasures.reduce(
                (sum, item) =>
                  sum +
                  (this.state.treasures.includes(item.id)
                    ? (item.achievementBonus || 0) *
                      this.state.achievements.length *
                      (1 + bonus("star_engine_power"))
                    : 0),
                0,
              )) *
            soul.points,
        ),
        discovery_points:
          bonus("discovery_points") + this.state.levels.adventurer * 5,
        discovery_multiplier: this.owns("seal-of-approval") ? 1 : 0,
        achievement_pps: this.round(
          this.state.levels["achievement-boost"] *
            this.state.achievements.length *
            RG.balance.achievementBoostBonus,
        ),
        maintenance_pps: this.state.levels["factory-maintenance"] * 2,
        passive_pps: this.round(
          (this.state.levels["point-factory"] +
            this.state.levels["factory-maintenance"] * 2 +
            upgradeBonus("passivePps") +
            bonus("passive_pps") +
            this.state.levels["achievement-boost"] *
              this.state.achievements.length *
              RG.balance.achievementBoostBonus) *
            passiveMultiplier *
            soul.points,
        ),
        grade_limit: Math.min(
          RG.rarityGrades.length,
          RG.upgrades.reduce(
            (limit, upgrade) =>
              this.owns(upgrade.id)
                ? Math.max(limit, upgrade.gradeLimit || 0)
                : limit,
            0,
          ),
        ),
        beef: bonus("beef"),
      };
    }
    soulRank(earned = this.state.meta.essenceEarned) {
      let rank = 0;
      while (
        rank < RG.soul.maxRank &&
        earned >= RG.soulRankRequirement(rank + 1)
      )
        rank++;
      return rank;
    }
    soulStats() {
      const meta = this.state.meta,
        rank = this.soulRank(),
        mode = meta.soulMode;
      const previous = rank ? RG.soulRankRequirement(rank) : 0,
        next = rank < RG.soul.maxRank ? RG.soulRankRequirement(rank + 1) : null;
      return {
        rank,
        next,
        progress: next
          ? Math.min(1, (meta.essenceEarned - previous) / (next - previous))
          : 1,
        luck:
          rank * RG.soul.luckPerRank + (mode === "chance" ? rank * 0.25 : 0),
        points:
          (1 + rank * RG.soul.pointsPerRank) *
          (mode === "wealth" ? 1 + rank * 0.1 : 1),
        essenceRate: this.round(
          (1 + rank * RG.soul.essencePerRank) *
            (mode === "self"
              ? RG.soulSelfMultiplier(meta.currencies.essence)
              : 1),
        ),
        soulRate: this.round(rank * RG.soul.soulPerRank),
      };
    }
    get levelsUnlocked() {
      return this.state.meta.prestiges > 0;
    }
    levelInfo(xp = this.state.meta.xp) {
      let level = 1,
        remaining = xp;
      while (remaining >= RG.levelRequirement(level)) {
        remaining -= RG.levelRequirement(level);
        level++;
      }
      return { level, xp: remaining, next: RG.levelRequirement(level) };
    }
    get realm() {
      const best = this.state.best ?? 0;
      return RG.realms.findLast((realm) => best >= realm.from) || RG.realms[0];
    }
    gainXp(amount) {
      if (!this.levelsUnlocked || amount <= 0) return 0;
      this.state.meta.xp = Math.min(
        Number.MAX_SAFE_INTEGER,
        this.state.meta.xp + amount,
      );
      return amount;
    }
    setSoulMode(mode) {
      if (
        this.readOnly ||
        !this.state.meta.prestiges ||
        this.soulRank() < 1 ||
        !RG.soul.modes.some((item) => item.id === mode)
      )
        return false;
      this.accrue();
      this.state.meta.soulMode = this.state.meta.soulMode === mode ? null : mode;
      this.checkAchievements();
      this.save();
      return true;
    }
    setAutoRollPause(key, enabled) {
      if (this.readOnly || !Object.hasOwn(this.state.autoRollPause, key))
        return false;
      this.state.autoRollPause[key] = enabled === true;
      this.save();
      return true;
    }
    requirementText(upgrade) {
      const parts = [],
        state = this.state;
      const nameOf = (id) =>
        [...RG.upgrades, ...RG.repeatables].find((item) => item.id === id)
          ?.name || id;
      if (upgrade.requires && !this.owns(upgrade.requires))
        parts.push(nameOf(upgrade.requires));
      for (const id of upgrade.requiresAll || [])
        if (!this.owns(id)) parts.push(nameOf(id));
      if (
        upgrade.requiresAchievement &&
        !state.achievements.includes(upgrade.requiresAchievement)
      )
        parts.push(
          `the ${RG.achievements.find((item) => item.id === upgrade.requiresAchievement).name} achievement`,
        );
      if (upgrade.minLifetime && state.lifetime < upgrade.minLifetime)
        parts.push(
          `${RG.format(upgrade.minLifetime)} lifetime Points (${RG.format(Math.floor(state.lifetime))} so far)`,
        );
      for (const [id, level] of Object.entries(upgrade.minLevels || {}))
        if ((state.levels[id] || 0) < level)
          parts.push(`${nameOf(id)} level ${level}`);
      return parts.length ? `Requires ${parts.join(", ")}.` : "";
    }
    get chances() {
      const exponent = 1 / (1 + this.stats.luck * RG.balance.luckStrength);
      const weights = RG.rarities.map((rarity) => rarity.weight ** exponent);
      const total = weights.reduce((a, b) => a + b, 0);
      return weights.map((weight) => weight / total);
    }
    get gradeChances() {
      const limit = this.stats.grade_limit;
      const weights = RG.rarityGrades.map((grade) =>
        grade.rank < limit
          ? (1 / 1.35 ** grade.rank) ** (1 / (1 + this.stats.luck * 0.15))
          : 0,
      );
      const total = weights.reduce((sum, value) => sum + value, 0);
      return weights.map((value) => (total ? value / total : 0));
    }
    bestGrade(id) {
      return (
        this.state.gradeCounts[id]?.reduce(
          (best, count, grade) =>
            count > 0 &&
            (best === null ||
              RG.rarityGrades[grade].rank > RG.rarityGrades[best].rank)
              ? grade
              : best,
          null,
        ) ?? null
      );
    }
    resultChance(
      id,
      grade = null,
      rarityChances = this.chances,
      gradeChances = this.gradeChances,
    ) {
      return (
        rarityChances[id] * (grade === null ? 1 : gradeChances[grade] || 0)
      );
    }
    sampleGrade(random = this.random, chances = this.gradeChances) {
      if (!chances.some((value) => value > 0)) return null;
      let cursor = random();
      for (const grade of RG.gradeOrder) {
        cursor -= chances[grade.id];
        if (cursor < 0) return grade.id;
      }
      return RG.gradeOrder.findLast((grade) => chances[grade.id] > 0).id;
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
      if (this.state.meta.prestiges > 0) {
        const meta = this.state.meta,
          { essenceRate, soulRate } = this.soulStats(),
          seconds = elapsed / 1000,
          add = (value, amount) =>
            this.round(Math.min(Number.MAX_SAFE_INTEGER, value + amount));
        meta.currencies.essence = add(
          meta.currencies.essence,
          seconds * essenceRate,
        );
        meta.essenceEarned = add(meta.essenceEarned, seconds * essenceRate);
        meta.currencies.soul = add(meta.currencies.soul, seconds * soulRate);
      }
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
    reward(id, grade = null) {
      return this.round(
        RG.rarityValue(id, this.chances[id]) *
          this.stats.point_multiplier *
          (RG.rarityGrades[grade]?.pointMultiplier || 1) *
          (this.owns("participation-prize")
            ? RG.participationMultiplier(1 / this.resultChance(id, grade))
            : 1),
      );
    }
    discoveryReward(id) {
      return this.round(
        this.stats.discovery_points +
          RG.rarityValue(id, this.chances[id]) *
            this.stats.discovery_multiplier,
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
      if (this.state.lifetime >= 10) this.state.upgradesUnlocked = true;
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
      if (action === "legendary-dialogue")
        this.state.flags.legendaryDialogueSeen = true;
      if (action === "market-closed") this.state.flags.marketClosed = true;
      if (action === "changelog") this.state.flags.readChangelog = true;
      if (action === "remote-roll") {
        this.state.flags.usedRemote = true;
        if (this.pendingRoll) this.pendingRoll.remote = true;
      }
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
        !["unsorted", "rarity", "rarity-desc", "name", "count"].includes(
          value,
        ) ||
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
      return this.upgradeAvailable(upgrade);
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
    buyRepeatableMax(id) {
      this.accrue();
      if (!this.owns("shopping-cart")) return 0;
      let bought = 0;
      while (this.canBuyRepeatable(id)) {
        this.state.points = this.round(
          this.state.points - this.repeatableCost(id),
        );
        this.state.levels[id]++;
        bought++;
      }
      if (bought) {
        this.checkAchievements();
        this.save();
      }
      return bought;
    }
    get achievementsUnlocked() {
      return this.state.lifetime >= 100 || this.state.meta.prestiges > 0;
    }
    achievementTier(id) {
      return this.state.achievementTiers[id] || 0;
    }
    achievementView(item, tier = this.achievementTier(item.id)) {
      return {
        ...item,
        requirementText:
          tier > 0 && item.track
            ? item.track.label(
                item.track.thresholds[
                  Math.min(tier, item.track.thresholds.length - 1)
                ],
              )
            : item.requirementText,
        tier,
        tierName: RG.achievementTiers[tier].name,
        grade: RG.achievementGrade(item.grade, tier),
      };
    }
    achievementProgress(item) {
      if (!item.track) return null;
      const tier = this.achievementTier(item.id);
      return {
        current: item.track.metric(this),
        target: item.track.thresholds[tier + 1] ?? null,
      };
    }
    checkAchievements() {
      let changed = false;
      let tiered = false;
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
      for (const item of RG.achievements) {
        if (!this.state.achievements.includes(item.id)) continue;
        const previous = this.achievementTier(item.id);
        const current = item.track?.metric(this);
        let tier = previous;
        item.track?.thresholds.forEach((threshold, index) => {
          if (current >= threshold) tier = Math.max(tier, index);
        });
        this.state.achievementTiers[item.id] = tier;
        if (tier > previous) {
          changed = true;
          tiered = true;
          const notification = {
            ...this.achievementView(item, tier),
            tierUp: true,
          };
          const queued = this.pendingAchievements.findIndex(
            (entry) => entry.id === item.id,
          );
          if (queued >= 0) this.pendingAchievements[queued] = notification;
          else if (!this.initializing)
            this.pendingAchievements.push(notification);
        }
      }
      if (tiered) changed = this.checkAchievements() || changed;
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
    upgradeAvailable(upgrade, state = this.state, legacyMilestones = false) {
      return (
        (legacyMilestones || state.lifetime >= (upgrade.minLifetime || 0)) &&
        (!upgrade.requires || state.purchased.includes(upgrade.requires)) &&
        (!upgrade.requiresAll ||
          upgrade.requiresAll.every((id) => state.purchased.includes(id))) &&
        (!upgrade.requiresAchievement ||
          state.achievements.includes(upgrade.requiresAchievement)) &&
        (!upgrade.minLevels ||
          Object.entries(upgrade.minLevels).every(
            ([id, level]) =>
              Number.isSafeInteger(state.levels[id]) &&
              state.levels[id] >= level,
          ))
      );
    }
    canBuy(id) {
      const upgrade = RG.upgrades.find((item) => item.id === id);
      return (
        !!upgrade &&
        this.state.upgradesUnlocked &&
        !this.owns(id) &&
        this.upgradeAvailable(upgrade) &&
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
    setAutoRoll(enabled) {
      if (this.readOnly || !this.owns("auto-roll")) return false;
      this.state.autoRoll = enabled === true;
      this.save();
      return true;
    }
    get canPrestige() {
      return (
        !this.readOnly &&
        this.state.counts[RG.prestigeRarity] > 0 &&
        this.state.meta.prestiges < Number.MAX_SAFE_INTEGER
      );
    }
    prestige() {
      if (!this.canPrestige) return false;
      this.accrue();
      const previous = this.state;
      try {
        this.storage.setItem(
          KEY + ".prestige-backup",
          JSON.stringify(previous),
        );
      } catch {
        this.saveMessage = "Prestige backup could not be saved.";
        return false;
      }
      const next = fresh();
      next.achievements = [...previous.achievements];
      next.achievementTiers = { ...previous.achievementTiers };
      next.treasures = [...previous.treasures];
      next.sound = previous.sound;
      next.meta = {
        ...previous.meta,
        prestiges: previous.meta.prestiges + 1,
        xp: Math.min(
          Number.MAX_SAFE_INTEGER,
          previous.meta.xp + RG.levels.prestigeXp,
        ),
        currencies: {
          ...previous.meta.currencies,
          prestige: Math.min(
            Number.MAX_SAFE_INTEGER,
            previous.meta.currencies.prestige + 1,
          ),
        },
      };
      this.state = next;
      if (!this.save()) {
        this.state = previous;
        return false;
      }
      this.cancelRoll();
      this.luckyDieOffer = null;
      this.pendingAchievements = [];
      this.ignoredRollClicks = [];
      this.fastRolls = false;
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
      this.checkAchievements();
      this.save();
      return true;
    }
    offerLuckyDie() {
      if (this.luckyDieOffer?.expiresAt <= Date.now())
        this.luckyDieOffer = null;
      if (
        !this.nightMarketUnlocked ||
        this.luckyDieOffer ||
        this.stats.temporary_luck ||
        this.random() >= RG.luckyDie.chance
      )
        return null;
      this.luckyDieOffer = {
        amount: this.round(
          RG.luckyDie.min + this.random() * (RG.luckyDie.max - RG.luckyDie.min),
        ),
        expiresAt: Date.now() + RG.luckyDie.fallDuration,
      };
      return this.luckyDieOffer;
    }
    claimLuckyDie() {
      const offer = this.luckyDieOffer;
      this.luckyDieOffer = null;
      if (!offer || offer.expiresAt <= Date.now() || this.stats.temporary_luck)
        return false;
      this.state.luckyBoost = {
        amount: offer.amount,
        expiresAt: Date.now() + RG.luckyDie.duration,
      };
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
        grade: null,
        gradeStartedAt: null,
        gradeDuration: this.owns("grading-kit") ? stats.roll_time * 100 : 0,
        rarityDuration:
          stats.roll_time * (this.owns("grading-kit") ? 900 : 1000),
        gradeChances: this.gradeChances,
        passivePps: stats.passive_pps,
        duration: stats.roll_time * 1000,
        startedAt: this.rollClock(),
        pointMultiplier: stats.point_multiplier,
        discoveryPoints: stats.discovery_points,
        variantDiscoveryPoints: stats.adventurer_points,
        discoveryScale: stats.discovery_multiplier,
        sealOwned: this.owns("seal-of-approval"),
        badges: RG.collectionBadges
          .filter((badge) => this.owns(badge.id))
          .map((badge) => badge.id),
        participationOwned: this.owns("participation-prize"),
        logbookOwned: this.owns("logbook"),
        chances: this.chances,
      };
      return {
        duration: this.pendingRoll.duration,
        id: this.pendingRoll.id,
        grade: this.pendingRoll.grade,
        rarityDuration: this.pendingRoll.rarityDuration,
        gradeDuration: this.pendingRoll.gradeDuration,
      };
    }
    beginGrade() {
      const roll = this.pendingRoll;
      if (
        !this.rolling ||
        !roll?.gradeDuration ||
        roll.gradeStartedAt !== null ||
        this.rollClock() - roll.startedAt < roll.rarityDuration
      )
        return null;
      roll.grade = this.sampleGrade(this.random, roll.gradeChances);
      roll.gradeStartedAt = this.rollClock();
      return roll.grade;
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
        this.rollClock() - roll.startedAt < roll.duration ||
        (roll.gradeDuration > 0 &&
          (roll.gradeStartedAt === null ||
            this.rollClock() - roll.gradeStartedAt < roll.gradeDuration))
      )
        return null;
      const isNew = this.state.counts[id] === 0;
      this.accrue();
      const grade = RG.rarityGrades[roll.grade];
      const newGrade = !!grade && this.state.gradeCounts[id][grade.id] === 0;
      const rarityOdds = 1 / roll.chances[id];
      const gradeOdds = grade ? 1 / roll.gradeChances[roll.grade] : 1;
      const odds = rarityOdds * gradeOdds;
      const participationMultiplier = roll.participationOwned
        ? RG.participationMultiplier(odds)
        : 1;
      const rarityValue = RG.rarityValue(id, roll.chances[id]);
      const baseAmount = this.round(
        rarityValue *
          roll.pointMultiplier *
          (grade?.pointMultiplier || 1) *
          participationMultiplier,
      );
      const discoveryAmount = isNew
        ? this.round(
            roll.discoveryPoints +
              rarityValue * roll.discoveryScale +
              (grade?.discoveryPoints || 0),
          )
        : newGrade
          ? roll.variantDiscoveryPoints
          : 0;
      const gradeBonus = this.round(
        (grade?.passiveSeconds || 0) * roll.passivePps,
      );
      const amount = this.round(baseAmount + discoveryAmount + gradeBonus);
      const isBest = this.state.best === null || id > this.state.best;
      this.credit(amount);
      this.state.rolls++;
      if (roll.remote) this.state.counters.remoteRolls++;
      if (odds >= 100) this.state.counters.rareRolls++;
      this.state.counts[id]++;
      if (grade) this.state.gradeCounts[id][grade.id]++;
      if (roll.sealOwned) this.state.stamped[id] = true;
      for (const badge of roll.badges) this.state.badges[badge][id] = true;
      if (isBest) this.state.best = id;
      const xp = this.gainXp(
        RG.rollXp(odds) + (isNew ? RG.levels.newRarityXp : 0),
      );
      this.state.maxRolledOdds = Math.max(this.state.maxRolledOdds, odds);
      if (this.nightMarketUnlocked) this.state.upgradesUnlocked = true;
      this.checkAchievements();
      this.offerLuckyDie();
      this.cancelRoll();
      if (roll.logbookOwned) {
        this.state.history.push({
          id,
          at: Date.now(),
          roll: this.state.rolls,
          amount,
          isNew,
          odds,
          rarityOdds,
          gradeOdds,
          grade: roll.grade,
          remote: roll.remote === true,
        });
        this.state.history = this.state.history.slice(-20);
      }
      this.save();
      return {
        id,
        grade: roll.grade,
        rarityOdds,
        gradeOdds,
        participationMultiplier,
        gradeBonus,
        amount,
        baseAmount,
        discoveryAmount,
        isNew,
        newGrade,
        isBest,
        odds,
        xp,
      };
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
      this.luckyDieOffer = null;
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
      this.luckyDieOffer = null;
      this.cancelRoll();
    }
  };
})();
