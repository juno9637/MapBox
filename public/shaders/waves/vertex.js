export const wavesVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uBigWavesElevation;
    uniform float uBigWavesFrequency;
    uniform float uBigWaveSpeed;
    uniform vec2 uWaveCenter;
    uniform float uPlaneRadius;
    
    varying float vDist;
    
    void main(){
    
    //Waves
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    //First waves
    float dist = length(modelPosition.xz - uWaveCenter);
    float normalizedDist = dist / uPlaneRadius;
    
    float edgeFalloff = 1.0 - smoothstep(0.5, 1.0, normalizedDist);
    
    float waveElevation = sin(dist * uBigWavesFrequency - uTime * uBigWaveSpeed) * uBigWavesElevation * edgeFalloff;
    
    modelPosition.y += waveElevation;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
    
    vDist = dist;
    }
`;