/* Search component behavior.
   - Click the circular button -> expand into the pill bar, focus the input.
   - Type -> filter mock results (title or alias match) into the panel below.
   - Click a result, hit Escape, click the X, or click outside -> collapse.

   Items support an optional `aliases` array for alternative searchable terms
   that don't appear in the visible title (e.g. abbreviations like "c4c").
   The filter checks the title first, then aliases; the title is what's shown
   and highlighted in the results, regardless of which field matched.

   Wire `window.searchSetItems(items)` from elsewhere if you want to feed
   real data; each item should be { id, title, meta?, aliases? }.
*/

(function () {
    const searchEl = document.querySelector(".search");
    if (!searchEl) return;

    const button = searchEl.querySelector(".search__button");
    const bar = searchEl.querySelector(".search__bar");
    const input = searchEl.querySelector(".search__input");
    const closeBtn = searchEl.querySelector(".search__close");
    const resultsEl = searchEl.querySelector(".search__results");

    // Mock dataset — replace with real building/place names from the map.
    let items = [
        { id: "envd",   title: "ENVD",                       meta: "Building"  },
        { id: "rec",    title: "Recreation Center",          meta: "Building"  },
        { id: "norlin", title: "Norlin Library",             meta: "Building",
            aliases: ["norlin", "norlin library"] },
        { id: "engr",   title: "Engineering Center",         meta: "Building"  },
        { id: "mcki",   title: "McKenna Languages",          meta: "Building"  },
        { id: "umc",    title: "University Memorial Center", meta: "Building"  },
        { id: "fold",   title: "Folsom Field",               meta: "Landmark"  },
        { id: "hale",   title: "Hale Science",               meta: "Building"  },
        { id: "kitt",   title: "Kittredge Central",          meta: "Residence" },
        { id: "musk",   title: "Muenzinger Psychology",      meta: "Building"  },
        { id: "C4C",    title: "Center for Community",       meta: "Building",
            aliases: ["c4c", "center for community"] }
    ];

    /** Allow other modules to feed the search real data. */
    window.searchSetItems = (next) => {
        if (Array.isArray(next)) {
            items = next;
            renderResults(input.value);
        }
    };

    function open() {
        if (searchEl.dataset.state === "open") return;
        searchEl.dataset.state = "open";
        button.setAttribute("aria-expanded", "true");
        // Defer focus until the bar is visible.
        requestAnimationFrame(() => input.focus());
    }

    function close() {
        if (searchEl.dataset.state === "closed") return;
        searchEl.dataset.state = "closed";
        button.setAttribute("aria-expanded", "false");
        input.value = "";
        searchEl.dataset.hasInput = "false";
        resultsEl.hidden = true;
        resultsEl.innerHTML = "";
        input.blur();
    }

    function renderResults(query) {
        const q = (query || "").trim().toLowerCase();
        if (!q) {
            searchEl.dataset.hasInput = "false";
            resultsEl.hidden = true;
            resultsEl.innerHTML = "";
            return;
        }

        searchEl.dataset.hasInput = "true";
        resultsEl.hidden = false;

        const matches = items.filter((it) => {
            if (it.title.toLowerCase().includes(q)) return true;
            if (Array.isArray(it.aliases)) {
                return it.aliases.some(a => a.toLowerCase().includes(q));
            }
            return false;
        });

        if (matches.length === 0) {
            resultsEl.innerHTML =
                '<div class="search__empty">No results for "' +
                escapeHtml(query) + '"</div>';
            return;
        }

        resultsEl.innerHTML = matches.map((it) =>
            '<button type="button" class="search__result" data-id="' +
            escapeHtml(it.id) + '">' +
            '<span class="search__result-title">' +
            highlight(it.title, q) +
            '</span>' +
            (it.meta
                ? '<span class="search__result-meta">' + escapeHtml(it.meta) + '</span>'
                : '') +
            '</button>'
        ).join("");
    }

    function highlight(text, query) {
        // Title-only highlight; alias matches just show the title unchanged.
        const idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return escapeHtml(text);
        return (
            escapeHtml(text.slice(0, idx)) +
            "<strong>" + escapeHtml(text.slice(idx, idx + query.length)) + "</strong>" +
            escapeHtml(text.slice(idx + query.length))
        );
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // ---- Event wiring ----

    button.addEventListener("click", open);

    closeBtn.addEventListener("click", close);

    input.addEventListener("input", (e) => {
        renderResults(e.target.value);
    });

    // Result row click
    resultsEl.addEventListener("click", (e) => {
        const row = e.target.closest(".search__result");
        if (!row) return;
        const id = row.dataset.id;
        // Surface the selection so other modules (map.js, etc.) can react.
        document.dispatchEvent(new CustomEvent("search:select", { detail: { id } }));
        close();
    });

    // Escape closes the search; stopPropagation so sidebar.js doesn't also fire.
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && searchEl.dataset.state === "open") {
            close();
            e.stopPropagation();
        }
    });

    // Click outside closes the search.
    document.addEventListener("mousedown", (e) => {
        if (searchEl.dataset.state !== "open") return;
        if (!searchEl.contains(e.target)) close();
    });
})();