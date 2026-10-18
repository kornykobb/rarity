"use strict";
window.RG = {};
RG.version = "1.0.1";
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
  RG.balance = { luckStrength: 0.15, efficiencySeconds: 0.2, pointCurve: 0.15 };
  RG.pointMultiplier = (bonus) =>
    1 + Math.log1p(bonus * RG.balance.pointCurve) / RG.balance.pointCurve;
  RG.upgrades = [
    {
      id: "handbook",
      name: "My Little Handbook",
      cost: 35,
      description:
        "A birthday gift from grandma. Gives you information on the roll screen.",
      requires: null,
    },
    {
      id: "rolling-kit",
      name: "My First Rolling Kit!",
      cost: 75,
      description:
        "Another gift from granny! Makes you better at gathering points, adding +.2 to your point multiplier.",
      requires: "handbook",
    },
    {
      id: "two-leaf-clover",
      name: "2 Leaf Clover",
      description: "A somewhat lucky clover. +.2 luck.",
      cost: 50,
      requires: "rolling-kit",
    },
    {
      id: "lucky-eye",
      name: "Lucky Eye",
      description:
        "You found some roadkill and its eye looked kind of lucky. You can now see rarity odds.",
      cost: 300,
      requires: "two-leaf-clover",
    },
    {
      id: "rolling-dumbell",
      name: "Rolling Dumbell",
      description:
        "Another gift! From granny! You curl some dumbells, making you better at rolling. Roll cooldown reduced by 0.2",
      cost: 95,
      requires: "two-leaf-clover",
    },
    {
      id: "collection-book-2",
      name: "Collection Book 2: Electric Boogaloo",
      description:
        "Granny decided to upgrade your subscription. You can now sort the collection book.",
      cost: 150,
      requires: "rolling-dumbell",
    },
    {
      id: "seal-of-approval",
      name: "Seal Of Approval",
      description:
        "A red wax seal, approving your collection. When you discover a new rarity, you get extra points.",
      cost: 150,
      requires: "collection-book-2",
    },
    {
      id: "upgrade-the-upgrades",
      name: "Upgrade the Upgrades",
      description: "You find an upgrade catalog, giving you more upgrades.",
      cost: 400,
      requires: "seal-of-approval",
    },
    {
      id: "logbook",
      name: "Logbook",
      description:
        "Another! Gift! From! Granny! It's a simple logbook, keeping your roll history (max 20)",
      cost: 350,
      requires: "upgrade-the-upgrades",
    },
    {
      id: "inventory",
      name: "Inventory",
      description:
        "You decide to start keeping inventory of how many rarities you have, allowing you to see rarity quantity.",
      cost: 400,
      requires: "logbook",
    },
    {
      id: "simple-point-booster",
      name: "Simple Point Booster",
      description:
        "I couldn't think of a funny item right now. +.7 Point Multiplier",
      cost: 500,
      requires: "inventory",
    },
    {
      id: "remote-cont-roll",
      name: "Remote-Cont-Roll",
      description:
        "Your grandma gives you a big red button that lets you roll from anywhere!",
      cost: 1000,
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
      cost: 125,
      growth: 2.6,
      max: 10,
      effect: (stats) => `${stats.roll_time.toFixed(1)}s roll cooldown`,
    },
    {
      id: "point-farm",
      name: "Point Farm",
      description:
        "Set up little stick-box traps for points, increasing your point multiplier by +.2",
      cost: 75,
      growth: 1.85,
      max: 25,
      effect: (stats) =>
        `${RG.format(stats.point_multiplier)}× point multiplier`,
    },
    {
      id: "luck-training",
      name: "Luck Training",
      description: "Lift a normal clover, increasing total luck by +.5",
      cost: 175,
      growth: 2.25,
      max: 25,
      effect: (stats) => `${RG.format(stats.luck)} total luck`,
    },
    {
      id: "point-factory",
      name: "Point Factory",
      description:
        "Start making counterfeit points on your own, adding +1 passive points per second per upgrade.",
      cost: 150,
      growth: 2,
      max: 10,
      effect: (stats) => `${RG.format(stats.passive_pps)} Points / second`,
      requires: "upgrade-the-upgrades",
    },
    {
      id: "adventurer",
      name: "Adventurer",
      description:
        "Start looking closer at your points, boosting discovery points by +5",
      cost: 150,
      growth: 1.9,
      max: 15,
      effect: (stats) =>
        `+${RG.format(stats.discovery_points)} discovery points`,
      requires: "two-leaf-clover",
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
      rewardText: "+0.5 Point multiplier",
      reward: { point_multiplier: 0.5 },
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
  ];
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
  RG.oddsText = (chance) => `1 in ${RG.format(Math.round(1 / chance))}`;
  RG.rollTickTimes = (duration) => {
    const count = Math.max(3, Math.min(32, Math.floor(duration / 80)));
    return Array.from(
      { length: count },
      (_, index) => duration * (index / count) ** 1.35,
    );
  };
})();
