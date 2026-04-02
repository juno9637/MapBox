export const smellVertexShader = /* glsl */ `
    uniform float uTime;
    uniform sampler2D uSwirlTexture;
    uniform sampler2D uPerlinTexture;
    
    varying vec2 vUv;
    varying float vElevation;
    
    vec2 rotate2D(vec2 value, float angle)
    {
        float s = sin(angle);
        float c = cos(angle);
        mat2 m = mat2(c, s, -s, c);
        return m * value;
    }
    
    void main(){
        vec3 newPosition = position;
    
        vec2 centered = uv * 2.0 - 1.0;
        float dist = 1.0 - clamp(length(centered) / 1.5, 0.0, 1.0);
        float heightFalloff = smoothstep(-0.9, 1.2, dist);
        dist = smoothstep(0.0, 1.0, dist); // Smooth the edges

        //Height
        float swirlHeight = texture(
            uSwirlTexture,
            vec2(uv.x, uv.y)
        ).r;
    
        float height = smoothstep(0.0, 1.0, swirlHeight * 0.3); // Add dist to fade out towards edges
        newPosition.y = height * heightFalloff;
    
        //Crest Sway
        float swayStrength = 3.0;
        vec2 sway = vec2(
        sin(uTime * 1.2 + position.x * 2.0),
        cos(uTime * 0.9 + position.z * 2.0)
        );
        //Height Squared for more sway at the top
        newPosition.xz += sway * swayStrength * height * height;
    
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    
        vUv = uv;
        vElevation = height;
    }
`;