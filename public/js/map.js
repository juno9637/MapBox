//region === Variables ===
import { bus } from "/js/busSingleton.js";
export let map;
const MAPBOX_KEY = window.CONFIG.MAPBOX_KEY;
//endregion

//region === Helper Functions ===
function getBboxCenter(geometry) {
    let coords;

    if (geometry.type === "Polygon") {
        coords = geometry.coordinates[0];               // outer ring
    } else if (geometry.type === "MultiPolygon") {
        coords = geometry.coordinates[0][0];            // first polygon outer ring
    } else if (geometry.type === "Point") {
        return geometry.coordinates;
    } else {
        throw new Error("Unsupported geometry type: " + geometry.type);
    }

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
    }

    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

//endregion

//region === Mabbox setup ===

mapboxgl.accessToken = MAPBOX_KEY;


// Set bounds to Boulder, Colorado.
const bounds = [
    [-105.27707102527657, 40.0030404925513], // Southwest coordinates
    [-105.25725037599734, 40.015062824363255] // Northeast coordinates
];

map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/virginiwoolf/cmkag1i8q00e201svft695qx1',
    center: [-105.26696020273963, 40.00821825269933],
    zoom: 10,
    pitch: 45,
    bearing: -180,
    maxBounds: bounds
});

const popup = new mapboxgl.Popup({offset:25}).setText("ENVD");

new mapboxgl.Marker({
    color: "green",
    scale: 0.6
})
    .setLngLat([-105.26922599080906, 40.00695729212469])
    .setPopup(popup)
    .addTo(map);

const tb = (window.tb = new Threebox(
    map,
    map.getCanvas().getContext('webgl'),
    {
        defaultLights: true
    }
));

//endregion

map.on("load", ()=>{

    //region === Interactions ===

    //Building Hover
    map.addInteraction('building-hover-on', {
        type: 'mouseenter',
        target: {featuresetId: 'buildings', importId: 'basemap'},
        handler: (e) => {
            map.setFeatureState(e.feature, {highlight: true});
            map.getCanvas().style.cursor = 'pointer';
        }
    });

    //Buildign Click Logic
    map.addInteraction('building-click-on', {
        type: 'click',
        target: {featuresetId: 'buildings', importId: 'basemap'},
        handler: (e) => {
            const feature = e.feature;
            if (!feature?.geometry) return;

            map.setFeatureState(feature, { select: true });

            const center = getBboxCenter(feature.geometry);

            bus.notify("BuildingClickedEvent", {
                feature,
                center
            });

            return true;
        }
    });

    map.addInteraction('building-hover-off', {
        type: 'mouseleave',
        target: {featuresetId: 'buildings', importId: 'basemap'},
        handler: (e) => {
            map.setFeatureState(e.feature, {highlight: false});
            map.getCanvas().style.cursor = '';
        }
    });

    //endregion

    //region ===== Data Sources =====
    map.addSource("focus", {
        type: "geojson",
        data: "/geojson/campusPolygon.geojson"
    });

    map.addSource("eraser", {
        type: "geojson",
        data: "/geojson/envdEraser.geojson"
    });

    map.addSource("mask", {
        type: "geojson",
        data: "/geojson/universityMask.geojson",
    });

    map.addSource("circleGradient", {
        type: "geojson",
        data: "/geojson/circleGradient.geojson",
    });

    map.addSource("polygonGradient", {
        type: "geojson",
        data: "/geojson/polygonGradient.geojson"
    })

    map.addSource("ENVD", {
        type: "geojson",
        data: "/geojson/buildingWalls.geojson"
    });

    map.addSource("REC", {
        type: "geojson",
        data: "/geojson/REC.geojson"
    });

    //endregion

    // ===== ENVD Area Erase =====
    function disableClip() { //On zoom out (not implemented)
        if (map.getLayer("ENVD-Erase")) map.removeLayer("ENVD-Erase");
    }

    function enableClip() { //On Zoom in remove building
        if (map.getLayer("ENVD-Erase")) return;

        map.addLayer({ //ENVD Building Clip Erase
            id: "ENVD-Erase",
            type: "clip",
            source: "eraser",
            layout: {
                "clip-layer-types": ["symbol", "model"]
            }
        });

        map.addLayer({ //3D Building
            id: 'custom-threebox-model',
            type: 'custom',
            renderingMode: '3d',
            slot: "top",
            onAdd: function () {
                // Creative Commons License attribution:  Metlife Building model by https://sketchfab.com/NanoRay
                // https://sketchfab.com/3d-models/metlife-building-32d3a4a1810a4d64abb9547bb661f7f3
                const scale = 3.2;
                const options = {
                    obj: 'https://docs.mapbox.com/mapbox-gl-js/assets/metlife-building.gltf',
                    type: 'gltf',
                    scale: {x: .5, y: .5, z: .5},
                    units: 'meters',
                    rotation: {x: 90, y: -90, z: 0}
                };

                tb.loadObj(options, (model) => {
                    model.setCoords([-105.26924454341602, 40.00698528139921]);
                    model.setRotation({x: 0, y: 0, z: 241});
                    tb.add(model);
                });
            },

            render: function () {
                tb.update();
            }
        });
    }

    // ===== Hallet Tiny Area =====
    map.addLayer({
        id: "polygonGradient-fill",
        type: "fill",
        source: "polygonGradient",
        slot: "bottom",
        paint: {
            "fill-color": "#A8E6C2",
            "fill-opacity": .4,
        }
    });

    map.addLayer({
        id: "polygonLine-fill",
        type: "line",
        source: "polygonGradient",
        slot: "middle",
        paint: {
            "line-color": "#A8E6C2",
            "line-width": 20,
            "line-blur": 15,
            "line-opacity": 1
        }
    });

    // ===== REC Area =====
    map.addLayer({ //Bottom Shape
        id: "REC-fill",
        type: "fill",
        source: "REC",
        slot: "bottom",
        paint: {
            "fill-color": "#E6C2A8",
            "fill-opacity": .4,
        }
    });

    map.addLayer({ //Surrounding line blur
        id: "REC-Linefill",
        type: "line",
        source: "REC",
        slot: "middle",
        paint: {
            "line-color": "#E6C2A8",
            "line-width": 25,
            "line-blur": 20,
            "line-opacity": 1
        }
    });

    // ===== Norlin Quad Area =====
    map.addLayer({
        id: "circle-gradient",
        type: "fill",
        source: "circleGradient",
        slot: "bottom",
        paint: {
            "fill-color": "#C2A8E6",
            "fill-opacity": .7,
            "fill-outline-color": "#000000",
        }
    });

    map.addLayer({
        id: "circleLine-gradient",
        type: "line",
        source: "circleGradient",
        slot: "middle",
        paint: {
            "line-color": "#C2A8E6",
            "line-width": 80,
            "line-blur": 40,
            "line-opacity": 1
        }
    });

    // ===== Global White Map =====
    map.addLayer({ //Line Blur
        id: "mask-feather",
        type: "line",
        source: "focus",
        slot: "top",
        paint: {
            "line-color": "#F4F4F4",
            "line-width": 80,
            "line-blur": 40,
            "line-opacity": 1
        }
    });

    map.addLayer({ //White Fill
        id: "region-mask",
        type: "fill",
        source: "mask",
        slot: "top",
        paint: {
            "fill-color": "#F4F4F4",
            "fill-opacity": 1,

            "fill-gradient": [
                "interpolate",
                ["linear"],
                ["distance-from-edge"],
                0, "rgba(255,255,255,0)",
                200, "rgba(255,255,255,1)"
            ],
        }
    });

    console.log('imports:', map.getStyle().imports);
});