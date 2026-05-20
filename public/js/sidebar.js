/* Sidebar toggle behavior.
   - Flips the `data-state` attribute on #sidebar between "docked" and "open".
   - Mirrors the state on #legend via `data-sidebar-open` so the legend
     can slide alongside the sidebar via CSS.
   - Updates aria-expanded for accessibility.
   - Listens for "sidebar:open" / "sidebar:close" custom events so other
     modules can programmatically drive the sidebar (used by map.js when
     a search selection activates a particle path).
*/

(function () {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("sidebar-toggle");
    const legend = document.getElementById("legend");

    if (!sidebar || !toggleBtn) return;

    function setSidebarState(open) {
        sidebar.dataset.state = open ? "open" : "docked";
        toggleBtn.setAttribute("aria-expanded", String(open));
        if (legend) legend.dataset.sidebarOpen = String(open);
    }

    toggleBtn.addEventListener("click", () => {
        const isOpen = sidebar.dataset.state === "open";
        setSidebarState(!isOpen);
    });

    // External programmatic control. Other modules can dispatch
    //   document.dispatchEvent(new CustomEvent("sidebar:open"))
    // (or "sidebar:close") to drive the sidebar without holding a
    // direct reference to its DOM nodes.
    document.addEventListener("sidebar:open",  () => setSidebarState(true));
    document.addEventListener("sidebar:close", () => setSidebarState(false));

    // Allow Escape to dock the sidebar when it's open. The search module
    // listens to Escape first and calls stopPropagation when it handles
    // the key, so the sidebar only collapses if the search isn't open.
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && sidebar.dataset.state === "open") {
            setSidebarState(false);
        }
    });
})();