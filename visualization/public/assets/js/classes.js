/**
 * Helper class providing functions for handling time series data.
 */
class TimedData
{
  /**
   * @param data JS array; index of an element is the associated time step
   */
  constructor(data)
  {
    this.internal = Object.create(null);
    this.data = this.buildConfig([]);
    
    this.currentStep = 0;
    this.endStep = data.length - 1;

    this.internal = data;
  }
  
  /**
   * Helper function in case the internal presentation of the data has to be processed before using it.
   * When extending this class this function can be overridden to format the data before working with it.
   * @param data All the necessary data associated with a single time step
   * @returns {*} Formatted data; in the default case does nothing
   */
  buildConfig(data)
  {
    return data;
  }
  
  /**
   * Get the data for the current time step.
   * @returns {*} All the data associated with the current time step
   */
  getCurrentData()
  {
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  /**
   * Moves the internal representation to the next element of the time series data.
   * If we are already at the end, nothing happens.
   * @returns {*} All the data associated with the next (but now current) time step
   */
  nextStep()
  {
    if (this.end()) return;
    this.currentStep++;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  /**
   * Moves the internal representation to the previous element of the time series data.
   * If we are at the start, nothing happens.
   * @returns {*} All the data associated with the previous (but now current) time step
   */
  previousStep()
  {
    if (this.currentStep === 0) return;
    this.currentStep--;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  /**
   * Moves the internal representation to a given point in time.
   * @param t Time step to move to
   * @returns {*} All the data associated with the given (and now current) time step
   */
  gotoStep(t)
  {
    if (t < 0 || t > this.internal.length) return;
    this.currentStep = t;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  /**
   * Helper function to check if we reached the end of the data.
   * @returns {boolean} true if we are at the end, false otherwise
   */
  end()
  {
    return this.currentStep === this.endStep;
  }
  
  /**
   * Helper function that returns the state of the simulation
   * in the final time step.
   * @returns {*} The last time step.
   */
  lastStep()
  {
    return this.buildConfig(this.internal[this.endStep]);
  }
  
  getPreviousStep()
  {
    if (this.currentStep === 0) return this.buildConfig(this.internal[this.currentStep]);
    return this.buildConfig(this.internal[this.currentStep - 1]);
  }
  
  prepareLocationAndLinkData()
  {
    this.locationValues = new Set();
    this.linkValues = new Set();
    this.maxDiff = -1;
    for (let i = 0; i < this.internal.length; i++)
    {
      for (let j = 0; j < this.internal[i]["locations"].length; j++)
      {
        this.locationValues.add(this.internal[i]["locations"][j].refugees);
        if (i > 0)
        {
          let previous = this.internal[i - 1]["locations"][j].refugees;
          let current = this.internal[i]["locations"][j].refugees;
          let difference = current - previous;
          this.internal[i]["locations"][j].difference = difference;
          if (Math.abs(difference) > this.maxDiff)
          {
            this.maxDiff = Math.abs(difference);
          }
        }
        else
        {
          this.internal[i]["locations"][j].difference = 0;
        }
      }
      for (let j = 0; j < this.internal[i]["links"].length; j++)
      {
        this.linkValues.add(this.internal[i]["links"][j].refugees);
      }
    }
    
    this.locationValues = Array.from(this.locationValues);
    this.linkValues = Array.from(this.linkValues);
    
    this.locationValues.sort((a, b) => a - b);
    this.linkValues.sort((a, b) => a - b);
  }
}

/**
 * Contains functions for everything related to the heatmap visualization.
 */
class HeatmapManager
{
  /**
   * @param map Reference to the leaflet map. Used to check if layer is active
   * @param layer Reference to the layer we are using
   * @param max Maximum value for heatmap. All values higher than this will result in the same red circle.
   */
  constructor(map, layer, max = 10000)
  {
    this.map = map;
    this.layer = layer;
    this.defaultConfig = {
      max: max,
      min: 1,
      data: []
    };
    this.scalingMethod = new ScalingTool();
  }
  
  /**
   * Helper function that returns true if the heatmap visualization is currently showing.
   * @returns {boolean} True if heatmap is currently visible, false otherwise
   */
  isActive()
  {
    return this.map.hasLayer(this.layer);
  }
  
  /**
   * Deletes all points from the heatmap.
   */
  reset()
  {
    this.layer.setData(this.defaultConfig);
  }
  
  /**
   * Adds a location to the data.
   * However heatmapjs is much more efficient when setting all the data at once. Use updateHeatmap instead.
   * @param location
   */
  addLocation(location)
  {
    this.layer.addData(location);
  }
  
  /**
   * Update the heatmap visualization with the data given in the locations array
   * @param locations JS array containing all locations to be displayed. Locations need to contain
   * the fields: lat, lng, refugees. See flee-vis.js for field definitions.
   */
  updateHeatmap(locations)
  {
    let that = this;
    const scaled_locations = locations.map(function(location, index) {
      let scaled_location = Object.create(location);
      scaled_location.refugees = that.scalingMethod.scale(location.refugees);
      return scaled_location;
    });
    this.layer.setData(this.buildConfig(scaled_locations));
  }
  
  /**
   * Set the max and min value for the heatmap visualization.
   * @param max Max value of the heatmap (results in red spot)
   * @param min Min value of heatmap. Places with values lower then this are not rendered.
   */
  setMaxMin(max = 10000, min = 1)
  {
    this.defaultConfig.max = this.scalingMethod.scale(max);
    this.defaultConfig.min = min;
  }
  
  /**
   * Helper function that returns the correct object structure needed for the heatmap visualization to work.
   * @param data Array containing the locations to visualize.
   * @returns {({max: number, min: number, data: Array} & {data: *}) | *} Returns object of the correct structure to use
   * with heatmapjs.
   */
  buildConfig(data)
  {
    let preped_data = Object.create(this.defaultConfig);
    preped_data.data = data;
    return preped_data;
  }
  
  reconfigure(cfg)
  {
    this.layer.reconfigure(cfg);
  }
}

/**
 * Contains functions for everything related to the circle and line visualization.
 */
class CircleVisManager
{
  /**
   * @param map Reference to the map to check if layer is active.
   * @param circleLayer The layer the objects of the circle visualization are drawn on.
   * @param lineLayer The layer the objects for the line visualization (routes) are drawn on.
   */
  constructor(map, circleLayer, lineLayer)
  {
    this.map = map;
    this.circleLayer = circleLayer;
    this.lineLayer = lineLayer;
    
    this.circles = [];
    this.lines = [];
    this.popups = [];
    
    this.scalingMethod = new ScalingTool();
  
    /**
     * Hashmap of color configurations for drawing poly-lines and circles.
     * @type {Object}
     */
    this.colorConfigs = Object.create(null);
    this.colorConfigs['red'] = {
      color: 'red', fillColor: '#f03', fillOpacity: 0.5
    };
    this.colorConfigs['blue'] = {
      color: 'blue', fillColor: '#03f', fillOpacity: 0.5
    };
    this.colorConfigs['green'] = {
      color: 'green', fillColor: '#3f0', fillOpacity: 0.5
    };
    this.colorConfigs['yellow'] = {
      color: 'yellow', fillColor: '#ff6', fillOpacity: 0.5
    };
    this.colorConfigs['lightblue'] = {
      color: '#1C9BFF', fillOpacity: 0.5
    };
    this.colorConfigs['lightgreen'] = {
      color: '#42E833', fillOpacity: 0.5
    };
    this.colorConfigs['lightred'] = {
      color: '#FE4F4B', fillOpacity: 0.5
    };
    
    this.defaultRadiusMultiplier = 15;
  
    /**
     * We have to redraw routes after zoom. This ensures the half-edge is displayed correctly.
     * @type {CircleVisManager}
     */
    let that = this;
    this.map.on('zoomend', function() {
      that.redrawRoutes();
    })
  }
  
  setupGlobalThresholds(dataSet)
  {
    let locations = dataSet.locationValues;
    let links = dataSet.linkValues;
  
    let location_thresh = this.calculateGlobalThresholds(locations);
    let link_thresh = this.calculateGlobalThresholds(links, true);
  
    this.maxOnLocation = location_thresh.max;
    this.locationMiddleThreshold = location_thresh.middleThreshold;
    this.locationFinalThreshold = location_thresh.finalThreshold;
  
    this.maxOnLink = link_thresh.max;
    this.linkMiddleThreshold = link_thresh.middleThreshold;
    this.linkFinalThreshold = link_thresh.finalThreshold;
  }
  
  setupThresholds(lastStep)
  {
    let locations = lastStep['locations'];
    let links = lastStep['links'];
  
    let location_thresh = this.calculateThresholdsForStep(locations);
    let link_thresh = this.calculateThresholdsForStep(links, true);
  
    this.maxOnLocation = location_thresh.max;
    this.locationMiddleThreshold = location_thresh.middleThreshold;
    this.locationFinalThreshold = location_thresh.finalThreshold;
  
    this.maxOnLink = link_thresh.max;
    this.linkMiddleThreshold = link_thresh.middleThreshold;
    this.linkFinalThreshold = link_thresh.finalThreshold;
  }
  
  calculateThresholdsForStep(data, link = false)
  {
    let data_copy = data.slice(0);
    let numbers = data_copy.map(function(location) {
      return location.refugees;
    });
    
    numbers = numbers.filter(function(number) {
      return number !== 0;
    });
    
    numbers.sort((a, b) => a - b);
  
    let that = this;
    let scaled_sorted_locations = numbers.map(function(location) {
      if (link)
      {
        return that.scalingMethod.scaleLink(location);
      }
      return that.scalingMethod.scale(location);
    });
  
    let max = scaled_sorted_locations[scaled_sorted_locations.length - 1];
  
    const threshold_index = Math.floor(scaled_sorted_locations.length / 3);
  
    let middle_thresh = scaled_sorted_locations[threshold_index];
    let final_thresh = scaled_sorted_locations[threshold_index * 2];
    
    return {max: max, middleThreshold: middle_thresh, finalThreshold: final_thresh};
  }
  
  calculateGlobalThresholds(data, link = false)
  {
    let that = this;
    let scaled_sorted_locations = data.map(function(location) {
      if (link)
      {
        return that.scalingMethod.scaleLink(location);
      }
      return that.scalingMethod.scale(location);
    });
  
    let max = scaled_sorted_locations[scaled_sorted_locations.length - 1];
  
    const threshold_index = Math.floor(scaled_sorted_locations.length / 3);
  
    let middle_thresh = scaled_sorted_locations[threshold_index];
    let final_thresh = scaled_sorted_locations[threshold_index * 2];
  
    return {max: max, middleThreshold: middle_thresh, finalThreshold: final_thresh};
  }
  
  /**
   * Set the default radius multiplier.
   * @param maxRadius maximum radius for a circle
   * @param maxActorCount maximum amount of actors at one location
   */
  setRadiusMultiplier(maxRadius, maxActorCount)
  {
    this.defaultRadiusMultiplier = maxRadius / this.scalingMethod.scale(maxActorCount);
  }
  
  /**
   * Delete all circles and lines currently drawn.
   */
  clearLayers()
  {
    this.circleLayer.clearLayers();
    this.lineLayer.clearLayers();
  }
  
  /**
   * Given an array of locations, draw all circles for those locations.
   * @param locations Array of locations containing lat, lng and agent count.
   */
  createAll(locations)
  {
    for (let i = 0; i < locations.length; i++)
    {
      this.createCircle(locations[i]);
    }
  }
  
  /**
   * Draw a circle for the given location.
   * @param location Object containing lat, lng and agent count.
   */
  createCircle(location)
  {
    if (location.refugees === 0) return;
    let scaled_num_agents = this.scalingMethod.scale(location.refugees);
    let chosen_color = "blue";
  
    if (scaled_num_agents > this.locationFinalThreshold)
    {
      chosen_color = "red";
    }
    else if (scaled_num_agents > this.locationMiddleThreshold)
    {
      chosen_color = "green";
    }
    let cfg = Object.create(this.colorConfigs[chosen_color]);
    cfg.radius = scaled_num_agents * this.defaultRadiusMultiplier;
    
    let circle = L.circleMarker([location.lat, location.lng], cfg);
    this.circles.push(circle);
    this.circleLayer.addLayer(circle);
  }
  
  /**
   * If circle layer is currently shown on the map.
   * @returns {boolean} True if circle layer is activated, false otherwise.
   */
  isCircleActive()
  {
    return this.map.hasLayer(this.circleLayer);
  }
  
  /**
   * If line layer is currently shown on the map.
   * @returns {boolean} True if line layer is activated, false otherwise.
   */
  isLineActive()
  {
    return this.map.hasLayer(this.lineLayer);
  }
  
  /**
   * Given a link, draw a line from start point to end point.
   * @param link Object containing from.lat|lng, to.lat|lng and agent count.
   */
  createLine(link)
  {
    if (link.refugees === 0 && !link.forced) return;
    let points = [
      [link.from.lat, link.from.lng],
      [link.to.lat, link.to.lng]
    ];
  
    let chosen_color = "lightblue";
    
    let scaled_num_agents = link.forced ? -1 : this.scalingMethod.scaleLink(link.refugees);
    if (scaled_num_agents > this.linkFinalThreshold)
    {
      chosen_color = "lightred";
    }
    else if (scaled_num_agents > this.linkMiddleThreshold)
    {
      chosen_color = "lightgreen";
    }
  
    if (link.forced)
    {
      chosen_color = "blue";
    }
    let cfg = Object.create(this.colorConfigs[chosen_color]);
    cfg.weight = 3;
    
    cfg.offset = 5;
  
    points.push(this.getPointForHalfedge(points));
  
    let line = L.polyline(points, cfg);
    line.bindPopup("Route from " + link.from.name + " to " + link.to.name + "<br>" +
    "Refugees: " + link.refugees
    );
  
    this.lineLayer.addLayer(line);
    this.lines.push(line);
  }
  
  /**
   * Update all points that are used to turn routes into half-edges and redraw them on the map.
   * Used when the map is zoomed to correctly display half-edges.
   */
  redrawRoutes()
  {
    for (let i = 0; i < this.lines.length; i++)
    {
      let line = this.lines[i];
      
      let points = line.getLatLngs();
      points.pop();
      points.push(this.getPointForHalfedge(points));
      line.setLatLngs(points);
    }
  }
  
  /**
   * Given two points finds a third point such that the line looks like an arrow pointing in the direction
   * from the first point to the second point. We only draw one side of the arrow and therefore get a half-edge.
   * @param points Array of two points given in lat, lng.
   * @returns {L.LatLng} LatLng object to draw the third point on the map creating a half-edge like shape when used
   * with the given points.
   */
  getPointForHalfedge(points)
  {
    let projected_points = [this.map.latLngToLayerPoint(points[0]), this.map.latLngToLayerPoint(points[1])];
    let segmentAngle = Math.atan2(projected_points[0].y - projected_points[1].y, projected_points[0].x - projected_points[1].x);
    let offsetAngle = segmentAngle - (Math.PI) / 4;
  
    let halfedge_arrow = {
      x: projected_points[1].x + 30 * Math.cos(offsetAngle),
      y: projected_points[1].y + 30 * Math.sin(offsetAngle),
    };
    return this.map.layerPointToLatLng(halfedge_arrow);
  }
  
  /**
   * Delete all drawn circles and lines and delete all internal references.
   */
  reset()
  {
    this.circleLayer.clearLayers();
    this.lineLayer.clearLayers();
    this.circles = [];
    this.lines = [];
  }
}

/**
 * Contains functions for everything related to the difference set visualization.
 */
class DifferenceSetManager extends HeatmapManager
{
  /**
   * Update the heatmap visualization with the data given in the locations array
   * @param locations JS array containing all locations to be displayed. Locations need to contain
   * the fields: lat, lng, refugees. See flee-vis.js for field definitions.
   */
  updateHeatmap(locations)
  {
    let that = this;
    const scaled_locations = locations.map(function(location, index) {
      let scaled_location = Object.create(location);
      scaled_location.difference = that.scalingMethod.scaleDifference(Math.abs(location.difference));
      return scaled_location;
    });
    this.layer.setData(this.buildConfig(scaled_locations));
  }
  
  setMaxMin(max = 10000, min = 1)
  {
    this.defaultConfig.max = this.scalingMethod.scaleDifference(max);
    this.defaultConfig.min = min;
  }
  
  reconfigure(cfg)
  {
    let mcfg = Object.create(cfg);
    mcfg.valueField = "difference";
    this.layer.reconfigure(mcfg);
  }
}


class ScalingTool
{
  constructor()
  {
  
  }
  
  scale(value)
  {
    //console.warn("Default scaling applied, returning value as-is.");
    return value;
  }
  
  scaleLink(value)
  {
    //console.warn("Default scaleLink called");
    return this.scale(value);
  }
  
  scaleDifference(value)
  {
    //console.warn("Default scaleDifference");
    return this.scale(value);
  }
  
  describe()
  {
    return "Default Scaling tool - should not be in use.";
  }
}

class LogScaling extends ScalingTool
{
  constructor()
  {
    super();
  }
  
  scale(value)
  {
    return value === 0 ? 0 : Math.log(value);
  }
  
  scaleLink(value)
  {
    return this.scale(value);
  }
  
  scaleDifference(value)
  {
    return this.scale(value);
  }
  
  describe()
  {
    return "Logarithmic function";
  }
}

class LogisticGrowth extends ScalingTool
{
  constructor()
  {
    super();
    this.midPointDeviation = 2;
    this.config = Object.create(null);
    this.linkConfig = Object.create(null);
  }
  
  setConfig(config)
  {
    this.config = config;
  }
  
  setLinkConfig(config)
  {
    this.linkConfig = config;
  }
  
  setDifferenceConfig(config)
  {
    this.diffConfig = config;
  }
  
  scale(value)
  {
    return this.calculate(value, this.config.ceiling, this.config.growthRate, this.config.midPoint);
  }
  
  scaleLink(value)
  {
    return this.calculate(value, this.linkConfig.ceiling, this.linkConfig.growthRate, this.linkConfig.midPoint);
  }
  
  scaleDifference(value)
  {
    return this.calculate(value, this.diffConfig.ceiling, this.diffConfig.growthRate, this.diffConfig.midPoint);
  }
  
  setParameters(ceiling, growthRate, midPoint)
  {
    this.config.ceiling = ceiling;
    this.config.growthRate = growthRate;
    this.config.midPoint = midPoint;
  }
  
  setLinkParameters(ceiling, growthRate, midPoint)
  {
    this.linkConfig.ceiling = ceiling;
    this.linkConfig.growthRate = growthRate;
    this.linkConfig.midPoint = midPoint;
  }
  
  calculate(value, ceiling, growthRate, offsetParameter)
  {
    if (value === 0) return 0;
    let result = ceiling / (1 + Math.exp(-growthRate * (value - offsetParameter)));
    //console.log(result);
    //console.log(value, ceiling, growthRate, offsetParameter);
    return result;
  }
  
  calculateGrowthRate(start, end, time)
  {
    let present = end;
    let past = start;
  
    if (past === 0)
    {
      past = 1;
    }
    
    let result = present / past;
    result = Math.pow(result, 1 / time);
    result -= 1;
    return result;
  }
  
  calculateParameters(start, end, time)
  {
    let growth = this.calculateGrowthRate(start, end, time);
    return {ceiling: end, growthRate: growth, midPoint: Math.floor(time / this.midPointDeviation)};
  }
  
  describe()
  {
    return "Logistic Growth function";
  }
}

class RawScaling extends ScalingTool
{
  constructor()
  {
    super();
  }
  
  scale(value)
  {
    return value;
  }
  
  describe()
  {
    return "No scaling";
  }
}

class ScalingManager
{
  constructor()
  {
    this.scalingMethods = Object.create(null);
    this.scalingMethods['log'] = new LogScaling();
    this.scalingMethods['logisticGrowth'] = new LogisticGrowth();
    this.scalingMethods['raw'] = new RawScaling();
  }
}