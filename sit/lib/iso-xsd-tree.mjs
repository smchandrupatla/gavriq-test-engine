// Reads an ISO 20022 message XSD (a Document message or a head.* AppHdr) and lists every element a person should see for it in the
// Scheme definitions screen: the Document root, each nested element (expanded through its named
// complex types) with its path, occurrence and whether it is a leaf. It reads the file itself, never
// the database or the API, so the GUI cases compare what the screen shows against the schema.

const TAG = /<(\/?)(?:\w+:)?(\w+)\b([^>]*?)(\/?)>/g;
const attr = (s, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1];

/**
 * Named complex types -> their child elements. An element that carries its own anonymous complexType
 * gets a synthetic type name, so its children are reached the same way as a named type's.
 */
function parseTypes(xsd) {
  const types = new Map();
  const stack = [];
  const open = [];
  let rootType = null;
  let rootName = null;
  let anon = 0;
  for (const m of xsd.replace(/<!--[\s\S]*?-->/g, "").matchAll(TAG)) {
    const [, closing, tag, attrs, selfClose] = m;
    if (closing) {
      if (tag === "complexType" || tag === "simpleType") stack.shift();
      else if (tag === "element") open.shift();
      continue;
    }
    if (tag === "complexType" || tag === "simpleType") {
      const name = attr(attrs, "name") || (tag === "complexType" && open[0] && !open[0].type ? `#anon${++anon}` : undefined);
      const entry = { name, kind: tag, children: [], attrs: [] };
      if (name) types.set(name, entry);
      if (name?.startsWith("#anon")) { open[0].type = name; if (open[0].isRoot) rootType = name; }
      if (!selfClose) stack.unshift(entry);
    } else if (tag === "attribute") {
      const name = attr(attrs, "name");
      if (name && stack[0]?.kind === "complexType") (stack[0].attrs ||= []).push({ name, required: attr(attrs, "use") === "required" });
    } else if (tag === "element") {
      const name = attr(attrs, "name");
      if (!stack.length) { const frame = {}; if (!rootName) { rootName = name; rootType = attr(attrs, "type"); frame.isRoot = true; } if (!selfClose) open.unshift(frame); continue; }
      const min = attr(attrs, "minOccurs");
      const max = attr(attrs, "maxOccurs");
      const child = { name, type: attr(attrs, "type"), min: min === undefined ? 1 : Number(min), max: max === "unbounded" ? Infinity : max === undefined ? 1 : Number(max) };
      if (stack[0].kind === "complexType" && name) stack[0].children.push(child);
      if (!selfClose) open.unshift(child);
    }
  }
  return { types, rootType, rootName };
}

/** Walks the schema once: the elements and the attributes (each at the element that carries it). */
function walkSchema(xsd) {
  const { types, rootType, rootName } = parseTypes(xsd);
  if (!rootName) throw new Error("the XSD has no root element");
  const root = `/${rootName}`;
  const elements = [{ path: root, name: rootName, depth: 0, min: 1, max: 1, leaf: false }];
  const attributes = [];
  const addAttrs = (typeName, path) => {
    for (const a of types.get(typeName)?.attrs || []) attributes.push({ path: `${path}/@${a.name}`, name: a.name, required: a.required });
  };
  const walk = (typeName, path, depth, seen) => {
    const t = types.get(typeName);
    const kids = t?.kind === "complexType" ? t.children : [];
    if (seen.includes(typeName)) return;
    for (const c of kids) {
      const childType = types.get(c.type);
      // A type already open on this branch is not expanded again, so its element is drawn as a leaf.
      const hasKids = childType?.kind === "complexType" && childType.children.length > 0 && c.type !== typeName && !seen.includes(c.type);
      const row = { path: `${path}/${c.name}`, name: c.name, depth, min: c.min, max: c.max, leaf: !hasKids };
      elements.push(row);
      if (childType?.kind === "complexType" && !seen.includes(c.type) && c.type !== typeName) addAttrs(c.type, row.path);
      if (hasKids) walk(c.type, row.path, depth + 1, [...seen, typeName]);
    }
  };
  if (types.get(rootType)?.kind === "complexType") addAttrs(rootType, root);
  walk(rootType, root, 1, []);
  return { elements, attributes };
}

/**
 * Every element reachable from the root (Document or AppHdr), depth first, as
 * { path, name, depth, min, max, leaf }. A type that contains itself is expanded once per branch.
 */
export function xsdElements(xsd) {
  return walkSchema(xsd).elements;
}

/** Every attribute of those elements, as { path: ".../Element/@Name", name, required }. */
export function xsdAttributes(xsd) {
  return walkSchema(xsd).attributes;
}

/**
 * The numbers the screen shows: "elements" counts every element; the product counts a field for each
 * leaf element and each attribute.
 */
export function xsdCounts(elements, attributes = []) {
  const leaves = elements.filter((e) => e.leaf).length;
  return { nodes: elements.length, fields: leaves + attributes.length, leaves, attributes: attributes.length, groups: elements.length - leaves };
}

/** Occurrence as the List and Diagram write it: "1..1", "0..1", "1..n" (the stored field's own format). */
export function occurrenceOf(e) {
  return `${e.min}..${e.max === Infinity ? "n" : e.max}`;
}

/** Occurrence as the Tree writes it: "1" when min and max agree, otherwise "0..1", "1..∞". */
export function treeOccurrenceOf(e) {
  return e.min === e.max ? String(e.min) : `${e.min}..${e.max === Infinity ? "∞" : e.max}`;
}
