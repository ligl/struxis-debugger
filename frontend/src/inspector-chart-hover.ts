import type { InjectionKey } from "vue";

export type InspectorChartObjectKind = "sbar" | "cbar" | "swing" | "trend" | "keyzone" | "interaction";
export type InspectorChartReference = { kind: InspectorChartObjectKind; id: string };
export type InspectorHoverChannel = "pointer" | "focus";

type InspectorChartHoverUpdate = (
  source: symbol,
  channel: InspectorHoverChannel,
  reference: InspectorChartReference | null,
) => void;

export const inspectorChartHoverKey: InjectionKey<InspectorChartHoverUpdate> = Symbol("inspector chart hover");

type HoverEntry = { source: symbol; reference: InspectorChartReference };

export function createInspectorChartHover(publish: (reference: InspectorChartReference | null) => void) {
  const entries: Record<InspectorHoverChannel, HoverEntry | null> = { pointer: null, focus: null };
  let published: InspectorChartReference | null = null;

  function publishCurrent(): void {
    const reference = (entries.pointer ?? entries.focus)?.reference ?? null;
    if (reference?.kind === published?.kind && reference?.id === published?.id) return;
    published = reference;
    publish(reference);
  }

  const update: InspectorChartHoverUpdate = (source, channel, reference) => {
    if (reference) entries[channel] = { source, reference };
    else if (entries[channel]?.source === source) entries[channel] = null;
    publishCurrent();
  };

  function clear(): void {
    entries.pointer = null;
    entries.focus = null;
    publishCurrent();
  }

  return { update, clear };
}
