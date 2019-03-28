var osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var osmAttrib = 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';
var osm = new L.TileLayer(osmUrl, {minZoom: 1, maxZoom: 24, attribution: osmAttrib});
var dbg = Object.create(null);
var data = Object.create(null);
var locationMapping = Object.create(null);

var cities = L.layerGroup();
var camps = L.layerGroup();

var campMarker = L.AwesomeMarkers.icon({
  icon: 'campground',
  prefix: 'fa',
  markerColor: 'red'
});

var cityMarker = L.AwesomeMarkers.icon({
  icon: 'city',
  prefix: 'fa',
  markerColor: 'blue'
});

var cfg =
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
  valueField: 'count'
};

var heatmapLayer = new HeatmapOverlay(cfg);

var mymap = L.map('map', {
  center: new L.LatLng(16.3700359, -2.2900239),
  zoom: 6,
  layers: [osm, heatmapLayer, cities, camps]
});


var baseLayers = {
  "Open Street Map": osm
};

var overlayLayers = {
  "Heatmap": heatmapLayer,
  "Cities": cities,
  "Camps": camps
};

L.control.layers(baseLayers, overlayLayers).addTo(mymap);

function getData()
{
  $.ajax({
    url: "/data/all",
    method: "GET"
  }).done(function(msg) {
    let data_set = new TimedData(msg);
    data = data_set;
    let now = data_set.getCurrentData();
    for (let i = 0; i < now.locations.length; i++)
    {
      let location = now.locations[i];
      var marker = null;
      if (location.camp)
      {
        marker = L.marker([location.lat, location.lng], { icon: campMarker }).bindPopup(location.name + "<br>" +
          "Capacity: " + location.capacity + "<br>" +
          "Refugees: " + location.refugees);
        camps.addLayer(marker);
      }
      else
      {
        marker = L.marker([location.lat, location.lng], { icon: cityMarker }).bindPopup(location.name + "<br>" +
          "Population: " + location.pop + "<br>" +
          "Refugees: " + location.refugees);
        cities.addLayer(marker);
      }
      marker.visID = i;
      marker.on('click', function(e) {
        var popup = e.target.getPopup();
        var location = data.getCurrentData().locations[e.target.visID];
        console.log("Current loc data");
        console.log(location);
        if (location.camp)
        {
          popup.setContent(location.name + "<br>" +
            "Capacity: " + location.capacity + "<br>" +
            "Refugees: " + location.refugees);
        }
        else
        {
          popup.setContent(location.name + "<br>" +
            "Population: " + location.pop + "<br>" +
            "Refugees: " + location.refugees);
        }
        popup.update();
      });
      locationMapping[location.name] = { id: i, marker: 1 };
    }
  });
}


var heatmapManager = Object.create(null);

function startHeatmap()
{
  $.ajax({
    url: "/data/test",
    method: "GET"
  }).done(function(msg) {
    let data_set = new TimedHeatmapData(msg);
    heatmapManager = new HeatmapManager(heatmapLayer, data_set);
    heatmapManager.playing = true;
    let loopID = setInterval(function()
    {
      if (heatmapManager.playing)
      {
        heatmapManager.advance();
      }
      else
      {
        clearInterval(loopID);
      }
    }, 50);
  });
}
getData();