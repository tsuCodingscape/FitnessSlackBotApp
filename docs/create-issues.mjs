#!/usr/bin/env node
/**
 * Creates the GitHub labels, milestones and issues described in
 * docs/backlog.md. The backlog is the only copy of the issue text - this
 * script just parses it - so edit issues there, not here.
 *
 * Safe to re-run: labels are upserted, and milestones and issues whose
 * title already exists in the repo (open or closed) are skipped.
 *
 * Usage:
 *   node docs/create-issues.mjs             create everything (needs `gh auth login`)
 *   node docs/create-issues.mjs --dry-run   print the plan; never calls gh
 *
 * Env: REPO (default tsuCodingscape/FitnessSlackBotApp), GH_BIN (default gh),
 *      DRY_RUN=1 (same as --dry-run).
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = process.env.REPO ?? "tsuCodingscape/FitnessSlackBotApp";
const GH = process.env.GH_BIN ?? "gh";
const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const BACKLOG = join(dirname(fileURLToPath(import.meta.url)), "backlog.md");

const PRIORITY_COLORS = { P0: "b60205", P1: "d93f0b", P2: "fbca04", P3: "0e8a16" };
const AREA_COLOR = "ededed";

// --- Parse docs/backlog.md ---------------------------------------------------

function parseBacklog(markdown) {
  const milestones = [];
  const issues = [];
  let milestone = null;
  let issue = null;

  const finishIssue = () => {
    if (!issue) return;
    issue.body = issue.lines.join("\n").trim();
    delete issue.lines;
    issues.push(issue);
    issue = null;
  };

  for (const line of markdown.split("\n")) {
    const milestoneHeading = line.match(/^## (M\d+ - .+)$/);
    if (milestoneHeading) {
      finishIssue();
      milestone = { title: milestoneHeading[1].trim(), description: "" };
      milestones.push(milestone);
      continue;
    }
    if (/^## /.test(line)) {
      // Any other second-level heading (e.g. "Summary") ends the current milestone.
      finishIssue();
      milestone = null;
      continue;
    }
    const issueHeading = line.match(/^### (\d+)\. (.+)$/);
    if (issueHeading) {
      finishIssue();
      if (!milestone) throw new Error(`Issue "${line}" is not under an "## M<n> - ..." milestone heading`);
      issue = { number: Number(issueHeading[1]), title: issueHeading[2].trim(), milestone: milestone.title, lines: [] };
      continue;
    }
    if (issue) {
      const meta = line.match(/^<!--\s*labels:\s*(.+?)\s*\|\s*size:\s*(\S+)\s*-->$/);
      if (meta && !issue.labels) {
        issue.labels = meta[1].split(",").map((l) => l.trim()).filter(Boolean);
        issue.size = meta[2];
        continue;
      }
      issue.lines.push(line.replace(/^#### /, "## "));
    } else if (milestone && !milestone.description && line.trim()) {
      milestone.description = line.trim();
    }
  }
  finishIssue();

  // Fail loudly on a malformed backlog rather than creating half-labelled issues.
  const errors = [];
  issues.forEach((i, index) => {
    // Numbers are GitHub issue numbers, so they need not start at 1, but must stay in order.
    if (index > 0 && i.number <= issues[index - 1].number) {
      errors.push(`Issue "${i.title}" is numbered ${i.number}, after ${issues[index - 1].number}; numbers must increase`);
    }
    if (!i.labels) errors.push(`Issue ${i.number} has no "<!-- labels: ... | size: ... -->" line`);
    else if (!i.labels.some((l) => l in PRIORITY_COLORS)) errors.push(`Issue ${i.number} has no P0-P3 label`);
    if (!i.body) errors.push(`Issue ${i.number} has an empty body`);
  });
  if (issues.length === 0) errors.push("No issues found");
  if (errors.length) throw new Error(`docs/backlog.md is malformed:\n  - ${errors.join("\n  - ")}`);

  for (const i of issues) {
    const priority = i.labels.find((l) => l in PRIORITY_COLORS);
    i.body = `**Priority:** ${priority}  |  **Size:** ${i.size}  |  **Milestone:** ${i.milestone}\n\n${i.body}`;
  }
  return { milestones, issues };
}

// --- GitHub ------------------------------------------------------------------

function gh(args, input) {
  try {
    return execFileSync(GH, args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    const detail = (err.stderr || err.message || "").toString().trim();
    throw new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${detail}`);
  }
}

function lines(output) {
  return output.split("\n").map((l) => l.trim()).filter(Boolean);
}

function main() {
  const { milestones, issues } = parseBacklog(readFileSync(BACKLOG, "utf8"));
  const labels = [...new Set(issues.flatMap((i) => i.labels))].sort();

  if (DRY_RUN) {
    console.log(`[dry-run] Repo: ${REPO}`);
    console.log(`[dry-run] ${labels.length} labels: ${labels.join(", ")}`);
    console.log(`[dry-run] ${milestones.length} milestones:`);
    for (const m of milestones) console.log(`  - ${m.title}`);
    console.log(`[dry-run] ${issues.length} issues (any whose title already exists would be skipped):`);
    for (const i of issues) console.log(`  #${i.number} ${i.title}  [${i.labels.join(", ")}] -> ${i.milestone}`);
    return;
  }

  gh(["auth", "status"]);

  console.log("Labels...");
  for (const label of labels) {
    gh(["label", "create", label, "--repo", REPO, "--color", PRIORITY_COLORS[label] ?? AREA_COLOR, "--force"]);
  }

  console.log("Milestones...");
  const existingMilestones = new Set(
    lines(gh(["api", "--paginate", `repos/${REPO}/milestones?state=all&per_page=100`, "--jq", ".[].title"]))
  );
  for (const m of milestones) {
    if (existingMilestones.has(m.title)) {
      console.log(`  exists: ${m.title}`);
      continue;
    }
    gh(["api", `repos/${REPO}/milestones`, "-f", `title=${m.title}`, "-f", `description=${m.description}`]);
    console.log(`  created: ${m.title}`);
  }

  console.log("Issues...");
  const existingTitles = new Set(
    lines(gh(["issue", "list", "--repo", REPO, "--state", "all", "--limit", "1000", "--json", "title", "--jq", ".[].title"]))
  );
  let created = 0;
  for (const i of issues) {
    if (existingTitles.has(i.title)) {
      console.log(`  exists: ${i.title}`);
      continue;
    }
    const url = gh(
      ["issue", "create", "--repo", REPO, "--title", i.title, "--label", i.labels.join(","), "--milestone", i.milestone, "--body-file", "-"],
      i.body
    ).trim();
    console.log(`  created: ${url}`);
    created += 1;
  }
  console.log(`Done: ${created} created, ${issues.length - created} already existed.`);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
