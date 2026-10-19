"use strict";
window.RG = {};
RG.version = "1.0.3";
RG.changelog = [
  {
    version: "1.0.3",
    date: "2026-10-18",
    name: "The Night Market",
    changes: [
      "Added the Night Market and Treasures.",
      "Added shop dialogue.",
      "Added 7 achievements.",
      "Added Achievement Boost.",
      "Added stat tooltips. Roll cooldown is now Roll Speed.",
      "Updated luck and lowered repeatable upgrade caps.",
      "Updated rolling controls and sounds.",
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
  RG.rarities = names.map((name, id) => ({
    id,
    name,
    color: colors[id] || `hsl(${(id * 137.508) % 360} 40% 70%)`,
    weight: 1 / 1.65 ** id,
    points: Math.max(1, Math.round(1.55 ** id)),
    appearance: RG.rarityAppearance(id + 1),
  }));
  RG.balance = {
    luckStrength: 0.35,
    efficiencySeconds: 0.2,
    pointCurve: 0.25,
    rollingKitBonus: 0.1,
    pointBoosterBonus: 0.25,
    pointFarmBonus: 0.1,
  };
  RG.pointMultiplier = (bonus) =>
    1 + Math.log1p(bonus * RG.balance.pointCurve) / RG.balance.pointCurve;
  RG.upgrades = [
    {
      id: "handbook",
      name: "My Little Handbook",
      cost: 15,
      description:
        "A birthday gift from grandma. Gives you information on the roll screen.",
      requires: null,
    },
    {
      id: "rolling-kit",
      name: "My First Rolling Kit!",
      cost: 30,
      description:
        "Another gift from granny! Makes you better at gathering points, adding +.1 to your point multiplier.",
      requires: "handbook",
    },
    {
      id: "two-leaf-clover",
      name: "2 Leaf Clover",
      description: "A somewhat lucky clover. +.2 luck.",
      cost: 25,
      requires: "rolling-kit",
    },
    {
      id: "lucky-eye",
      name: "Lucky Eye",
      description:
        "You found some roadkill and its eye looked kind of lucky. You can now see rarity odds.",
      cost: 75,
      requires: "two-leaf-clover",
    },
    {
      id: "rolling-dumbell",
      name: "Rolling Dumbell",
      description:
        "Another gift! From granny! You curl some dumbells, making you better at rolling. Roll Speed reduced by 0.2",
      cost: 45,
      requires: "two-leaf-clover",
    },
    {
      id: "collection-book-2",
      name: "Collection Book 2: Electric Boogaloo",
      description:
        "Granny decided to upgrade your subscription. You can now sort the collection book.",
      cost: 60,
      requires: "rolling-dumbell",
    },
    {
      id: "seal-of-approval",
      name: "Seal Of Approval",
      description:
        "A red wax seal, approving your collection. When you discover a new rarity, you get extra points.",
      cost: 75,
      requires: "collection-book-2",
    },
    {
      id: "upgrade-the-upgrades",
      name: "Upgrade the Upgrades",
      description: "You find an upgrade catalog, giving you more upgrades.",
      cost: 175,
      requires: "seal-of-approval",
    },
    {
      id: "logbook",
      name: "Logbook",
      description:
        "Another! Gift! From! Granny! It's a simple logbook, keeping your roll history (max 20)",
      cost: 125,
      requires: "upgrade-the-upgrades",
    },
    {
      id: "inventory",
      name: "Inventory",
      description:
        "You decide to start keeping inventory of how many rarities you have, allowing you to see rarity quantity.",
      cost: 150,
      requires: "logbook",
    },
    {
      id: "simple-point-booster",
      name: "Simple Point Booster",
      description:
        "I couldn't think of a funny item right now. +.25 Point Multiplier",
      cost: 200,
      requires: "inventory",
    },
    {
      id: "remote-cont-roll",
      name: "Remote-Cont-Roll",
      description:
        "Your grandma gives you a big red button that lets you roll from anywhere!",
      cost: 400,
      requires: "simple-point-booster",
    },
  ];
  RG.grades = ["SS", "S", "A", "B", "C", "D", "F"];
  RG.repeatables = [
    {
      id: "efficiency",
      name: "Roll Efficiency",
      description:
        "Train yourself in the art of rolling, decreasing roll speed by .2 second.",
      cost: 50,
      growth: 1.55,
      max: 10,
      effect: (stats) => `${stats.roll_time.toFixed(1)}s Roll Speed`,
    },
    {
      id: "point-farm",
      name: "Point Farm",
      description:
        "Set up little stick-box traps for points, increasing your point multiplier by +.1",
      cost: 40,
      growth: 1.45,
      max: 10,
      effect: (stats) =>
        `${RG.format(stats.point_multiplier)}× point multiplier`,
    },
    {
      id: "luck-training",
      name: "Luck Training",
      description: "Lift a normal clover, increasing total luck by +.5",
      cost: 90,
      growth: 1.65,
      max: 10,
      effect: (stats) => `${RG.format(stats.luck)} total luck`,
    },
    {
      id: "point-factory",
      name: "Point Factory",
      description:
        "Start making counterfeit points on your own, adding +1 passive points per second per upgrade.",
      cost: 80,
      growth: 1.55,
      max: 10,
      effect: (stats) => `${RG.format(stats.passive_pps)} Points / second`,
      requires: "upgrade-the-upgrades",
    },
    {
      id: "adventurer",
      name: "Adventurer",
      description:
        "Start looking closer at your points, boosting discovery points by +5",
      cost: 50,
      growth: 1.45,
      max: 15,
      effect: (stats) =>
        `+${RG.format(stats.discovery_points)} discovery points`,
      requires: "two-leaf-clover",
    },
    {
      id: "achievement-boost",
      name: "Achievement Boost",
      description:
        "Installs an Achievement Juice Drinker in your Roll Machine, boosting passive point generation by a smaller amount depending on how many achievements you have.",
      cost: 100,
      growth: 1.6,
      max: 10,
      requiresAchievement: "maximum-power",
      effect: (stats) => `+${RG.format(stats.achievement_pps)} Points / second`,
    },
  ];
  RG.treasureRarities = ["common", "uncommon", "rare", "epic", "legendary"];
  RG.treasures = [
    {
      id: "star-engine",
      name: "Star Engine",
      rarity: "common",
      description:
        "An engine that runs on Achievement Juice. Boosts your point gain through rolling by total achievements.",
      image: "assets/star-engine.png",
      price: 250,
      achievementBonus: 0.03,
      shelf: { x: 0.39, bottom: 0.49, width: 0.15 },
    },
  ];
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
      check: (engine) => engine.stats.luck > 0,
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
      rewardText: "+1 Luck",
      reward: { luck: 1 },
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
      tooltip: (stats) => `Total luck: ×${RG.format(1 + stats.luck)}`,
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
