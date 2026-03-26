export const cameraTransparencyFragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec2 uResolution;
    uniform sampler2D uPerlinTexture;
    uniform vec2 uCutPos;
    uniform float uCutRadius;
    uniform float uCutDepth;
    uniform float uCutFade;
  
    varying vec2 vUv;
    varying vec4 vClipPos;
    varying vec3 vViewPos;
    
    void main() {
    
        // Distance From Center
        vec2 normalizedPosition = vClipPos.xy / vClipPos.w;
        float aspectRatio = uResolution.x / uResolution.y;
        vec2 circleDelta = (normalizedPosition - uCutPos) * vec2(aspectRatio, 1.0);
        float centerDist = length(circleDelta);
    
        //Wavey
        float wavesY = texture(uPerlinTexture, vec2(0.5, vUv.y * 0.2 - uTime * 0.1)).r;
        float wavesX = texture(uPerlinTexture, vec2(0.5, vUv.x * 0.2 - uTime * 0.1)).r;
        float waves = wavesY * wavesX;
        
        float wavePos = centerDist + (waves - 0.5) * 0.3;
        float waveCircleMask = smoothstep(uCutRadius, uCutRadius + 0.2, wavePos);
        
        //Depth
        float depth = -vViewPos.z;
        float depthMask = smoothstep(uCutDepth, uCutDepth + uCutFade, depth);
    
        float alpha = max(waveCircleMask, depthMask);
        
        if (alpha < 0.01) discard;
    
        //Final Color
        gl_FragColor = vec4(uColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

