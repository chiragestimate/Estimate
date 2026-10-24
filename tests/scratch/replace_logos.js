const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const srcJpg = 'C:/Users/tirth/.gemini/antigravity/brain/f96c51f5-083a-43ab-b2cf-e51f633b1bac/.user_uploaded/media_1792822878794_a353ba8f.jpg';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  const jpgBuffer = fs.readFileSync(srcJpg);
  const base64 = jpgBuffer.toString('base64');
  await page.setContent('<html><body style="margin:0;padding:0;"><img id="logo" src="data:image/jpeg;base64,' + base64 + '"></body></html>');
  const imgElement = await page.$('#logo');
  const pngBuffer = await imgElement.screenshot({ type: 'png' });
  await browser.close();

  const targetsJpg = [
    'apps/Invoice Builder/logo.jpg',
    'apps/Invoice Builder/public/logo-full.jpg',
    'apps/Invoice Builder/public/logo.jpg',
    'assets/images/logo.jpg',
    'Invoice Builder/logo.jpg',
    'Invoice Builder/public/logo-full.jpg',
    'Invoice Builder/public/logo.jpg'
  ];

  const targetsPng = [
    'assets/images/logo-rounded.png',
    'assets/images/logo.png',
    'assets/formulations-build/logo-rounded-d20ZjoY5.png'
  ];

  for (const t of targetsJpg) {
    if (fs.existsSync(path.dirname(t))) {
      fs.writeFileSync(t, jpgBuffer);
      console.log('Updated JPG:', t);
    }
  }

  for (const t of targetsPng) {
    if (fs.existsSync(path.dirname(t))) {
      fs.writeFileSync(t, pngBuffer);
      console.log('Updated PNG:', t);
    }
  }
  console.log('All logos replaced successfully!');
})();
