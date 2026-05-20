/* Time bar behavior.
   - Slider underlying range is hour-of-day (6..18) for human-readable
     labels and the "12:00 PM" readout that match building.pug's style.
   - Map.js still expects a normalized [0, 1] value, so every emission
     converts: value = (hour - 6) / 12. Hour 6 -> 0.0, hour 18 -> 1.0.
   - On "timebar:open" we also emit a sync change event so the gradient
     marker and speed-profile segment align with the slider's current
     position immediately, satisfying the "line up one-to-one" requirement.
*/

(function () {
    const timebarEl = document.querySelector(".timebar");
    if (!timebarEl) return;

    const slider    = timebarEl.querySelector(".timebar__slider");
    const readoutEl = timebarEl.querySelector(".timebar__readout");

    // ---- State transitions ---------------------------------------------------

    function setState(open) {
        timebarEl.dataset.state = open ? "open" : "closed";
    }

    // ---- Hour <-> normalized conversion --------------------------------------

    /** Convert an integer hour (6..18) to a normalized [0, 1] path position. */
    function hourToNormalized(h) {
        return (h - 6) / 12;
    }

    /** Convert a normalized [0, 1] back to a clamped integer hour (6..18). */
    function normalizedToHour(v) {
        const clamped = Math.max(0, Math.min(1, Number(v) || 0));
        return Math.round(6 + clamped * 12);
    }

    /** "12:00 PM" / "6:00 AM" formatter. */
    function formatHour(h) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const suffix = h >= 12 ? "PM" : "AM";
        return hour12 + ":00 " + suffix;
    }

    function updateReadout(h) {
        if (readoutEl) readoutEl.textContent = formatHour(h);
    }

    function dispatchChange(h) {
        document.dispatchEvent(new CustomEvent("timebar:change", {
            detail: { value: hourToNormalized(h), hour: h }
        }));
    }

    // ---- Slider drives outgoing events --------------------------------------

    slider.addEventListener("input", () => {
        const h = parseInt(slider.value, 10);
        updateReadout(h);
        dispatchChange(h);
    });

    // ---- External control ---------------------------------------------------

    document.addEventListener("timebar:open", () => {
        setState(true);
        // Sync downstream listeners (map.js) to the slider's current value
        // so the gradient marker and speed segment land on the displayed hour.
        const h = parseInt(slider.value, 10);
        dispatchChange(h);
    });

    document.addEventListener("timebar:close", () => setState(false));

    /**
     * Programmatic value setter. Accepts a normalized [0, 1] value (same units
     * map.js uses) and snaps to the nearest hour. Silent — does NOT re-emit
     * timebar:change, so map.js can use this to sync the slider back to its
     * own state without creating an event loop.
     */
    window.timebarSetValue = (v) => {
        const h = normalizedToHour(v);
        slider.value = String(h);
        updateReadout(h);
    };

    // Initialize the readout from the slider's HTML default value.
    updateReadout(parseInt(slider.value, 10));

    // Escape closes the bar (after search and sidebar have had a chance
    // to handle the key first — natural event order does this for us).
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && timebarEl.dataset.state === "open") {
            setState(false);
        }
    });
})();