/**
 * netlify-plugin-sitemap-ping
 *
 * Pings Google and Bing with your sitemap URL after every successful deploy
 * so new or updated content gets indexed faster.
 *
 * Note: Google deprecated the ping endpoint in 2023 but IndexNow (used by
 * Bing, Yandex, and others) is still active. This plugin uses IndexNow
 * for Bing/Yandex and also submits to Google Search Console's standard
 * sitemap ping as a best-effort fallback.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      })
      .on("error", reject);
  });
}

module.exports = {
  onSuccess: async ({ constants, inputs, utils }) => {
    const siteUrl = (inputs.siteUrl || process.env.URL || "").replace(/\/$/, "");

    if (!siteUrl) {
      console.log("⚠️  Sitemap Ping: No site URL found. Set siteUrl in plugin inputs or ensure URL env var is set.");
      return;
    }

    const sitemapPath = inputs.sitemapPath || "/sitemap-index.xml";
    const sitemapUrl = `${siteUrl}${sitemapPath}`;

    // Check that sitemap exists in the build output
    const publishDir = constants.PUBLISH_DIR;
    const localSitemap = path.join(publishDir, sitemapPath);
    if (!fs.existsSync(localSitemap)) {
      // Try common alternatives
      const alternatives = ["/sitemap.xml", "/sitemap-index.xml", "/sitemap-0.xml"];
      let found = null;
      for (const alt of alternatives) {
        if (fs.existsSync(path.join(publishDir, alt))) {
          found = alt;
          break;
        }
      }
      if (!found) {
        console.log(`⚠️  Sitemap Ping: No sitemap found at ${sitemapPath}. Skipping.`);
        return;
      }
      console.log(`   Sitemap not at ${sitemapPath}, using ${found} instead.`);
    }

    console.log("\n📡 Sitemap Ping — notifying search engines...\n");
    console.log(`   Sitemap: ${sitemapUrl}\n`);

    const targets = [
      {
        name: "Google",
        url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      },
      {
        name: "Bing (IndexNow)",
        url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      },
      {
        name: "Yandex",
        url: `https://yandex.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      },
    ];

    for (const target of targets) {
      try {
        const res = await httpGet(target.url);
        const status = res.status < 300 ? "✅" : `⚠️  ${res.status}`;
        console.log(`   ${status} ${target.name}`);
      } catch (err) {
        console.log(`   ❌ ${target.name}: ${err.message}`);
      }
    }

    console.log("\n   Done — search engines notified.\n");
  },
};
