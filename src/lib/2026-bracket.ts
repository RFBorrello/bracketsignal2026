import { BracketSlot, RegionBracket } from "@/lib/types";

const createRoundOne = (
  region: string,
  entries: Array<{
    id: string;
    label: string;
    topTeam: BracketSlot["topTeam"];
    bottomTeam: BracketSlot["bottomTeam"];
  }>,
): BracketSlot[] =>
  entries.map((entry) => ({
    id: entry.id,
    round: 1,
    region,
    label: entry.label,
    topTeam: entry.topTeam,
    bottomTeam: entry.bottomTeam,
  }));

const createAdvancement = (region: string, prefix: string): BracketSlot[] => [
  {
    id: `${prefix}-r2-1`,
    round: 2,
    region,
    label: "Round of 32",
    children: [`${prefix}-r1-1`, `${prefix}-r1-2`],
  },
  {
    id: `${prefix}-r2-2`,
    round: 2,
    region,
    label: "Round of 32",
    children: [`${prefix}-r1-3`, `${prefix}-r1-4`],
  },
  {
    id: `${prefix}-r2-3`,
    round: 2,
    region,
    label: "Round of 32",
    children: [`${prefix}-r1-5`, `${prefix}-r1-6`],
  },
  {
    id: `${prefix}-r2-4`,
    round: 2,
    region,
    label: "Round of 32",
    children: [`${prefix}-r1-7`, `${prefix}-r1-8`],
  },
  {
    id: `${prefix}-r3-1`,
    round: 3,
    region,
    label: "Sweet 16",
    children: [`${prefix}-r2-1`, `${prefix}-r2-2`],
  },
  {
    id: `${prefix}-r3-2`,
    round: 3,
    region,
    label: "Sweet 16",
    children: [`${prefix}-r2-3`, `${prefix}-r2-4`],
  },
  {
    id: `${prefix}-r4-1`,
    round: 4,
    region,
    label: "Elite Eight",
    children: [`${prefix}-r3-1`, `${prefix}-r3-2`],
  },
];

export const regionBrackets: RegionBracket[] = [
  {
    region: "East",
    slots: [
      ...createRoundOne("East", [
        {
          id: "east-r1-1",
          label: "1 vs 16",
          topTeam: { name: "Duke", seed: 1, conference: "ACC", record: "32-2" },
          bottomTeam: { name: "Siena", seed: 16, conference: "MAAC", record: "23-11" },
        },
        {
          id: "east-r1-2",
          label: "8 vs 9",
          topTeam: { name: "Ohio State", seed: 8, conference: "Big Ten", record: "21-12" },
          bottomTeam: { name: "TCU", seed: 9, conference: "Big 12", record: "22-11" },
        },
        {
          id: "east-r1-3",
          label: "5 vs 12",
          topTeam: { name: "St. John's", seed: 5, conference: "Big East", record: "28-6" },
          bottomTeam: { name: "Northern Iowa", seed: 12, conference: "MVC", record: "23-12" },
        },
        {
          id: "east-r1-4",
          label: "4 vs 13",
          topTeam: { name: "Kansas", seed: 4, conference: "Big 12", record: "23-10" },
          bottomTeam: { name: "California Baptist", seed: 13, conference: "WAC", record: "25-8" },
        },
        {
          id: "east-r1-5",
          label: "6 vs 11",
          topTeam: { name: "Louisville", seed: 6, conference: "ACC", record: "23-10" },
          bottomTeam: { name: "South Florida", seed: 11, conference: "AAC", record: "25-8" },
        },
        {
          id: "east-r1-6",
          label: "3 vs 14",
          topTeam: { name: "Michigan State", seed: 3, conference: "Big Ten", record: "25-7" },
          bottomTeam: { name: "North Dakota State", seed: 14, conference: "Summit", record: "27-7" },
        },
        {
          id: "east-r1-7",
          label: "7 vs 10",
          topTeam: { name: "UCLA", seed: 7, conference: "Big Ten", record: "23-11" },
          bottomTeam: { name: "UCF", seed: 10, conference: "Big 12", record: "21-11" },
        },
        {
          id: "east-r1-8",
          label: "2 vs 15",
          topTeam: { name: "UConn", seed: 2, conference: "Big East", record: "29-5" },
          bottomTeam: { name: "Furman", seed: 15, conference: "Southern", record: "22-12" },
        },
      ]),
      ...createAdvancement("East", "east"),
    ],
  },
  {
    region: "West",
    slots: [
      ...createRoundOne("West", [
        {
          id: "west-r1-1",
          label: "1 vs 16",
          topTeam: { name: "Arizona", seed: 1, conference: "Big 12", record: "32-2" },
          bottomTeam: { name: "LIU", seed: 16, conference: "NEC", record: "24-10" },
        },
        {
          id: "west-r1-2",
          label: "8 vs 9",
          topTeam: { name: "Villanova", seed: 8, conference: "Big East", record: "24-8" },
          bottomTeam: { name: "Utah State", seed: 9, conference: "Mountain West", record: "28-6" },
        },
        {
          id: "west-r1-3",
          label: "5 vs 12",
          topTeam: { name: "Wisconsin", seed: 5, conference: "Big Ten", record: "24-10" },
          bottomTeam: { name: "High Point", seed: 12, conference: "Big South", record: "30-4" },
        },
        {
          id: "west-r1-4",
          label: "4 vs 13",
          topTeam: { name: "Arkansas", seed: 4, conference: "SEC", record: "26-8" },
          bottomTeam: { name: "Hawai'i", seed: 13, conference: "Big West", record: "24-8" },
        },
        {
          id: "west-r1-5",
          label: "6 vs 11",
          topTeam: { name: "BYU", seed: 6, conference: "Big 12", record: "23-11" },
          bottomTeam: { name: "Texas", seed: 11, conference: "SEC", record: "19-14" },
        },
        {
          id: "west-r1-6",
          label: "3 vs 14",
          topTeam: { name: "Gonzaga", seed: 3, conference: "WCC", record: "30-3" },
          bottomTeam: { name: "Kennesaw State", seed: 14, conference: "C-USA", record: "21-13" },
        },
        {
          id: "west-r1-7",
          label: "7 vs 10",
          topTeam: { name: "Miami", seed: 7, conference: "ACC", record: "25-8" },
          bottomTeam: { name: "Missouri", seed: 10, conference: "SEC", record: "20-12" },
        },
        {
          id: "west-r1-8",
          label: "2 vs 15",
          topTeam: { name: "Purdue", seed: 2, conference: "Big Ten", record: "27-8" },
          bottomTeam: { name: "Queens", seed: 15, conference: "ASUN", record: "21-13" },
        },
      ]),
      ...createAdvancement("West", "west"),
    ],
  },
  {
    region: "Midwest",
    slots: [
      ...createRoundOne("Midwest", [
        {
          id: "midwest-r1-1",
          label: "1 vs 16",
          topTeam: { name: "Michigan", seed: 1, conference: "Big Ten", record: "31-3" },
          bottomTeam: { name: "Howard", seed: 16, conference: "MEAC", record: "24-10" },
        },
        {
          id: "midwest-r1-2",
          label: "8 vs 9",
          topTeam: { name: "Georgia", seed: 8, conference: "SEC", record: "22-10" },
          bottomTeam: { name: "Saint Louis", seed: 9, conference: "A-10", record: "28-5" },
        },
        {
          id: "midwest-r1-3",
          label: "5 vs 12",
          topTeam: { name: "Texas Tech", seed: 5, conference: "Big 12", record: "22-10" },
          bottomTeam: { name: "Akron", seed: 12, conference: "MAC", record: "29-5" },
        },
        {
          id: "midwest-r1-4",
          label: "4 vs 13",
          topTeam: { name: "Alabama", seed: 4, conference: "SEC", record: "23-9" },
          bottomTeam: { name: "Hofstra", seed: 13, conference: "CAA", record: "24-10" },
        },
        {
          id: "midwest-r1-5",
          label: "6 vs 11",
          topTeam: { name: "Tennessee", seed: 6, conference: "SEC", record: "22-11" },
          bottomTeam: { name: "Miami (OH)", seed: 11, conference: "MAC", record: "31-1" },
        },
        {
          id: "midwest-r1-6",
          label: "3 vs 14",
          topTeam: { name: "Virginia", seed: 3, conference: "ACC", record: "29-5" },
          bottomTeam: { name: "Wright State", seed: 14, conference: "Horizon", record: "23-11" },
        },
        {
          id: "midwest-r1-7",
          label: "7 vs 10",
          topTeam: { name: "Kentucky", seed: 7, conference: "SEC", record: "21-13" },
          bottomTeam: { name: "Santa Clara", seed: 10, conference: "WCC", record: "26-8" },
        },
        {
          id: "midwest-r1-8",
          label: "2 vs 15",
          topTeam: { name: "Iowa State", seed: 2, conference: "Big 12", record: "27-7" },
          bottomTeam: { name: "Tennessee State", seed: 15, conference: "OVC", record: "23-9" },
        },
      ]),
      ...createAdvancement("Midwest", "midwest"),
    ],
  },
  {
    region: "South",
    slots: [
      ...createRoundOne("South", [
        {
          id: "south-r1-1",
          label: "1 vs 16",
          topTeam: { name: "Florida", seed: 1, conference: "SEC", record: "26-7" },
          bottomTeam: { name: "Prairie View A&M", seed: 16, conference: "SWAC", record: "18-17" },
        },
        {
          id: "south-r1-2",
          label: "8 vs 9",
          topTeam: { name: "Clemson", seed: 8, conference: "ACC", record: "24-10" },
          bottomTeam: { name: "Iowa", seed: 9, conference: "Big Ten", record: "21-12" },
        },
        {
          id: "south-r1-3",
          label: "5 vs 12",
          topTeam: { name: "Vanderbilt", seed: 5, conference: "SEC", record: "26-8" },
          bottomTeam: { name: "McNeese", seed: 12, conference: "Southland", record: "28-5" },
        },
        {
          id: "south-r1-4",
          label: "4 vs 13",
          topTeam: { name: "Nebraska", seed: 4, conference: "Big Ten", record: "26-6" },
          bottomTeam: { name: "Troy", seed: 13, conference: "Sun Belt", record: "22-11" },
        },
        {
          id: "south-r1-5",
          label: "6 vs 11",
          topTeam: { name: "North Carolina", seed: 6, conference: "ACC", record: "24-8" },
          bottomTeam: { name: "VCU", seed: 11, conference: "A-10", record: "27-7" },
        },
        {
          id: "south-r1-6",
          label: "3 vs 14",
          topTeam: { name: "Illinois", seed: 3, conference: "Big Ten", record: "24-8" },
          bottomTeam: { name: "Penn", seed: 14, conference: "Ivy", record: "18-11" },
        },
        {
          id: "south-r1-7",
          label: "7 vs 10",
          topTeam: { name: "Saint Mary's", seed: 7, conference: "WCC", record: "27-5" },
          bottomTeam: { name: "Texas A&M", seed: 10, conference: "SEC", record: "21-11" },
        },
        {
          id: "south-r1-8",
          label: "2 vs 15",
          topTeam: { name: "Houston", seed: 2, conference: "Big 12", record: "28-6" },
          bottomTeam: { name: "Idaho", seed: 15, conference: "Big Sky", record: "21-14" },
        },
      ]),
      ...createAdvancement("South", "south"),
    ],
  },
];

export const finalFourSlots: BracketSlot[] = [
  {
    id: "final-four-1",
    round: 5,
    region: "Final Four",
    label: "National Semifinal",
    children: ["east-r4-1", "south-r4-1"],
  },
  {
    id: "final-four-2",
    round: 5,
    region: "Final Four",
    label: "National Semifinal",
    children: ["west-r4-1", "midwest-r4-1"],
  },
  {
    id: "title-game",
    round: 6,
    region: "Final Four",
    label: "National Championship",
    children: ["final-four-1", "final-four-2"],
  },
];
