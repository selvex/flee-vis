class Logger
{
  constructor(debug)
  {
    this.debug = debug;
  }
  
  log(message, object)
  {
    if (!this.debug) return;
  
    console.log(message);
    
    if (object !== undefined)
    {
      console.log(object);
    }
  }
  error(message, object)
  {
    if (!this.debug) return;
    
    console.error(message);
    
    if (object !== undefined)
    {
      console.error(object);
    }
  }
  info(message, object)
  {
    if (!this.debug) return;
    
    console.info(message);
    
    if (object !== undefined)
    {
      console.info(object);
    }
  }
}

class ServerLogger extends Logger
{
  constructor(debug)
  {
    super(debug);
  }
}
if (typeof module !== "undefined") module.exports = new ServerLogger(true);