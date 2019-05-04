import flee.flee as flee
import datamanager.handle_refugee_data as handle_refugee_data
import numpy as np
import outputanalysis.analysis as a
import visualization.vis
from flee import InputGeography
from datetime import datetime
from datetime import timedelta


"""
Generation 1 code. Incorporates only distance, travel always takes one day.
"""

if __name__ == "__main__":
  print("Testing basic data handling and simulation kernel.")

  flee.SimulationSettings.SimulationSettings.MinMoveSpeed=5000.0
  flee.SimulationSettings.SimulationSettings.MaxMoveSpeed=5000.0

  end_time = 200

  e = flee.Ecosystem()

  ig = InputGeography.InputGeography()

  ig.ReadLocationsFromCSV("examples/general_example/locations.csv")

  ig.ReadLinksFromCSV("examples/general_example/routes.csv")

  ig.ReadClosuresFromCSV("examples/general_example/closures.csv")

  e, lm = ig.StoreInputGeographyInEcosystem(e)

  # print("Network data loaded")

  d = handle_refugee_data.RefugeeTable(csvformat="generic", data_directory="examples/general_example/refugee_data/",
                                       start_date="2009-12-24", data_layout="data_layout.csv")


  refugee_debt = 0
  refugees_raw = 0 #raw (interpolated) data from TOTAL UNHCR refugee count only.

  # Visualization
  visoutput = visualization.vis.VisManager(flee.SimulationSettings.SimulationSettings.DefaultVisPath / "general.json")
  start_date = datetime(2009, 12, 24)
  current_date = datetime(2009, 12, 24)
  # Visualization end

  for t in range(0,end_time):
    ig.AddNewConflictZones(e, t)

    # Determine number of new refugees to insert into the system.
    new_refs = d.get_daily_difference(t, FullInterpolation=True) - refugee_debt
    refugees_raw += d.get_daily_difference(t, FullInterpolation=True)
    if new_refs < 0:
      refugee_debt = -new_refs
      new_refs = 0
    elif refugee_debt > 0:
      refugee_debt = 0

    # Insert refugee agents
    for i in range(0, new_refs):
      e.addAgent(e.pick_conflict_location())

    e.refresh_conflict_weights()

    t_data = t

    e.enact_border_closures(t)
    e.evolve()
    # Visualization
    assert t == visoutput.addTimeStep(current_date.strftime("%Y-%m-%d"))
    visoutput.addLocationDataAtTime(t, e.locations)
    current_date = current_date + timedelta(days=1)
    # Visualization end

  # Visualization
  visoutput.setMetaData([48.208176,16.373819], start_date.strftime("%Y-%m-%d"), "General", "General visualization")
  visoutput.saveVisData()
  # Visualization end
  #79 746 24601 14784 38188

