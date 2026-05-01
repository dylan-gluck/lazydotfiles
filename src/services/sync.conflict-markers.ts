/**
 * Strip git/jj conflict markers from a text file, keeping the chosen side.
 *
 * Recognized blocks (per git/jj output):
 *
 *   <<<<<<< (label)
 *   ours-lines
 *   ||||||| (label)        // optional: 3-way base block
 *   base-lines
 *   =======
 *   theirs-lines
 *   >>>>>>> (label)
 *
 * Unmatched / malformed sequences fall through unchanged so the file is never
 * silently truncated.
 */
export function pickConflictSide(text: string, side: "ours" | "theirs"): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("<<<<<<<")) {
      // Find separators within this conflict block.
      let baseIdx = -1;
      let sepIdx = -1;
      let endIdx = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]!;
        if (l.startsWith("|||||||") && baseIdx === -1 && sepIdx === -1) baseIdx = j;
        else if (l.startsWith("=======") && sepIdx === -1) sepIdx = j;
        else if (l.startsWith(">>>>>>>")) {
          endIdx = j;
          break;
        }
      }
      if (sepIdx === -1 || endIdx === -1) {
        // Malformed; emit verbatim and bail.
        out.push(line);
        i++;
        continue;
      }
      const oursEnd = baseIdx === -1 ? sepIdx : baseIdx;
      if (side === "ours") {
        for (let j = i + 1; j < oursEnd; j++) out.push(lines[j]!);
      } else {
        for (let j = sepIdx + 1; j < endIdx; j++) out.push(lines[j]!);
      }
      i = endIdx + 1;
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}
