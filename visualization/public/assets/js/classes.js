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
  constructor(layer, dataset)
  {
    this.layer = layer;
    /** @type TimedData */
    this.dataset = dataset;
    this.dataset.gotoStep(0);
    this.layer.setData(this.dataset.getCurrentData());
  }
  
  advance()
  {
    if (this.dataset.end())
    {
      this.playing = false;
      return;
    }
    this.layer.setData(this.dataset.nextStep());
  }
}