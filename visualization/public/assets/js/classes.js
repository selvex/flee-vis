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
      min: 0,
      data: []
    };
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
    const scaled_locations = locations.map(function(location, index) {
      let scaled_location = Object.create(location);
      scaled_location.refugees = location.refugees === 0 ? 0 : Math.log(location.refugees);
      return scaled_location;
    });
    this.layer.setData(this.buildConfig(scaled_locations));
  }
  
  /**
   * Set the max and min value for the heatmap visualization.
   * @param max Max value of the heatmap (results in red spot)
   * @param min Min value of heatmap. Places with values lower then this are not rendered.
   */
  setMaxMin(max = 10000, min = 0)
  {
    this.defaultConfig.max = max;
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
      color: '#7BD9E8', fillOpacity: 0.5
    };
    this.colorConfigs['lightgreen'] = {
      color: '#42E833', fillOpacity: 0.5
    };
    this.colorConfigs['lightred'] = {
      color: '#FE4F4B', fillOpacity: 0.5
    };
    
    this.defaultRadiusMultiplier = 15;
  
    this.setupLinkThresholds(1000);
    this.setupCircleThresholds(30000);
  
    /**
     * We have to redraw routes after zoom. This ensures the half-edge is displayed correctly.
     * @type {CircleVisManager}
     */
    let that = this;
    this.map.on('zoomend', function() {
      that.redrawRoutes();
    })
  }
  
  /**
   * Set up the values needed for choosing which color is given to a specific link. Takes the maximum amount
   * of agents on a link from the meta data and defines thresholds for the different colors.
   * @param maxAgentsOnLink
   */
  setupLinkThresholds(maxAgentsOnLink)
  {
    this.maxOnLink = Math.log(maxAgentsOnLink);
    const thresholds = Math.floor(this.maxOnLink / 3);
    this.linkMiddleThreshold = thresholds;
    this.linkFinalThreshold = thresholds * 2;
  }
  
  /**
   * Set up the values needed for choosing which color is given to a specific circle. Takes the maximum amount
   * of agents on a location from the meta data and defines thresholds for the different colors.
   * @param maxAgentsOnLocation
   */
  setupCircleThresholds(maxAgentsOnLocation)
  {
    this.maxOnLocation = Math.log(maxAgentsOnLocation);
    const thresholds = Math.floor(maxAgentsOnLocation / 3);
    this.locationMiddleThreshold = Math.log(thresholds);
    this.locationFinalThreshold = Math.log(thresholds * 2);
  }
  
  /**
   * Set the default radius multiplier.
   * @param radiusMultiplier {int} Radius multiplier to use.
   */
  setRadiusMultiplier(radiusMultiplier)
  {
    this.defaultRadiusMultiplier = radiusMultiplier;
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
    let scaled_num_agents = Math.log(location.refugees);
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
    
    let scaled_num_agents = link.forced ? -1 : Math.log(link.refugees);
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
  
  /**
   * Sanity check.
   */
  test()
  {
    console.log("Called");
  }
}