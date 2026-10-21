"use strict";
window.RG = {};
RG.version = "1.0.5";
RG.changelog = [
  {
    version: "1.0.5",
    date: "2026-10-21",
    name: "Grades N' Tiers",
    changes: [
      "achievement tiers",
      "rarity grades",
      "rarities up to legendary",
      "prestige, body tree, essence and soul",
      "levels and realms",
      "lucky die",
      "shadow totem",
      "new upgrades: factory maintenance, annex, weighted clover, appraisal kits, auto roll, shopping cart, remote cont-roll control",
      "auto roll settings",
      "rebalanced points and prices",
      "collection counter and unsorted view",
      "bug fixes",
    ],
  },
];
(() => {
  const names = [
    "Abundant",
    "Plentiful",
    "Common",
    "Frequent",
    "Regular",
    "Ordinary",
    "Unusual",
    "Infrequent",
    "Uncommon",
    "Limited",
    "Scarce",
    "Sporadic",
    "Seldom",
    "Elusive",
    "Exceptional",
    "Rare",
    "Distinctive",
    "Very Rare",
    "Remarkably Rare",
    "Exceptionally Rare",
    "Extremely Rare",
    "Ultra Rare",
    "Extraordinary",
    "Phenomenal",
    "Epic",
    "Exotic",
    "Exclusive",
    "Rarefied",
    "Obscure",
    "Esoteric",
    "Enigmatic",
    "Cryptic",
    "Unheard-of",
    "Unseen",
    "Unrecorded",
    "Uncharted",
    "Undiscovered",
    "Forgotten",
    "Lost",
    "Ancient",
    "Relic",
    "Artifact",
    "Anomalous",
    "Unprecedented",
    "Unrepeatable",
    "Irreplaceable",
    "Unique",
    "Singular",
    "Fabled",
    "Legendary",
  ];
  const colors = [
    "#889095",
    "#a3aaad",
    "#c2c7cd",
    "#cbd4dc",
    "#dbe4ee",
    "#eef4f9",
    "#99c5ad",
    "#7ed8a4",
    "#61edaf",
    "#69d9c8",
    "#71dce9",
    "#67cafa",
    "#6bafff",
    "#8aabff",
    "#ac9eff",
    "#bc8cfc",
    "#d49aff",
    "#ec9ce8",
    "#f8b4cf",
    "#ffb191",
    "#ffd09a",
    "#ffda78",
    "#f6e5a0",
    "#ead0ff",
    "#efb1ff",
  ];
  RG.rarityAppearance = (rank) => ({
    treatment: rank >= 100 ? "glow" : rank >= 50 ? "gradient" : "solid",
    stroke: rank < 10 ? 0 : rank < 25 ? 0.15 : 0.3,
    weight: rank < 20 ? 400 : 500,
  });
  RG.balance = {
    rarityStep: 1.65,
    oddsPower: 0.7,
    tierBonus: 0.05,
    luckStrength: 0.26,
    efficiencySeconds: 0.35,
    pointCurve: 0.25,
    rollingKitBonus: 0.1,
    pointBoosterBonus: 0.25,
    pointFarmBonus: 0.1,
    luckTrainingBonus: 0.4,
    achievementBoostBonus: 0.05,
  };
  RG.rarityValue = (id, chance) =>
    Math.max(
      1,
      Math.round(
        (1 / chance) ** RG.balance.oddsPower * (1 + id * RG.balance.tierBonus),
      ),
    );
  RG.rarities = names.map((name, id) => ({
    id,
    name,
    color: colors[id] || `hsl(${(id * 137.508) % 360} 40% 70%)`,
    weight: 1 / RG.balance.rarityStep ** id,
    appearance: RG.rarityAppearance(id + 1),
  }));
  const baseTotal = RG.rarities.reduce((sum, rarity) => sum + rarity.weight, 0);
  RG.rarities.forEach((rarity) => {
    rarity.points = RG.rarityValue(rarity.id, rarity.weight / baseTotal);
  });
  RG.pointMultiplier = (bonus) =>
    1 + Math.log1p(bonus * RG.balance.pointCurve) / RG.balance.pointCurve;
  RG.upgrades = [
    {
      id: "handbook",
      name: "My Little Handbook",
      cost: 25,
      description:
        "A birthday gift from grandma. Gives you information on the roll screen.",
      requires: null,
    },
    {
      id: "rolling-kit",
      name: "My First Rolling Kit!",
      cost: 60,
      description:
        "Another gift from granny! Makes you better at gathering points, adding +.1 to your point multiplier.",
      requires: "handbook",
    },
    {
      id: "two-leaf-clover",
      name: "2 Leaf Clover",
      description: "A somewhat lucky clover. +.2 luck.",
      cost: 100,
      requires: "rolling-kit",
    },
    {
      id: "lucky-eye",
      category: "collection",
      name: "Lucky Eye",
      description:
        "You found some roadkill and its eye looked kind of lucky. You can now see rarity odds.",
      cost: 250,
      requires: "two-leaf-clover",
    },
    {
      id: "rolling-dumbell",
      name: "Rolling Dumbell",
      description:
        "Another gift! From granny! You curl some dumbells, making you better at rolling. Roll Speed reduced by 0.2",
      cost: 150,
      requires: "two-leaf-clover",
    },
    {
      id: "collection-book-2",
      category: "collection",
      name: "Collection Book 2: Electric Boogaloo",
      description:
        "Granny decided to upgrade your subscription. You can now sort the collection book.",
      cost: 300,
      requires: "two-leaf-clover",
    },
    {
      id: "seal-of-approval",
      type: "badge",
      category: "badges",
      name: "Seal Of Approval",
      description:
        "A red wax seal, approving your collection. When you discover a new rarity, you get extra points.",
      cost: 400,
      requires: "rolling-dumbell",
    },
    {
      id: "participation-prize",
      name: "Participation Prize",
      type: "badge",
      category: "badges",
      cost: 1500,
      requires: "seal-of-approval",
      description:
        "Your grandma gave this to you when you got last place in the flute competition. Thanks. - Increases rarity value based on its odds.",
    },
    {
      id: "upgrade-the-upgrades",
      name: "Upgrade the Upgrades",
      description: "You find an upgrade catalog, giving you more upgrades.",
      cost: 1000,
      requires: "seal-of-approval",
    },
    {
      id: "logbook",
      category: "collection",
      name: "Logbook",
      description:
        "Another! Gift! From! Granny! It's a simple logbook, keeping your roll history (max 20)",
      cost: 600,
      requires: "two-leaf-clover",
    },
    {
      id: "inventory",
      category: "collection",
      name: "Inventory",
      description:
        "You decide to start keeping inventory of how many rarities you have, allowing you to see rarity quantity.",
      cost: 800,
      requires: "two-leaf-clover",
    },
    {
      id: "simple-point-booster",
      name: "Simple Point Booster",
      description:
        "I couldn't think of a funny item right now. +.25 Point Multiplier",
      cost: 2500,
      requires: "upgrade-the-upgrades",
    },
    {
      id: "grading-kit",
      name: "Appraisal Kit",
      gradeLimit: 11,
      cost: 350,
      requires: "two-leaf-clover",
      description:
        "Adds Grades to new rolls. Starts with N through D. Grades give a small rolling Point bonus.",
    },
    {
      id: "remote-cont-roll",
      name: "Remote-Cont-Roll",
      description:
        "Your grandma gives you a big red button that lets you roll from anywhere!",
      cost: 6000,
      requires: "simple-point-booster",
    },
  ];
  RG.upgrades.push(
    {
      id: "advanced-appraisal-kit",
      name: "Advanced Appraisal Kit",
      cost: 12000,
      requires: "grading-kit",
      requiresAll: ["upgrade-the-upgrades"],
      gradeLimit: 14,
      description: "A better appraisal kit. Unlocks Grades C, B and A.",
    },
    {
      id: "factory-annex",
      name: "Factory Annex",
      minLifetime: 75000,
      cost: 60000,
      requires: "two-leaf-clover",
      minLevels: { "factory-maintenance": 1 },
      requiresAchievement: "richie-rich",
      passivePps: 5,
      description:
        "Build another room for your point factory. +5 points per second.",
    },
    {
      id: "weighted-clover",
      name: "Weighted Clover",
      minLifetime: 100000,
      cost: 90000,
      requires: "two-leaf-clover",
      requiresAchievement: "richie-rich",
      luckBonus: 0.5,
      description: "A heavier clover for your training. +0.5 Luck.",
    },
    {
      id: "appraisal-kit-iii",
      name: "Ultra Appraisal Kit",
      minLifetime: 150000,
      cost: 200000,
      requires: "advanced-appraisal-kit",
      requiresAchievement: "richie-rich",
      gradeLimit: 17,
      description:
        "An even better appraisal kit. Unlocks Grades AA, AAA and S.",
    },
  );
  RG.upgrades.push(
    {
      id: "shopping-cart",
      name: "Shopping Cart",
      cost: 5000,
      requires: "upgrade-the-upgrades",
      description:
        "Take after the homeless and steal a cart from Raremart, allowing you to buy maximum repeatables.",
    },
    {
      id: "remote-control",
      name: "Remote Cont-Roll Control",
      cost: 15000,
      requires: "remote-cont-roll",
      description:
        "Your grandma attaches a smaller button to the big red button that REALLY allows you to roll from anywhere. Press Space to roll at any time.",
    },
  );
  RG.upgrades.push({
    id: "auto-roll",
    name: "Auto Roll",
    cost: 80000,
    requires: "remote-cont-roll",
    requiresAchievement: "richie-rich",
    minLifetime: 75000,
    description:
      "Starts the next roll automatically. Uses your normal Roll Speed and odds.",
  });
  RG.metaCurrencies = [
    { id: "prestige", name: "Prestige", color: "#ffd66b", icon: "✧" },
    { id: "essence", name: "Essence", color: "#b7f0db", icon: "◈" },
    {
      id: "soul",
      name: "Soul",
      color: "#7fb8ff",
      icon: "●",
      unlocked: (e) => e.stats.soul_rank > 0,
    },
  ];
  RG.bodyLayers = [
    {
      id: "prestige",
      name: "Prestige",
      symbol: "P",
      currency: "prestige",
      color: "#ffd66b",
      position: { x: 400, y: 190 },
    },
    {
      id: "essence",
      name: "Essence",
      symbol: "E",
      currency: "essence",
      color: "#b7f0db",
      position: { x: 400, y: 400 },
      parent: "prestige",
    },
  ];
  RG.soul = {
    firstRank: 60,
    growth: 2.5,
    maxRank: 10,
    soulPerRank: 0.1,
    colors: [
      "#3d8cff",
      "#5a6dff",
      "#8a5cff",
      "#c357ff",
      "#ff4fc8",
      "#ff4f6e",
      "#ff8a3d",
      "#ffd23d",
      "#5dff7a",
      "#c8f6ff",
    ],
    pointsPerRank: 0.05,
    essencePerRank: 0.1,
    luckPerRank: 0.1,
    modes: [
      {
        id: "chance",
        name: "Soul of Chance",
        description:
          "Imbue your soul with Luck, increasing your luck by Soul Rank.",
        effect: (rank) => `+${RG.format(rank * 0.25)} Luck`,
      },
      {
        id: "wealth",
        name: "Soul of Wealth",
        description:
          "Imbue your soul with Greed, increasing your point gain by soul rank.",
        effect: (rank) => `×${RG.format(1 + rank * 0.1)} Points`,
      },
      {
        id: "self",
        name: "Soul of Self",
        description:
          "Imbue all your power into yourself, boosting Essence gain by itself.",
        effect: (rank, essence) =>
          `×${RG.format(RG.soulSelfMultiplier(essence))} Essence`,
      },
    ],
  };
  RG.levels = { base: 40, growth: 1.6, prestigeXp: 500, newRarityXp: 10 };
  RG.levelRequirement = (level) =>
    Math.round(RG.levels.base * level ** RG.levels.growth);
  RG.rollXp = (odds) => 1 + Math.floor(Math.log10(Math.max(1, odds)));
  RG.realms = [
    { id: "alpha", name: "Realm Alpha", from: 0, to: 29 },
    { id: "beta", name: "Realm Beta", from: 30, to: 59 },
  ];
  RG.soulSelfMultiplier = (essence) =>
    Number((1 + Math.log10(1 + essence) * 0.2).toFixed(2));
  RG.soulRankRequirement = (rank) =>
    Math.round(RG.soul.firstRank * RG.soul.growth ** (rank - 1));
  RG.prestigeRarity = 49;
  RG.prestigeDialogue = [
    "So, you did it! You reached the maximum rarity!",
    "Except, this isn't the end. There will always be something rarer.",
    "You can keep going, if you'd like. but from here, you'll have a hard time progressing to further rarities because of their odds.",
    "So, what should you do....? You feel like you may have been here before.",
  ];
  RG.luckyDie = {
    chance: 0.02,
    duration: 45000,
    fallDuration: 12000,
    min: 0.5,
    max: 1.5,
  };

  RG.collectionBadges = [
    {
      id: "seal-of-approval",
      name: "Seal Of Approval",
      image: "assets/wax-seal.png",
      className: "wax-stamp",
    },
    {
      id: "participation-prize",
      name: "Participation Prize",
      image: "assets/participation-prize.png",
      className: "participation-medal",
    },
  ];
  RG.participationMultiplier = (odds) =>
    1 + Math.min(0.5, Math.max(0, Math.log2(Math.max(1, odds))) * 0.02);
  RG.grades = ["SS", "S", "A", "B", "C", "D", "F"];
  RG.repeatables = [
    {
      id: "efficiency",
      name: "Roll Efficiency",
      description:
        "Train yourself in the art of rolling, decreasing roll speed by .35 second.",
      cost: 120,
      growth: 1.6,
      max: 10,
      effect: (stats) => `${stats.roll_time.toFixed(1)}s Roll Speed`,
    },
    {
      id: "point-farm",
      name: "Point Farm",
      description:
        "Set up little stick-box traps for points, increasing your point multiplier by +.1",
      cost: 100,
      growth: 1.5,
      max: 15,
      effect: (stats) =>
        `${RG.format(stats.point_multiplier)}× point multiplier`,
    },
    {
      id: "luck-training",
      name: "Luck Training",
      description: "Lift a normal clover, increasing total luck by +.4",
      cost: 400,
      growth: 1.35,
      max: 30,
      effect: (stats) => `${RG.format(stats.luck)} total luck`,
    },
    {
      id: "point-factory",
      name: "Point Factory",
      description:
        "Start making counterfeit points on your own, adding +1 passive points per second per upgrade.",
      cost: 150,
      growth: 1.45,
      max: 15,
      effect: (stats) =>
        `+${RG.format(stats.factory_pps)} base Points / second`,
      requires: "two-leaf-clover",
    },
    {
      id: "adventurer",
      name: "Adventurer",
      description:
        "Start looking closer at your points, boosting discovery points by +5",
      cost: 80,
      growth: 1.45,
      max: 15,
      effect: (stats) =>
        `+${RG.format(stats.adventurer_points)} discovery points`,
      requires: "two-leaf-clover",
    },
    {
      id: "achievement-boost",
      name: "Achievement Boost",
      description:
        "Installs an Achievement Juice Drinker in your Roll Machine, boosting passive point generation by a smaller amount depending on how many achievements you have.",
      cost: 2500,
      growth: 1.5,
      max: 10,
      requiresAchievement: "maximum-power",
      effect: (stats) => `+${RG.format(stats.achievement_pps)} Points / second`,
    },
  ];
  RG.repeatables.push({
    id: "factory-maintenance",
    name: "Factory Maintenance",
    cost: 4000,
    growth: 1.35,
    max: 15,
    requires: "two-leaf-clover",
    minLevels: { "point-factory": 5 },
    description:
      "Ask your grandma to help your point factory, adding +2 points per second.",
    effect: (stats) =>
      `+${RG.format(stats.maintenance_pps)} base Points / second`,
  });
  RG.rarityGrades = [
    "F",
    "E",
    "D",
    "C",
    "B",
    "A",
    "AA",
    "AAA",
    "S",
    "SS",
    "SSS",
    "X",
    "XX",
    "XXX",
    "Z",
    "ZZ",
    "ZZZ",
    "Δ",
    "Θ",
    "Λ",
    "Ξ",
    "Π",
    "Σ",
    "Φ",
    "Ψ",
    "Ω",
  ].map((name, id) => ({
    id,
    name,
    pointMultiplier: 1 + id * 0.04,
    discoveryPoints: Math.max(0, id - 7) * 2,
    passiveSeconds: Math.max(0, id - 10),
    color:
      id < 3
        ? ["#aaa", "#bcc2c9", "#c6cbb2"][id]
        : `hsl(${145 + id * 13} 65% 72%)`,
  }));
  RG.rarityGrades.forEach((grade) => {
    grade.rank = grade.id + 8;
    grade.pointMultiplier += 0.08;
    grade.treatment = grade.id >= 11 ? "gradient" : "solid";
  });
  ["N", "M", "L", "K", "J", "I", "H", "G"].forEach((name, rank) => {
    RG.rarityGrades.push({
      id: RG.rarityGrades.length,
      name,
      rank,
      pointMultiplier: 1 + rank * 0.01,
      discoveryPoints: 0,
      passiveSeconds: 0,
      color: `hsl(${195 - rank * 8} ${3 + rank * 2}% ${57 + rank * 3}%)`,
      treatment: "solid",
    });
  });
  RG.gradeOrder = [...RG.rarityGrades].sort((a, b) => a.rank - b.rank);
  RG.treasureRarities = ["common", "uncommon", "rare", "epic", "legendary"];
  RG.treasures = [
    {
      id: "star-engine",
      name: "Star Engine",
      rarity: "common",
      description:
        "An engine that runs on Achievement Juice. Boosts your point gain through rolling by total achievements.",
      image: "assets/star-engine.png",
      price: 15000,
      achievementBonus: 0.03,
      shelf: { x: 0.39, bottom: 0.49, width: 0.15 },
    },
  ];
  RG.treasures.push({
    id: "shadow-totem",
    name: "Shadow Totem",
    rarity: "common",
    description:
      "A totem that copies your every move, boosting passive point gain by 2x",
    image: "assets/shadow-totem.png",
    price: 30000,
    passiveMultiplier: 2,
    shelf: { x: 0.72, bottom: 0.72, width: 0.09 },
  });
  RG.achievements = [
    {
      id: "a-start",
      number: "001",
      name: "A Start",
      description:
        "You're just beginning your rolling journey. You've got a long way!",
      requirementText: "100 Points",
      rewardText: "+0.15 Point multiplier",
      reward: { point_multiplier: 0.15 },
      check: (engine) => engine.state.lifetime >= 100,
      grade: "F",
    },
    {
      id: "lucky",
      number: "002",
      name: "Lucky",
      description: "Get your first bit of luck.",
      requirementText: "Gain luck",
      rewardText: "+0.1 luck",
      reward: { luck: 0.1 },
      check: (engine) => engine.stats.permanent_luck > 0,
      grade: "F",
    },
    {
      id: "clicky-clicky",
      number: "003",
      name: "Clicky Clicky",
      description: "Click the rarity in the middle of the screen.",
      requirementText: "Click the rarity",
      rewardText: "+0.1 luck",
      reward: { luck: 0.1 },
      check: (engine) => engine.state.flags.clickedRarity,
      grade: "F",
    },
    {
      id: "rollin",
      number: "004",
      name: "Rollin'",
      description: "Roll 25 times",
      requirementText: "25 rolls",
      rewardText: "+25 Points",
      reward: { points: 25 },
      check: (engine) => engine.state.rolls >= 25,
      grade: "F",
    },
    {
      id: "muted",
      number: "005",
      name: "Mmmph!!! Mmmmmphhh!!",
      description: "Turn sound off.",
      requirementText: "Turn sound off",
      rewardText: "+0.1 luck",
      reward: { luck: 0.1 },
      check: (engine) => engine.state.flags.mutedOnce,
      grade: "F",
    },
    {
      id: "collector",
      number: "006",
      name: "Collector",
      description: "Unlock 10 different rarities.",
      requirementText: "10 different rarities",
      rewardText: "+5 Points on discovery",
      reward: { discovery_points: 5 },
      check: (engine) =>
        engine.state.counts.filter((count) => count > 0).length >= 10,
      grade: "F",
    },
    {
      id: "rank-up",
      number: "007",
      name: "RANK UP!",
      description: "Reach Uncommon.",
      requirementText: "Reach Uncommon",
      rewardText: "+0.2 luck",
      reward: { luck: 0.2 },
      check: (engine) => engine.state.best !== null && engine.state.best >= 8,
      grade: "F",
    },
    {
      id: "baby-beefer",
      number: "008",
      name: "We <3 Baby Beefer",
      faceHeart: true,
      description: "I. FUCKING. LOVE. BABY. BEEFER!",
      requirementText: "",
      rewardText: "+1 Beef",
      reward: { beef: 1 },
      check: (engine) => engine.state.flags.beeferClicked,
      grade: "A",
    },
    {
      id: "daily-paper",
      number: "009",
      name: "Its my daily paper!",
      description: "Check out the Changelog.",
      requirementText: "",
      grade: "F",
      rewardText: "+25 Points",
      reward: { points: 25 },
      check: (engine) => engine.state.flags.readChangelog,
    },
    {
      id: "lets-roll",
      number: "010",
      name: "Lets Roll.",
      description: "Use the Remote Cont-Roll",
      requirementText: "",
      grade: "D",
      rewardText: "+100 Points",
      reward: { points: 100 },
      check: (engine) => engine.state.flags.usedRemote,
    },
    {
      id: "maximum-power",
      number: "011",
      name: "Maximum Power!",
      description: "Max out a repeatable upgrade.",
      requirementText: "",
      grade: "D",
      rewardText: "Unlocks the Achievement Boost upgrade.",
      reward: {},
      check: (engine) =>
        RG.repeatables.some(
          (item) =>
            item.max !== null && engine.state.levels[item.id] >= item.max,
        ),
    },
    {
      id: "fancypants",
      number: "012",
      name: "Fancypants",
      description: "Roll a rarity with odds of 1 in 100 or more.",
      requirementText: "",
      grade: "D",
      rewardText: "+0.5 Luck",
      reward: { luck: 0.5 },
      check: (engine) => engine.state.maxRolledOdds >= 100,
    },
    {
      id: "finally-passive",
      number: "013",
      name: "Finally Passive",
      description: "Get 10 points per second.",
      requirementText: "",
      grade: "F",
      rewardText: "+5 PPS",
      reward: { passive_pps: 5 },
      check: (engine) => engine.stats.passive_pps >= 10,
    },
  ];
  RG.achievements.push({
    id: "be-patient",
    number: "014",
    name: "BE PATIENT!!!!!!",
    description: "Spam the roll button.",
    requirementText: "",
    grade: "F",
    rewardText: "",
    reward: {},
    check: (engine) => engine.state.flags.spammedRoll,
  });
  RG.achievements.push(
    {
      id: "treasure-hunter",
      number: "015",
      name: "Treasure Hunter",
      description: "Get a Treasure.",
      requirementText: "",
      grade: "F",
      rewardText: "+5% rolling Points",
      reward: { rolling_percent: 0.05 },
      check: (e) => e.state.treasures.length > 0,
    },
    {
      id: "tier-up",
      number: "016",
      name: "TIER UP!",
      description: "Get your first tiered up achievement.",
      requirementText: "",
      grade: "F",
      rewardText: "+3% power to Star Engine, if you have it.",
      reward: { star_engine_power: 0.03 },
      check: (e) => Object.values(e.state.achievementTiers).some((t) => t > 0),
    },
    {
      id: "market-bye",
      number: "017",
      name: "Oh...Okay, bye...",
      description: "Have the Night Market close on you.",
      requirementText: "",
      grade: "F",
      rewardText: "",
      reward: {},
      check: (e) => e.state.flags.marketClosed,
    },
    {
      id: "night-market",
      number: "018",
      name: "Night Market",
      description: "Unlock the Night Market.",
      requirementText: "",
      grade: "F",
      rewardText: "",
      reward: {},
      check: (e) => e.nightMarketUnlocked,
    },
    {
      id: "richie-rich",
      number: "019",
      name: "Richie Rich",
      description: "Oh, look at you! You're getting wealthy!",
      requirementText: "75,000 lifetime Points",
      grade: "D",
      rewardText: "Unlocks more Main upgrades.",
      reward: {},
      check: (e) => e.state.lifetime >= 75000,
    },
  );
  RG.achievements.push({
    id: "all-caught-up",
    number: "020",
    name: "All Caught Up",
    description:
      "Get both Treasures, all three Richie Rich upgrades and Auto Roll.",
    requirementText: "",
    grade: "C",
    rewardText: "",
    reward: {},
    check: (e) =>
      RG.treasures.every((t) => e.ownsTreasure(t.id)) &&
      [
        "factory-annex",
        "weighted-clover",
        "appraisal-kit-iii",
        "auto-roll",
      ].every((id) => e.owns(id)),
  });
  RG.achievementTiers = [
    ["Normal", "#c4c4c4", "#333333"],
    ["Copper", "#dfa16e", "#763c22"],
    ["Silver", "#e8edf4", "#7e8fa7"],
    ["Gold", "#ffda6d", "#a57212"],
    ["Diamond", "#d1fbff", "#57bddd", "diamond"],
    ["Ruby", "#ff202c", "#8f000c", "ruby"],
    ["Uranium", "#b3ff55", "#4d9820", "uranium"],
    ["Mythril", "#b6bbff", "#655cc4", "mythril"],
    ["Adamantite", "#afc2dc", "#283b54", "adamantite"],
  ].map(([name, fill, stroke, shader], id) => ({
    id,
    name,
    fill,
    stroke,
    shader,
  }));
  RG.achievementGrades = RG.gradeOrder
    .filter(
      (grade) => grade.name === "F" || grade.rank > RG.rarityGrades[0].rank,
    )
    .map((grade) => grade.name);
  RG.grades = [...RG.achievementGrades].reverse();
  RG.achievementGrade = (base, tier) => {
    const start = Math.max(0, RG.achievementGrades.indexOf(base));
    const target = [0, 1, 2, 3, 5, 9, 13, 22, 25][tier] || 0;
    return RG.achievementGrades[
      Math.min(RG.achievementGrades.length - 1, Math.max(start + tier, target))
    ];
  };
  const track = (thresholds, metric, label) => ({ thresholds, metric, label });
  RG.achievementTracks = {
    "richie-rich": track(
      [
        75000, 150000, 300000, 600000, 1200000, 2400000, 4800000, 9600000,
        20000000,
      ],
      (e) => e.state.lifetime,
      (value) => `${RG.format(value)} lifetime Points`,
    ),
    "a-start": track(
      [100, 1500, 7500, 25000, 75000, 200000, 500000, 1250000, 3000000],
      (e) => e.state.lifetime,
      (value) => `${RG.format(value)} lifetime Points`,
    ),
    lucky: track(
      [0.01, 0.3, 0.6, 1, 1.5, 2.5, 3.5, 5, 6.5],
      (e) => e.stats.permanent_luck,
      (value) => `${RG.format(value)} Luck`,
    ),
    rollin: track(
      [25, 60, 125, 250, 450, 750, 1200, 1800, 2500],
      (e) => e.state.rolls,
      (value) => `${RG.format(value)} completed rolls`,
    ),
    collector: track(
      [10, 12, 14, 16, 18, 20, 22, 24, 25],
      (e) => e.state.counts.filter((count) => count > 0).length,
      (value) => `${value} different rarities`,
    ),
    "rank-up": track(
      [8, 10, 12, 14, 16, 18, 20, 22, 24],
      (e) => e.state.best ?? -1,
      (value) => `Reach ${RG.rarities[value].name}`,
    ),
    "lets-roll": track(
      [1, 10, 25, 60, 125, 250, 450, 750, 1000],
      (e) => e.state.counters.remoteRolls,
      (value) => `${RG.format(value)} completed remote rolls`,
    ),
    "maximum-power": track(
      [10, 20, 30, 40, 50, 65, 80, 95, 110],
      (e) =>
        Object.values(e.state.levels).reduce((sum, level) => sum + level, 0),
      (value) => `${value} total repeatable levels`,
    ),
    fancypants: track(
      [1, 5, 15, 35, 75, 150, 300, 600, 1000],
      (e) => e.state.counters.rareRolls,
      (value) => `${RG.format(value)} rolls at odds of 1 in 100 or rarer`,
    ),
    "finally-passive": track(
      [10, 16, 18, 20, 22, 24, 26, 28, 29],
      (e) => e.stats.passive_pps,
      (value) => `${value} passive Points per second`,
    ),
  };
  RG.achievements.forEach((item) => {
    item.track = RG.achievementTracks[item.id];
    if (item.track && item.grade === "F")
      item.track.thresholds = item.track.thresholds.slice(0, 4);
  });
  RG.shadowQuotes = [
    "Have you ever seen Click by Adam Sandler?",
    "Family Guy is my favorite show.",
    "Also try Prestige Tree!",
    "It's rude to speak about somebody who's listening.",
    "Do you wanna be a BIG SHOT?",
    "This is like, the 3rd deltarune reference.",
    "Its just one of those days where you dont wanna wake up everything is fucked everybody sucks you dont really know why but you wanna ju",
    "Please finish the ArcTree!!!",
    "Trans Rights!",
    "Thank you Oversight team!",
    "I love baby beefer!",
    "How is (City/Town)?",
    "BOO!",
    "Are you scared of me?",
    "I love galaxy.click!",
    "Happy halloween!",
    "Do you ever feel like you're being watched?",
    "What's your name, kid?",
    "Hello, (name).",
    "Living it up in (city/town name), huh, (your name)?",
    "Go ahead. give me your credit card, I dare you.",
  ];
  RG.marketRefusalChance = 0.05;
  RG.shadowPoorQuote = "Come back when you're a little, mmmm, RICHER!";
  RG.sidebarStats = [
    {
      id: "luck",
      name: "Luck",
      icon: "☘︎",
      color: "#65d17d",
      value: (stats) => RG.format(stats.luck),
      tooltip: (stats) =>
        `Total luck: ×${RG.format(1 + stats.luck)}${stats.temporary_luck ? ` (+${RG.format(stats.temporary_luck)} temporary Luck, ${Math.max(0, Math.ceil((stats.luck_expires_at - Date.now()) / 1000))}s left)` : ""}`,
      unlocked: (engine) => engine.stats.luck > 0,
    },
    {
      id: "beef",
      name: "Beef",
      icon: () => RG.BeeferOrb(),
      color: "#b78d6c",
      value: (stats) => RG.format(stats.beef),
      unlocked: (engine) => engine.stats.beef > 0,
    },
  ];
  RG.metaCurrencies.forEach((currency) =>
    RG.sidebarStats.push({
      id: currency.id,
      name: currency.name,
      icon: currency.icon,
      color: currency.color,
      value: (stats) => RG.format(stats.metaCurrencies[currency.id]),
      unlocked: (e) =>
        e.state.meta.prestiges > 0 && (!currency.unlocked || currency.unlocked(e)),
    }),
  );
  const standardFormat = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  });
  const compactFormat = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
    notation: "compact",
  });
  RG.format = (number) =>
    (number >= 1000000 ? compactFormat : standardFormat).format(number);
  RG.oddsText = (chance) => `1 in ${RG.format(1 / chance)}`;
  RG.rollTickTimes = (duration) => {
    const count = Math.max(3, Math.min(32, Math.floor(duration / 80)));
    return Array.from(
      { length: count },
      (_, index) => duration * (index / count) ** 1.35,
    );
  };
})();
