export const smellFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uDepthColor;
uniform vec3 uSurfaceColor;
uniform sampler2D uPerlinTexture;

varying vec2 vUv;
varying float vElevation;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main(){
    float radius = 1.2; // Adjust for how far the waves reach
    
    vec2 center = vUv * 2.0 - 1.0;
    float dist = 1.0 - clamp(length(center) / radius, 0.0, 1.0);
    dist = smoothstep(0.0, 1.0, dist); // Smooth the edges
    
    float edgeMask = 1.0 - dist + radius;

    float wavesY = texture(uPerlinTexture, vec2(0.5, vUv.y * 0.2 - uTime * 0.01)).r;
    float wavesX = texture(uPerlinTexture, vec2(0.5, vUv.x * 0.2 - uTime * 0.01)).r;
    float waves = wavesY * wavesX;

    dist = dist + (waves - 0.5) * 0.9; // Add wavy distortion to the distance

    float grainScale = 1.0; // Adjust for grain size
    vec2 grainCoord = floor(gl_FragCoord.xy / grainScale); // time offset animates the grain
    float grain = hash(grainCoord);

    float grainAlpha = grain + 0.5; // Base alpha for grain, adjust as needed

    // Remap from [0,1] to [-1,1] so grain brightens AND darkens
    grain = (grain - 0.5) * 2.0;

    // Control intensity
    float grainStrength = 0.08; // tweak this
    grain *= grainStrength;

    float mixStrength = (vElevation + 0.002) * 5.0;
    vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength); // Base color with distance fade
    color += grain; // Add grain to the color, adjust strength as needed

    gl_FragColor = vec4(color, dist * edgeMask); // Use dist for alpha, multiplied by edgeMask to fade out edges

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;