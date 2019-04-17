var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');
var config = require('./config.js');

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + "/index.html"));
});

//app.get('/data/test', function(req, res) {
//  res.setHeader('Content-Type', 'application/json');
//  res.sendFile(path.join(__dirname + "/public/assets/data/test/heatmap.json"));
//});

app.get('/data/available-simulations', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  let data_directory = path.join(__dirname + config.dataDirectory);
  
  new Promise(function(resolve, reject) {
    fs.readdir(data_directory, function(err, files) {
      if (err)
      {
        reject({
          message        : "Failed to read data directory",
          status         : 400,
          internalMessage: "Failed to read data directory",
          error          : err
        });
        return;
      }
      resolve(files);
    });
  }).then(function processFiles(files) {
      var promises = [];
      files.forEach(function(file, index) {
        let current_file = path.join(data_directory + file);
        promises.push(new Promise(function(resolve, reject) {
          fs.stat(current_file, function(err, stat) {
            if (err)
            {
              reject({
                message        : "Failed to read data from data directory.",
                status         : 400,
                internalMessage: "Failed to read data from data directory.",
                error          : err
              });
              return;
            }
            if (stat.isFile())
            {
              resolve({name: file});
            }
            resolve({directory: true});
          });
        }))
      });
      
      // Check all files in folder
      Promise.all(promises)
      .then(function(foundFiles) {
        let available_simulations = [];
        foundFiles.forEach(function(file) {
          if (file.directory)
          {
            return;
          }
          available_simulations.push(file);
        });
        res.json(available_simulations);
      })
      .catch(function failedCheckingFile(err) {
        res.status(err.status).json({error: err.message});
        console.error(err.internalMessage);
        console.error(err.error);
      });
      
    },
    function failedToReadDirectory(err) {
      res.status(err.status).json({error: err.message});
      console.error(err.internalMessage);
      console.error(err.error);
    });
});

app.get('/data/:file', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname + config.dataDirectory + req.params.file));
});

var server = app.listen(config.port, function() {
  console.log('Flee Vis app listening on port ' + config.port + '!');
  console.log("Visit localhost:" + config.port + " to start.");
});
app.use(express.static('public'));

function shutdown()
{
  console.log("Graceful shutdown");
  server.close();
  process.exit(0);
}