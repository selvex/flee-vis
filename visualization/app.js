var express = require('express');
var app = express();
var path = require('path');

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.use(express.json());
app.use(express.urlencoded( {extended: true }));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.get('/data/test', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname + "/public/assets/data/test/heatmap.json"));
});

app.get('/data/all', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname + "/public/assets/data/test/all.json"));
});

var server = app.listen(3000, function () {
  console.log('Flee Vis app listening on port 3000!');
  console.log("Visit localhost:3000 to start.")
});
app.use(express.static('public'));

function shutdown()
{
  console.log("Graceful shutdown");
  server.close();
  process.exit(0);
}