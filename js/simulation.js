'use strict';

var SIM = (function () {


  var 
    self,
    renderer,
    camera,

    frame,
    sim,

    $$ = document.querySelectorAll.bind(document),

    image  = $$('.panel.image')[0],


    index = 0,
    trails = [],
    
    trailsWind,
    trailsBetterWind,

    image,

    model = {

    },

    sun   = Orb.SolarSystem().Sun(),
    // sun2  = Orb.SolarSystem().Sun2(),
    // earth = Orb.SolarSystem().Earth(),

    time = {
      // start: moment.utc(timerange[0], "YYYY-MM-DD"),
      start: moment.utc('2017-01-01-00', "YYYY-MM-DD-HH"),

      now: moment.utc('2017-03-20-12', "YYYY-MM-DD-HH"),

      show: moment.utc('2017-03-20-12', "YYYY-MM-DD-HH"),
      show: moment.utc('2017-09-23-12', "YYYY-MM-DD-HH"),

      // now:   moment.utc(),
      // show:  moment.utc(),

      // end:   moment.utc(timerange.slice(-1)[0], "YYYY-MM-DD"),
      end:   moment.utc('2017-12-31-00', "YYYY-MM-DD-HH"),
      // interval: timerange.length * 24 -1, 
      interval: 365 * 24, 
    },

    end;


  return {
    boot: function () {
      return self = this;
    },
    init: function () {

      var diff = time.now.diff(time.start, 'hours');

      IFC.controllers['DateTime']['choose'].setValue(diff);
      // IFC.controllers['DateTime']['display'].setValue(time.show.format('YYYY-MM-DD HH:MM'));

    },
    load: function (name, config, callback) {

      TIM.step('SIM.load.in');

      var mesh = self.createWind();
      callback(name, mesh);

      TIM.step('SIM.load.out');

    },
    updateDatetime: function (val) {

      // TODO: adjust for ra
      // https://www.timeanddate.com/scripts/sunmap.php?iso=20170527T1200

      var iso, orbTime, posSun, sphererical;

      time.show = (typeof val === 'string') ? 
        time.show.clone().add(~~val, 'hours') : 
        time.start.clone().add(val, 'hours') ;

      iso = time.show.format('YYYY-MM-DD HH');
      // image && (image.src = '//www.timeanddate.com/scripts/sunmap.php?iso=' + time.show.format('YYYYMMDD[T]HHmm'));

      // query sun by time
      orbTime = new Orb.Time(time.show.toDate());
      posSun  = sun.position.equatorial(orbTime);

      //  Spherical(                      radius, phi, theta )
      sphererical = new THREE.Spherical(4, 0, -Math.PI / 2);
      sphererical.phi    -= posSun.dec * Math.PI / 180;             // raise sun
      sphererical.phi    += Math.PI / 2;                            // change coord system
      sphererical.theta  -= ( time.show.hour() * (Math.PI / 12) ) ; // rot by planet

      SCN.objects.spot.position.setFromSpherical(sphererical).normalize().multiplyScalar(4);
      SCN.objects.sunPointer.setDirection(SCN.objects.spot.position.clone().normalize());

      IFC.controllers['SimTime'].setValue(time.show.format('YYYY-MM-DD HH:mm'));

      // console.log(iso, 'dec', posSun.dec, 'ra', posSun.ra);

    },
    createWind: function () {

      var i, j, lat, lon, col,

        amount = TRAIL_NUM,
        length = TRAIL_LEN,
        
        trailsVectors = new Array(amount).fill(0).map( () => []),
        trailsColors  = new Array(amount).fill(0).map( () => []),
        latsStart = H.linspace(-40, 40, amount), 
        lonsStart = H.linspace(  -10, -10, amount), 
        convert    = function (latlon) {
          return TOOLS.latLongToVector3(latlon[0], latlon[1], CFG.earth.radius, CFG.earth.radius / 45);
        },

        color = new THREE.Color('rgb(255, 0, 0)'),

      end;

      for (i=0; i<amount; i++) {

        lat   = latsStart[i];
        lon   = lonsStart[i];
        col   = 0;

        for (j=0; j<length; j++) {

          trailsVectors[i].push(convert([lat, lon]));
          trailsColors[i].push(new THREE.Color('hsl(' + (col + 360/length) + ', 80%, 50%)'));

          lat += 0;
          lon += 20/length;
          col += 360/length;

        }

      }

      trailsWind = new Trails('wind10m', trailsVectors, trailsColors, color);
      
      return trailsWind.container;
      
    },
    loadBetterWind: function () {

      return;

      // https://stackoverflow.com/questions/44098678/how-to-rotate-a-vector3-using-vector2

      //  For winds, the u wind is parallel to the x axis. 
      // A positive u wind is from the west. 
      // A negative u wind is from the east. 
      // The v wind runs parallel to the y axis. 
      // A positive v wind is from the south, and a negative v wind is from the north.
      
      TIM.step('Model.loaded');

      var t0 = Date.now(), i, j, lat, lon, col, vector3, vecWind, sphericalPosition,  latlon, 

        // latlonsStart = TOOLS.createLatLonsRect( [0, 0], [87, 179], 4 ),
        // amount = latlonsStart.length,

        length = 60,
        amount = 3000,
        latlonsStart = TOOLS.createLatLonsRectRandom([80, 0], [-80, 359], amount),

        trailsVectors = new Array(amount).fill(0).map( () => []),
        trailsColors  = new Array(amount).fill(0).map( () => []),
        convertLL    = function (latlon) {
          return TOOLS.latLongToVector3(latlon[0], latlon[1], CFG.earth.radius, CFG.earth.radius / 45);
        },
        convertV3 = function (v3) {
          return TOOLS.vector3ToLatLong(v3, CFG.earth.radius + CFG.earth.radius / 45);
        },
        factor = 0.0004, // TODO: proper Math
        color = new THREE.Color(0xffff88);

      end;

      for (i=0; i<amount; i++) {

        col   = 0;
        lat   = latlonsStart[i][0];
        lon   = latlonsStart[i][1];

        for (j=0; j<length; j++) {

          vector3 = convertLL([lat, lon]);
          trailsVectors[i].push(vector3);

          sphericalPosition = new THREE.Spherical().setFromVector3(vector3);
          sphericalPosition.theta += model.ugrd10.linearXY(0, lat, lon) * factor; // east-direction
          sphericalPosition.phi   += model.vgrd10.linearXY(0, lat, lon) * factor; // north-direction
          vector3 = vector3.setFromSpherical(sphericalPosition).clone();
          
          latlon = convertV3(vector3);
          lat = latlon.lat;
          lon = latlon.lon;

          trailsColors[i].push(new THREE.Color('hsl(' + (col + 360/length) + ', 50%, 80%)'));
          col += 360/length;

        }

      }

      trailsBetterWind = new Trails('nicewind10m', trailsVectors, trailsColors, color);
      
      SCN.add('nicewind10m', trailsBetterWind.container);

      TIM.step('Wind.created');

    },
    loadModel: function (callback) {

      return;

      RES.load({
        urls: [
          'data/gfs/2017-05-23.tcdcclm.dods',
          'data/gfs/2017-05-23.tmp2m.dods',
          'data/gfs/2017-05-23.ugrd10m.dods',
          'data/gfs/2017-05-23.vgrd10m.dods',
        ],
        onFinish: function (err, responses) {
          responses.forEach(function (response) {
            var vari, data;
            if (response){
              vari = response.url.split('.')[-2];
              data = SIM.Model.parseMultiDods(vari, response.data);
              model[vari] = new SIM.Datagram(data);
            } else {
              console.log('WTF');
            }
          });
        }
      });    

    },
    step: function (frame) {

      trailsWind && trailsWind.step();

      // trailsBetterWind && trailsBetterWind.step();

      index += 1;

    },
    start: function () {},
    stop: function () {},
    pause: function () {},
    activate: function () {
    },
    resize: function () {
    },
    render: function () {

    }
  };

}()).boot();