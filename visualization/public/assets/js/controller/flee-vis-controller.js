var app = angular.module('fleeVis', []);
app.config(['$provide', function($provide) {
  $provide.factory('mapManager', function() {
    return new MapManager();
  });
  $provide.factory('circleVis', ['mapManager', function(mapManager) {
    return new CircleVisManager(mapManager.map, mapManager.circleVisLayer, mapManager.lineVisLayer);
  }]);
  $provide.factory('heatmapVis', ['mapManager', function(mapManager) {
    return new HeatmapManager(mapManager.map, mapManager.heatmapLayer);
  }]);
}]);


app.controller('fleeVisController', ['$scope', '$http', '$interval', 'mapManager','circleVis', 'heatmapVis', function($scope, $http, $interval, mapManager, circleVis, heatmapVis) {
  $scope.popups = [];
  $scope.playing = false;
  $scope.endStep = 500;
  $scope.ready = false;
  $scope.startDate = new Date("2012-02-29");
  $scope.currentDate = $scope.startDate;
  $scope.simulationSpeed = 1.0;
  $scope.msPerTick = 1000;
  
  $scope.availableSimulations = Object.create(null);
  $scope.availableSimulations['Mali'] = {name: "Mali", description: "Test descr Mali"};
  $scope.availableSimulations['CAR'] = {name: "CAR", description: "Test descr CAR"};
  
  $scope.selectedSimulation = $scope.availableSimulations['Mali'];
    
    
    /**
   * Retrieves the specified data from the server. Additionally initializes all the marker on the map
   * and stores references to each individual popup to update their text when the model changes.
   */
  $scope.getData = function() {
    console.log("Called getData Successfully with target " + $scope.selectedSimulation.name);
    $http({
      method: 'get',
      url: '/data/all'
    }).then(function successCallback(response) {
      // clear everything so we have a clean map
      circleVis.clearLayers();
      mapManager.cities.clearLayers();
      mapManager.camps.clearLayers();
      
      $scope.dataSet = new TimedData(response.data);
      let now = $scope.dataSet.getCurrentData();
      for (let i = 0; i < now.locations.length; i++)
      {
        let location = now.locations[i];
        $scope.initMarker(location, i);
        globals.locationMapping[location.name] = { id: i, marker: 1 };
        circleVis.createCircle(location);
      }
      for (let i = 0; i < now.links.length; i++)
      {
        circleVis.createLine(now.links[i]);
      }
      $scope.locations = now.locations;
      $scope.endStep = $scope.dataSet.endStep;
      $scope.ready = true;
    });
  };
  
  /**
   * Function that updates the model with the internal data of the data set. To be called whenever the internal data
   * set changes. This function also updates all popups with the new model information. It should contain all
   * updates for observers which angularjs does not handle on its own.
   *
   * Assumes no locations are added during runtime.
   */
  $scope.myUpdateData = function() {
    if (!$scope.ready)
    {
      // ng-change is called for timeline immediately, which will fail since the data gets set later.
      // ng-hide doesn't deactivate this behaviour so we have to check for undefined here.
      return;
    }
    $scope.locations = $scope.dataSet.getCurrentData().locations;
    $scope.links = $scope.dataSet.getCurrentData().links;
    $scope.currentDate = $scope.simStepToDate();
    
    circleVis.reset();
  
    if (heatmapVis.isActive())
    {
      heatmapVis.updateHeatmap($scope.locations);
    }
    
    for (let i = 0; i < $scope.locations.length; i++)
    {
      let location = $scope.locations[i];
      
      $scope.updatePopup($scope.popups[i], location);
      
      if (circleVis.isCircleActive())
      {
        circleVis.createCircle(location);
      }
    }
  
    if (circleVis.isLineActive())
    {
      for (let i = 0; i < $scope.links.length; i++)
      {
        circleVis.createLine($scope.links[i])
      }
    }
  };
  
  /**
   * Initializes all camp and city markers on the map. Defines the first popup and registers them to the controller
   * so they can be updated when the model changes.
   * @param location Location data from data set
   */
  $scope.initMarker = function(location) {
    var marker = null;
    if (location.camp)
    {
      marker = L.marker([location.lat, location.lng], { icon: mapManager.campMarker }).bindPopup(location.name + "<br>" +
        "Capacity: " + location.capacity + "<br>" +
        "Refugees: " + location.refugees);
      mapManager.camps.addLayer(marker);
    }
    else
    {
      marker = L.marker([location.lat, location.lng], { icon: mapManager.cityMarker }).bindPopup(location.name + "<br>" +
        "Population: " + location.pop + "<br>" +
        "Refugees: " + location.refugees);
      mapManager.cities.addLayer(marker);
    }
    $scope.popups.push(marker.getPopup());
  };
  
  /**
   * Updates all registered popups with the data contained in the current model.
   * @param popup Popup to update
   * @param location Location from which to take the data from. Retrieved from $scope.locations using the same id
   */
  $scope.updatePopup = function(popup, location) {
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
  };
  
  // Timeline related functions
  /**
   * Advance the time step by one; internal representation gets updated and then the scope update method is called.
   */
  $scope.advance = function() {
    $scope.dataSet.nextStep();
    $scope.myUpdateData();
  };
  
  $scope.forward = function() {
    $scope.stop();
    $scope.dataSet.nextStep();
    $scope.myUpdateData();
  };
  
  $scope.back = function() {
    $scope.stop();
    $scope.dataSet.previousStep();
    $scope.myUpdateData();
  };
  
  $scope.beginning = function() {
    $scope.stop();
    $scope.dataSet.gotoStep(0);
    $scope.myUpdateData();
  };
  
  $scope.end = function() {
    $scope.stop();
    $scope.dataSet.gotoStep($scope.endStep);
    $scope.myUpdateData();
  };
  
  $scope.play = function() {
    console.log("Play pressed");
    if ($scope.dataSet.end())
    {
      return;
    }
    if (!$scope.playing)
    {
      console.log("Starting play");
      $scope.playing = true;
      var promise = $interval(function() {
        if (!$scope.playing)
        {
          console.log("Pausing");
          $interval.cancel(promise);
          return;
        }
        
        $scope.advance();
        
        if ($scope.dataSet.end())
        {
          console.log("Simulation ended");
          $interval.cancel(promise);
        }
      }, $scope.msPerTick / $scope.simulationSpeed);
      promise.then(function() {
        console.log("Promise: Interval resolved");
        $scope.playing = false;
      }).catch(function() {
        console.log("Promise: Interval rejected");
        $scope.playing = false;
      });
    }
    else
    {
      $scope.playing = false;
    }
  };
  
  $scope.stop = function() {
    $scope.playing = false;
  };
  
  // Helpers
  $scope.simStepToDate = function() {
    let current_date = new Date($scope.startDate.valueOf());
    current_date.setDate($scope.startDate.getDate() + $scope.dataSet.currentStep);
    return current_date;
  };
  
  $scope.formatDate = function(date) {
    let month = date.getMonth() + 1;
    if (month < 10) { month = "0" + month; }
    let day = date.getDate();
    if (day < 10) { day = "0" + day; }
    return date.getFullYear() + "-" + month + "-" + day;
  };
  
  $scope.dbg = function() {
    console.log($scope.selectedSimulation);
  };
}]);