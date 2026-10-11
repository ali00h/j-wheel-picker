// Dependency-free browser runner. Override browser discovery with BROWSER_PATH.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(Boolean);
const browser = candidates.find(candidate => fs.existsSync(candidate));
if (!browser) {
    console.error('Set BROWSER_PATH to an installed Chrome or Edge executable.');
    process.exit(1);
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jwp-tests-'));
try {
    const testUrl = pathToFileURL(path.join(__dirname, 'browser.html'));
    if (process.argv.includes('--examples')) testUrl.searchParams.set('examples', '1');
    const result = spawnSync(browser, [
        '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--allow-file-access-from-files',
        `--user-data-dir=${profile}`, '--virtual-time-budget=10000', '--dump-dom',
        testUrl.href
    ], { encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const report = (result.stdout || '').match(/<pre id="results">([\s\S]*?)<\/pre>/);
    console.log(report ? report[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&') : 'No test report produced.');
    if (result.error || result.status !== 0 || !/data-test-status="passed"/.test(result.stdout || '')) {
        console.error(result.error || result.stderr);
        process.exitCode = 1;
    }
} finally {
    // Only remove the unique temporary profile created by this invocation.
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Browser may still be releasing files. */ }
}
