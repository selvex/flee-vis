class TimedData
{
  constructor(data)
  {
    this.internal = Object.create(null);
    this.data = this.buildConfig([]);
    
    this.currentStep = 0;
    this.endStep = data.length - 1;

    this.internal = data;
  }
  
  buildConfig(data)
  {
    return data;
  }
  
  getCurrentData()
  {
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  nextStep()
  {
    if (this.end()) return;
    this.currentStep++;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  previousStep()
  {
    if (this.currentStep === 0) return;
    this.currentStep--;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  gotoStep(t)
  {
    if (t < 0 || t > this.internal.length) return;
    this.currentStep = t;
    return this.buildConfig(this.internal[this.currentStep]);
  }
  
  end()
  {
    return this.currentStep === this.endStep;
  }
}

class TimedHeatmapData extends TimedData
{
  constructor(data)
  {
    super(data);
  }
  
  buildConfig(data)
  {
    return {
      max: 10000,
      min: 0,
      data: data
    }
  }
}

class HeatmapManager
{
  constructor(map, layer)
  {
    this.map = map;
    this.layer = layer;
    this.defaultConfig = {
      max: 10000,
      min: 0,
      data: []
    };
  }
  
  isActive()
  {
    return this.map.hasLayer(this.layer);
  }
  
  reset()
  {
    this.layer.setData(this.defaultConfig);
  }
  
  /**
   * Adds a location to the data. We use this instead of setData so we only iterate over all locations once in our
   * update function.
   * @param location
   */
  addLocation(location)
  {
    this.layer.addData(location);
  }
  
  updateHeatmap(locations, config = {empty: true})
  {
    this.layer.setData(this.buildConfig(locations, config));
  }
  
  buildConfig(data, config)
  {
    const preped_data = {data: data};
    if (config.empty)
    {
      return Object.assign(this.defaultConfig, preped_data);
    }
    else
    {
      return Object.assign(config, preped_data);
    }
  }
}

class CircleVisManager
{
  constructor(map, circleLayer, lineLayer)
  {
    this.map = map;
    this.circleLayer = circleLayer;
    this.lineLayer = lineLayer;
    
    this.circles = [];
    this.lines = [];
    this.popups = [];
  
    this.outliers = Object.create(null);
    this.outliers['Mbera'] = {radiusMultiplier: 3, color: 'blue', fillColor: '#03f', fillOpacity: 0.5};
  
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
    let that = this;
    this.map.on('zoomend', function() {
      that.redrawRoutes();
    })
  }
  
  clearLayers()
  {
    this.circleLayer.clearLayers();
    this.lineLayer.clearLayers();
  }
  
  createAll(locations)
  {
    for (let i = 0; i < locations.length; i++)
    {
      let location = locations[i];
      let circle = L.circle([location.lat, location.lng],
      {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: location.refugees * 100
      });
      this.circles.push(circle);
      this.circleLayer.addLayer(circle);
    }
  }
  
  createCircle(location)
  {
    if (location.refugees === 0) return;
    let cfg = {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5,
      radius: location.refugees * 15
    };
    if (location.name in this.outliers)
    {
      cfg = this.outliers[location.name];
      cfg.radius = location.refugees * cfg.radiusMultiplier;
    }
    let circle = L.circle([location.lat, location.lng], cfg);
    this.circles.push(circle);
    this.circleLayer.addLayer(circle);
  }
  
  isCircleActive()
  {
    return this.map.hasLayer(this.circleLayer);
  }
  
  isLineActive()
  {
    return this.map.hasLayer(this.lineLayer);
  }
  
  createLine(link)
  {
    let points = [
      [link.from.lat, link.from.lng],
      [link.to.lat, link.to.lng]
    ];
    let cfg = this.colorConfigs['green'];
    if (link.forced){
      cfg = this.colorConfigs['blue'];
    }
    cfg.weight = link.refugees > 0 ? 3 + Math.min(Math.max(Math.floor(link.refugees / 40), 0), 4) : 3;
    cfg.offset = 5;
  
    points.push(this.getPointForHalfedge(points));
  
    let line = L.polyline(points, cfg);
    line.bindPopup("Route from " + link.from.name + " to " + link.to.name + "<br>" +
    "Refugees: " + link.refugees
    );
  
    this.lineLayer.addLayer(line);
    this.lines.push(line);
  }
  
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
  
  reset()
  {
    this.circleLayer.clearLayers();
    this.lineLayer.clearLayers();
    this.circles = [];
    this.lines = [];
  }
  
  test()
  {
    console.log("Called");
  }
}