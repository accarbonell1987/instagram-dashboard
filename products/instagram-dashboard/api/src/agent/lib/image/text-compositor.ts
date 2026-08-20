import sharp from 'sharp';

const SIDE_MARGIN = 60;

interface TextLayout {
  fontSize: number;
  charsPerLine: number;
  lineHeight: number;
}

function getLayout(textLength: number): TextLayout {
  if (textLength <= 40) return { fontSize: 72, charsPerLine: 22, lineHeight: 94 };
  if (textLength <= 70) return { fontSize: 64, charsPerLine: 25, lineHeight: 83 };
  if (textLength <= 100) return { fontSize: 56, charsPerLine: 28, lineHeight: 73 };
  return { fontSize: 48, charsPerLine: 33, lineHeight: 62 };
}

function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > charsPerLine) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function compositeTextOnImage(
  imageBuffer: Buffer,
  text: string,
): Promise<Buffer> {
  if (!text.trim()) return imageBuffer;

  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();

  const layout = getLayout(text.length);
  const lines = wrapText(text.trim(), layout.charsPerLine);

  const paddingV = 36;
  const totalTextHeight = lines.length * layout.lineHeight;
  const boxHeight = totalTextHeight + paddingV * 2;
  const boxY = height - boxHeight - SIDE_MARGIN;
  const boxWidth = width - SIDE_MARGIN * 2;
  const textX = width / 2;
  const firstLineY = boxY + paddingV + layout.fontSize;

  const textElements = lines
    .map(
      (line, i) => `<text
      x="${String(textX)}"
      y="${String(firstLineY + i * layout.lineHeight)}"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${String(layout.fontSize)}"
      font-weight="bold"
      fill="white"
      filter="url(#shadow)"
    >${escapeXml(line)}</text>`,
    )
    .join('\n');

  const svg = `<svg width="${String(width)}" height="${String(height)}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow">
        <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="black" flood-opacity="0.85"/>
      </filter>
    </defs>
    <rect
      x="${String(SIDE_MARGIN)}"
      y="${String(boxY)}"
      width="${String(boxWidth)}"
      height="${String(boxHeight)}"
      rx="16"
      fill="black"
      fill-opacity="0.55"
    />
    ${textElements}
  </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
