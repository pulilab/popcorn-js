// PLUGIN: OPENMAP
var openmapCallback;
(function (Popcorn) {
  
  /**
   * openmap popcorn plug-in 
   * Adds an OpenLayers + OpenStreetMap map to the target div centered on the location specified by the user
   * Based on the googlemap popcorn plug-in. No StreetView support
   * Options parameter will need a start, end, target, type, zoom, lat and lng
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing 
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: ROADMAP (OpenStreetMap), SATELLITE (NASA WorldWind / LandSat). Coming Soon: TERRAIN (USGS)
   * -Zoom [optional] defaults to 2
   * -Lat and Lng are the coordinates of the map if location is not named
   * -Location is a name of a place to center the map, geocoded to coordinates using TinyGeocoder.com
   * -Markers [optional] is an array of map marker objects, with the following properties:
   * --Icon is the URL of a map marker image
   * --Size [optional] is the radius in pixels of the scaled marker image (default is 14)
   * --Text [optional] is the HTML content of the map marker -- if your popcorn instance is named 'popped', use <script>popped.currentTime(10);</script> to control the video
   * --Lat and Lng are coordinates of the map marker if location is not specified
   * --Location is a name of a place for the map marker, geocoded to coordinates using TinyGeocoder.com
   *  Note: using location requires extra loading time, also not specifying both lat/lng and location will
   * cause a JavaScript error. 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn( '#video' )
        .openmap({
          start: 5,
          end: 15,
          type: 'ROADMAP',
          target: 'map',
          lat: 43.665429,
          lng: -79.403323
        } )
   *
   */
  var newdiv,
      i = 1,
      _mapFired = false,
      _mapLoaded = false;

  // insert openlayers api script once
  if (!_mapFired) {
  _mapFired = true;
  Popcorn.getScript('http://openlayers.org/api/OpenLayers.js',
    function() {
      _mapLoaded = true;
    });
  }

  Popcorn.plugin( "openmap" , function( options ){
    // create a new div within the target div
    // this is later passed on to the maps api
    options._newdiv               = document.createElement('div');
    options._newdiv.id            = "actualmap"+i;
    options._newdiv.style.width   = "100%";
    options._newdiv.style.height  = "100%";
    i++;
    if (document.getElementById(options.target)) {
      document.getElementById(options.target).appendChild(options._newdiv);
    }
    // callback function fires when the script is run
    var isGeoReady = function() {
      if ( !_mapLoaded ) {
        setTimeout( function () {
          isGeoReady();
        }, 50);
      } else {
        if( options.location ){
          // set a dummy center at start
          options._location = new OpenLayers.LonLat( 0, 0 );
          // query TinyGeocoder and re-center in callback
          Popcorn.getJSONP(
            "http://tinygeocoder.com/create-api.php?q=" + options.location + "&callback=jsonp",
            function( latlng ) {
              options._location = new OpenLayers.LonLat( latlng[1], latlng[0] );
              options._map.setCenter( options._location );
            }
          );
        } else {
          options._location = new OpenLayers.LonLat( options.lng, options.lat );
        }
        if( options.type == "ROADMAP" ) {
          // add OpenStreetMap layer
          options._projection = new OpenLayers.Projection( 'EPSG:900913' );
          options._displayProjection = new OpenLayers.Projection( 'EPSG:4326' );
          options._location = options._location.transform( options._displayProjection, options._projection );
          options._map = new OpenLayers.Map( { div: options._newdiv, projection: options._projection, "displayProjection": options._displayProjection } );
          var osm = new OpenLayers.Layer.OSM();
          options._map.addLayer( osm );
        }
        else if( options.type == "SATELLITE" ) {
          // add NASA WorldWind / LANDSAT map
          options._map = new OpenLayers.Map( { div: options._newdiv, "maxResolution": .28125, tileSize: new OpenLayers.Size( 512, 512 ) } );
          var worldwind = new OpenLayers.Layer.WorldWind( "LANDSAT", "http://worldwind25.arc.nasa.gov/tile/tile.aspx", 2.25, 4, { T: "105" } );
          options._map.addLayer( worldwind );
          options._displayProjection = new OpenLayers.Projection( "EPSG:4326" );
          options._projection = new OpenLayers.Projection( "EPSG:4326" );
        }
        else if( options.type == "TERRAIN" ) {
          // add terrain map ( CC-BY-SA National Geographic Society ) - coming soon
          options._map = new OpenLayers.Map( options._newdiv );
          var relief = new OpenLayers.Layer.ArcGIS93Rest( "National Geographic Society", "http://server.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer/export"); 
          options._map.addLayer( relief );
          options._displayProjection = new OpenLayers.Projection( "EPSG:4326" );
          options._projection = new OpenLayers.Projection( "EPSG:4326" );
        }
        options._map.div.style.display = "none";
      }
    };
    isGeoReady();

    return {
      /**
       * @member openmap 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ) {
        var isReady = function () {
          // wait until OpenLayers has been loaded, and the start function is run, before adding map
          if (!options._map) {
            setTimeout(function () {
              isReady();
            }, 13);
          } else {
            options._map.div.style.display = "block";
            // make sure options.zoom is a number
            if ( options.zoom && typeof options.zoom !== "number" ) {
              options.zoom = +options.zoom;
            }
            options.zoom = options.zoom || 2; // default to 2

            // reset the location and zoom just in case the user played with the map
            options._map.setCenter( options._location, options.zoom );
            if( options.markers ){
              var layerStyle = OpenLayers.Util.extend( {} , OpenLayers.Feature.Vector.style[ 'default' ] );
              options._pointLayer = new OpenLayers.Layer.Vector( "Point Layer", { style: layerStyle } );
              options._map.addLayer( options._pointLayer );
              for( var m=0; m<options.markers.length; m++ ) {
                var myMarker = options.markers[ m ];
                if( myMarker.text ){
                  if( !options._selectControl ){
                    options._selectControl = new OpenLayers.Control.SelectFeature( options._pointLayer );
                    options._map.addControl( options._selectControl );
                    options._selectControl.activate();
                    options._pointLayer.events.on( {
                      "featureselected": function( clickInfo ) {
                        clickedFeature = clickInfo.feature;
                        if( !clickedFeature.attributes.text ){
                          return;
                        }
                        options._popup = new OpenLayers.Popup.FramedCloud(
                          "featurePopup",
                          clickedFeature.geometry.getBounds().getCenterLonLat(),
                          new OpenLayers.Size( 120, 250 ),
                          clickedFeature.attributes.text,
                          null,
                          true,
                          function( closeInfo ) {
                            options._selectControl.unselect(this.feature);
                          }
                        );
                        clickedFeature.popup = options._popup;
                        options._popup.feature = clickedFeature;
                        options._map.addPopup(options._popup);
                      },
                      "featureunselected": function( clickInfo ) {
                        feature = clickInfo.feature;
                        if ( feature.popup ) {
                          options._popup.feature = null;
                          options._map.removePopup( feature.popup );
                          feature.popup.destroy();
                          feature.popup = null;
                        }
                      }
                    } );
                  }
                }
                if( myMarker.location ){
                  var geocodeThenPlotMarker = function( myMarker ){
                    Popcorn.getJSONP(
                      "http://tinygeocoder.com/create-api.php?q=" + myMarker.location + "&callback=jsonp",
                      function( latlng ){
                        var myPoint = new OpenLayers.Geometry.Point( latlng[1], latlng[0] ).transform( options._displayProjection, options._projection ),
                            myPointStyle = OpenLayers.Util.extend( {}, layerStyle );
                        if( !myMarker.size || isNaN( myMarker.size ) ) {
                          myMarker.size = 14;
                        }
                        myPointStyle.pointRadius = myMarker.size;
                        myPointStyle.graphicOpacity = 1;
                        myPointStyle.externalGraphic = myMarker.icon;
                        var myPointFeature = new OpenLayers.Feature.Vector( myPoint, null, myPointStyle );
                        if( myMarker.text ) {
                          myPointFeature.attributes = { 
                            text: myMarker.text
                          };
                        }
                        options._pointLayer.addFeatures( [ myPointFeature ] );
                      }
                    );
                  };
                  geocodeThenPlotMarker(myMarker);
                } else {
                  var myPoint = new OpenLayers.Geometry.Point( myMarker.lng, myMarker.lat ).transform( options._displayProjection, options._projection ),
                      myPointStyle = OpenLayers.Util.extend( {}, layerStyle );
                  if( !myMarker.size || isNaN( myMarker.size ) ) {
                    myMarker.size = 14;
                  }
                  myPointStyle.pointRadius = myMarker.size;
                  myPointStyle.graphicOpacity = 1;
                  myPointStyle.externalGraphic = myMarker.icon;
                  var myPointFeature = new OpenLayers.Feature.Vector( myPoint, null, myPointStyle );
                  if( myMarker.text ) {
                    myPointFeature.attributes = { 
                      text: myMarker.text
                    };
                  }
                  options._pointLayer.addFeatures( [ myPointFeature ] );
                }
              }
            }
          }
        };
        
        isReady();
      },
      /**
       * @member openmap
       * The end function will be executed when the currentTime 
       * of the video reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ) {
        // if the map exists hide it do not delete the map just in 
        // case the user seeks back to time b/w start and end
        if (options._map) {
          options._map.div.style.display = 'none';          
        }
      }

    };
  },
  {
    about:{
      name: "Popcorn OpenMap Plugin",
      version: "0.2",
      author: "@mapmeld",
      website: "mapuganda.blogspot.com"
    },
    options:{
      start    : {elem:'input', type:'text', label:'In'},
      end      : {elem:'input', type:'text', label:'Out'},
      target   : 'map-container',
      type     : {elem:'select', options:[ 'ROADMAP', 'SATELLITE' ], label:'Type'},
      zoom     : {elem:'input', type:'text', label:'Zoom'},
      lat      : {elem:'input', type:'text', label:'Lat'},
      lng      : {elem:'input', type:'text', label:'Lng'},
      location : {elem:'input', type:'text', label:'Location'}
      markers  : {elem:'input', type:'text', label:'List Markers'},
    }	
  });
})( Popcorn );
