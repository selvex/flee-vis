var osmUrl= 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var osmAttrib='Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors';
var osm = new L.TileLayer(osmUrl, {minZoom: 1, maxZoom: 24, attribution: osmAttrib});

var mymap = L.map('map').setView(new L.LatLng(16.3700359, -2.2900239), 4);
mymap.addLayer(osm);