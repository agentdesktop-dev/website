import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { ImageResponse } from "next/og.js";
import { jsx, jsxs } from "react/jsx-runtime";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const postsDirectory = join(root, "blog/content/posts");
const outputDirectory = join(root, "blog/static/og");
const brandLogo = await readFile(join(root, "docs/assets/imgs/logo-color.svg"));
const brandLogoUrl = `data:image/svg+xml;base64,${brandLogo.toString("base64")}`;

async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = join(directory, entry.name);
      return entry.isDirectory() ? findMarkdownFiles(entryPath) : entryPath;
    }),
  );
  return files.flat().filter((file) => extname(file) === ".md");
}

function firstValue(value, fallback) {
  if (Array.isArray(value)) return String(value[0] ?? fallback);
  return value ? String(value) : fallback;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "agentdesktop blog";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function truncate(value, maximum) {
  if (value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

function titleSize(title) {
  if (title.length > 88) return 54;
  if (title.length > 62) return 60;
  return 68;
}

function createCard({ category, date, title }) {
  return new ImageResponse(
    jsxs("div", {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px 58px",
        color: "#151927",
        background: "#f6f7fb",
        fontFamily: "sans-serif",
      },
      children: [
        jsxs("div", {
          style: {
            display: "flex",
            alignItems: "center",
          },
          children: [
            jsx("img", {
              src: brandLogoUrl,
              width: 238,
              height: 63,
              alt: "",
            }),
            jsx("div", {
              style: {
                display: "flex",
                marginLeft: 18,
                color: "#555b70",
                fontSize: 23,
              },
              children: "blog",
            }),
          ],
        }),
        jsx("div", {
          style: {
            display: "flex",
            maxWidth: 1040,
            fontSize: titleSize(title),
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: "-0.01em",
          },
          children: truncate(title, 112),
        }),
        jsxs("div", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#656b80",
            fontSize: 19,
          },
          children: [
            jsxs("div", {
              style: { display: "flex", alignItems: "center" },
              children: [
                jsx("span", {
                  style: { display: "flex", color: "#6e29e0", fontWeight: 700 },
                  children: category,
                }),
                jsx("span", {
                  style: { display: "flex", margin: "0 12px", color: "#9aa0b4" },
                  children: "·",
                }),
                date,
              ],
            }),
            "agentdesktop.dev/blog",
          ],
        }),
      ],
    }),
    { width: 1200, height: 630 },
  );
}

const files = (await findMarkdownFiles(postsDirectory)).filter(
  (file) => basename(file) !== "_index.md",
);
const seenNames = new Set();
const posts = await Promise.all(
  files.map(async (file) => {
    const { data } = matter(await readFile(file, "utf8"));
    const name = basename(file, extname(file));
    if (seenNames.has(name)) throw new Error(`Duplicate blog post filename: ${name}`);
    seenNames.add(name);
    if (typeof data.title !== "string" || !data.title.trim()) {
      throw new Error(`Blog post is missing a title: ${file}`);
    }
    if (data.ogImage) return null;
    return {
      category: firstValue(data.categories, "Blog"),
      date: formatDate(data.date),
      name,
      title: data.title.trim(),
    };
  }),
);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const post of posts.filter(Boolean)) {
  const response = createCard(post);
  const output = join(outputDirectory, `${post.name}.png`);
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  console.log(`Created ${output.replace(`${root}/`, "")}`);
}