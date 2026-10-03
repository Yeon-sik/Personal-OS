import { afterEach, describe, expect, it } from "vitest";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { MarkerLegend } from "./RecordMarkerLegend";

const renderers: ReactTestRenderer[] = [];

function textContent(instance: ReactTestInstance): string {
  return instance.children
    .map((child) => typeof child === "string" ? child : textContent(child))
    .join("");
}

afterEach(() => {
  for (const renderer of renderers.splice(0)) {
    act(() => renderer.unmount());
  }
});

describe("RecordMarkerLegend", () => {
  it("matches the semantic progress calendar and excludes legacy markers", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<MarkerLegend />);
    });
    renderers.push(renderer);

    const legend = renderer.root.findByProps({ "aria-label": "달력 표시 범례" });
    const legendText = textContent(legend);

    expect(legendText).toContain("Project");
    expect(legendText).toContain("Training");
    expect(legendText).toContain("Plan");
    expect(legendText).toContain("✓1/2");
    expect(legendText).toContain("!1");
    expect(legendText).toContain("Memo");
    expect(legendText).not.toContain("할 일");
    expect(legendText).not.toContain("오늘 완료");
    expect(legendText).not.toContain("운동");
    expect(legendText).not.toContain("식사");
    expect(legendText).not.toContain("체중");
    expect(legendText).not.toContain("메모");
    expect(legend.findByProps({
      className: "block h-1.5 w-4 rounded-sm bg-violet-700 dark:bg-violet-600",
    })).toBeDefined();
    expect(legend.findByProps({
      className: "block h-1.5 w-4 rounded-sm bg-red-700 dark:bg-red-600",
    })).toBeDefined();
    expect(legend.findByProps({
      className: "block h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-neutral-300",
    })).toBeDefined();
  });
});
