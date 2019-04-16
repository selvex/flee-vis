var globals = {
  dbg: Object.create(null),
  data: Object.create(null),
  locationMapping: Object.create(null)
};

class MapManager
{
  constructor()
  {
    let osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let osmAttrib = 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';
    let osm = new L.TileLayer(osmUrl, {minZoom: 1, maxZoom: 24, attribution: osmAttrib});
  
    this.circleVisLayer = L.layerGroup();
    this.lineVisLayer = L.layerGroup();
    this.cities = L.layerGroup();
    this.camps = L.layerGroup();
  
    this.campMarker = L.AwesomeMarkers.icon({
      icon: 'campground',
      prefix: 'fa',
      markerColor: 'red'
    });
  
    this.cityMarker = L.AwesomeMarkers.icon({
      icon: 'city',
      prefix: 'fa',
      markerColor: 'blue'
    });
  
    let cfg =
      {
        "radius": 1,
        "maxOpacity": .8,
        // scales the radius based on map zoom
        "scaleRadius": true,
        "useLocalExtrema": false,
        // which field name in your data represents the latitude - default "lat"
        latField: 'lat',
        // which field name in your data represents the longitude - default "lng"
        lngField: 'lng',
        // which field name in your data represents the data value - default "value"
        valueField: 'refugees'
      };
  
    this.heatmapLayer = new HeatmapOverlay(cfg);
  
    this.map = L.map('map', {
      center: new L.LatLng(16.3700359, -2.2900239),
      zoom: 6,
      layers: [osm, this.cities, this.camps, this.circleVisLayer, this.lineVisLayer]
    });
  
  
    let baseLayers = {
      "Open Street Map": osm
    };
  
    let overlayLayers = {
      "Heatmap": this.heatmapLayer,
      "Cities": this.cities,
      "Camps": this.camps,
      "Circles": this.circleVisLayer,
      "Routes": this.lineVisLayer
    };
  
    L.control.layers(baseLayers, overlayLayers).addTo(this.map);
  
    //this.generalPopup = L.popup();
    //let that = this;
    //this.map.on('click', function(e) {
    //  that.generalPopup
    //  .setLatLng(e.latlng)
    //  .setContent("You clicked the map at " + e.latlng.toString())
    //  .openOn(that.map);
    //});
  }
}