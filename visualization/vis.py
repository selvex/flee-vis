from flee import SimulationSettings
from flee.flee import Location
from flee.flee import Link
import json

class VisManager:
  def __init__(self, output_file = ''):
    if output_file == '':
      output_file = SimulationSettings.SimulationSettings.DefaultVisPath / "all.json"
    self.output_file = open(output_file, "w")
    if not self.output_file.writable():
      raise ValueError("Cant write to visualization output file")
    self.data = []

  def visFormat(self):
    return {
      'actors': [],
      'locations': [],
      'links': []
    }

  def addTimeStep(self):
    self.data.append(self.visFormat())
    return len(self.data) - 1

  def addLocationDataAtTime(self, t, locations):
    formatted_locations = []
    formatted_links = []
    for id, location in enumerate(locations):
      formatted_locations.append({
        "lat": location.x,
        "lng": location.y,
        "pop": location.pop,
        "refugees": location.numAgents,
        "name": location.name,
        "camp": location.camp,
        "capacity": location.capacity
      })

      for link in location.links:
        formatted_links.append({
          "from": {
            "name": location.name,
            "lat": location.x,
            "lng": location.y
          },
          "to": {
            "name": link.endpoint.name,
            "lat": link.endpoint.x,
            "lng": link.endpoint.y
          },
          "distance": link.distance,
          "refugees": link.numAgents,
          "forced": link.forced_redirection
        })
    self.data[t]["locations"] = formatted_locations
    self.data[t]["links"] = formatted_links

  def addPersonDataAtTime(self, t, person):
    self.data[t]['actors'].append(person.getVisData())

  def saveVisData(self):
    json.dump(self.data, self.output_file)
    self.output_file.close()