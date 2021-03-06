
SIM.Models.pratesfc = (function () {

  var 
    self, cfg, times, vari,
    model = {
      obj:      new THREE.Object3D(),
      urls:     [],
      minDoe:   NaN,
      maxDoe:   NaN,
    }
  ;

  return self = {
    create: function (config, timcfg) {

      // shortcuts
      cfg   = config;
      times = timcfg;
      vari  = cfg.sim.variable;

      model.prepare = self.prepare;

      self.calcUrls();

      return model;

    },
    calcUrls: function () {

      times.moms.forEach(mom => {
        cfg.sim.patterns.forEach(pattern => {
          model.urls.push(cfg.sim.dataroot + mom.format(pattern));
        });
      });

    },    
    prepare: function ( ) {

      // TIM.step('Model.pratesfc.in', SIM.time.doe);

      var
        t0 = Date.now(), 

        doe        = SIM.time.doe,
        
        doe1       = doe - (doe % 0.25),
        doe2       = doe1 + 0.25,
        
        datagrams = SIM.datagrams,
        doe       = SIM.time.doe,

        geometry = new THREE.SphereBufferGeometry(cfg.radius, 359, 180),

        attributes = {
          doe1:    new THREE.BufferAttribute( datagrams[vari].attribute(doe1), 1 ),
          doe2:    new THREE.BufferAttribute( datagrams[vari].attribute(doe2), 1 ),
        },

        ownuniforms   = {
          doe:          { type: 'f',   value: doe },
          opacity:      { type: 'f',   value: cfg.opacity },
          sunDirection: { type: 'v3',  value: SIM.sunDirection.clone() },
        },

        uniforms   = THREE.UniformsUtils.merge([
            // THREE.UniformsLib[ 'lights' ],
            ownuniforms       
        ]),
        
        material   = new THREE.ShaderMaterial({
          uniforms,
          transparent:    true,
          vertexShader:   self.vertexShader(),
          fragmentShader: self.fragmentShader(),
        }),
      
        onAfterRender = function  () {

          var
            doe = SIM.time.doe, 
            datagramm = SIM.datagrams[vari];

          uniforms.doe.value = doe;

          // check bounds
          if ( doe >= times.mindoe && doe <= times.maxdoe ) {

            // check whether update needed
            if (doe < doe1 || doe > doe2) {

              doe1 = doe  - (doe % 0.25);
              doe2 = doe1 + 0.25;

              geometry.attributes.doe1.array = datagramm.attribute(doe1);
              geometry.attributes.doe2.array = datagramm.attribute(doe2);

              geometry.attributes.doe1.needsUpdate = true;
              geometry.attributes.doe2.needsUpdate = true;

            }

          } else {
            uniforms.doe.value = 0.0;

          }

          uniforms.doe.needsUpdate          = true;
          uniforms.sunDirection.value.copy(SIM.sunDirection);
          uniforms.sunDirection.needsUpdate = true;

        },

        mesh = new THREE.Mesh( geometry, material )

      ;

      geometry.addAttribute( 'doe1', attributes.doe1 );
      geometry.addAttribute( 'doe2', attributes.doe2 );

      mesh.onAfterRender = onAfterRender;
      mesh.name = 'sector';
      model.obj.add(mesh);

      TIM.step('SIM.pratesfc.out', Date.now() -t0, 'ms');

      return model;

    },

    // https://stackoverflow.com/questions/37342114/three-js-shadermaterial-lighting-not-working
    // https://jsfiddle.net/2pha/h83py9gu/ fog + shadermaterial
    // https://github.com/borismus/webvr-boilerplate/blob/master/node_modules/three/src/renderers/shaders/ShaderChunk/lights_lambert_vertex.glsl

    vertexShader: function () {
      
      return `

        attribute float doe1;
        attribute float doe2;

        varying float vData1;
        varying float vData2;

        void main() {

          vData1 = doe1;
          vData2 = doe2;

          gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

        }
      
      `;

    },
    fragmentShader: function () {

      return `

        // precision highp int;
        // precision highp float;

        uniform float doe, opacity;

        varying float vData1;
        varying float vData2;

        float frac, fac1, fac2, value;

        vec4 color;

        void main() {

          vec3 irradiance;


          if (doe < 1.0) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 0.4); // error

          } else {

            frac = fract(doe);
            fac2 = mod(frac, 0.25) * 4.0;
            fac1 = 1.0 - fac2;

            value = (vData1 * fac1 + vData2 * fac2) ;

            if ( value <= 0.00005 ) {
              discard;

            } else {
              // color = (
              //   value < 0.0001 ? vec3(0.666, 0.400, 0.666) : // dark violett
              //   value < 0.0002 ? vec3(0.807, 0.607, 0.898) :
              //   value < 0.0003 ? vec3(0.423, 0.807, 0.886) :
              //   value < 0.0004 ? vec3(0.423, 0.937, 0.423) :
              //   value < 0.0005 ? vec3(0.929, 0.976, 0.423) :
              //   value < 0.0006 ? vec3(0.984, 0.792, 0.384) :
              //   value < 0.0007 ? vec3(0.984, 0.396, 0.305) :
              //   value < 0.0008 ? vec3(0.800, 0.250, 0.250) :
              //     vec3(0.600, 0.150, 0.150)                  // dark red
              // );
              color = (
                value < 0.0004 ? vec4(0.04, 0.24, 0.59, 0.30) :
                value < 0.0007 ? vec4(0.11, 0.30, 0.62, 0.40) :
                value < 0.0013 ? vec4(0.18, 0.36, 0.66, 0.50) :
                value < 0.0024 ? vec4(0.25, 0.43, 0.70, 0.60) :
                value < 0.0042 ? vec4(0.32, 0.49, 0.74, 0.70) :
                value < 0.0076 ? vec4(0.39, 0.55, 0.77, 0.80) :
                value < 0.0136 ? vec4(0.47, 0.62, 0.81, 0.90) :
                  vec4(1.0)                  // white
              );

              color.a = color.a * opacity;
              gl_FragColor = color;        //0.3 good

            }

          }
          
        }

      `;

    }

  };

}());
