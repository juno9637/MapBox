import { bus } from "/js/busSingleton.js";
import { map } from "/js/map.js";

const overlay = document.getElementById("fadeOverlay");

//region === Helper Functions ===
function fadeToWhite() {
    overlay.classList.add("blocking");
    overlay.classList.add("is-on");
}

function fadeFromWhite() {
    overlay.classList.remove("is-on");
    overlay.classList.remove("blocking");
}

function navigateTo(url){
    window.location.href = url;
}

function waitFor(overlay, eventName, propertyName) {
    return new Promise((resolve) => {
        const onDone = (e) => {
            if (propertyName && e.propertyName !== propertyName) return;
            overlay.removeEventListener(eventName, onDone);
            resolve(true);
        };

        overlay.addEventListener(eventName, onDone);
    });
}
//endregion

bus.subscribe("BuildingClickedEvent", async ({ center }) => {
    fadeToWhite();

    map.flyTo({
        center,
        zoom: 19,
        pitch: 35,
        bearing: -60
    });

    await waitFor(overlay, "transitionend", "opacity");
    navigateTo("/building")
});
