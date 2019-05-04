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
  $provide.factory('diffVis', ['mapManager', function(mapManager) {
    return new DifferenceSetManager(mapManager.map, mapManager.differenceSetLayer);
  }]);
  $provide.factory('logger', function() {
    return new Logger(true);
  });
  $provide.factory('scaling', function() {
    return new ScalingManager();
  });
}]);


app.controller('fleeVisController', ['$scope', '$http', '$interval', '$timeout', 'mapManager','circleVis', 'heatmapVis', 'diffVis', 'logger', 'scaling', function($scope, $http, $interval, $timeout, mapManager, circleVis, heatmapVis, diffVis, logger, scaling) {
  $scope.marker = [];
  $scope.playing = false;
  $scope.endStep = 500;
  $scope.ready = false;
  $scope.startDate = new Date("2019-02-29");
  $scope.currentDate = $scope.startDate;
  $scope.showSettings = true;
  $scope.collapse = {};
  $scope.timelinePromise = new Promise(function(resolve, reject) {
    resolve();
  });
  /**
   * Two options:
   * - using circle markers
   * - using circles
   * When using circle markers this define the maximum radius in pixel. The circle markers will scale with the current
   * zoom level, which means they will always be the same size regardless of zoom.
   * When using circles this defines the maximum radius in meters. The circles will always occupy the same space, meaning
   * if we zoom the circle also gets bigger.
   * @type {number}
   */
  $scope.maxRadius = 50;
  $scope.msPerTick = 1000;
  
  $scope.availableSimulations = Object.create(null);
  $scope.selectedSimulation = Object.create(null);
  $scope.loadedSimulation = Object.create(null);
  $scope.meta = Object.create(null);
  
  $scope.scalingMethods = scaling.scalingMethods;
  
  $scope.defaultSettings = {
    map: {
      height: 720
    },
    heatmap: {
      radius: 1,
      maxOpacity: 0.8,
      scaleRadius: true,
      useLocalExtrema: false,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'refugees'
    },
    scalingMethod: 'log',
    logisticGrowth: {
      internal: {},
      midPointDeviation: 12
    },
    simulationSpeed: 15.0
  };
  
  $scope.settings = {
    map: {
      height: $scope.defaultSettings.map.height
    },
    heatmap: {
      radius: $scope.defaultSettings.heatmap.radius,
      maxOpacity: $scope.defaultSettings.heatmap.maxOpacity,
      scaleRadius: $scope.defaultSettings.heatmap.scaleRadius,
      useLocalExtrema: $scope.defaultSettings.heatmap.useLocalExtrema,
      latField: $scope.defaultSettings.heatmap.latField,
      lngField: $scope.defaultSettings.heatmap.lngField,
      valueField: $scope.defaultSettings.heatmap.valueField
    },
    scalingMethod: $scope.defaultSettings.scalingMethod,
    logisticGrowth: {
      internal: {},
      midPointDeviation: $scope.defaultSettings.logisticGrowth.midPointDeviation
    },
    simulationSpeed: $scope.defaultSettings.simulationSpeed
  };
  
  $scope.fetchAvailableSimulations = function() {
    return $http({
      method: 'get',
      url   : '/data/available-simulations'
    }).then(function successCallback(response) {
      $scope.availableSimulations = response.data;
      if ($scope.availableSimulations.length < 1)
      {
        logger.error("No simulations available");
        return;
      }
      $scope.selectedSimulation = $scope.availableSimulations[0];
    })
    .catch(function error(error) {
      logger.error("Could not fetch available simulations. Server probably not running.");
    });
  };
  
    /**
   * Retrieves the specified data from the server. Additionally initializes all the marker on the map
   * and stores references to each individual popup to update their text when the model changes.
   */
  $scope.getData = function() {
    logger.log("Called getData Successfully with target " + $scope.selectedSimulation.name);
    $http({
      method: 'get',
      url: '/data/' + $scope.selectedSimulation.name
    }).then(function successCallback(response) {
      $scope.loadedSimulation = response.data.meta;
      
      // clear everything so we have a clean map
      circleVis.clearLayers();
      mapManager.cities.clearLayers();
      mapManager.camps.clearLayers();
      heatmapVis.reset();
      diffVis.reset();
      $scope.marker = [];
  
      $scope.dataSet = new TimedData(response.data.data);
      $scope.dataSet.prepareLocationAndLinkData();
  
      let last_step = $scope.dataSet.lastStep();
      let max_location = response.data.meta.maxForLocation;
      let max_link = response.data.meta.maxForLink;
      let max_diff = $scope.dataSet.maxDiff;
      let sim_length = response.data.data.length;
      $scope.meta = Object.assign({}, response.data.meta);
  
      if ($scope.settings.scalingMethod === 'logisticGrowth')
      {
        $scope.setupLogisticGrowth(max_location, max_link, max_diff);
      }
  
      let scalingMethod = scaling.scalingMethods[$scope.settings.scalingMethod];
      heatmapVis.scalingMethod = scalingMethod;
      diffVis.scalingMethod = scalingMethod;
      circleVis.scalingMethod = scalingMethod;
      
      heatmapVis.setMaxMin(max_location);
      diffVis.setMaxMin(max_diff);
      circleVis.setRadiusMultiplier($scope.maxRadius, max_location);
  
      circleVis.setupGlobalThresholds($scope.dataSet);
      
      mapManager.map.panTo(response.data.meta.center);
  
      $scope.startDate = new Date(response.data.meta.start_date);
      $scope.currentDate = $scope.startDate;
      
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
  
    if (diffVis.isActive())
    {
      diffVis.updateHeatmap($scope.locations);
    }
    
    for (let i = 0; i < $scope.locations.length; i++)
    {
      let location = $scope.locations[i];
      
      $scope.updatePopup($scope.marker[i].getPopup(), location);
      
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
  
  $scope.updateMap = function() {
    mapManager.map.invalidateSize();
  };
  
  $scope.updateHeatmap = function() {
    if (heatmapVis.isActive())
    {
      heatmapVis.reconfigure($scope.settings.heatmap);
    }
    if (diffVis.isActive())
    {
      diffVis.reconfigure($scope.settings.heatmap);
    }
  };
  
  $scope.updateHeatmapScaleRadius = function() {
    if (heatmapVis.isActive() || diffVis.isActive())
    {
      if ($scope.settings.heatmap.scaleRadius)
      {
        $scope.settings.heatmap.radius = 1;
      }
      else
      {
        $scope.settings.heatmap.radius = 10;
      }
  
      $scope.updateHeatmap();
    }
  };
  
  $scope.updateScaleMethod = function() {
    if ($scope.settings.scalingMethod === 'logisticGrowth')
    {
      $scope.setupLogisticGrowth($scope.meta.maxForLocation, $scope.meta.maxForLink, $scope.dataSet.maxDiff);
    }
  
    let scalingMethod = scaling.scalingMethods[$scope.settings.scalingMethod];
    heatmapVis.scalingMethod = scalingMethod;
    diffVis.scalingMethod = scalingMethod;
    circleVis.scalingMethod = scalingMethod;
  
    heatmapVis.setMaxMin($scope.meta.maxForLocation);
    diffVis.setMaxMin($scope.dataSet.maxDiff);
    circleVis.setRadiusMultiplier($scope.maxRadius, $scope.meta.maxForLocation);
  
    circleVis.setupGlobalThresholds($scope.dataSet);
    $scope.myUpdateData();
  };
  
  $scope.setupLogisticGrowth = function(maxLocation, maxLink, maxDiff) {
    $scope.settings.logisticGrowth.internal.location = {};
    $scope.settings.logisticGrowth.internal.link = {};
    $scope.settings.logisticGrowth.internal.difference = {};
  
    scaling.scalingMethods['logisticGrowth'].midPointDeviation = $scope.settings.logisticGrowth.midPointDeviation;
    $scope.settings.logisticGrowth.internal.location = scaling.scalingMethods['logisticGrowth'].calculateParameters(0, maxLocation, maxLocation);
    $scope.settings.logisticGrowth.internal.link = scaling.scalingMethods['logisticGrowth'].calculateParameters(0, maxLink, maxLink);
    $scope.settings.logisticGrowth.internal.difference = scaling.scalingMethods['logisticGrowth'].calculateParameters(0, maxDiff, maxDiff);
  
    scaling.scalingMethods['logisticGrowth'].setConfig($scope.settings.logisticGrowth.internal.location);
    scaling.scalingMethods['logisticGrowth'].setLinkConfig($scope.settings.logisticGrowth.internal.link);
    scaling.scalingMethods['logisticGrowth'].setDifferenceConfig($scope.settings.logisticGrowth.internal.difference);
  };
  
  $scope.updateLogistic = function() {
    let scalingMethod = scaling.scalingMethods[$scope.settings.scalingMethod];
    
    heatmapVis.setMaxMin($scope.meta.maxForLocation);
    diffVis.setMaxMin($scope.dataSet.maxDiff);
    circleVis.setRadiusMultiplier($scope.maxRadius, $scope.meta.maxForLocation);
  
    circleVis.setupGlobalThresholds($scope.dataSet);
    $scope.myUpdateData();
  };
  
  $scope.toggleSettings = function() {
    $scope.showSettings = !$scope.showSettings;
    // invalidate map size after toggling settings to prevent weird behaviour
    $timeout($scope.updateMap, 50).then(function() {
      $('.tutorial').tooltip();
    });
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
    $scope.marker.push(marker);
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
  
  $scope.zoomTo = function(index) {
    let location = $scope.locations[index];
    $scope.marker[index].openPopup();
    mapManager.map.setView([location.lat, location.lng]);
  };
  
  $scope.updateSimulationSpeed = function() {
    if ($scope.playing)
    {
      $scope.stop();
    }
  };
  
  // Timeline related functions
  /**
   * Advance the time step by one; internal representation gets updated and then the scope update method is called.
   */
  $scope.advance = function() {
    $scope.dataSet.nextStep();
    $scope.myUpdateData();
  };
  
  /**
   * Advance the time step by one and stop if playing
   */
  $scope.forward = function() {
    $scope.stop();
    $scope.dataSet.nextStep();
    $scope.myUpdateData();
  };
  
  /**
   * Go back one time step and stop if playing
   */
  $scope.back = function() {
    $scope.stop();
    $scope.dataSet.previousStep();
    $scope.myUpdateData();
  };
  
  /**
   * Go to the first time step and stop if playing
   */
  $scope.beginning = function() {
    $scope.stop();
    $scope.dataSet.gotoStep(0);
    $scope.myUpdateData();
  };
  
  /**
   * Go to the last time step and stop if playing
   */
  $scope.end = function() {
    $scope.stop();
    $scope.dataSet.gotoStep($scope.endStep);
    $scope.myUpdateData();
  };
  
  /**
   * Start automatically advancing the timeline
   */
  $scope.play = function() {
    if ($scope.dataSet.end())
    {
      return;
    }
    if (!$scope.playing)
    {
      $scope.playing = true;
      $scope.timelinePromise = $interval(function() {
        if (!$scope.playing)
        {
          $interval.cancel($scope.timelinePromise);
          return;
        }
        
        $scope.advance();
        
        if ($scope.dataSet.end())
        {
          $scope.stop();
        }
      }, $scope.msPerTick / $scope.settings.simulationSpeed);
      $scope.timelinePromise.then(function() {
        $scope.playing = false;
      }).catch(function() {
        $scope.playing = false;
      });
    }
    else
    {
      $scope.playing = false;
    }
  };
  /**
   * Stop automatically advancing the timeline
   */
  $scope.stop = function() {
    $scope.playing = false;
  };
  
  // Helpers
  /**
   * Tranforms the current timestep into a JS Date object
   * @returns {Date} the date representation of the current timestep
   */
  $scope.simStepToDate = function() {
    let current_date = new Date($scope.startDate.valueOf());
    current_date.setDate($scope.startDate.getDate() + $scope.dataSet.currentStep);
    return current_date;
  };
  
  /**
   * Transforms the given JS Date object into a human readable string
   * @param date JS Date object which should be formatted
   * @returns {string} human readable string representing date
   */
  $scope.formatDate = function(date) {
    let month = date.getMonth() + 1;
    if (month < 10) { month = "0" + month; }
    let day = date.getDate();
    if (day < 10) { day = "0" + day; }
    return date.getFullYear() + "-" + month + "-" + day;
  };
  
  $scope.dbg = function() {
    $scope.showSettings = !$scope.showSettings;
  };
  
  // Events that use functions defined above
  /**
   * When activating an overlay (like heatmap) we update the map to already show it on the map.
   */
  mapManager.map.on('overlayadd', $scope.myUpdateData);
  
  $scope.fetchAvailableSimulations().then(function() {
    $timeout($scope.getData(), 500).then(function() {
      $scope.toggleSettings();
    });
  });
}]);