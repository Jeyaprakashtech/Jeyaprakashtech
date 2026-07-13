/**
 * generate-contribution-graph.js
 *
 * Renders your real GitHub contribution calendar as a self-contained,
 * animated SVG that matches the README's navy/blue theme — replacing the
 * default-styled snake animation, which doesn't match the color scheme
 * and can't be restyled beyond its built-in palettes.
 *
 * Requires env vars:
 *   GH_USERNAME  - the GitHub username to report on
 *   GH_TOKEN     - a token with `read:user` (+ `repo` if you want private
 *                  contributions included)
 */

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  console.error("Missing GH_USERNAME or GH_TOKEN env vars.");
  process.exit(1);
}

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            weekday
          }
        }
      }
    }
  }
}
`;

const CELL = 11;
const GAP = 3;
const LEFT_PAD = 30;
const TOP_PAD = 30;

// theme colors — empty cell up through highest-intensity cell
const SCALE = ["#152A54", "#1E3A6E", "#2954A0", "#2563EB", "#60A5FA"];

async function main() {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const total = json.data.user.contributionsCollection.contributionCalendar.totalContributions;

  const svg = renderGraph(weeks, total);

  const fs = await import("fs");
  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/contribution-graph.svg", svg);
  console.log("Wrote assets/contribution-graph.svg");
}

function colorFor(count, max) {
  if (count === 0) return SCALE[0];
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.75) return SCALE[4];
  if (ratio > 0.5) return SCALE[3];
  if (ratio > 0.25) return SCALE[2];
  return SCALE[1];
}

function renderGraph(weeks, total) {
  const max = Math.max(...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));
  const width = LEFT_PAD + weeks.length * (CELL + GAP) + 10;
  const height = TOP_PAD + 7 * (CELL + GAP) + 20;

  let cells = "";
  let monthLabels = "";
  let lastMonth = null;

  weeks.forEach((week, wi) => {
    const firstDay = week.contributionDays[0];
    if (firstDay) {
      const month = new Date(firstDay.date).getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        const label = new Date(firstDay.date).toLocaleString("en-US", { month: "short" });
        monthLabels += `<text x="${LEFT_PAD + wi * (CELL + GAP)}" y="16" font-family="Consolas, Menlo, monospace" font-size="10" fill="#93C5FD" opacity="0.7">${label}</text>`;
      }
    }

    week.contributionDays.forEach((day) => {
      const x = LEFT_PAD + wi * (CELL + GAP);
      const y = TOP_PAD + day.weekday * (CELL + GAP);
      const fill = colorFor(day.contributionCount, max);
      const delay = (wi * 0.012).toFixed(3);
      cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2.5" fill="${fill}" opacity="0">
        <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.4s" fill="freeze"/>
      </rect>`;
    });
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="graphBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1E3D"/>
      <stop offset="100%" stop-color="#122a52"/>
    </linearGradient>
    <clipPath id="graphClip"><rect x="0" y="0" width="${width}" height="${height}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#graphClip)">
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#graphBg)"/>
    <rect x="0" y="0" width="${width}" height="4" fill="#2563EB">
      <animate attributeName="width" from="0" to="${width}" dur="1s" fill="freeze"/>
    </rect>
    ${monthLabels}
    ${cells}
    <text x="${LEFT_PAD}" y="${height - 6}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="11" fill="#CBD5E1" opacity="0">
      ${total} contributions in the last year
      <animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="0.6s" fill="freeze"/>
    </text>
  </g>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="14" fill="none" stroke="#2563EB" stroke-opacity="0.35"/>
</svg>`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
