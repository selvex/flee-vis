from flee import SimulationSettings
from flee.flee import Person
import json

class VisManager:
  def __init__(self, output_file = ''):
    if output_file == '':
      output_file = SimulationSettings.SimulationSettings.DefaultVisFile
    self.output_file = open(output_file, "w")
    self.data = [self.visFormat()]

  def visFormat(self):
    return {
      'actors': [],
      'locations': []
    }

  def addTimeStep(self, t):
    if len(self.data) < t:
      self.data.append(self.visFormat())

  def addPersonDataAtTime(self, t, person):
    self.data[t]['actors'].append(person.getVisData())

  def __del__(self):
    self.output_file.close()


class HeatMapManager:
  def __init__(self, output_file = ''):
    if output_file == '':
      output_file = SimulationSettings.SimulationSettings.DefaultVisFile
    self.output_file = open(output_file, "w")
    if not self.output_file.writable():
      raise ValueError("Cant write to visualization output file")
    self.data = []

  def addTimeStep(self, locations):
    formatted = []
    for id, location in enumerate(locations):
      formatted.append({
        "lat": location.x,
        "lng": location.y,
        "count": location.numAgents
      })

    self.data.append(formatted)

  def saveVisData(self):
    json.dump(self.data, self.output_file)
    self.output_file.close()
