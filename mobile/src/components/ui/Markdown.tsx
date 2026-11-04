import React from "react";
import { View, Text, ScrollView, Linking } from "react-native";

// A small renderer for the Markdown subset the pathway guides use: paragraphs, bold, italic,
// links, bullet and numbered lists, headings, block quotes and tables. Raw HTML, images and code
// are not drawn. Written here, not pulled from a package: react-markdown cannot run in React Native.

/** Same cleanup as packages/rich-text normalizeRichText: authors paste from Word and Docs. */
export function normalize(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/^[ \t]*[•◦▪▫‣⁃·][ \t]*/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function parseBlocks(source: string): Block[] {
  const lines = normalize(source).split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (HEADING.test(line)) {
      flush();
      blocks.push({ kind: "h", text: (HEADING.exec(line) as RegExpExecArray)[1] });
    } else if (isTableRow(line) && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      i -= 1;
      blocks.push({ kind: "table", head, rows });
    } else if (UL.test(line) || OL.test(line)) {
      flush();
      const ordered = OL.test(line);
      const re = ordered ? OL : UL;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i]))
        (items.push((re.exec(lines[i]) as RegExpExecArray)[1]), i++);
      i -= 1;
      blocks.push({ kind: ordered ? "ol" : "ul", items });
    } else if (QUOTE.test(line)) {
      flush();
      const parts: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i]))
        (parts.push((QUOTE.exec(lines[i]) as RegExpExecArray)[1]), i++);
      i -= 1;
      blocks.push({ kind: "quote", text: parts.join("\n") });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function Inline({ text, size, color }: { text: string; size: number; color: string }) {
  const parts = text.split(INLINE).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (/^(\*\*|__)/.test(part)) {
          return (
            <Text key={i} style={{ fontWeight: "700" }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (/^(\*|_)[^*_]/.test(part) && /(\*|_)$/.test(part)) {
          return (
            <Text key={i} style={{ fontStyle: "italic" }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        const link = LINK.exec(part);
        if (link) {
          const [, label, url] = link;
          // Only web links are followed; anything else (javascript:, tel:, a bare path) is plain text.
          if (!/^https?:\/\//i.test(url)) return <Text key={i}>{label}</Text>;
          return (
            <Text
              key={i}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(url)}
              style={{ fontWeight: "700", color: "#9A3412", textDecorationLine: "underline" }}
            >
              {label}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </>
  );
}

/** `overview` is the larger, darker body; answers and details are a step smaller. */
export function Markdown({
  children,
  variant = "detail",
}: {
  children?: string | null;
  variant?: "overview" | "detail";
}) {
  if (!children || !children.trim()) return null;
  const size = variant === "overview" ? 15.5 : 14;
  const color = variant === "overview" ? "#4A4741" : "#4A4741";
  const lineHeight = Math.round(size * 1.55);
  const base = { fontSize: size, lineHeight, color } as const;
  const blocks = parseBlocks(children);

  return (
    <View>
      {blocks.map((b, i) => {
        const gap = i === 0 ? 0 : 8;
        if (b.kind === "p") {
          return (
            <Text key={i} style={[base, { marginTop: gap }]}>
              <Inline text={b.text} size={size} color={color} />
            </Text>
          );
        }
        if (b.kind === "h") {
          // Every heading level draws as one small bold heading, never larger.
          return (
            <Text
              key={i}
              style={{ marginTop: gap + 2, fontSize: 14, fontWeight: "700", color: "#1C1B1A" }}
            >
              <Inline text={b.text} size={14} color="#1C1B1A" />
            </Text>
          );
        }
        if (b.kind === "ul" || b.kind === "ol") {
          return (
            <View key={i} style={{ marginTop: gap }}>
              {b.items.map((item, j) => (
                <View key={j} style={{ flexDirection: "row", marginTop: j === 0 ? 0 : 5 }}>
                  <Text style={[base, { width: 22 }]}>{b.kind === "ol" ? `${j + 1}.` : "•"}</Text>
                  <Text style={[base, { flex: 1 }]}>
                    <Inline text={item} size={size} color={color} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        if (b.kind === "quote") {
          return (
            <View
              key={i}
              style={{
                marginTop: gap,
                borderLeftWidth: 3,
                borderLeftColor: "#E97316",
                paddingLeft: 12,
              }}
            >
              <Text style={base}>
                <Inline text={b.text} size={size} color={color} />
              </Text>
            </View>
          );
        }
        return (
          <ScrollView key={i} horizontal showsHorizontalScrollIndicator style={{ marginTop: gap }}>
            <View
              style={{
                minWidth: 320,
                borderWidth: 1,
                borderColor: "#E1DCD3",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              {[b.head, ...b.rows].map((row, r) => (
                <View
                  key={r}
                  style={{
                    flexDirection: "row",
                    borderTopWidth: r === 0 ? 0 : 1,
                    borderTopColor: "#E1DCD3",
                    backgroundColor: r === 0 ? "#EFE7DA" : "#FFFFFF",
                  }}
                >
                  {row.map((cell, c) => (
                    <Text
                      key={c}
                      style={{
                        width: 130,
                        padding: 8,
                        fontSize: 13,
                        color: "#1C1B1A",
                        fontWeight: r === 0 ? "700" : "400",
                      }}
                    >
                      {cell}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      })}
    </View>
  );
}
