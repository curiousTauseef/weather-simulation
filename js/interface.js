'use strict';

// https://github.com/sindresorhus/screenfull.js/

var IFC = (function () {

  var 
    self,

    $  = document.getElementById.bind(document),
    $$ = document.querySelectorAll.bind(document),

    orbitControls, 

    controllers = GUIcontrollers,

    simulator,  // 3D canvas
    fullscreen, // div full
    latlon,     // info panel

    mouse = {
      x: NaN, 
      y: NaN, 
      down: false, 
      button: NaN,
      intersect: new THREE.Vector3(0, 0, 0),
    },

    raycaster = new THREE.Raycaster(),
    marker    = new THREE.Vector3(),

    stats,

    end;

  function vector3ToLatLong (v3) {

    var v = v3.clone().normalize();
    var lon = ((270 + (Math.atan2(v.x , v.z)) * 180 / Math.PI) % 360);

    lon = lon > 180 ? -(360 - lon) : lon;

    return {
      lat: 90 - (Math.acos(v.y))  * 180 / Math.PI,
      lon: lon,
    };

  }

  function formatLatLon (prefix, ll) {
    
    ll.lat = ll.lat < 0 ? 'S ' + Math.abs(ll.lat).toFixed(0) : 'N ' + Math.abs(ll.lat).toFixed(0);
    ll.lon = ll.lon < 0 ? 'E ' + Math.abs(ll.lon).toFixed(0) : 'W ' + Math.abs(ll.lon).toFixed(0);

    return `<strong>${prefix}</strong> ${ ll.lat }, ${ ll.lon }`;
  }


  return {
    
    stats,
    mouse,
    raycaster,
    controllers,
    orbitControls,

    boot: function () {
      return self = this;
    },
    init: function () {

      simulator  = $$('.simulator')[0];
      fullscreen = $$('.fullscreen')[0];
      latlon     = $$('.panel.latlon')[0];

      var datgui = $$('div.dg.ac')[0];

      var stats = new Stats();
      self.stats = stats;
      stats.showPanel( 1 ); // 0: fps, 1: ms, 2: mb, 3+: custom
      fullscreen.appendChild( stats.dom );

      raycaster.params.Points.threshold = 0.001; // threshold;

      orbitControls = self.orbitControls = new THREE.OOrbitControls(SCN.camera, SCN.renderer.domElement),

      orbitControls.enabled = true;
        orbitControls.enablePan = false;
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.88;
        orbitControls.constraint.smoothZoom = true;
        orbitControls.constraint.zoomDampingFactor = 0.2;
        orbitControls.constraint.smoothZoomSpeed = 2.0;
        orbitControls.constraint.minDistance = RADIUS + 0.1;
        orbitControls.constraint.maxDistance = 8;

      // move gui.dat to fullscreen container
      fullscreen.appendChild(datgui);

      // poc
      // controllers['Ambient']['intensity'].setValue(1.0);

    },
    activate: function () {


      window.addEventListener('resize', self.resize, false);

      H.each([

        [simulator, 'mousedown'],
        [simulator, 'mouseup'],
        [simulator, 'mousemove'],
        [simulator, 'mouseenter'],
        [simulator, 'mouseover'],
        [simulator, 'mouseleave'],
        [simulator, 'mouseout'],
        [simulator, 'click'],
        [simulator, 'dblclick'],
        [document,  'contextmenu'],
        [window,    'orientationchange'],
        [window,    'deviceorientation'],
        [window,    'devicemotion'],
      
      ], function (_, e) { 

        e[0].addEventListener(e[1], self.events[e[1]], false) 

      });

    },
    step: function step () {

      TWEEN.update();

      orbitControls.update();

      // GUI info
      self.setLatLon(SCN.camera.position, SCN.objects.arrowHelper.cone.position);

    },
    events: {
      click:   function (event) { 

        GUI.closed = true;
        // console.log('click')

      },      
      dblclick:   function (event) { 

        if (screenfull.enabled) {
          screenfull.toggle(fullscreen);
        }        
        // console.log('dblclick');

      },
      mousedown:   function (event) { 

        mouse.down = true;
        mouse.button = event.button;
        // console.log('mousedown', event.button, event);

        if (mouse.button === 0) {
          SCN.objects.arrowHelper.setDirection( mouse.intersect );
          marker.copy(mouse.intersect);
        }

        if (mouse.button === 2) {
          ANI.insert(0, ANI.library.cam2vector(mouse.intersect, 2))
        }


      },
      mouseup:     function (event) { 

        mouse.down = false;
        mouse.button = NaN;

      },
      mousemove:   function (event) { 

        // TODO: not window
        mouse.x =   ( event.clientX / window.innerWidth )  * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

        self.updateMouse();

      },
      mouseenter:  function (event) { /* console.log('mouseenter') */ },
      mouseover:   function (event) { /* console.log('mouseover') */ },
      mouseleave:  function (event) { /* console.log('mouseleave') */ },
      mouseout:    function (event) { /* console.log('mouseout') */ },
      contextmenu: function (event) { /* console.log('contextmenu') */ },

      devicemotion:      function (event) { /* console.log('devicemotion', event)      */ },
      orientationchange: function (event) { console.log('orientationchange', event)       },
      deviceorientation: function (event) { /* console.log('deviceorientation', event) */ },

    },
    updateMouse: function () {

      var intersections, intersection;

      raycaster.setFromCamera( mouse, SCN.camera );
      intersections = raycaster.intersectObjects( [SCN.objects.pointer] );

      if (( intersection = ( intersections.length ) > 0 ? intersections[ 0 ] : null )) {
        mouse.intersect.copy(intersection.point).normalize();
      }

    },
    resize: function () {
    },
    setLatLon: function (posCam, posArrow) {
      latlon.innerHTML = (
        formatLatLon('C', vector3ToLatLong(posCam)) + '<br>' + 
        formatLatLon('M', vector3ToLatLong(marker))
      );
    },

    takeScreenShot: function(){
      // https://developer.mozilla.org/en/DOM/window.open
      var f = self.getFrame("image/png");
      var opts = "menubar=no,scrollbars=no,location=no,status=no,resizable=yes,innerHeight=" + (f.height/2) + ",innerWidth=" + (f.width/2);
      var win = window.open(f.url, "screenshot", opts); 
      win.focus();
      console.log("win.open", win, opts);
    },   
    getFrame :  function(mimetype){ 

      var 
        cvs    = SCN.renderer.domElement,
        width  = cvs.width,
        height = cvs.height;

      return {
        width, 
        height,
        url: cvs.toDataURL(mimetype),
        num: SCN.frames, 
      }; 

    },

  };

}()).boot();