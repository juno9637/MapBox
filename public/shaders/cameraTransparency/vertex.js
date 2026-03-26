export const cameraTransparencyVertexShader = /* glsl */ `
    uniform float uTime;
    
    varying vec2 vUv;
    varying vec4 vClipPos;
    varying vec3 vViewPos;
    
    void main(){
        //Position
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        
        vec4 finalPosition = projectionMatrix * viewMatrix * modelPosition;
        
        //Final Position
        gl_Position = finalPosition;
        
        //Varyings
        vViewPos = modelViewPosition.xyz;
        vUv = uv;
        vClipPos = finalPosition;
    }
`;

