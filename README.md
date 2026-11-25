# NETRA GCS — Rover Monitoring & Ground Control Station

A web-based Rover Monitoring & Ground Control Station (GCS) built with pure **HTML**, **CSS**, **vanilla JavaScript**, and **Three.js**, designed with an aerospace/robotics engineering aesthetic inspired by Foxglove Studio, NASA Open MCT, and QGroundControl.

---

## Features

### 1. 3D Showcase Portal
- Fullscreen Three.js scene featuring a procedural **6-wheel rocker-bogie rover** on a circular metric landing pad with studio lighting and atmospheric dust particles.
- 360° drag-to-orbit and scroll-to-zoom (`OrbitControls`), flanked by rover specification cards (Dimensions, Weight, Powertrain, Max Speed, Sensors).
- Click directly on the 3D rover (via Three.js `Raycaster`) or click **ENTER MISSION CONTROL** for a smooth camera zoom transition into the main GCS dashboard.
- Return to the 3D Showcase anytime using the **3D** button in the top header.

### 2. Mission Control Header
- **Live Status Nodes**: Comms Link (`UDP 5.8 GHz` + latency), GNSS Fix (`RTK Fixed` + satellite count), Bus Power (`24V 6S` pack voltage), Mission Elapsed Time (`MET`), and live `UTC` clock.
- **Interactive Controls**: Navigation Mode selector (`MANUAL`, `HOLD`, `AUTO`, `GUIDED`, `RTL`), **ARM / DISARM** toggle with confirmation modal, **E-STOP** button with confirmation modal, **3D** showcase return, and Fullscreen toggle.

### 3. Multi-Tab Workspace
- **Cockpit**:
  - 5-card KPI strip (Ground Speed, Current Draw, Heading, Pitch/Roll Attitude, Next Waypoint).
  - Dynamic SVG **Primary Flight Display (PFD)** with artificial horizon, pitch ladder, roll rotation, speed/heading readouts, and D-pad / keyboard (`WASD` / Arrow keys / `Space`) `/cmd_vel` controls.
  - SVG **Tactical Map** with geofence boundary, planned waypoint path, traversed trail, and rotating rover marker.
  - **Camera Stream** panel with `RGB` / `Thermal` / `Depth` mode toggles, target bounding-box overlay, **Snapshot** (PNG download), and **REC** indicator.
  - **6-Wheel Drivetrain Matrix** (`FL`, `ML`, `RL`, `FR`, `MR`, `RR`) displaying live RPM, current (A), and temperature (°C).
  - **Telemetry Console** with ROS2/MAVLink-style logs, live text filter, Clear, and Export JSON.
- **3D Model (Digital Twin)**: Interactive Three.js CAD viewport synced live to rover pitch/roll, with camera presets (`Isometric`, `Top`, `Front`, `Side`, `Chase`) and toggles for **Wireframe**, **LiDAR Cone**, and **XYZ Axes**.
- **Optics**: 2×2 multi-camera grid (`Primary 4K`, `Rear Docking`, `Thermal IR`, `Stereo Depth`).
- **Tactical**: Expanded SVG mission map paired with a live Waypoint schedule table (`WP-01` – `WP-08`).
- **Power**: 6S LiPo individual cell voltage bars (`S1`–`S6`) and subsystem power distribution breakdown.
- **Logs**: Fullscreen telemetry log viewer with level filtering (`ALL`, `INFO`, `WARN`, `ERROR`), text search, Clear, and JSON export.
- **Config**: PID controller tuning (`Steering`, `Throttle`, `Heading`) and safety/geofence parameter inputs.

---

## Project Structure

```text
├── index.html   # Application layout, Three.js import map, and modals
├── style.css    # Dark obsidian/slate engineering UI (Amber & Cobalt palette)
├── app.js       # Three.js scenes, telemetry simulation, SVG instruments, & controls
└── README.md    # Project documentation
```

---

## Running Locally

Because `app.js` uses ES modules and an `importmap` for Three.js, serve the directory over a local HTTP server rather than opening `index.html` via `file://`:

```bash
# Using Node.js
npx serve .

# Or using Python 3
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.
