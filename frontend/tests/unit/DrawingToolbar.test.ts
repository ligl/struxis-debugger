import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DrawingToolbar from "../../src/components/DrawingToolbar.vue";

describe("DrawingToolbar", () => {

  it("renders drawing-specific SVG glyphs in a compact single-column picker", async () => {
    const wrapper = mount(DrawingToolbar, {
      props: { activeTool: null, expanded: true, drawingCount: 0, selectedCount: 0 },
    });

    expect(wrapper.find(".drawing-flyout").exists()).toBe(false);
    await wrapper.get('[data-testid="drawing-category-0"]').trigger("click");

    const trendLine = wrapper.get('[data-tool-kind="trend-line"]');
    expect(trendLine.find("svg.drawing-tool-glyph").exists()).toBe(true);
    expect(trendLine.find(".drawing-tool-glyph").attributes("data-glyph")).toBe("trend");
    expect(wrapper.get(".drawing-flyout-tools").classes()).toContain("drawing-flyout-tools");
    expect(wrapper.find(".drawing-flyout-footer").exists()).toBe(false);
  });

  it("emits collapse and expand requests without changing the active drawing tool", async () => {
    const wrapper = mount(DrawingToolbar, {
      props: { activeTool: "trend-line", expanded: true, drawingCount: 2, selectedCount: 1 },
    });

    expect(wrapper.get('[data-testid="drawing-toolbar"]').classes()).not.toContain("is-collapsed");
    expect(wrapper.find(".drawing-flyout").exists()).toBe(false);
    await wrapper.get('[data-testid="drawing-category-0"]').trigger("click");
    expect(wrapper.get('[data-tool-kind="trend-line"]').exists()).toBe(true);
    await wrapper.get('[data-testid="drawing-toolbar-toggle"]').trigger("click");
    expect(wrapper.emitted("toggle")).toHaveLength(1);

    const collapsed = mount(DrawingToolbar, {
      props: { activeTool: "trend-line", expanded: false, drawingCount: 2, selectedCount: 1 },
    });
    expect(collapsed.get('[data-testid="drawing-toolbar"]').classes()).toContain("is-collapsed");
    expect(collapsed.find(".drawing-rail").exists()).toBe(false);
    expect(collapsed.find(".drawing-count").exists()).toBe(false);
    expect(collapsed.get('[data-testid="drawing-toolbar-toggle"]').attributes("aria-expanded")).toBe("false");
    expect(collapsed.get('[data-testid="drawing-toolbar-toggle"]').attributes("aria-label")).toBe("Expand drawing toolbar");
    expect(collapsed.find('[data-tool-kind="trend-line"]').exists()).toBe(false);
    await collapsed.get('[data-testid="drawing-toolbar-toggle"]').trigger("click");
    expect(collapsed.emitted("toggle")).toHaveLength(1);
  });

  it("emits the selected drawing kind", async () => {
    const wrapper = mount(DrawingToolbar, {
      props: { activeTool: null, expanded: true, drawingCount: 0, selectedCount: 0 },
    });

    await wrapper.get('[data-testid="drawing-category-2"]').trigger("click");
    await wrapper.get('[data-tool-kind="fib-retracement"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([["fib-retracement"]]);
  });

  it("provides a select mode to cancel the current tool", async () => {
    const wrapper = mount(DrawingToolbar, {
      props: { activeTool: "rectangle", expanded: true, drawingCount: 1, selectedCount: 0 },
    });

    await wrapper.get('[data-testid="drawing-tool-select"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([[null]]);
  });
});
