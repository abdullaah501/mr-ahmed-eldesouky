const META_START = /^\[META\]\s*\n?/im;
const DIFFICULTY_MAP = new Map([
  ["easy", "easy"], ["سهل", "easy"],
  ["medium", "medium"], ["متوسط", "medium"],
  ["hard", "hard"], ["صعب", "hard"],
]);

export function parseMetadataBlock(text) {
  if (!text) return { metadata: {}, cleanedText: text };

  const startMatch = text.match(META_START);
  if (!startMatch) return { metadata: {}, cleanedText: text };

  const afterMarker = text.slice(startMatch.index + startMatch[0].length);
  const nextSection = afterMarker.search(/\n\[(?:MCQ|TF|ESSAY|FB|MATCH|META)\]/i);
  const endOfMeta = nextSection !== -1 ? nextSection : afterMarker.search(/\n\n/);
  const metaBlock = endOfMeta !== -1 ? afterMarker.slice(0, endOfMeta) : afterMarker;
  const lines = metaBlock.split(/\n/).filter((l) => l.trim());

  const metadata = {};

  for (const line of lines) {
    const match = line.match(/^\s*(.+?)\s*[:=]\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const rawValue = match[2].trim();

    switch (key) {
      case "difficulty":
      case "الصعوبة":
        metadata.difficulty = DIFFICULTY_MAP.get(rawValue.toLowerCase()) || rawValue;
        break;
      case "grade":
      case "الصف":
        metadata.grade = rawValue;
        break;
      case "subject":
      case "المادة":
        metadata.subject = rawValue;
        break;
      case "tags":
      case "الوسوم":
        if (rawValue) {
          metadata.tags = rawValue.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
        } else {
          const tagLineIdx = lines.indexOf(line);
          const bulletTags = [];
          for (let j = tagLineIdx + 1; j < lines.length; j++) {
            const trimmed = lines[j].trim();
            if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
              bulletTags.push(trimmed.replace(/^[-•]\s*/, "").trim());
            } else {
              break;
            }
          }
          metadata.tags = bulletTags;
        }
        break;
      default:
        break;
    }
  }

  const beforeMeta = text.slice(0, startMatch.index).trimEnd();
  const afterMeta = afterMarker.slice(metaBlock.length + 1).trimStart();
  const cleanedText = beforeMeta || afterMeta || "";

  return { metadata, cleanedText };
}
