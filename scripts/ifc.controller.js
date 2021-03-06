
IFC.Controller = (function () {

  const
    PI    = Math.PI,
    TAU   = PI * 2,
    EPS   = 0.000001,
    max   = Math.max,
    min   = Math.min,
    abs   = Math.abs,
    hypot = Math.hypot
  ;

  var 
    self, interval, cam, home, dispatcher,

    cfg        = {},
    spcl       = new THREE.Spherical(),

    enabled    = false,

    frameCounter = 0,

    attOrientX = H.createAttenuator(10),
    attOrientY = H.createAttenuator(10),

    veloX      = 0,
    veloY      = 0,
    veloZ      = 0,

    alpha      = NaN,
    beta       = NaN,
    gamma      = NaN,

    keys       = { down: false, key: ''},
    mouse      = { down: {x: NaN, y:NaN }, last: {x: NaN, y:NaN } },
    touch      = { down: {x: NaN, y:NaN }, last: {x: NaN, y:NaN } }, // 1 finger
    swipe      = { diff: {x: NaN, y:NaN }, last: {x: NaN, y:NaN } }, // 2 fingers

    isMoving   =  false,
    wasMoving  =  false,

    status     = {},

    defaults   = {

      minRadius:     1.2,
      maxRadius:     8.0,

      onwheel:       null,
      ondrag:        null,
      onorient:      null,
      
      onkey:         () => {},

      onRelax:       () => {},
      onAwake:       () => {},

      keys:          ['t', 'z', 'u', 'i', 'o', 'p'],
      lookAt:        new THREE.Vector3(0, 0, 0),

      dampX:         0.94,
      dampY:         0.94,
      dampZ:         0.90,

      keyXimpulse:   0.05,
      keyYimpulse:   0.05,
      keyZimpulse:   0.5,

      wheelYimpulse: 0.5,
      wheelXimpulse: 0.5,

      moveXimpulse:  0.004,
      moveYimpulse:  0.004,

      keyInterval:   100,

      keyactions: {
        'y': () => self.stop(),
        'x': () => self.reset(),
        'a': (ix        ) => self.impulse( -ix,   0,   0),   // X, rotate left  negative
        'd': (ix        ) => self.impulse(  ix,   0,   0),   // X, rotate right positive
        'w': (ix, iy    ) => self.impulse(   0, -iy,   0),   // Y, rotate up    negative, inverted
        's': (ix, iy    ) => self.impulse(   0,  iy,   0),   // Y, rotate down  positive, inverted
        'e': (ix, iy, iz) => self.impulse(   0,   0,  iz),   // Z, zoom   out   positive
        'q': (ix, iy, iz) => self.impulse(   0,   0, -iz),   // Z, zoom   in    positive
      }

    };

  function eat (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }

  function scale (x, xMin, xMax, min, max) {
    return (max - min) * (x - xMin) / (xMax - xMin) + min;
  }

  function distanceScale (x, min, max) {
    return (max-min)*(x-cfg.minRadius)/(cfg.maxRadius-cfg.minRadius)+min;
  }

  return self = {

    spherical: spcl,

    status: function () {

      status.alpha = alpha;
      status.beta  = beta;
      status.gamma = gamma;

      status.veloX = veloX;
      status.veloY = veloY;
      status.veloZ = veloZ;

      status.attOrientX = attOrientX();
      status.attOrientY = attOrientY();

      return status;

    },

    init: function (camera, element, config) {

      cam  = camera;
      home = cam.position.clone();

      // TODO make touchstart, -move, wheel passive

      dispatcher = [
        [element,   'mousedown'],
        [element,   'mouseup'],
        [element,   'mousemove'],
        [element,   'mouseleave'],
        [element,   'wheel'],
        [element,   'touchstart'],
        [element,   'touchmove'],
        [element,   'touchend'],
        [element,   'touchcancel'],
        [document,  'keydown'],
        [document,  'keyup'],
        // [window,    'devicemotion'],
        // [window,    'deviceorientation'],   // against fixed frame, needs secure connection
      ];
      
      spcl.setFromVector3(cam.position);

      Object.assign(cfg, defaults, config);

    },
    
    activate: function () {
      enabled = true;
      H.each(dispatcher, (_, e) => e[0].addEventListener(e[1], self.events[e[1]], false) );
    },
    deactivate: function () {
      enabled = false;
      H.each(dispatcher, (_, e) => e[0].removeEventListener(e[1], self.events[e[1]], false) );
    },

    info: function () {
      return {
        veloX,
        veloY,
        veloZ,
      }
    },
    reset: function () {
      self.stop();
      cam.position.copy(home);
    },
    stop: function () {
      veloX = 0;
      veloY = 0;
      veloZ = 0;
    },
    impulse: function (x, y, z) {
      veloX += x;
      veloY += y;
      veloZ += z;
    },
    step: function (frame, deltatime) {

      var radius = cam.radius;

      if (enabled) {

        frameCounter += 1;

        veloX = abs(veloX) > EPS ? veloX * cfg.dampX : 0;  // right/left
        veloY = abs(veloY) > EPS ? veloY * cfg.dampY : 0;  // up/down
        veloZ = abs(veloZ) > EPS ? veloZ * cfg.dampZ : 0;  // zoom

        isMoving = veloX || veloY || veloZ;

        (  isMoving && !wasMoving ) && cfg.onAwake();
        ( !isMoving &&  wasMoving ) && cfg.onRelax();

        wasMoving = isMoving;

        if (veloX || veloY) {

          spcl.radius = radius;
          spcl.theta += veloX * deltatime;           // E/W
          spcl.phi   += veloY * deltatime;           // N/S

          // keep between zero and TAU
          spcl.theta = spcl.theta > TAU ? spcl.theta - TAU : spcl.theta;

          // mind the poles
          spcl.phi = max(EPS,      spcl.phi);
          spcl.phi = min(PI - EPS, spcl.phi);

          cam.position.setFromSpherical(spcl);

          // calc lat/lon
          cam.phi    = spcl.phi;
          cam.theta  = spcl.theta;
          cam.radius = spcl.radius;

        }

        if (veloZ) {

          radius *= 1 + ( veloZ * deltatime / radius );

          radius  = (
            radius < cfg.minRadius ? cfg.minRadius :
            radius > cfg.maxRadius ? cfg.maxRadius :
              radius
          );

          cam.position.setLength(radius);

        }

        cam.lookAt(cfg.lookAt);

      }

    },

    events: {
      deviceorientation: function (event) {

        // https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Orientation_and_motion_data_explained
        // https://www.html5rocks.com/en/tutorials/device/orientation/
        
        !(frameCounter % 10) && attOrientX(event.gamma);  // [-90,90]    tilted right-to-left
        !(frameCounter % 10) && attOrientY(event.beta);   // [-180,180]  tilted front-to-back

        var 
          deltaX = event.gamma - attOrientX(),
          deltaY = event.beta  - attOrientY();

        alpha = event.alpha;   // ~0 pointing north, [0,360]
        beta  = event.beta;    // ~0 on flat surface, +90  top titlted up
        gamma = event.gamma;   // ~0 on flat surface, -90, tilted left

        if (abs(deltaX) > 0.1 || abs(deltaX) > 0.1) {

          deltaX = scale (deltaX, -20, +20, -0.1, +0.1 );
          deltaY = scale (deltaY, -20, +20, -0.1, +0.1 );

          if (cfg.onorient) {
            cfg.onorient(self.impulse, deltaX, deltaY, 0);

          } else {
            self.impulse(deltaX, deltaY, 0);

          }

        }

      },
      mouseleave:      function (event) {
        self.events.mouseup(event);
      },
      mousedown:    function (event) {
        mouse.down.x = event.pageX;
        mouse.down.y = event.pageY;
        mouse.last.x = event.pageX;
        mouse.last.y = event.pageY;
      },
      mouseup:      function (event) {
        mouse.down.x = NaN;
        mouse.down.y = NaN;
        mouse.last.x = NaN;
        mouse.last.y = NaN;
      },
      mousemove:    function (event) {

        var 
          deltaX, deltaY, 
          distance = cam.position.length(),
          factor   = distanceScale(distance, 1, cfg.maxRadius - cfg.minRadius)
        ;

        if ( !isNaN(mouse.down.x) ) {

          deltaX = (mouse.last.x - event.pageX) * cfg.moveXimpulse * factor;
          deltaY = (mouse.last.y - event.pageY) * cfg.moveYimpulse * factor;

          if (cfg.ondrag) {
            cfg.ondrag(self.impulse, deltaX, deltaY, 0);

          } else {
            self.impulse(deltaX, deltaY, 0);

          }

          mouse.last.x = event.pageX;
          mouse.last.y = event.pageY;

          return eat(event);

        }

      },
      wheel:        function (event) {

        var 
          deltaX = 0, deltaY = 0, deltaZ = 0,
          distance  = cam.position.length(),
          impFactor = distanceScale(distance, 0.2, cfg.maxRadius - cfg.minRadius)
        ;

        switch ( event.deltaMode ) {

          case 2: // Zoom in pages
            debugger;
            deltaX = event.deltaX * 0.025;
            deltaZ = event.deltaY * 0.025;  // y => z
            break;

          case 1: // Zoom in lines, Firefox
            deltaX = event.deltaX * 0.2;
            deltaZ = event.deltaY * 0.4 * impFactor;
            break;

          default: // undefined, 0, assume pixels, Chrome
            deltaX = event.deltaX * 0.01;
            deltaZ = event.deltaY * 0.02 * impFactor;  
            break;

        }

        if (cfg.onwheel) {
          cfg.onwheel(self.impulse, deltaX, deltaY, deltaZ)

        } else {
          self.impulse(deltaX, deltaY, deltaZ);

        }
        
        return eat(event);

      },
      touchcancel:    function (event) {
        self.stop();
      },
      touchend:   function (event) {

        // console.log('touchend');

        if (event.touches.length === 1) {
          // touch.last.x = event.changedTouches[0].pageX;
          // touch.last.y = event.changedTouches[0].pageY;
        }

        touch.down.x = NaN;
        touch.down.y = NaN;
        swipe.diff.x = NaN;
        swipe.diff.y = NaN;

      },
      touchstart:   function (event) {

        switch ( event.touches.length ) {

          case 1: 
            touch.down.x = event.touches[ 0 ].pageX;
            touch.down.y = event.touches[ 0 ].pageY;
            touch.last.x = touch.down.x;
            touch.last.y = touch.down.y;
          break;

          case 2: 
            swipe.diff.x = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
            swipe.diff.y = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
            swipe.last.x = swipe.diff.x;
            swipe.last.y = swipe.diff.y;
          break;

          case 3: 
            // not implemented yet
          break;

        }

      },
      touchmove:  function (event) {

        var 
          deltaX, deltaY, deltaZ,
          distance  = cam.position.length(),
          impFactor = distanceScale(distance, 1, cfg.maxRadius - cfg.minRadius)
        ;

        if (event.changedTouches.length === 1) {

          deltaX = (touch.last.x - event.changedTouches[0].pageX) * cfg.moveXimpulse * impFactor;
          deltaY = (touch.last.y - event.changedTouches[0].pageY) * cfg.moveYimpulse * impFactor;

          if (cfg.ondrag) {
            cfg.ondrag(self.impulse, deltaX, deltaY, 0)

          } else {
            self.impulse(deltaX, deltaY, 0);

          }

          touch.last.x = event.changedTouches[0].pageX;
          touch.last.y = event.changedTouches[0].pageY;

          return eat(event);

        }

        if ( event.changedTouches.length === 2 ) { 

          swipe.diff.x = event.changedTouches[ 0 ].pageX - event.changedTouches[ 1 ].pageX;
          swipe.diff.y = event.changedTouches[ 0 ].pageY - event.changedTouches[ 1 ].pageY;

          deltaZ = hypot(swipe.diff.x, swipe.diff.y) - hypot(swipe.last.x, swipe.last.y);

          self.impulse(0, 0, -deltaZ * impFactor * 0.01);

          swipe.last.x = swipe.diff.x;
          swipe.last.y = swipe.diff.y;

          // touch.last.x = event.changedTouches[0].pageX;
          // touch.last.y = event.changedTouches[0].pageY;

          return eat(event);

        }

      },
      keydown:    function (event) {

        var 
          distance  = cam.position.length(),
          impFactor = distanceScale(distance, 1, cfg.maxRadius - cfg.minRadius),
          xImp      = cfg.keyXimpulse * impFactor,
          yImp      = cfg.keyYimpulse * impFactor,
          zImp      = cfg.keyZimpulse * impFactor
        ;

        // console.log('down', keys, event.repeat);

        // if (!keys.down || event === undefined) {

          // console.log('action', keys);

          keys.down = true;
          keys.key  = event ? event.key : keys.key;

          if (cfg.keyactions[keys.key]) {
            cfg.keyactions[keys.key](xImp, yImp, zImp);          
            return eat(event);
          
          } else if (cfg.keys.indexOf(keys.key) !== -1) {
            cfg.onkey(keys.key);
            return eat(event);

          }

        // } else {
          // clearInterval(interval);
          // if (keys.down){debugger}
          // console.log('int', keys, event);
          // interval = setInterval(function () {
          //   self.events.keydown();
          // }, 500); //cfg.keyInterval);

        // }

      },
      keyup:      function (event) {
        // console.log('up', keys);
        keys.down = false;
        keys.key = '';
        // clearInterval(interval);
      },

    }

  };

}());

