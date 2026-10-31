import { NextResponse } from "next/server";

const OFFICIAL_URL = "https://ai.google.dev/gemini-api/docs/pricing";
// Force English: Google otherwise redirects to a localized page (for example
// ?hl=it) whose table labels are translated, which broke the parser.
const PRICING_URL = `${OFFICIAL_URL}?hl=en`;
const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_HEADER = "public, s-maxage=21600, stale-while-revalidate=86400";

// Google occasionally throttles unknown agents, so retry with a browser UA.
const USER_AGENTS = [
  "Vexora/1.0 (+https://github.com/joyebkdev/Vexora)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
];

// Chat-only models. Google's pricing page also lists Live, TTS, transcription,
// image and embedding models, which this text chat cannot use.
const NON_TEXT_MODEL =
  /(-live|-tts|-transcribe|-image|-audio|embedding|computer-use|realtime|native-audio)/i;

let cache = { at: 0, models: [] };

const decodeEntities = (value) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const htmlToLines = (html) =>
  decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const isFreePrice = (value) => /^(free of charge|\$0(?:\.00+)?)\b/i.test(value);

const addModel = (models, seen, id) => {
  const model = (id || "").replace(/[.,;:]+$/, "");
  if (!model || seen.has(model) || NON_TEXT_MODEL.test(model)) return;
  seen.add(model);
  models.push(model);
};

// Google renders one section per model. The primary parser walks the text
// lines: the model ID appears on its own line and the Standard pricing table
// that follows starts with an "Input price" row whose Free Tier column says
// either "Free of charge" or "Not available".
//
// A second pass reads the tables directly and pairs each free pricing table
// with the nearest model link before it. That keeps working if Google changes
// the surrounding markup or adds extra text between the heading and the table.
const parseGeminiFreeModels = (html) => {
  const lines = htmlToLines(html);
  const models = [];
  const seen = new Set();

  lines.forEach((line, index) => {
    if (!/^gemini-[0-9][\w.-]*$/.test(line)) return;

    const section = lines.slice(index, index + 200);
    const priceRow = section.indexOf("Input price");
    if (priceRow === -1) return;

    if (isFreePrice(section[priceRow + 1] || "")) {
      addModel(models, seen, line);
    }
  });

  const tables = html.matchAll(
    /<table[^>]*class="[^"]*pricing-table[^"]*"[\s\S]*?<\/table>/gi
  );
  for (const table of tables) {
    if (!/Input price/i.test(table[0])) continue;
    if (!/Free of charge/i.test(table[0])) continue;

    const before = html.slice(Math.max(0, table.index - 5000), table.index);
    const ids = [...before.matchAll(/gemini-[0-9][\w.-]*/g)];
    if (ids.length > 0) {
      addModel(models, seen, ids[ids.length - 1][0]);
    }
  }

  return models;
};

const fetchFreeModels = async () => {
  let lastError = new Error("Google's pricing page could not be read.");

  for (const userAgent of USER_AGENTS) {
    try {
      const response = await fetch(PRICING_URL, {
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml",
        },
        // We keep our own six-hour cache below; never reuse a poisoned fetch
        // cache entry from dev or a failed request.
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Google returned HTTP ${response.status}.`);
      }

      const models = parseGeminiFreeModels(await response.text());
      if (models.length > 0) return models;

      lastError = new Error(
        "Could not find any free text models on Google's pricing page."
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const json = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": CACHE_HEADER },
  });

export async function GET(request) {
  const provider =
    new URL(request.url).searchParams.get("provider") || "gemini";

  if (provider !== "gemini") {
    return NextResponse.json(
      { error: `No official free-tier adapter for "${provider}".` },
      { status: 400 }
    );
  }

  const now = Date.now();
  if (cache.models.length > 0 && now - cache.at < CACHE_TTL) {
    return json({
      provider,
      models: cache.models,
      source: OFFICIAL_URL,
      fetchedAt: new Date(cache.at).toISOString(),
      cached: true,
    });
  }

  try {
    const models = await fetchFreeModels();
    cache = { at: now, models };

    return json({
      provider,
      models,
      source: OFFICIAL_URL,
      fetchedAt: new Date(now).toISOString(),
      cached: false,
    });
  } catch (error) {
    // Keep serving the previous list if Google's page is temporarily down.
    if (cache.models.length > 0) {
      return json({
        provider,
        models: cache.models,
        source: OFFICIAL_URL,
        fetchedAt: new Date(cache.at).toISOString(),
        cached: true,
        warning: `${error.message} Using the last successful list.`,
      });
    }

    return NextResponse.json(
      {
        provider,
        models: [],
        error: error.message,
        source: OFFICIAL_URL,
      },
      { status: 502 }
    );
  }
}

