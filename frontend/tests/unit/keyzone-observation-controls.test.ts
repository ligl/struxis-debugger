import { mount, flushPromises } from "@vue/test-utils";
import { computed, ref, reactive, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import KeyZoneObservationControls from "../../src/components/KeyZoneObservationControls.vue";
import KeyZoneDetails from "../../src/components/KeyZoneDetails.vue";
import { useKeyZoneObservations } from "../../src/composables/useKeyZoneObservations";
import * as bridge from "../../src/origin-bridge";
import type { CreateObservationDto, ObservationCommandResultDto, ObservationControlsContext, ReplayInspectorDto, RunStateDto } from "../../src/origin-types";
import { keyzoneFixture, keyzoneBars } from "./keyzone-fixture";

vi.mock("../../src/origin-bridge", () => ({
  createKeyZoneObservation: vi.fn(), cancelKeyZoneObservation: vi.fn(),
  describeIpcError: (error: { message?: string }) => error.message ?? "Operation failed",
}));

function fixture() {
  const registry = keyzoneFixture();
  registry.observations = [];
  registry.interactions = [];
  const context: ObservationControlsContext = { runId: "run-a", cursorSbarId: "1700000120000000000", timeframe: "1m", bars: keyzoneBars(), enabled: true, disabledReason: "" };
  const inspector = { stateKey: "AUD/USD.SIM-1m", checkpointIndex: 2, sbarId: context.cursorSbarId, sbar: keyzoneBars()[2], structure: null, keyzones: registry } as ReplayInspectorDto;
  const result: ObservationCommandResultDto = { observationId: "2", operation: "created", inspector };
  const create = vi.fn<(request: CreateObservationDto) => Promise<ObservationCommandResultDto>>().mockResolvedValue(result);
  const cancel = vi.fn().mockResolvedValue({ ...result, operation: "cancelled" });
  const props = { zone: registry.zones[0]!, registry, context, create, cancel };
  return { props, result, create, cancel, context, inspector };
}

describe("KeyZone observation controls", () => {
  it("keeps the submitted form visible when the application locks other commands", async () => {
    const f = fixture();
    const context = reactive(f.context);
    let finish!: (result: ObservationCommandResultDto) => void;
    f.create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const wrapper = mount(KeyZoneObservationControls, { props: { ...f.props, context } });
    await wrapper.get('button[aria-expanded]').trigger("click");
    await wrapper.get("form").trigger("submit");
    context.enabled = false;
    context.disabledReason = "Wait for the current operation to finish.";
    await nextTick();
    expect(wrapper.get('button[type="submit"]').text()).toBe("Creating…");
    expect(wrapper.get("fieldset").attributes("disabled")).toBeDefined();
    finish(f.result);
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe("Observation 2 created.");
  });

  it("creates with domain defaults, lossless boundaries and inline feedback", async () => {
    const f = fixture();
    const wrapper = mount(KeyZoneObservationControls, { props: f.props });
    await wrapper.get('button[aria-expanded]').trigger("click");
    expect(wrapper.get('[aria-label="Observation N"]').element).toHaveProperty("value", "3");
    expect(wrapper.get('[aria-label="Observation X"]').element).toHaveProperty("value", "0.5");
    expect(wrapper.text()).toContain("deadline K-line is excluded");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({
      context: { runId: "run-a", expectedSbarId: "1700000120000000000" },
      keyzoneId: "9007199254740993", n: "3", x: 0.5,
      completion: "AfterOneInteraction", startAt: null, deadline: "1700000180000000001",
    }));
    expect(wrapper.get('[role="status"]').text()).toBe("Observation 2 created.");
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("validates N, X and the exclusive deadline before invoking the backend", async () => {
    const f = fixture();
    const wrapper = mount(KeyZoneObservationControls, { props: f.props });
    await wrapper.get('button[aria-expanded]').trigger("click");
    await wrapper.get('[aria-label="Observation N"]').setValue("0");
    await wrapper.get("form").trigger("submit");
    expect(f.create).not.toHaveBeenCalled();
    expect(wrapper.get('[role="status"]').text()).toContain("positive whole number");
    await wrapper.get('[aria-label="Observation N"]').setValue("3");
    await wrapper.get('[aria-label="Observation X"]').setValue("-1");
    expect(wrapper.get('[role="status"]').text()).toContain("zero or greater");
    await wrapper.get('[aria-label="Observation X"]').setValue("0.5");
    await wrapper.get('[aria-label="Observation deadline"]').setValue(f.context.cursorSbarId);
    expect(wrapper.get('[role="status"]').text()).toContain("later than the start");
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
  });

  it("historical start only lists accepted Bars and includes the selected start", async () => {
    const f = fixture();
    const wrapper = mount(KeyZoneObservationControls, { props: f.props });
    await wrapper.get('button[aria-expanded]').trigger("click");
    await wrapper.get('[aria-label="Observation start"]').setValue("history");
    const select = wrapper.get('[aria-label="Observation historical start"]');
    expect(select.findAll("option").map((option) => option.attributes("value"))).toEqual([
      "1700000000000000000", "1700000060000000000", "1700000120000000000",
    ]);
    await select.setValue("1700000060000000000");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.create.mock.calls[0]![0].startAt).toBe("1700000060000000000");
  });

  for (const originKind of ["Swing", "Trend"] as const) {
    for (const formedAt of ["1700000000000000001", "1700000060000000000"]) {
      it(`${originKind} history starts at the first accepted K-line at or after ${formedAt}`, async () => {
        const f = fixture();
        f.props.zone.originKind = originKind;
        f.props.zone.formedAt = formedAt;
        const wrapper = mount(KeyZoneObservationControls, { props: f.props });
        await wrapper.get('button[aria-expanded]').trigger("click");
        await wrapper.get('[aria-label="Observation start"]').setValue("history");
        const select = wrapper.get('[aria-label="Observation historical start"]');
        expect(select.findAll("option").map((option) => option.attributes("value"))).toEqual([
          "1700000060000000000", "1700000120000000000",
        ]);
        expect(select.element).toHaveProperty("value", "1700000060000000000");
        await wrapper.get("form").trigger("submit");
        await flushPromises();
        expect(f.create).toHaveBeenCalledOnce();
        expect(f.create.mock.calls[0]![0].startAt).toBe("1700000060000000000");
      });
    }

    it(`${originKind} rejects a current cursor before formation and accepts equality`, async () => {
      const f = fixture();
      f.props.zone.originKind = originKind;
      f.props.zone.formedAt = "1700000120000000001";
      const context = reactive(f.context);
      const wrapper = mount(KeyZoneObservationControls, { props: { ...f.props, context } });
      await wrapper.get('button[aria-expanded]').trigger("click");
      expect(wrapper.get('[role="status"]').text()).toContain("formation time");
      expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
      await wrapper.get("form").trigger("submit");
      expect(f.create).not.toHaveBeenCalled();
      context.bars = [...context.bars.slice(0, 3), { ...context.bars[2]!, sbarId: "1700000120000000001", tsEvent: "1700000120000000001" }, ...context.bars.slice(3)];
      context.cursorSbarId = "1700000120000000001";
      await nextTick();
      expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeUndefined();
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(f.create).toHaveBeenCalledOnce();
      expect(f.create.mock.calls[0]![0]).toMatchObject({
        context: { expectedSbarId: "1700000120000000001" }, startAt: null,
      });
    });

    it(`${originKind} blocks empty historical starts and selects the first newly accepted legal K-line`, async () => {
      const f = fixture();
      f.props.zone.originKind = originKind;
      f.props.zone.formedAt = "1700000180000000000";
      const context = reactive(f.context);
      const wrapper = mount(KeyZoneObservationControls, { props: { ...f.props, context } });
      await wrapper.get('button[aria-expanded]').trigger("click");
      await wrapper.get('[aria-label="Observation start"]').setValue("history");
      const select = wrapper.get('[aria-label="Observation historical start"]');
      expect(select.findAll("option")).toHaveLength(0);
      expect(wrapper.get('[role="status"]').text()).toContain("No accepted K-line");
      expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
      await wrapper.get("form").trigger("submit");
      expect(f.create).not.toHaveBeenCalled();
      context.cursorSbarId = "1700000180000000000";
      await nextTick();
      expect(select.findAll("option").map((option) => option.attributes("value"))).toEqual(["1700000180000000000"]);
      expect(select.element).toHaveProperty("value", "1700000180000000000");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(f.create).toHaveBeenCalledOnce();
      expect(f.create.mock.calls[0]![0].startAt).toBe("1700000180000000000");
    });
  }

  for (const startMode of ["current", "history"]) {
    it(`FixedPriceRange allows ${startMode} observation before formation`, async () => {
      const f = fixture();
      f.props.zone.originKind = "FixedPriceRange";
      f.props.zone.originId = null;
      f.props.zone.formedAt = "1700000180000000000";
      f.props.zone.createdAt = "1700000180000000000";
      const wrapper = mount(KeyZoneObservationControls, { props: f.props });
      await wrapper.get('button[aria-expanded]').trigger("click");
      await wrapper.get('[aria-label="Observation start"]').setValue(startMode);
      if (startMode === "history") {
        const select = wrapper.get('[aria-label="Observation historical start"]');
        expect(select.findAll("option").map((option) => option.attributes("value"))).toEqual([
          "1700000000000000000", "1700000060000000000", "1700000120000000000",
        ]);
        expect(select.element).toHaveProperty("value", "1700000000000000000");
      }
      expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeUndefined();
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(f.create).toHaveBeenCalledOnce();
      expect(f.create.mock.calls[0]![0].startAt).toBe(startMode === "history" ? "1700000000000000000" : null);
    });
  }

  it("keeps input and request identity after failure, but gives edited intent a new identity", async () => {
    const f = fixture();
    f.create.mockRejectedValue(new Error("History unavailable"));
    const wrapper = mount(KeyZoneObservationControls, { props: f.props });
    await wrapper.get('button[aria-expanded]').trigger("click");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("History unavailable");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.create.mock.calls[1]![0].requestId).toBe(f.create.mock.calls[0]![0].requestId);
    await wrapper.get('[aria-label="Observation N"]').setValue("4");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(f.create.mock.calls[2]![0].requestId).not.toBe(f.create.mock.calls[0]![0].requestId);
  });

  it("shows actionable disabled reasons and protects invalidated or read-only regions", async () => {
    const f = fixture();
    const context = reactive(f.context);
    const zone = reactive(f.props.zone);
    const wrapper = mount(KeyZoneObservationControls, { props: { ...f.props, context, zone } });
    context.enabled = false;
    context.disabledReason = "Pause playback to create or cancel an observation.";
    await nextTick();
    expect(wrapper.get('button[aria-expanded]').attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Pause playback");
    context.enabled = true;
    context.disabledReason = "";
    zone.state = "Invalidated";
    await nextTick();
    expect(wrapper.get('button[aria-expanded]').attributes("disabled")).toBeDefined();
    const readonly = mount(KeyZoneDetails, { props: { zone: f.props.zone, registry: f.props.registry } });
    expect(readonly.find('[data-testid="keyzone-observation-controls"]').exists()).toBe(false);
  });

  it("cancels only observing tasks and removes its action when the refreshed state is terminal", async () => {
    const f = fixture();
    const registry = reactive(keyzoneFixture());
    const wrapper = mount(KeyZoneObservationControls, { props: { ...f.props, registry } });
    await wrapper.get('[aria-label="Cancel observation 1"]').trigger("click");
    await flushPromises();
    expect(f.cancel).toHaveBeenCalledWith({ context: { runId: "run-a", expectedSbarId: "1700000120000000000" }, observationId: "1" });
    registry.observations[0]!.state = "Cancelled";
    await nextTick();
    expect(wrapper.find('[aria-label="Cancel observation 1"]').exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toBe("Observation 1 cancelled.");
  });

  it("locks conflicting commands and refuses a response belonging to a replaced Run", async () => {
    const f = fixture();
    const run = ref({ runId: "run-a", cursorSbarId: f.context.cursorSbarId, status: "paused" } as RunStateDto);
    const busy = ref(false);
    const inspector = ref<ReplayInspectorDto | null>(null);
    const controls = useKeyZoneObservations(run, busy, computed(() => busy.value), inspector);
    let finish!: (result: ObservationCommandResultDto) => void;
    vi.mocked(bridge.createKeyZoneObservation).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const request: CreateObservationDto = { context: { runId: "run-a", expectedSbarId: f.context.cursorSbarId }, keyzoneId: f.props.zone.keyzoneId,
      requestId: "request-a", startAt: null, n: "3", x: 0.5, completion: "AfterOneInteraction", deadline: "1700000180000000001" };
    const first = controls.create(request);
    expect(busy.value).toBe(true);
    await expect(controls.create(request)).rejects.toThrow("wait for the current operation");
    run.value = { ...run.value, runId: "run-b" };
    finish(f.result);
    await expect(first).rejects.toThrow("Run changed");
    expect(inspector.value).toBe(null);
    expect(busy.value).toBe(false);
  });
});
