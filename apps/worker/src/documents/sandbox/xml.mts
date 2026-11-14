/**
 * A minimal XML tokenizer for SpreadsheetML parts (sandbox side). It is intentionally not a general XML parser:
 *  - a DOCTYPE or entity declaration is refused outright, so there is no entity expansion to bomb or to point at a
 *    file or URL (no XXE, no "billion laughs");
 *  - only the five predefined entities and numeric character references are decoded;
 *  - namespace prefixes are dropped from element names (`x:c` → `c`), attribute names are kept as written.
 * Anything malformed throws SandboxReject("corrupt_file").
 */
import { SandboxReject } from "./protocol.mts";

export type XmlToken =
  | {
      readonly type: "open";
      readonly name: string;
      readonly attrs: Readonly<Record<string, string>>;
      readonly selfClosing: boolean;
    }
  | { readonly type: "close"; readonly name: string }
  | { readonly type: "text"; readonly text: string };

const PREDEFINED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function bad(why: string): never {
  throw new SandboxReject("corrupt_file", `xml: ${why}`);
}

/** Decodes a part to text: UTF-8 (the OOXML default) or UTF-16 when a byte-order mark says so. */
export function decodeXml(bytes: Buffer): string {
  try {
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
    }
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return bad("not valid UTF-8 or UTF-16");
  }
}

export function decodeEntities(raw: string): string {
  if (!raw.includes("&")) return raw;
  return raw.replace(/&([^;&\s]{1,12});/g, (_, body: string) => {
    const named = PREDEFINED[body];
    if (named !== undefined) return named;
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const digits = body.slice(hex ? 2 : 1);
      if (!(hex ? /^[0-9a-fA-F]{1,6}$/ : /^[0-9]{1,7}$/).test(digits))
        bad("bad character reference");
      const code = Number.parseInt(digits, hex ? 16 : 10);
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        bad("character reference out of range");
      }
      return String.fromCodePoint(code);
    }
    return bad("undeclared entity");
  });
}

function localName(qname: string): string {
  const colon = qname.indexOf(":");
  return colon < 0 ? qname : qname.slice(colon + 1);
}

const ATTR = /([^\s=/<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
const SPACE = /\s*/y;

function parseTag(body: string): { name: string; attrs: Record<string, string> } {
  let i = 0;
  while (i < body.length && !/\s/.test(body[i]!)) i++;
  const name = localName(body.slice(0, i));
  if (name === "") bad("empty element name");
  const attrs: Record<string, string> = Object.create(null) as Record<string, string>;
  for (;;) {
    SPACE.lastIndex = i;
    SPACE.exec(body);
    i = SPACE.lastIndex;
    if (i >= body.length) break;
    ATTR.lastIndex = i;
    const m = ATTR.exec(body);
    if (m === null) bad("malformed attribute");
    attrs[m[1]!] = decodeEntities(m[2] ?? m[3] ?? "");
    i = ATTR.lastIndex;
  }
  return { name, attrs };
}

/** Index of the `>` that closes the tag starting before `from`; a `>` inside a quoted attribute value does not count. */
function tagEnd(xml: string, from: number): number {
  let quote = 0;
  for (let i = from; i < xml.length; i++) {
    const ch = xml.charCodeAt(i);
    if (quote !== 0) {
      if (ch === quote) quote = 0;
    } else if (ch === 0x22 || ch === 0x27) {
      quote = ch;
    } else if (ch === 0x3e) {
      return i;
    } else if (ch === 0x3c) {
      bad("'<' inside a tag");
    }
  }
  return bad("unterminated tag");
}

/** Yields the elements and character data of `xml` in document order. Comments and processing instructions are skipped. */
export function* tokenize(xml: string): Generator<XmlToken> {
  let pos = 0;
  const len = xml.length;
  while (pos < len) {
    const lt = xml.indexOf("<", pos);
    if (lt < 0) {
      const tail = xml.slice(pos);
      if (tail.trim() !== "") yield { type: "text", text: decodeEntities(tail) };
      return;
    }
    if (lt > pos) yield { type: "text", text: decodeEntities(xml.slice(pos, lt)) };

    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4);
      if (end < 0) bad("unterminated comment");
      pos = end + 3;
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9);
      if (end < 0) bad("unterminated CDATA");
      yield { type: "text", text: xml.slice(lt + 9, end) };
      pos = end + 3;
    } else if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end < 0) bad("unterminated processing instruction");
      pos = end + 2;
    } else if (xml.startsWith("<!", lt)) {
      // <!DOCTYPE …>, <!ENTITY …>: never legitimate in an OOXML part.
      throw new SandboxReject("unsupported_structure", "xml: document type declaration");
    } else {
      const gt = tagEnd(xml, lt + 1);
      if (xml.charCodeAt(lt + 1) === 0x2f) {
        yield { type: "close", name: localName(xml.slice(lt + 2, gt).trim()) };
      } else {
        const selfClosing = xml.charCodeAt(gt - 1) === 0x2f;
        const { name, attrs } = parseTag(xml.slice(lt + 1, selfClosing ? gt - 1 : gt));
        yield { type: "open", name, attrs, selfClosing };
      }
      pos = gt + 1;
    }
  }
}

/** The value of the attribute whose local name is `local` (e.g. `id` matches `r:id`), or undefined. */
export function attrByLocalName(
  attrs: Readonly<Record<string, string>>,
  local: string,
  requirePrefix = false,
): string | undefined {
  for (const key of Object.keys(attrs)) {
    const colon = key.indexOf(":");
    if (colon < 0) {
      if (!requirePrefix && key === local) return attrs[key];
    } else if (key.slice(colon + 1) === local) {
      return attrs[key];
    }
  }
  return undefined;
}
