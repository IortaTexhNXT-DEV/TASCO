// Render Mermaid diagrams to PNG (2x device scale) in the iorta TechNXT template colours.
// Usage: node render_mermaid.js <jobs.json> <mermaid.min.js>
//   jobs.json = [{ "code": "...", "out": "/abs/path.png" }, ...]
// Prints a JSON summary {rendered, failed, errors:[{out,message}]} on stdout.
// Based on scratchpad/conv/render_mermaid.js (Playwright + Chromium).
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

const [jobsFile, mermaidJs] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));

const FONT = '"Segoe UI", Inter, Arial, sans-serif';
const config = {
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  fontFamily: FONT,
  themeVariables: {
    fontFamily: FONT,
    fontSize: '14px',
    background: '#FFFFFF',
    primaryColor: '#E8F1FA',        // light fill
    primaryBorderColor: '#1D74BA',  // template primary blue
    primaryTextColor: '#101820',    // template body text colour
    secondaryColor: '#F3F7FB',
    secondaryBorderColor: '#7FA7CF',
    secondaryTextColor: '#101820',
    tertiaryColor: '#FFFFFF',
    tertiaryBorderColor: '#9DBFE0',
    lineColor: '#0F4761',           // template heading blue
    textColor: '#101820',
    clusterBkg: '#F5F9FD',
    clusterBorder: '#9DBFE0',
    titleColor: '#0F4761',
    edgeLabelBackground: '#FFFFFF',
    nodeBorder: '#1D74BA',
    mainBkg: '#E8F1FA',
    actorBkg: '#E8F1FA',
    actorBorder: '#1D74BA',
    actorTextColor: '#101820',
    actorLineColor: '#7FA7CF',
    signalColor: '#0F4761',
    signalTextColor: '#101820',
    labelBoxBkgColor: '#E8F1FA',
    labelBoxBorderColor: '#1D74BA',
    labelTextColor: '#101820',
    loopTextColor: '#0F4761',
    noteBkgColor: '#FFF6DD',
    noteBorderColor: '#D9B54A',
    noteTextColor: '#101820',
    activationBkgColor: '#D6E6F5',
    activationBorderColor: '#1D74BA',
    sequenceNumberColor: '#FFFFFF',
  },
  flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis', padding: 12, nodeSpacing: 40, rankSpacing: 50 },
  sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 40, boxMargin: 8, messageMargin: 32, wrap: true },
  state: { useMaxWidth: false },
  class: { useMaxWidth: false },
  er: { useMaxWidth: false },
  gantt: { useMaxWidth: false },
  journey: { useMaxWidth: false },
  pie: { useMaxWidth: false },
  mindmap: { useMaxWidth: false },
  timeline: { useMaxWidth: false },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 2400, height: 1600 } });
  await page.setContent(`<html><head><style>body{background:#fff;margin:0;font-family:${FONT}} #c{display:inline-block;padding:8px;background:#fff}</style></head><body><div id="c"></div></body></html>`);
  await page.addScriptTag({ path: mermaidJs });
  await page.evaluate((cfg) => window.mermaid.initialize(cfg), config);
  await page.evaluate(() => document.fonts.ready);
  let rendered = 0;
  const errors = [];
  for (let i = 0; i < jobs.length; i++) {
    const { code, out } = jobs[i];
    try {
      await page.evaluate(async ({ code, id }) => {
        const c = document.getElementById('c');
        c.innerHTML = '';
        const { svg } = await window.mermaid.render(id, code);
        c.innerHTML = svg;
      }, { code, id: `m${i}` });
      const el = await page.$('#c');
      await el.screenshot({ path: out, omitBackground: false });
      rendered++;
    } catch (e) {
      errors.push({ out, message: String(e.message || e).split('\n')[0] });
    }
  }
  await browser.close();
  console.log(JSON.stringify({ rendered, failed: errors.length, errors }));
})();
