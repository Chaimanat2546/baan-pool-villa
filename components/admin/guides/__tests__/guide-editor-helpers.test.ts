import { describe, expect, it } from "vitest";

import {
  EDITOR_BLOCK_TYPES,
  changeEditableBlockType,
  createEditableTextBlock,
  getEditorBlockMeta,
  guideBlocksToTipTapDocument,
  normalizeEditableBlocks,
  tipTapDocumentToGuideBlocks,
  updateEditableBlockText,
} from "../guide-editor-helpers";

describe("guide editor helpers", () => {
  it("defines clear Thai labels and placeholders for Medium-style blocks", () => {
    expect(EDITOR_BLOCK_TYPES).toEqual([
      "paragraph",
      "heading",
      "bulletListItem",
      "checkListItem",
      "quote",
    ]);
    expect(getEditorBlockMeta("heading")).toEqual({
      label: "หัวข้อ",
      placeholder: "พิมพ์หัวข้อ...",
    });
    expect(getEditorBlockMeta("checkListItem")).toEqual({
      label: "เช็กลิสต์",
      placeholder: "พิมพ์รายการที่ต้องเช็ก...",
    });
  });

  it("changes a block type without losing the written text", () => {
    const paragraph = createEditableTextBlock(
      "paragraph",
      "เลือกบ้านให้พอดีกับจำนวนคน",
      "block-1",
    );

    expect(changeEditableBlockType(paragraph, "heading")).toEqual({
      ...paragraph,
      type: "heading",
    });
  });

  it("updates text content using the existing CMS block shape", () => {
    const block = createEditableTextBlock("bulletListItem", "", "block-2");

    expect(updateEditableBlockText(block, "มีห้องนอนชั้นล่าง")).toEqual({
      ...block,
      content: [
        {
          styles: {},
          text: "มีห้องนอนชั้นล่าง",
          type: "text",
        },
      ],
    });
  });

  it("normalizes unknown content into one editable paragraph", () => {
    expect(normalizeEditableBlocks([{ type: "unsupported" }])).toEqual([
      createEditableTextBlock("paragraph", "", expect.any(String)),
    ]);
  });

  it("converts guide blocks into one TipTap document", () => {
    expect(
      guideBlocksToTipTapDocument([
        createEditableTextBlock("heading", "เลือกบ้านพักให้ตรงทริป", "heading-1"),
        createEditableTextBlock("paragraph", "ดูจำนวนคนก่อน", "paragraph-1"),
        createEditableTextBlock("bulletListItem", "มีพื้นที่นั่งรวม", "list-1"),
        createEditableTextBlock("checkListItem", "เช็กจำนวนเตียง", "check-1"),
        createEditableTextBlock("quote", "บ้านที่เลือกง่ายปิดจองง่าย", "quote-1"),
      ]),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "เลือกบ้านพักให้ตรงทริป" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "ดูจำนวนคนก่อน" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "มีพื้นที่นั่งรวม" }],
                },
              ],
            },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "เช็กจำนวนเตียง" }],
                },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "บ้านที่เลือกง่ายปิดจองง่าย" }],
            },
          ],
        },
      ],
    });
  });

  it("converts a TipTap document back to guide blocks", () => {
    expect(
      tipTapDocumentToGuideBlocks({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "หัวข้อบทความ" }],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "รายการแรก" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "รายการสอง" }],
                  },
                ],
              },
            ],
          },
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "เช็กรายการ" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      createEditableTextBlock("heading", "หัวข้อบทความ", expect.any(String)),
      createEditableTextBlock("bulletListItem", "รายการแรก", expect.any(String)),
      createEditableTextBlock("bulletListItem", "รายการสอง", expect.any(String)),
      createEditableTextBlock("checkListItem", "เช็กรายการ", expect.any(String)),
    ]);
  });
});
