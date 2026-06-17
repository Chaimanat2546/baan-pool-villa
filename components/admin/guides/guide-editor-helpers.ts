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

// Keep the editor renderable even when saved content is partial or malformed.
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

function createTipTapTextNode(text: string): TipTapNode[] | undefined {
  return text.length > 0 ? [{ type: "text", text }] : undefined;
}

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

function createTipTapParagraph(text: string): TipTapNode {
  const paragraph: TipTapNode = { type: "paragraph" };
  const content = createTipTapTextNode(text);

  if (content) {
    paragraph.content = content;
  }

  return paragraph;
}

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

// Group consecutive list-style blocks so the saved TipTap document preserves
// real list structure instead of flattening every item into a paragraph.
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

function mapTipTapListItems(
  node: TipTapNode,
  type: "bulletListItem" | "numberedListItem" | "checkListItem",
): EditableBlock[] {
  return (node.content ?? []).map((item) =>
    createEditableTextBlockFromContent(type, getTipTapTextContent(item)),
  );
}

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
