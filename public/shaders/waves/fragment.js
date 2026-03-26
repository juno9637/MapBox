export const wavesFragmentShader = /* glsl */ `
    varying float vDist;
    
    void main(){
        gl_FragColor = vec4(vec3(vDist - 0.5), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

