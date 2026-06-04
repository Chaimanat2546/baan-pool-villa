export type EditableBlockType =
  | "paragraph"
  | "heading"
  | "bulletListItem"
  | "numberedListItem"
  | "checkListItem"
  | "quote"
  | "image";

export interface EditableTextContent {
  marks?: TipTapMark[];
  styles: Record<string, unknown>;
  text: string;
  type: "text";
}

export interface EditableBlock {
  children: unknown[];
  content?: EditableTextContent[];
  id: string;
  props: Record<string, unknown>;
  type: EditableBlockType;
}

interface EditorBlockMeta {
  label: string;
  placeholder: string;
}

export interface TipTapNode {
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
  type: string;
}

export interface TipTapDocument {
  content: TipTapNode[];
  type: "doc";
}

export interface TipTapMark {
  attrs?: Record<string, unknown>;
  type: string;
}

export const EDITOR_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletListItem",
  "checkListItem",
  "quote",
] as const satisfies readonly EditableBlockType[];

const EDITABLE_BLOCK_TYPES = new Set<EditableBlockType>([
  ...EDITOR_BLOCK_TYPES,
  "numberedListItem",
  "image",
]);

const EDITOR_BLOCK_META: Record<EditableBlockType, EditorBlockMeta> = {
  paragraph: {
    label: "ย่อหน้า",
    placeholder: "เริ่มเขียน...",
  },
  heading: {
    label: "หัวข้อ",
    placeholder: "พิมพ์หัวข้อ...",
  },
  bulletListItem: {
    label: "รายการ",
    placeholder: "พิมพ์รายการ...",
  },
  numberedListItem: {
    label: "ลำดับเลข",
    placeholder: "พิมพ์รายการ...",
  },
  checkListItem: {
    label: "เช็กลิสต์",
    placeholder: "พิมพ์รายการที่ต้องเช็ก...",
  },
  quote: {
    label: "คำคม",
    placeholder: "พิมพ์ข้อความอ้างอิง...",
  },
  image: {
    label: "รูปภาพ",
    placeholder: "คำอธิบายรูป",
  },
};

let draftIdFallbackCounter = 0;

export function createEditableDraftId(): string {
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.randomUUID === "function") {
    return cryptoProvider.randomUUID();
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    cryptoProvider.getRandomValues(values);

    return `draft-${Date.now()}-${Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("")}`;
  }

  draftIdFallbackCounter += 1;
  return `draft-${Date.now()}-${draftIdFallbackCounter}`;
}

export function createEditableTextContent(text: string): EditableTextContent[] {
  return text.trim().length > 0
    ? [
        {
          type: "text",
          text,
          styles: {},
        },
      ]
    : [];
}

export function createEditableTextBlock(
  type: EditableBlockType,
  text = "",
  id = createEditableDraftId(),
): EditableBlock {
  return {
    id,
    type,
    props: {},
    content: createEditableTextContent(text),
    children: [],
  };
}

export function createEditableImageBlock(image: {
  alt: string;
  url: string;
}): EditableBlock {
  return {
    id: createEditableDraftId(),
    type: "image",
    props: {
      alt: image.alt,
      url: image.url,
    },
    children: [],
  };
}

export function normalizeEditableBlocks(blocks: unknown[]): EditableBlock[] {
  const normalizedBlocks: EditableBlock[] = [];

  blocks.forEach((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return;
    }

    const candidate = block as Partial<EditableBlock>;

    if (typeof candidate.type !== "string") {
      return;
    }

    const type = candidate.type as EditableBlockType;

    if (!EDITABLE_BLOCK_TYPES.has(type)) {
      return;
    }

    normalizedBlocks.push({
      id: typeof candidate.id === "string" ? candidate.id : createEditableDraftId(),
      type,
      props:
        candidate.props && typeof candidate.props === "object"
          ? candidate.props
          : {},
      content: Array.isArray(candidate.content)
        ? candidate.content
        : createEditableTextContent(""),
      children: Array.isArray(candidate.children) ? candidate.children : [],
    });
  });

  return normalizedBlocks.length > 0
    ? normalizedBlocks
    : [createEditableTextBlock("paragraph")];
}

export function getEditableBlockText(block: EditableBlock): string {
  return block.content
    ?.map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("") ?? "";
}

export function getEditableImageBlockUrl(block: EditableBlock): string {
  return typeof block.props.url === "string" ? block.props.url : "";
}

export function getEditableImageBlockAlt(block: EditableBlock): string {
  return typeof block.props.alt === "string" ? block.props.alt : "";
}

export function updateEditableBlockText(
  block: EditableBlock,
  text: string,
): EditableBlock {
  return {
    ...block,
    content: createEditableTextContent(text),
  };
}

export function changeEditableBlockType(
  block: EditableBlock,
  type: EditableBlockType,
): EditableBlock {
  return {
    ...block,
    type,
  };
}

export function getEditorBlockMeta(type: EditableBlockType): EditorBlockMeta {
  return EDITOR_BLOCK_META[type];
}

/**
 * Create a single text node from a non-empty string.
 *
 * @param text - Source string for the text node
 * @returns An array containing one text node when `text` is non-empty, `undefined` otherwise.
 */
function createTipTapTextNode(text: string): TipTapNode[] | undefined {
  return text.length > 0 ? [{ type: "text", text }] : undefined;
}

/**
 * Convert an array of EditableTextContent into TipTap `text` nodes, preserving any `marks`.
 *
 * @param content - An array of editable text content items (each expected to have `type: "text"` and a non-empty `text`).
 * @returns A list of TipTap `text` nodes with `text` and optional `marks`, or `undefined` if `content` is empty or yields no valid text nodes.
 */
function createTipTapTextNodes(
  content: EditableTextContent[] | undefined,
): TipTapNode[] | undefined {
  if (!Array.isArray(content) || content.length === 0) {
    return undefined;
  }

  const nodes = content
    .filter((item) => item.type === "text" && item.text.length > 0)
    .map((item) => {
      const textNode: TipTapNode = {
        type: "text",
        text: item.text,
      };

      if (Array.isArray(item.marks) && item.marks.length > 0) {
        textNode.marks = item.marks;
      }

      return textNode;
    });

  return nodes.length > 0 ? nodes : undefined;
}

/**
 * Creates a TipTap paragraph node from a plain text string.
 *
 * @param text - The paragraph text. If empty, the returned node will not include a `content` property.
 * @returns A TipTap paragraph node; when `text` is non-empty the node's `content` contains a single text node for that text.
 */
function createTipTapParagraph(text: string): TipTapNode {
  const paragraph: TipTapNode = { type: "paragraph" };
  const content = createTipTapTextNode(text);

  if (content) {
    paragraph.content = content;
  }

  return paragraph;
}

/**
 * Create a TipTap paragraph node from editable text content.
 *
 * Converts provided `EditableTextContent[]` into TipTap text nodes and attaches them as the paragraph's `content` when any non-empty text items exist; returns a paragraph node without `content` when `content` is `undefined` or contains no text.
 *
 * @param content - Editable text content to convert; items with non-empty `text` are included as text nodes and their `marks` (if present) are preserved
 * @returns A TipTap `paragraph` node. If conversion yields text nodes they are assigned to the node's `content`; otherwise the node has no `content` property.
 */
function createTipTapParagraphFromEditableContent(
  content: EditableTextContent[] | undefined,
): TipTapNode {
  const paragraph: TipTapNode = { type: "paragraph" };
  const tipTapContent = createTipTapTextNodes(content);

  if (tipTapContent) {
    paragraph.content = tipTapContent;
  }

  return paragraph;
}

/**
 * Create a TipTap list-item node whose content is a paragraph generated from the given editable content.
 *
 * @param content - Editable text content to populate the paragraph; if omitted or empty, the paragraph will have no text content.
 * @param type - The node type to create: `"listItem"` or `"taskItem"`.
 * @returns A TipTap node representing the list item; when `type` is `"taskItem"`, the node includes `attrs.checked` set to `false`.
 */
function createTipTapListItem(
  content: EditableTextContent[] | undefined,
  type: "listItem" | "taskItem",
) {
  const item: TipTapNode = {
    type,
    content: [createTipTapParagraphFromEditableContent(content)],
  };

  if (type === "taskItem") {
    item.attrs = { checked: false };
  }

  return item;
}

/**
 * Append a list item node to the last TipTap list of the given type or create a new list node containing the item.
 *
 * @param content - Array of TipTap document nodes to modify in place
 * @param listType - Target list node type: `"bulletList"`, `"orderedList"`, or `"taskList"`
 * @param item - The list item node to append
 */
function pushTipTapListNode(
  content: TipTapNode[],
  listType: "bulletList" | "orderedList" | "taskList",
  item: TipTapNode,
) {
  const previousNode = content.at(-1);

  if (previousNode?.type === listType) {
    previousNode.content = [...(previousNode.content ?? []), item];
    return;
  }

  content.push({
    type: listType,
    content: [item],
  });
}

/**
 * Convert an array of editable guide blocks into a TipTap document.
 *
 * The function normalizes the input blocks, maps supported guide block types
 * (paragraph, heading, lists, tasks, quote, image) to corresponding TipTap nodes,
 * and groups consecutive list items into list nodes. Image blocks with an empty
 * URL are omitted.
 *
 * @param blocks - Array of potentially unnormalized editable blocks (will be normalized before conversion)
 * @returns A `TipTapDocument` whose `content` contains the converted TipTap nodes; if no nodes are produced, the document contains a single empty paragraph node
 */
export function guideBlocksToTipTapDocument(blocks: unknown[]): TipTapDocument {
  const documentContent: TipTapNode[] = [];

  normalizeEditableBlocks(blocks).forEach((block) => {
    const textContent = createTipTapTextNodes(block.content);

    switch (block.type) {
      case "heading":
        documentContent.push({
          type: "heading",
          attrs: { level: 2 },
          content: textContent,
        });
        break;
      case "bulletListItem":
        pushTipTapListNode(
          documentContent,
          "bulletList",
          createTipTapListItem(block.content, "listItem"),
        );
        break;
      case "numberedListItem":
        pushTipTapListNode(
          documentContent,
          "orderedList",
          createTipTapListItem(block.content, "listItem"),
        );
        break;
      case "checkListItem":
        pushTipTapListNode(
          documentContent,
          "taskList",
          createTipTapListItem(block.content, "taskItem"),
        );
        break;
      case "quote":
        documentContent.push({
          type: "blockquote",
          content: [createTipTapParagraphFromEditableContent(block.content)],
        });
        break;
      case "image": {
        const src = getEditableImageBlockUrl(block);

        if (src.length > 0) {
          documentContent.push({
            type: "image",
            attrs: {
              alt: getEditableImageBlockAlt(block),
              src,
            },
          });
        }
        break;
      }
      default:
        documentContent.push(createTipTapParagraphFromEditableContent(block.content));
        break;
    }
  });

  return {
    type: "doc",
    content:
      documentContent.length > 0 ? documentContent : [createTipTapParagraph("")],
  };
}

/**
 * Convert a TipTap node into a flattened array of `EditableTextContent`, preserving any `marks`.
 *
 * @param node - TipTap node to extract text content from. If `node.text` is a string, returns a single content item (including `marks` when present); otherwise recursively extracts text content from `node.content`.
 * @returns An array of `EditableTextContent` items representing the node's text fragments, or an empty array if no text is found.
 */
function getTipTapTextContent(node: TipTapNode): EditableTextContent[] {
  if (typeof node.text === "string") {
    const content: EditableTextContent = {
      type: "text",
      text: node.text,
      styles: {},
    };

    if (Array.isArray(node.marks) && node.marks.length > 0) {
      content.marks = node.marks;
    }

    return [content];
  }

  return node.content?.flatMap(getTipTapTextContent) ?? [];
}

/**
 * Create an editable block of the specified type populated with the provided text content.
 *
 * @param type - The block type to create
 * @param content - The array of `EditableTextContent` items to set as the block's `content`
 * @returns An `EditableBlock` with a new draft id, empty `props` and `children`, and `content` set to `content`
 */
function createEditableTextBlockFromContent(
  type: EditableBlockType,
  content: EditableTextContent[],
): EditableBlock {
  return {
    id: createEditableDraftId(),
    type,
    props: {},
    content,
    children: [],
  };
}

/**
 * Convert items of a TipTap list node into editable list-item blocks of the given type.
 *
 * @param node - A TipTap node whose `content` contains list item nodes
 * @param type - The editable block type to produce for each list item (`bulletListItem`, `numberedListItem`, or `checkListItem`)
 * @returns An array of `EditableBlock` objects, one per list item, each created from the corresponding TipTap item content
 */
function mapTipTapListItems(
  node: TipTapNode,
  type: "bulletListItem" | "numberedListItem" | "checkListItem",
): EditableBlock[] {
  return (node.content ?? []).map((item) =>
    createEditableTextBlockFromContent(type, getTipTapTextContent(item)),
  );
}

/**
 * Convert a TipTap document into an array of editable guide blocks.
 *
 * @param document - The TipTap document to convert
 * @returns An array of `EditableBlock` objects representing the document; if no blocks are produced, returns a single paragraph block
 */
export function tipTapDocumentToGuideBlocks(document: TipTapDocument): EditableBlock[] {
  const blocks: EditableBlock[] = [];

  document.content.forEach((node) => {
    switch (node.type) {
      case "heading":
        blocks.push(
          createEditableTextBlockFromContent("heading", getTipTapTextContent(node)),
        );
        break;
      case "bulletList":
        blocks.push(...mapTipTapListItems(node, "bulletListItem"));
        break;
      case "orderedList":
        blocks.push(...mapTipTapListItems(node, "numberedListItem"));
        break;
      case "taskList":
        blocks.push(...mapTipTapListItems(node, "checkListItem"));
        break;
      case "blockquote":
        blocks.push(
          createEditableTextBlockFromContent("quote", getTipTapTextContent(node)),
        );
        break;
      case "image": {
        const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";

        if (src.length > 0) {
          blocks.push(
            createEditableImageBlock({
              alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : "",
              url: src,
            }),
          );
        }
        break;
      }
      default: {
        blocks.push(
          createEditableTextBlockFromContent("paragraph", getTipTapTextContent(node)),
        );
        break;
      }
    }
  });

  return blocks.length > 0 ? blocks : [createEditableTextBlock("paragraph")];
}
